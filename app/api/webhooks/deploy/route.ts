import { NextRequest, NextResponse } from "next/server";
import { broadcastNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.DEPLOY_WEBHOOK_SECRET;

    // Optional secret check if set
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: {
      type?: string;
      payload?: { deployment?: { meta?: { githubCommitMessage?: string; githubCommitSha?: string } } };
      message?: string;
      title?: string;
    } = {};

    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const commitMessage =
      payload.payload?.deployment?.meta?.githubCommitMessage ||
      payload.message ||
      "Latest changes and improvements have been deployed.";

    const commitSha =
      payload.payload?.deployment?.meta?.githubCommitSha?.slice(0, 7) || "";

    const title = payload.title || "App Update Deployed 🚀";
    const message = commitSha
      ? `New version (${commitSha}): ${commitMessage}`
      : `New version deployed: ${commitMessage}`;

    await broadcastNotification({
      type: "SYSTEM",
      title,
      message,
      link: "/",
      metadata: { source: "vercel-deploy", commitSha, commitMessage },
    });

    return NextResponse.json({
      success: true,
      message: "Deployment broadcast sent to active devices",
    });
  } catch (error) {
    console.error("POST /api/webhooks/deploy error:", error);
    return NextResponse.json({ error: "Failed to broadcast deploy update" }, { status: 500 });
  }
}
