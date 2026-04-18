import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createHmac, timingSafeEqual } from "crypto";

const WEBHOOK_SECRET = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  const hmac = createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(body);
  const expected = hmac.digest("base64");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";

  // Fail closed: if the webhook secret is not configured, reject all requests
  if (!WEBHOOK_SECRET) {
    console.error("Square webhook: SQUARE_WEBHOOK_SIGNATURE_KEY is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!verifySignature(rawBody, signature)) {
    console.error("Square webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const event = JSON.parse(rawBody);
    const eventType = event.type;

    if (eventType === "payment.updated") {
      const payment = event.data?.object?.payment;
      if (!payment?.id) {
        return NextResponse.json({ received: true });
      }

      const supabase = createServiceClient();
      const squareStatus = payment.status; // COMPLETED, FAILED, CANCELLED, etc.

      // Map Square payment status to order status
      let orderStatus: string | undefined;
      if (squareStatus === "COMPLETED") orderStatus = "paid";
      else if (squareStatus === "FAILED") orderStatus = "pending";
      else if (squareStatus === "CANCELLED") orderStatus = "cancelled";

      if (orderStatus) {
        await supabase
          .from("orders")
          .update({ status: orderStatus })
          .eq("square_payment_id", payment.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Square webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
