import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

const rateLimit = new Map<string, number[]>();
const RATE_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_MAX = 5;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const timestamps = rateLimit.get(ip)?.filter((t) => now - t < RATE_WINDOW) || [];
    if (timestamps.length >= RATE_MAX) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    timestamps.push(now);
    rateLimit.set(ip, timestamps);

    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const trimmed = email.trim().slice(0, 320);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const supabase = await createClient();

    // Save to Supabase
    const { error: subscriberError } = await supabase
      .from("newsletter_subscribers")
      .upsert({ email: trimmed, subscribed: true }, { onConflict: "email" });

    if (subscriberError) {
      console.error("Newsletter subscriber save failed:", subscriberError);
      return NextResponse.json({ error: "Failed to save subscriber" }, { status: 500 });
    }

    // Sync to Mailchimp if configured — failures must not block subscription
    if (process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_LIST_ID) {
      try {
        const dc = process.env.MAILCHIMP_API_KEY.split("-").pop();
        const subscriberHash = createHash("md5").update(trimmed.toLowerCase()).digest("hex");
        const response = await fetch(
          `https://${dc}.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/members/${subscriberHash}`,
          {
            method: "PUT",
            headers: {
              Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email_address: trimmed,
              status_if_new: "pending",
            }),
          }
        );
        if (!response.ok) {
          console.error("Mailchimp sync failed:", await response.text());
        }
      } catch (mcError) {
        console.error("Mailchimp sync error:", mcError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Newsletter signup error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
