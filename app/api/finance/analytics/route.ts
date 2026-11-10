import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Transaction from "@/models/Transaction";
import User from "@/models/User";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  const user = await User.findOne({ email: session.user.email }).lean() as { _id: { toString(): string } } | null;
  return user ? String(user._id) : null;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const { searchParams } = new URL(req.url);
  const monthYear = searchParams.get("monthYear") ?? new Date().toISOString().slice(0, 7);
  const [year, month] = monthYear.split("-").map(Number);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  await connectDB();

  const [categoryBreakdown, dailyVelocity, totalIncome, totalExpense] = await Promise.all([
    // Pie chart: expense breakdown by category
    Transaction.aggregate([
      {
        $match: {
          userId: userObjectId,
          type: "EXPENSE",
          date: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$convertedAmountIDR" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),

    // Bar chart: daily expense velocity
    Transaction.aggregate([
      {
        $match: {
          userId: userObjectId,
          type: "EXPENSE",
          date: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: "$date" },
          total: { $sum: "$convertedAmountIDR" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          day: "$_id",
          total: 1,
          _id: 0,
        },
      },
    ]),

    // Total income this month
    Transaction.aggregate([
      {
        $match: {
          userId: userObjectId,
          type: "INCOME",
          date: { $gte: startDate, $lt: endDate },
        },
      },
      { $group: { _id: null, total: { $sum: "$convertedAmountIDR" } } },
    ]),

    // Total expense this month
    Transaction.aggregate([
      {
        $match: {
          userId: userObjectId,
          type: "EXPENSE",
          date: { $gte: startDate, $lt: endDate },
        },
      },
      { $group: { _id: null, total: { $sum: "$convertedAmountIDR" } } },
    ]),
  ]);

  return NextResponse.json({
    monthYear,
    categoryBreakdown,
    dailyVelocity,
    totalIncome: totalIncome[0]?.total ?? 0,
    totalExpense: totalExpense[0]?.total ?? 0,
    netSavings: (totalIncome[0]?.total ?? 0) - (totalExpense[0]?.total ?? 0),
  });
}
