import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Transaction from "@/models/Transaction";
import User from "@/models/User";
import { getCategoryDisplayName } from "@/lib/categories";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  await connectDB();
  const user = (await User.findOne({ email: session.user.email }).lean()) as {
    _id: { toString(): string };
  } | null;
  return user ? String(user._id) : null;
}

interface TxRecordSummary {
  subCategory?: string;
  description?: string;
  title?: string;
  date?: Date;
}

function extractBestSubCategory(records: TxRecordSummary[]): string | undefined {
  if (!Array.isArray(records) || records.length === 0) return undefined;
  const subCounts: Record<string, number> = {};
  for (const r of records) {
    if (r.subCategory && typeof r.subCategory === "string" && r.subCategory.trim()) {
      subCounts[r.subCategory] = (subCounts[r.subCategory] || 0) + 1;
    }
  }
  const sortedSubs = Object.entries(subCounts).sort((a, b) => b[1] - a[1]);
  return sortedSubs.length > 0 ? sortedSubs[0][0] : undefined;
}

function extractBestDescription(
  records: TxRecordSummary[],
  category: string,
  subCategory?: string
): string | undefined {
  if (!Array.isArray(records) || records.length === 0) return undefined;

  const catName = getCategoryDisplayName(category, subCategory);
  const parentCatName = getCategoryDisplayName(category);
  const rawCat = category.toLowerCase();

  const descCounts: Record<string, { count: number; latestDate: Date }> = {};

  for (const r of records) {
    let d: string | undefined = undefined;
    if (r.description && typeof r.description === "string" && r.description.trim()) {
      d = r.description.trim();
    } else if (r.title && typeof r.title === "string" && r.title.trim()) {
      const trimmed = r.title.trim();
      if (
        trimmed.toLowerCase() !== catName.toLowerCase() &&
        trimmed.toLowerCase() !== parentCatName.toLowerCase() &&
        trimmed.toLowerCase() !== rawCat
      ) {
        d = trimmed;
      }
    }

    if (d) {
      const dDate = r.date ? new Date(r.date) : new Date(0);
      if (!descCounts[d]) {
        descCounts[d] = { count: 1, latestDate: dDate };
      } else {
        descCounts[d].count += 1;
        if (dDate > descCounts[d].latestDate) {
          descCounts[d].latestDate = dDate;
        }
      }
    }
  }

  const sortedDescs = Object.entries(descCounts).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return b[1].latestDate.getTime() - a[1].latestDate.getTime();
  });

  return sortedDescs.length > 0 ? sortedDescs[0][0] : undefined;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const { searchParams } = new URL(req.url);
  const amountParam = searchParams.get("amount");
  const currencyParam = searchParams.get("currency");
  const typeParam = searchParams.get("type");

  await connectDB();

  // Common currency filter: handle TWD / NTD interchangeability
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildCurrencyMatch = (curr: string | null): any => {
    if (!curr) return undefined;
    const c = curr.toUpperCase();
    if (c === "TWD" || c === "NTD") {
      return { $in: ["TWD", "NTD"] };
    }
    return { $regex: new RegExp(`^${curr}$`, "i") };
  };

  // 1. If a specific amount is requested
  if (amountParam !== null && amountParam !== undefined) {
    const numAmount = parseFloat(amountParam);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ suggestion: null });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchQuery: Record<string, any> = {
      userId: userObjectId,
      amount: numAmount,
    };
    if (typeParam) matchQuery.type = typeParam.toUpperCase();
    const currMatch = buildCurrencyMatch(currencyParam);
    if (currMatch) matchQuery.currency = currMatch;

    const stats = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          records: {
            $push: {
              subCategory: "$subCategory",
              description: "$description",
              title: "$title",
              date: "$date",
            },
          },
          latestDate: { $max: "$date" },
        },
      },
      // Frequency requirement: must have at least 3 transactions
      { $match: { count: { $gte: 3 } } },
      // Highest frequency first, tie-break by most recent date
      { $sort: { count: -1, latestDate: -1 } },
      { $limit: 1 },
    ]);

    if (!stats || stats.length === 0) {
      return NextResponse.json({ suggestion: null });
    }

    const top = stats[0];
    const bestSubCategory = extractBestSubCategory(top.records);
    const bestDescription = extractBestDescription(top.records, top._id, bestSubCategory);

    return NextResponse.json({
      suggestion: {
        category: top._id,
        subCategory: bestSubCategory,
        description: bestDescription,
        count: top.count,
      },
    });
  }

  // 2. If no specific amount is passed, return frequent suggestions map (grouped by amount)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generalMatch: Record<string, any> = {
    userId: userObjectId,
  };
  if (typeParam) generalMatch.type = typeParam.toUpperCase();
  const currMatch = buildCurrencyMatch(currencyParam);
  if (currMatch) generalMatch.currency = currMatch;

  const allFrequentStats = await Transaction.aggregate([
    { $match: generalMatch },
    {
      $group: {
        _id: {
          amount: "$amount",
          category: "$category",
        },
        count: { $sum: 1 },
        records: {
          $push: {
            subCategory: "$subCategory",
            description: "$description",
            title: "$title",
            date: "$date",
          },
        },
        latestDate: { $max: "$date" },
      },
    },
    // Must have at least 3 transactions
    { $match: { count: { $gte: 3 } } },
    // Sort by amount, then highest count first, then most recent date
    { $sort: { "_id.amount": 1, count: -1, latestDate: -1 } },
  ]);

  const suggestions: Record<
    string,
    {
      category: string;
      subCategory?: string;
      description?: string;
      count: number;
    }
  > = {};

  for (const item of allFrequentStats) {
    const amtKey = String(item._id.amount);
    // Since items are sorted with highest count first for each amount, the first occurrence is the most frequent
    if (!suggestions[amtKey]) {
      const bestSubCategory = extractBestSubCategory(item.records);
      const bestDescription = extractBestDescription(item.records, item._id.category, bestSubCategory);

      suggestions[amtKey] = {
        category: item._id.category,
        subCategory: bestSubCategory,
        description: bestDescription,
        count: item.count,
      };
    }
  }

  return NextResponse.json({ suggestions });
}
