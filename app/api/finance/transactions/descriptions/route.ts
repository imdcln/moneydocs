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

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.toLowerCase().trim();

  // Category + subCategory filtering — both required to be specific
  const categoryFilter = searchParams.get("category")?.trim();
  const subCategoryFilter = searchParams.get("subCategory")?.trim() || null;

  // Require a category — no category means no results
  if (!categoryFilter) {
    return NextResponse.json({ descriptions: [] });
  }

  const limitParam = parseInt(searchParams.get("limit") || "60");
  const limit = Math.min(100, Math.max(1, isNaN(limitParam) ? 60 : limitParam));

  await connectDB();

  // Build the MongoDB query — filter to the exact category (+ optional subCategory) at DB level
  const dbQuery: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    category: categoryFilter,
  };

  if (subCategoryFilter) {
    // When a subCategory is selected, only return descriptions from that exact subCategory
    dbQuery.subCategory = subCategoryFilter;
  } else {
    // When only the parent category is selected (no subCategory chosen),
    // return descriptions from transactions where subCategory is absent/null
    dbQuery.$or = [{ subCategory: { $exists: false } }, { subCategory: null }, { subCategory: "" }];
  }

  const txs = await Transaction.find(
    dbQuery,
    { title: 1, description: 1, category: 1, subCategory: 1, date: 1 }
  )
    .sort({ date: -1 })
    .lean();

  const freqMap = new Map<string, { count: number; latestDate: Date }>();

  for (const tx of txs) {
    let desc: string | undefined = undefined;

    if (tx.description && typeof tx.description === "string" && tx.description.trim()) {
      desc = tx.description.trim();
    } else if (tx.title && typeof tx.title === "string" && tx.title.trim()) {
      const trimmedTitle = tx.title.trim();
      const catName = getCategoryDisplayName(tx.category || "", tx.subCategory);
      const parentCatName = getCategoryDisplayName(tx.category || "");
      const rawCat = (tx.category || "").toLowerCase();

      // Skip if title is merely the category name
      if (
        trimmedTitle.toLowerCase() !== catName.toLowerCase() &&
        trimmedTitle.toLowerCase() !== parentCatName.toLowerCase() &&
        trimmedTitle.toLowerCase() !== rawCat
      ) {
        desc = trimmedTitle;
      }
    }

    if (!desc) continue;

    // Filter by search query if provided
    if (search && !desc.toLowerCase().includes(search)) {
      continue;
    }

    const txDate = tx.date ? new Date(tx.date) : new Date(0);
    const existing = freqMap.get(desc);
    if (existing) {
      existing.count += 1;
      if (txDate > existing.latestDate) {
        existing.latestDate = txDate;
      }
    } else {
      freqMap.set(desc, { count: 1, latestDate: txDate });
    }
  }

  // Sort by count desc (most frequent first), then most recent date desc
  const sorted = Array.from(freqMap.entries())
    .sort((a, b) => {
      if (b[1].count !== a[1].count) {
        return b[1].count - a[1].count;
      }
      return b[1].latestDate.getTime() - a[1].latestDate.getTime();
    })
    .slice(0, limit)
    .map(([desc]) => desc);

  return NextResponse.json({ descriptions: sorted });
}
