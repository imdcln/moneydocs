import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import SupportTicket from "@/models/SupportTicket";
import User from "@/models/User";

const DEVELOPER_EMAIL = "declane.docs@gmail.com";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const { category, subject, message, contactEmail, deviceInfo } = body;

    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Subject and description are required." },
        { status: 400 }
      );
    }

    await connectDB();

    let user = null;
    if (session?.user?.email) {
      user = await User.findOne({ email: session.user.email }).lean();
    }

    const finalContactEmail =
      contactEmail?.trim() || session?.user?.email || "anonymous@moneydocs.com";
    const finalUserName =
      user?.name || session?.user?.name || "Money Docs User";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ticket: any = await SupportTicket.create({
      userId: user?._id || undefined,
      userName: finalUserName,
      userEmail: session?.user?.email ?? finalContactEmail,
      contactEmail: finalContactEmail,
      targetEmail: DEVELOPER_EMAIL,
      category: category || "General Support",
      subject: subject.trim(),
      message: message.trim(),
      deviceInfo: deviceInfo || {},
      status: "OPEN",
    });

    console.log(
      `[Support Ticket Created] ID: ${ticket._id} | From: ${finalContactEmail} | Subject: "${subject}" -> Target: ${DEVELOPER_EMAIL}`
    );

    return NextResponse.json({
      success: true,
      ticketId: String(ticket._id),
      targetEmail: DEVELOPER_EMAIL,
      createdAt: ticket.createdAt,
    });
  } catch (error) {
    console.error("[Support POST error]:", error);
    return NextResponse.json(
      { error: "Failed to submit support issue." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const tickets = await SupportTicket.find({
      $or: [{ userEmail: session.user.email }, { contactEmail: session.user.email }],
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({
      tickets: tickets.map((t) => ({
        id: String(t._id),
        category: t.category,
        subject: t.subject,
        message: t.message,
        status: t.status,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Support GET error]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
