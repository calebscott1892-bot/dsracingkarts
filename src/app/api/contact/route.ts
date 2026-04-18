import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Simple in-memory rate limiter (per IP, 3 submissions per 15 minutes)
const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 3;
const RATE_WINDOW = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim().slice(0, 200);
    const email = String(body.email || "").trim().slice(0, 320);
    const subject = String(body.subject || "").trim().slice(0, 200);
    const message = String(body.message || "").trim().slice(0, 5000);

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "DS Racing Karts <noreply@dsracingkarts.com.au>",
      to: "dsracing@bigpond.com",
      replyTo: email,
      subject: `[${safeSubject}] Contact from ${safeName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #e11d48;">New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Name</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safeEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Subject</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${safeSubject}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: bold; vertical-align: top;">Message</td>
              <td style="padding: 8px 12px; white-space: pre-wrap;">${safeMessage}</td>
            </tr>
          </table>
          <hr style="margin-top: 24px; border: none; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #888;">Sent from the DS Racing Karts website contact form.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again later." },
      { status: 500 }
    );
  }
}
