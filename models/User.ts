import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IUserDevice {
  deviceId: string;
  name: string;
  type: string;
  lastActive: Date;
  isCurrent?: boolean;
}

export interface IPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  deviceId?: string;
  userAgent?: string;
  createdAt?: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  googleId?: string;
  authProvider?: "credentials" | "google";
  isVerified?: boolean;
  emailOtpEnabled?: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  baseCurrency: string;
  defaultWalletId?: Types.ObjectId;
  walletOrder?: Types.ObjectId[];
  hasCompletedOnboarding?: boolean;
  profileColor?: string;
  devices?: IUserDevice[];
  pushSubscriptions?: IPushSubscription[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    image: { type: String },
    googleId: { type: String, sparse: true },
    authProvider: { type: String, enum: ["credentials", "google"], default: "credentials" },
    isVerified: { type: Boolean, default: false },
    emailOtpEnabled: { type: Boolean, default: false },
    verificationCode: { type: String, select: false },
    verificationCodeExpires: { type: Date, select: false },
    baseCurrency: { type: String, default: "IDR" },
    defaultWalletId: { type: Schema.Types.ObjectId, ref: "Wallet" },
    walletOrder: [{ type: Schema.Types.ObjectId, ref: "Wallet" }],
    hasCompletedOnboarding: { type: Boolean, default: false },
    profileColor: { type: String, default: "from-pink-500 to-rose-400" },
    devices: [
      {
        deviceId: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, default: "mobile" },
        lastActive: { type: Date, default: Date.now },
        isCurrent: { type: Boolean, default: false },
      },
    ],
    pushSubscriptions: [
      {
        endpoint: { type: String, required: true },
        keys: {
          p256dh: { type: String, required: true },
          auth: { type: String, required: true },
        },
        deviceId: { type: String },
        userAgent: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
