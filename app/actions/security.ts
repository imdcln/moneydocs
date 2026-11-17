"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Account from "@/models/Account";
import { createAndSendNotification } from "@/lib/notifications";

export interface SecurityStatus {
  hasPassword: boolean;
  isGoogleLinked: boolean;
  googleId?: string | null;
  email: string;
  isVerified: boolean;
  authProvider: string;
  canUnlinkGoogle: boolean;
  canRemovePassword: boolean;
  accounts: {
    provider: string;
    providerAccountId: string;
    createdAt?: Date;
  }[];
}

/**
 * Get the current user's authentication and security status
 */
export async function getSecurityStatusAction(): Promise<{
  success: boolean;
  status?: SecurityStatus;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select("+password +passwordHash");
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const accounts = await Account.find({ userId: user._id }).lean();
    const hasPassword = Boolean(user.passwordHash || user.password);
    const googleAccount = accounts.find((a) => a.provider === "google");
    const isGoogleLinked = Boolean(user.googleId || googleAccount);

    // Lockout prevention rules:
    // 1. Cannot unlink Google if passwordHash is null (no password set)
    // 2. Cannot remove password if no OAuth provider is linked
    const canUnlinkGoogle = hasPassword;
    const canRemovePassword = isGoogleLinked;

    return {
      success: true,
      status: {
        hasPassword,
        isGoogleLinked,
        googleId: user.googleId || googleAccount?.providerAccountId || null,
        email: user.email,
        isVerified: Boolean(user.isVerified || isGoogleLinked),
        authProvider: user.authProvider || (isGoogleLinked ? "google" : "credentials"),
        canUnlinkGoogle,
        canRemovePassword,
        accounts: accounts.map((a) => ({
          provider: a.provider,
          providerAccountId: a.providerAccountId,
          createdAt: a.createdAt,
        })),
      },
    };
  } catch (err) {
    console.error("[getSecurityStatusAction error]:", err);
    return { success: false, error: "Failed to fetch security status." };
  }
}

/**
 * Unlink Google account with strict lockout prevention:
 * Rejects if user has no password set (passwordHash is null/empty).
 */
export async function unlinkGoogleAction(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select("+password +passwordHash");
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // STRICT LOCKOUT PREVENTION: User cannot unlink Google if passwordHash is null
    const hasPassword = Boolean(user.passwordHash || user.password);
    if (!hasPassword) {
      return {
        success: false,
        error: "Lockout prevention: You cannot unlink Google because no password is set. Please set a password first.",
      };
    }

    // Remove Google account mapping and clear googleId
    await Account.deleteMany({ userId: user._id, provider: "google" });
    user.googleId = undefined;
    if (user.authProvider === "google") {
      user.authProvider = "credentials";
    }
    await user.save();

    // Send security notification
    createAndSendNotification({
      userId: user._id,
      type: "SECURITY",
      title: "Google Account Unlinked ⚠️",
      message: "Your Google account was unlinked. You can continue signing in with your email and password.",
      link: "/account/my-account",
    }).catch((e) => console.error("[unlinkGoogleAction] notification error:", e));

    return { success: true, message: "Google account unlinked successfully." };
  } catch (err) {
    console.error("[unlinkGoogleAction error]:", err);
    return { success: false, error: "Failed to unlink Google account." };
  }
}

/**
 * Set password (for Google OAuth users who don't have a password yet)
 * or change password (for users with existing passwords)
 */
export async function setOrChangePasswordAction(data: {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    const { currentPassword, newPassword, confirmPassword } = data;

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: "New password must be at least 6 characters long." };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "New passwords do not match." };
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select("+password +passwordHash");
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const hasExistingPassword = Boolean(user.passwordHash || user.password);

    // If existing password exists, verify current password
    if (hasExistingPassword) {
      if (!currentPassword) {
        return { success: false, error: "Current password is required to change password." };
      }
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash || user.password!);
      if (!isMatch) {
        return { success: false, error: "Incorrect current password." };
      }
    }

    // Hash and store in both password and passwordHash
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.passwordHash = hashedPassword;
    user.password = hashedPassword;
    await user.save();

    // Ensure Account record for credentials exists
    await Account.findOneAndUpdate(
      { userId: user._id, provider: "credentials" },
      {
        userId: user._id,
        provider: "credentials",
        providerAccountId: user.email.toLowerCase().trim(),
        emailVerified: user.isVerified || false,
        type: "credentials",
      },
      { upsert: true, new: true }
    );

    createAndSendNotification({
      userId: user._id,
      type: "SECURITY",
      title: hasExistingPassword ? "Password Changed 🔐" : "Password Set 🔐",
      message: hasExistingPassword
        ? "Your account password was updated successfully."
        : "A password has been successfully set for your account. You can now log in using email and password.",
      link: "/account/my-account",
    }).catch((e) => console.error("[setPasswordAction] notification error:", e));

    return {
      success: true,
      message: hasExistingPassword ? "Password updated successfully." : "Password created successfully.",
    };
  } catch (err) {
    console.error("[setOrChangePasswordAction error]:", err);
    return { success: false, error: "Failed to update password." };
  }
}

/**
 * Remove password with strict lockout prevention:
 * Rejects if user does not have an OAuth provider (e.g. Google) linked.
 */
export async function removePasswordAction(currentPassword: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).select("+password +passwordHash");
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // STRICT LOCKOUT PREVENTION: Cannot remove password if no OAuth provider is linked
    const accounts = await Account.find({ userId: user._id }).lean();
    const hasGoogle = Boolean(user.googleId || accounts.some((a) => a.provider === "google"));

    if (!hasGoogle) {
      return {
        success: false,
        error: "Lockout prevention: Cannot remove password. You must have Google or an OAuth provider linked before removing your password.",
      };
    }

    // Verify current password first
    const hasExistingPassword = Boolean(user.passwordHash || user.password);
    if (hasExistingPassword) {
      if (!currentPassword) {
        return { success: false, error: "Current password is required to remove password." };
      }
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash || user.password!);
      if (!isMatch) {
        return { success: false, error: "Incorrect password." };
      }
    }

    // Remove password
    user.passwordHash = null;
    user.password = null;
    user.authProvider = "google";
    await user.save();

    await Account.deleteMany({ userId: user._id, provider: "credentials" });

    createAndSendNotification({
      userId: user._id,
      type: "SECURITY",
      title: "Password Removed ⚠️",
      message: "Password authentication was removed. You must now sign in using your linked Google account.",
      link: "/account/my-account",
    }).catch((e) => console.error("[removePasswordAction] notification error:", e));

    return { success: true, message: "Password removed successfully. Your Google account remains active." };
  } catch (err) {
    console.error("[removePasswordAction error]:", err);
    return { success: false, error: "Failed to remove password." };
  }
}
