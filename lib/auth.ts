import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { decode } from "next-auth/jwt";
import { authConfig } from "@/auth.config";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Account from "@/models/Account";
import { registerOrUpdateDevice } from "@/lib/deviceManager";
import { generateCollisionToken } from "@/lib/tokenUtils";

export const isGoogleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  !process.env.GOOGLE_CLIENT_ID.startsWith("REPLACE")
);

const ONE_DAY_SECONDS = 24 * 60 * 60;
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        stayLoggedIn: { label: "Stay Logged In", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.warn("[NextAuth:Credentials] Missing email or password");
          return null;
        }

        try {
          await connectDB();
          const email = String(credentials.email).toLowerCase().trim();
          const user = await User.findOne({ email }).select("+password +passwordHash");

          if (!user) {
            console.warn(`[NextAuth:Credentials] User not found: ${email}`);
            return null;
          }

          const userPassword = user.passwordHash || user.password;
          if (!userPassword) {
            console.warn(`[NextAuth:Credentials] User ${email} has no password set (OAuth account)`);
            return null;
          }

          const isValid = await bcrypt.compare(String(credentials.password), userPassword);
          if (!isValid) {
            console.warn(`[NextAuth:Credentials] Invalid password for user: ${email}`);
            return null;
          }

          // Maintain Account mapping for credentials
          await Account.findOneAndUpdate(
            { provider: "credentials", providerAccountId: email },
            {
              userId: user._id,
              provider: "credentials",
              providerAccountId: email,
              emailVerified: Boolean(user.isVerified),
              type: "credentials",
            },
            { upsert: true, setDefaultsOnInsert: true }
          ).catch((e) => console.error("[NextAuth:Account] credentials upsert error:", e));

          return {
            id: String(user._id),
            name: user.name,
            email: user.email,
            stayLoggedIn: credentials.stayLoggedIn === "1",
          };
        } catch (dbError) {
          console.error("[NextAuth:Credentials] DB error during authorize:", dbError);
          throw dbError;
        }
      },
    }),
    ...(isGoogleConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  secret: process.env.AUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === "production",
  session: { strategy: "jwt", maxAge: THIRTY_DAYS_SECONDS },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "credentials") {
        if (user?.id) {
          try {
            const { headers, cookies } = await import("next/headers");
            const headerList = await headers();
            const cookieStore = await cookies();
            const ua = headerList.get("user-agent") || "";
            const cookieDeviceId = cookieStore.get("dclne_device_id")?.value;
            const headerDeviceId = headerList.get("x-device-id");
            const clientDeviceId = (headerDeviceId || cookieDeviceId || "").trim();
            await registerOrUpdateDevice({
              userId: user.id,
              userAgent: ua,
              clientDeviceId,
              sendNotification: false,
            });
          } catch (devErr) {
            console.error("[auth:credentials] device register error:", devErr);
          }
        }
        return true;
      }

      if (account?.provider === "google") {
        try {
          if (!user.email) return false;

          await connectDB();
          const cleanEmail = user.email.toLowerCase().trim();
          const { headers, cookies } = await import("next/headers");
          const cookieStore = await cookies();
          const headerList = await headers();

          // 1. Check if the user is already logged in (connecting Google from account settings)
          const sessionCookie =
            cookieStore.get("__Secure-authjs.session-token")?.value ||
            cookieStore.get("authjs.session-token")?.value ||
            cookieStore.get("__Secure-next-auth.session-token")?.value ||
            cookieStore.get("next-auth.session-token")?.value;

          if (sessionCookie) {
            try {
              const salt =
                cookieStore.get("__Secure-authjs.session-token") ||
                cookieStore.get("__Secure-next-auth.session-token")
                  ? cookieStore.get("__Secure-authjs.session-token")
                    ? "__Secure-authjs.session-token"
                    : "__Secure-next-auth.session-token"
                  : cookieStore.get("authjs.session-token")
                  ? "authjs.session-token"
                  : "next-auth.session-token";

              const decoded = await decode({
                token: sessionCookie,
                secret: process.env.AUTH_SECRET!,
                salt,
              });

              if (decoded?.userId) {
                const loggedInUser = await User.findById(decoded.userId);
                if (loggedInUser) {
                  // --- Email match guard: reject if Google email ≠ logged-in user email ---
                  if (cleanEmail !== loggedInUser.email.toLowerCase().trim()) {
                    console.warn(
                      `[auth:google link] Email mismatch: session=${loggedInUser.email} google=${cleanEmail}`
                    );
                    return `/account/my-account?error=GoogleEmailMismatch&expected=${encodeURIComponent(loggedInUser.email)}`;
                  }

                  // Verify that this Google account isn't already claimed by another user
                  const existingAcc = await Account.findOne({
                    provider: "google",
                    providerAccountId: account.providerAccountId,
                  });
                  if (
                    existingAcc &&
                    String(existingAcc.userId) !== String(loggedInUser._id)
                  ) {
                    return "/account/my-account?error=GoogleAccountAlreadyLinkedToOther";
                  }

                  loggedInUser.googleId = account.providerAccountId;
                  // Mark account as verified when Google is linked
                  loggedInUser.isVerified = true;
                  await loggedInUser.save();

                  await Account.findOneAndUpdate(
                    { provider: "google", providerAccountId: account.providerAccountId },
                    {
                      userId: loggedInUser._id,
                      provider: "google",
                      providerAccountId: account.providerAccountId,
                      emailVerified: true,
                      type: "oauth",
                    },
                    { upsert: true, new: true }
                  );

                  // Also update the credentials account emailVerified if present
                  await Account.findOneAndUpdate(
                    { provider: "credentials", providerAccountId: cleanEmail },
                    { emailVerified: true },
                    { new: false }
                  );

                  return "/account/my-account?linked=google";
                }
              }
            } catch (linkErr) {
              console.error("[auth:google link-session error]:", linkErr);
            }
          }

          // 2. Incoming Google sign-in / registration
          const existingUser = await User.findOne({ email: cleanEmail }).select(
            "+password +passwordHash"
          );

          let targetUser = existingUser;

          if (!existingUser) {
            // First-time user onboarding: frictionless log in to dashboard without password prompt
            targetUser = await User.create({
              name: user.name ?? cleanEmail.split("@")[0],
              email: cleanEmail,
              image: user.image ?? undefined,
              googleId: account.providerAccountId,
              passwordHash: null,
              password: null,
              authProvider: "google",
              isVerified: true,
              baseCurrency: "IDR",
              hasCompletedOnboarding: false,
            });

            await Account.findOneAndUpdate(
              { provider: "google", providerAccountId: account.providerAccountId },
              {
                userId: targetUser._id,
                provider: "google",
                providerAccountId: account.providerAccountId,
                emailVerified: true,
                type: "oauth",
              },
              { upsert: true, new: true }
            );
          } else {
            const hasExistingPassword = Boolean(
              existingUser.passwordHash || existingUser.password
            );

            // If account was already registered with Google or has no password set
            if (
              existingUser.googleId === account.providerAccountId ||
              !hasExistingPassword
            ) {
              if (!existingUser.googleId) {
                existingUser.googleId = account.providerAccountId;
              }
              existingUser.isVerified = true;
              await existingUser.save();

              await Account.findOneAndUpdate(
                { provider: "google", providerAccountId: account.providerAccountId },
                {
                  userId: existingUser._id,
                  provider: "google",
                  providerAccountId: account.providerAccountId,
                  emailVerified: true,
                  type: "oauth",
                },
                { upsert: true, new: true }
              );
            } else if (existingUser.isVerified) {
              // Collision handling: Automatically link Google to an existing VERIFIED email/password account
              existingUser.googleId = account.providerAccountId;
              await existingUser.save();

              await Account.findOneAndUpdate(
                { provider: "google", providerAccountId: account.providerAccountId },
                {
                  userId: existingUser._id,
                  provider: "google",
                  providerAccountId: account.providerAccountId,
                  emailVerified: true,
                  type: "oauth",
                },
                { upsert: true, new: true }
              );

              // Maintain credentials Account mapping as well
              await Account.findOneAndUpdate(
                { provider: "credentials", providerAccountId: cleanEmail },
                {
                  userId: existingUser._id,
                  provider: "credentials",
                  providerAccountId: cleanEmail,
                  emailVerified: true,
                  type: "credentials",
                },
                { upsert: true, setDefaultsOnInsert: true }
              );
            } else {
              // Collision handling: Existing UNVERIFIED email/password account!
              // Require existing password to confirm ownership before linking
              const collisionToken = generateCollisionToken({
                email: cleanEmail,
                providerAccountId: account.providerAccountId,
                name: user.name || "",
                image: user.image || "",
              });

              return `/auth/signin?collision=unverified&email=${encodeURIComponent(
                cleanEmail
              )}&token=${encodeURIComponent(collisionToken)}`;
            }
          }

          if (targetUser) {
            try {
              const ua = headerList.get("user-agent") || "";
              const cookieDeviceId = cookieStore.get("dclne_device_id")?.value;
              const headerDeviceId = headerList.get("x-device-id");
              const clientDeviceId = (
                headerDeviceId ||
                cookieDeviceId ||
                ""
              ).trim();
              await registerOrUpdateDevice({
                userId: targetUser._id,
                userAgent: ua,
                clientDeviceId,
                sendNotification: true,
              });
            } catch (devErr) {
              console.error("[auth:google] device register error:", devErr);
            }
          }

          return true;
        } catch (err) {
          console.error("[auth] signIn callback error:", err);
          return false;
        }
      }

      return false;
    },

    async jwt({ token, user, account, trigger }) {
      const isFirstSignIn = !!user;
      const isUpdate = trigger === "update";

      if (isFirstSignIn) {
        delete token.picture;
        delete token.name;

        if (account?.provider === "credentials") {
          const stay = (user as { stayLoggedIn?: boolean }).stayLoggedIn ?? true;
          token.stayLoggedIn = stay;
          token.sessionExpiry =
            Math.floor(Date.now() / 1000) +
            (stay ? THIRTY_DAYS_SECONDS : ONE_DAY_SECONDS);
        }

        const email = user.email || token.email;
        if (email) {
          try {
            await connectDB();
            const dbUser = (await User.findOne(
              { email: String(email).toLowerCase().trim() },
              {
                _id: 1,
                baseCurrency: 1,
                authProvider: 1,
                googleId: 1,
                isVerified: 1,
                passwordHash: 1,
                password: 1,
              }
            )
              .select("+password +passwordHash")
              .lean()) as {
              _id: unknown;
              baseCurrency?: string;
              authProvider?: string;
              googleId?: string;
              isVerified?: boolean;
              passwordHash?: string | null;
              password?: string | null;
            } | null;

            if (dbUser) {
              token.userId = String(dbUser._id);
              token.baseCurrency = dbUser.baseCurrency ?? "IDR";
              const provider =
                dbUser.authProvider ||
                (dbUser.googleId ? "google" : "credentials");
              token.authProvider = provider;
              const isGoogleLinked = Boolean(dbUser.googleId);
              const isVerified =
                provider === "google" || isGoogleLinked
                  ? true
                  : Boolean(dbUser.isVerified);
              token.isVerified = isVerified;
              token.hasPassword = Boolean(
                dbUser.passwordHash || dbUser.password
              );
              token.isGoogleLinked = isGoogleLinked;
              // Stable derived field: how the account is verified
              token.emailVerifiedVia =
                provider === "google"
                  ? "google"
                  : isGoogleLinked
                  ? "google-linked"
                  : isVerified
                  ? "email"
                  : "unverified";
            }
          } catch {
            // non-fatal
          }
        }
      }

      if (token.stayLoggedIn === false && token.sessionExpiry) {
        const now = Math.floor(Date.now() / 1000);
        if (now > (token.sessionExpiry as number)) {
          return null as unknown as typeof token;
        }
      }

      if (isUpdate && token.email) {
        try {
          await connectDB();
          const dbUser = (await User.findOne(
            { email: String(token.email).toLowerCase().trim() },
            {
              _id: 1,
              baseCurrency: 1,
              authProvider: 1,
              googleId: 1,
              isVerified: 1,
              passwordHash: 1,
              password: 1,
            }
          )
            .select("+password +passwordHash")
            .lean()) as {
            _id: unknown;
            baseCurrency?: string;
            authProvider?: string;
            googleId?: string;
            isVerified?: boolean;
            passwordHash?: string | null;
            password?: string | null;
          } | null;

          if (dbUser) {
            token.userId = String(dbUser._id);
            token.baseCurrency = dbUser.baseCurrency ?? "IDR";
            const provider =
              dbUser.authProvider ||
              (dbUser.googleId ? "google" : "credentials");
            token.authProvider = provider;
            const isGoogleLinked = Boolean(dbUser.googleId);
            const isVerified =
              provider === "google" || isGoogleLinked
                ? true
                : Boolean(dbUser.isVerified);
            token.isVerified = isVerified;
            token.hasPassword = Boolean(dbUser.passwordHash || dbUser.password);
            token.isGoogleLinked = isGoogleLinked;
            // Stable derived field: how the account is verified
            token.emailVerifiedVia =
              provider === "google"
                ? "google"
                : isGoogleLinked
                ? "google-linked"
                : isVerified
                ? "email"
                : "unverified";
          }
        } catch {
          // non-fatal
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      if (token.baseCurrency) {
        (session as { baseCurrency?: string }).baseCurrency =
          token.baseCurrency as string;
      }
      const u = session.user as unknown as {
        isVerified?: boolean;
        authProvider?: string;
        hasPassword?: boolean;
        isGoogleLinked?: boolean;
        emailVerifiedVia?: string;
      };
      u.isVerified = token.isVerified as boolean;
      u.authProvider = token.authProvider as string;
      u.hasPassword = token.hasPassword as boolean;
      u.isGoogleLinked = token.isGoogleLinked as boolean;
      u.emailVerifiedVia = token.emailVerifiedVia as string | undefined;
      return session;
    },
  },
});
