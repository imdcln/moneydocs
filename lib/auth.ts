import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { registerOrUpdateDevice } from "@/lib/deviceManager";

export const isGoogleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  !process.env.GOOGLE_CLIENT_ID.startsWith("REPLACE")
);

const ONE_DAY_SECONDS = 24 * 60 * 60;
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
          const user = await User.findOne({ email }).select("+password");

          if (!user) {
            console.warn(`[NextAuth:Credentials] User not found: ${email}`);
            return null;
          }

          if (!user.password) {
            console.warn(`[NextAuth:Credentials] User ${email} has no password set (OAuth account)`);
            return null;
          }

          const isValid = await bcrypt.compare(String(credentials.password), user.password);
          if (!isValid) {
            console.warn(`[NextAuth:Credentials] Invalid password for user: ${email}`);
            return null;
          }

          return {
            id: String(user._id),
            name: user.name,
            email: user.email,
            // Do NOT return image here — Google picture URLs are very long and
            // NextAuth stores them in the JWT cookie, which can cause 431 errors.
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
              sendNotification: false, // Avoid duplicate notifications if already handled in login route
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
          const existingUser = await User.findOne({ email: cleanEmail });

          let targetUser = existingUser;
          if (!existingUser) {
            targetUser = await User.create({
              name: user.name ?? cleanEmail.split("@")[0],
              email: cleanEmail,
              image: user.image ?? undefined,
              googleId: account.providerAccountId,
              authProvider: "google",
              isVerified: true,
              baseCurrency: "IDR",
              hasCompletedOnboarding: false,
            });
          } else {
            if (!existingUser.googleId) {
              existingUser.googleId = account.providerAccountId;
            }
            existingUser.isVerified = true;
            if (!existingUser.authProvider) {
              existingUser.authProvider = "google";
            }
            await existingUser.save();
          }

          if (targetUser) {
            try {
              const { headers, cookies } = await import("next/headers");
              const headerList = await headers();
              const cookieStore = await cookies();
              const ua = headerList.get("user-agent") || "";
              const cookieDeviceId = cookieStore.get("dclne_device_id")?.value;
              const headerDeviceId = headerList.get("x-device-id");
              const clientDeviceId = (headerDeviceId || cookieDeviceId || "").trim();
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

      // ── First sign-in ────────────────────────────────────────────────────────
      if (isFirstSignIn) {
        // Strip large fields NextAuth copies from the user/profile object
        // `picture` can be a very long Google CDN URL — never store it in the token
        delete token.picture;
        delete token.name;

        // For credentials: store session-length preference
        if (account?.provider === "credentials") {
          const stay = (user as { stayLoggedIn?: boolean }).stayLoggedIn ?? true;
          token.stayLoggedIn = stay;
          token.sessionExpiry =
            Math.floor(Date.now() / 1000) + (stay ? THIRTY_DAYS_SECONDS : ONE_DAY_SECONDS);
        }

        // Fetch ONLY the fields we need — never pull devices/pushSubscriptions
        const email = user.email || token.email;
        if (email) {
          try {
            await connectDB();
            const dbUser = await User.findOne(
              { email: String(email).toLowerCase().trim() },
              { _id: 1, baseCurrency: 1, authProvider: 1, googleId: 1, isVerified: 1 }
            ).lean() as {
              _id: unknown;
              baseCurrency?: string;
              authProvider?: string;
              googleId?: string;
              isVerified?: boolean;
            } | null;

            if (dbUser) {
              token.userId = String(dbUser._id);
              token.baseCurrency = dbUser.baseCurrency ?? "IDR";
              const provider =
                dbUser.authProvider || (dbUser.googleId ? "google" : "credentials");
              token.authProvider = provider;
              token.isVerified =
                provider === "google" ? true : Boolean(dbUser.isVerified);
            }
          } catch {
            // non-fatal
          }
        }
      }

      // ── Short-session expiry check (every request) ───────────────────────────
      if (token.stayLoggedIn === false && token.sessionExpiry) {
        const now = Math.floor(Date.now() / 1000);
        if (now > (token.sessionExpiry as number)) {
          return null as unknown as typeof token;
        }
      }

      // ── Explicit session update (e.g. user changes baseCurrency) ────────────
      if (isUpdate && token.email) {
        try {
          await connectDB();
          const dbUser = await User.findOne(
            { email: String(token.email).toLowerCase().trim() },
            { _id: 1, baseCurrency: 1, authProvider: 1, googleId: 1, isVerified: 1 }
          ).lean() as {
            _id: unknown;
            baseCurrency?: string;
            authProvider?: string;
            googleId?: string;
            isVerified?: boolean;
          } | null;

          if (dbUser) {
            token.userId = String(dbUser._id);
            token.baseCurrency = dbUser.baseCurrency ?? "IDR";
            const provider =
              dbUser.authProvider || (dbUser.googleId ? "google" : "credentials");
            token.authProvider = provider;
            token.isVerified =
              provider === "google" ? true : Boolean(dbUser.isVerified);
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
        (session as { baseCurrency?: string }).baseCurrency = token.baseCurrency as string;
      }
      (session.user as unknown as { isVerified?: boolean; authProvider?: string }).isVerified = token.isVerified as boolean;
      (session.user as unknown as { isVerified?: boolean; authProvider?: string }).authProvider = token.authProvider as string;
      return session;
    },
  },
});
