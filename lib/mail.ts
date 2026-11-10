import nodemailer from "nodemailer";

interface SendVerificationEmailOptions {
  to: string;
  name?: string;
  code: string;
}

interface SendEmailResult {
  success: boolean;
  simulated?: boolean;
  code?: string;
  messageId?: string;
  error?: string;
}

export async function sendVerificationEmail({
  to,
  name,
  code,
}: SendVerificationEmailOptions): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD;
  const rawFrom =
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    `"Money Docs" <${user || "noreply@moneydocs.local"}>`;
  // Sanitize potential backslash escapes (e.g. \" from .env files) that break RFC 5321 envelope sender syntax
  const from = rawFrom.replace(/\\/g, "").trim();

  const isConfigured = Boolean(host && user && pass);

  if (!isConfigured) {
    console.warn(`[mail] SMTP environment variables not configured. Unable to send verification email to ${to}.`);
    return {
      success: false,
      error: "Email delivery service is currently not configured on this server (missing SMTP settings in .env).",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      // Prefer IPv4 to avoid ENETUNREACH issues on environments without IPv6 routes
      family: 4,
    } as any);

    const displayName = name || to.split("@")[0];

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your Money Docs account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0c10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0c10; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #141519; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 36px 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
                Money Docs
              </div>
              <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
                Email Verification
              </div>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding-bottom: 24px; font-size: 14px; line-height: 1.6; color: #cbd5e1; text-align: center;">
              Hello <strong style="color: #ffffff;">${displayName}</strong>,<br>
              Use the 6-digit verification code below to verify your email address.
            </td>
          </tr>

          <!-- Code Box -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="background-color: #1a1d26; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; padding: 18px 24px; display: inline-block; letter-spacing: 10px; font-size: 32px; font-weight: 800; color: #38bdf8; font-family: monospace;">
                ${code}
              </div>
            </td>
          </tr>

          <!-- Expiry Notice -->
          <tr>
            <td align="center" style="padding-bottom: 24px; font-size: 12px; color: #64748b;">
              This code will expire in <strong style="color: #94a3b8;">15 minutes</strong>. If you did not request this verification, you can safely ignore this email.
            </td>
          </tr>

          <!-- Footer Divider -->
          <tr>
            <td style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 20px; font-size: 11px; color: #475569; text-align: center;">
              Money Docs &bull; Personal Money &amp; Debt Management
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const info = await transporter.sendMail({
      from,
      to,
      subject: `${code} is your Money Docs verification code`,
      text: `Your verification code is: ${code}. It expires in 15 minutes.`,
      html: htmlContent,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[mail send error]:", errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
