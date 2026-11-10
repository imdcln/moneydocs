import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Wallet from "@/models/Wallet";
import User from "@/models/User";
import { createAndSendNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const user = (await User.findOne({ email: session.user.email })
    .select("_id email name")
    .lean()) as { _id: mongoose.Types.ObjectId; email: string; name?: string } | null;

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { walletId, action } = body; // action: "ACCEPT" | "DECLINE"

  if (!walletId || !["ACCEPT", "DECLINE"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(walletId)) {
    return NextResponse.json({ error: "Invalid wallet ID" }, { status: 400 });
  }

  const userEmail = user.email.toLowerCase();

  // Find the wallet that has a PENDING invite for this user
  const wallet = await Wallet.findOne({
    _id: walletId,
    sharedWith: { $elemMatch: { email: userEmail, status: "PENDING" } },
  });

  if (!wallet) {
    return NextResponse.json({ error: "Invitation not found or already responded" }, { status: 404 });
  }

  if (action === "ACCEPT") {
    await Wallet.updateOne(
      { _id: walletId, "sharedWith.email": userEmail },
      {
        $set: {
          "sharedWith.$.status": "ACCEPTED",
          "sharedWith.$.name": user.name || "",
        },
      }
    );

    // Notify the wallet owner that user accepted
    if (wallet.userId) {
      await createAndSendNotification({
        userId: wallet.userId,
        type: "WALLET_INVITE",
        title: "Invitation Accepted",
        message: `${user.name || userEmail} accepted your invitation to collaborate on "${wallet.name}"`,
        link: "/account",
        metadata: {
          walletId: wallet._id.toString(),
          walletName: wallet.name,
        },
      });
    }
  } else {
    // DECLINE: remove entry entirely
    await Wallet.updateOne(
      { _id: walletId },
      { $pull: { sharedWith: { email: userEmail } } }
    );
  }

  return NextResponse.json({ ok: true });
}
