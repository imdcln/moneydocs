/**
 * Database Seeder
 * Run with: npx tsx lib/seed.ts <your-email@gmail.com>
 *
 * Seeds default wallets for a given user. Category constants are
 * defined here for use across the app — not stored in DB (statically defined).
 */

import { connectDB } from "./mongoose";
import User from "../models/User";
import Wallet, { WalletType } from "../models/Wallet";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, DEBT_CATEGORIES } from "./categories";

export { EXPENSE_CATEGORIES, INCOME_CATEGORIES, DEBT_CATEGORIES };

// ─── Default Wallets ──────────────────────────────────────────────────────────

const DEFAULT_WALLETS: Array<{
  name: string;
  icon: string;
  type: WalletType;
  balance: number;
  currency: string;
  isDefault?: boolean;
}> = [
  { name: "Cash", icon: "💵", type: "CASH", balance: 500000, currency: "IDR", isDefault: true },
  { name: "BCA Bank", icon: "🏦", type: "BANK", balance: 5000000, currency: "IDR" },
  { name: "GoPay", icon: "🟢", type: "E_WALLET", balance: 200000, currency: "IDR" },
  { name: "OVO", icon: "🟣", type: "E_WALLET", balance: 150000, currency: "IDR" },
];

// ─── Seed Script ──────────────────────────────────────────────────────────────

async function seed() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx lib/seed.ts <email>");
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User not found: ${email}. Sign in via Google first.`);
    process.exit(1);
  }

  console.log(`Seeding for user: ${user.name} (${user.email})`);

  for (const w of DEFAULT_WALLETS) {
    const exists = await Wallet.findOne({ userId: user._id, name: w.name });
    if (!exists) {
      await Wallet.create({ ...w, userId: user._id });
      console.log(`  ✓ Created wallet: ${w.name}`);
    } else {
      console.log(`  – Wallet already exists: ${w.name}`);
    }
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
