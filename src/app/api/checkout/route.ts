import { NextRequest, NextResponse } from "next/server";
import { getSquareClient, SQUARE_LOCATION_ID } from "@/lib/square";
import { createServiceClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { Resend } from "resend";

/**
 * POST /api/checkout
 *
 * Accepts:
 *   - sourceId: Square payment token from Web Payments SDK
 *   - idempotencyKey: client-generated key to prevent duplicate charges
 *   - cart: { items: CartItem[], subtotal: number }
 *   - customer: { email, name, phone, address }
 *
 * Flow:
 *   1. Validate cart items against DB (prices)
 *   2. Create order in Supabase with status "pending"
 *   3. Create Square payment
 *   4. Update order to "paid" (or clean up on failure)
 *   5. Decrement inventory
 *   6. Return order confirmation
 */

const rateLimit = new Map<string, number[]>();
const RATE_WINDOW = 5 * 60 * 1000; // 5 minutes
const RATE_MAX = 10;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const timestamps = rateLimit.get(ip)?.filter((t) => now - t < RATE_WINDOW) || [];
    if (timestamps.length >= RATE_MAX) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    timestamps.push(now);
    rateLimit.set(ip, timestamps);

    const body = await request.json();
    const { sourceId, idempotencyKey, cart, customer } = body;

    if (!sourceId || !cart?.items?.length || !customer?.email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const square = getSquareClient();

    // ---- 1. Validate cart against DB ----
    const variationIds = cart.items.map((item: any) => item.variation_id);
    const { data: dbVariations } = await supabase
      .from("product_variations")
      .select(`
        id, price, sale_price, name, sku, product_id
      `)
      .in("id", variationIds);

    if (!dbVariations || dbVariations.length !== variationIds.length) {
      return NextResponse.json(
        { error: "Some items are no longer available" },
        { status: 400 }
      );
    }

    // Calculate verified total
    let verifiedSubtotal = 0;
    const orderItems: any[] = [];

    for (const cartItem of cart.items) {
      const dbVar = dbVariations.find(
        (v: any) => v.id === cartItem.variation_id
      );
      if (!dbVar) {
        return NextResponse.json(
          { error: `Product not found: ${cartItem.product_name}` },
          { status: 400 }
        );
      }

      const unitPrice = dbVar.sale_price || dbVar.price;

      const lineTotal = unitPrice * cartItem.quantity;
      verifiedSubtotal += lineTotal;

      orderItems.push({
        product_id: dbVar.product_id,
        variation_id: dbVar.id,
        product_name: cartItem.product_name,
        variation_name: dbVar.name,
        sku: dbVar.sku,
        quantity: cartItem.quantity,
        unit_price: unitPrice,
        total_price: lineTotal,
      });
    }

    // Calculate tax (10% GST for Australia)
    const tax = Math.round(verifiedSubtotal * 0.1 * 100) / 100;
    const shipping = 0; // Shipping quoted separately per order
    const total = verifiedSubtotal + tax;

    // ---- 2. Create order in Supabase (pending) ----
    // Find or create customer
    let { data: dbCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", customer.email)
      .single();

    if (!dbCustomer) {
      const { data: newCustomer } = await supabase
        .from("customers")
        .insert({
          email: customer.email,
          first_name: customer.name?.split(" ")[0] || null,
          last_name: customer.name?.split(" ").slice(1).join(" ") || null,
          phone: customer.phone || null,
          address_line1: customer.address?.line1 || null,
          city: customer.address?.city || null,
          state: customer.address?.state || null,
          postcode: customer.address?.postcode || null,
        })
        .select("id")
        .single();
      dbCustomer = newCustomer;
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: dbCustomer?.id,
        status: "pending",
        subtotal: verifiedSubtotal,
        shipping_cost: shipping,
        tax,
        total,
        shipping_name: customer.name,
        shipping_line1: customer.address?.line1,
        shipping_city: customer.address?.city,
        shipping_state: customer.address?.state,
        shipping_postcode: customer.address?.postcode,
        shipping_country: "AU",
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      console.error("Order creation failed:", orderError);
      return NextResponse.json(
        { error: "Order creation failed" },
        { status: 500 }
      );
    }

    // Insert order line items
    const itemsToInsert = orderItems.map((item: any) => ({
      ...item,
      order_id: order.id,
    }));
    await supabase.from("order_items").insert(itemsToInsert);

    // ---- 3. Process Square payment ----
    // Square amounts are in cents (smallest currency unit)
    const amountCents = Math.round(total * 100);

    let paymentResult;
    try {
      const squareResponse = await square.paymentsApi.createPayment({
        sourceId,
        idempotencyKey: idempotencyKey || randomUUID(),
        amountMoney: {
          amount: BigInt(amountCents),
          currency: "AUD",
        },
        locationId: SQUARE_LOCATION_ID,
        buyerEmailAddress: customer.email,
        note: `DS Racing Karts — Order #${order.order_number}`,
      });
      paymentResult = squareResponse.result;
    } catch (paymentError) {
      // Payment failed — mark order as cancelled
      await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);
      console.error("Square payment failed:", paymentError);
      return NextResponse.json(
        { error: "Payment failed. Please try again." },
        { status: 402 }
      );
    }

    if (!paymentResult.payment || paymentResult.payment.status !== "COMPLETED") {
      // Payment not completed — mark order as cancelled
      await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);
      return NextResponse.json(
        { error: "Payment failed. Please try again." },
        { status: 402 }
      );
    }

    // ---- 4. Update order to paid ----
    await supabase
      .from("orders")
      .update({
        status: "paid",
        square_payment_id: paymentResult.payment.id,
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    // ---- 5. Decrement inventory ----
    for (const cartItem of cart.items) {
      await supabase.rpc("decrement_inventory", {
        p_variation_id: cartItem.variation_id,
        p_quantity: cartItem.quantity,
      });
    }

    // ---- 6. Send confirmation email ----
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const itemRows = orderItems
        .map(
          (item: any) =>
            `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #222;color:#fff">${item.product_name}${item.variation_name !== "Regular" ? ` — ${item.variation_name}` : ""}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #222;color:#b0b0b0;text-align:center">${item.quantity}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #222;color:#fff;text-align:right">$${item.total_price.toFixed(2)}</td>
            </tr>`
        )
        .join("");

      await resend.emails.send({
        from: "DS Racing Karts <onboarding@resend.dev>",
        to: customer.email,
        subject: `Order Confirmed — #${order.order_number}`,
        html: `
          <div style="background:#0a0a0a;padding:32px;font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="height:4px;background:#e60012;margin-bottom:24px"></div>
            <h1 style="color:#fff;font-size:24px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.1em">Order Confirmed</h1>
            <p style="color:#e60012;font-size:18px;margin:0 0 24px;font-weight:bold">#${order.order_number}</p>
            <p style="color:#b0b0b0;font-size:14px;margin:0 0 24px">Thanks for your order! Here&rsquo;s a summary of what you purchased.</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
              <thead>
                <tr style="border-bottom:2px solid #e60012">
                  <th style="padding:8px 12px;text-align:left;color:#b0b0b0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Item</th>
                  <th style="padding:8px 12px;text-align:center;color:#b0b0b0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Qty</th>
                  <th style="padding:8px 12px;text-align:right;color:#b0b0b0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Price</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
              <tr>
                <td style="padding:6px 12px;color:#b0b0b0;font-size:14px">Subtotal</td>
                <td style="padding:6px 12px;color:#fff;font-size:14px;text-align:right">$${verifiedSubtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:6px 12px;color:#b0b0b0;font-size:14px">GST (10%)</td>
                <td style="padding:6px 12px;color:#fff;font-size:14px;text-align:right">$${tax.toFixed(2)}</td>
              </tr>
              <tr style="border-top:2px solid #e60012">
                <td style="padding:10px 12px;color:#fff;font-size:18px;font-weight:bold">Total</td>
                <td style="padding:10px 12px;color:#e60012;font-size:18px;font-weight:bold;text-align:right">$${total.toFixed(2)}</td>
              </tr>
            </table>
            <div style="background:#111;padding:16px;margin-bottom:24px">
              <p style="color:#b0b0b0;font-size:13px;margin:0;line-height:1.5">
                <strong style="color:#fff">Shipping:</strong> We&rsquo;ll be in touch with a shipping quote based on your order size and destination. Shipping is calculated separately.
              </p>
            </div>
            <p style="color:#6b6b6b;font-size:12px;margin:0;text-align:center">DS Racing Karts &mdash; Sydney, Australia</p>
            <div style="height:4px;background:#e60012;margin-top:24px"></div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Confirmation email failed:", emailError);
    }

    // ---- 7. Return confirmation ----
    return NextResponse.json({
      success: true,
      order_number: order.order_number,
      order_id: order.id,
      total,
    });
  } catch (error: any) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
