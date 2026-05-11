import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSquareClient, SQUARE_LOCATION_ID } from "@/lib/square";
import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { createHash } from "crypto";

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
 *   5. Return order confirmation
 */

const rateLimit = new Map<string, number[]>();
const RATE_WINDOW = 5 * 60 * 1000; // 5 minutes
const RATE_MAX = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CART_LINE_QTY = 20;
const ADMIN_ORDER_EMAIL = process.env.ORDER_NOTIFICATION_EMAIL || "dsracing@bigpond.com";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function syncCheckoutNewsletterSignup(
  supabase: ReturnType<typeof createServiceClient>,
  email: string
) {
  const { error: subscriberError } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      { email, subscribed: true, source: "checkout" },
      { onConflict: "email" }
    );

  if (subscriberError) {
    console.error("Checkout newsletter subscriber save failed:", subscriberError);
  }

  if (process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_LIST_ID) {
    try {
      const dc = process.env.MAILCHIMP_API_KEY.split("-").pop();
      const subscriberHash = createHash("md5").update(email.toLowerCase()).digest("hex");
      const response = await fetch(
        `https://${dc}.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/members/${subscriberHash}`,
        {
          method: "PUT",
          headers: {
            Authorization: `apikey ${process.env.MAILCHIMP_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_address: email,
            status_if_new: "pending",
          }),
        }
      );
      if (!response.ok) {
        console.error("Checkout Mailchimp sync failed:", await response.text());
      }
    } catch (mcError) {
      console.error("Checkout Mailchimp sync error:", mcError);
    }
  }
}

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
    const cartItems = Array.isArray(cart?.items) ? cart.items : [];
    const customerEmail = String(customer?.email || "").trim().toLowerCase().slice(0, 320);
    const customerName = String(customer?.name || "").trim().slice(0, 160);
    const customerPhone = String(customer?.phone || "").trim().slice(0, 40);
    const customerSubscribe = Boolean(customer?.subscribe);
    const shippingLine1 = String(customer?.address?.line1 || "").trim().slice(0, 200);
    const shippingCity = String(customer?.address?.city || "").trim().slice(0, 120);
    const shippingState = String(customer?.address?.state || "").trim().slice(0, 32);
    const shippingPostcode = String(customer?.address?.postcode || "").trim().slice(0, 20);

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!sourceId || cartItems.length === 0 || !customerEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!idempotencyKey || !UUID_REGEX.test(String(idempotencyKey))) {
      return NextResponse.json(
        { error: "Invalid or missing idempotency key" },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(customerEmail) || !customerName || !customerPhone || !shippingLine1 || !shippingCity || !shippingState || !shippingPostcode) {
      return NextResponse.json(
        { error: "Invalid customer or shipping details" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const square = getSquareClient();

    // ---- 1. Validate cart against DB ----
    const variationIds = Array.from(new Set(
      cartItems.map((item: any) => String(item?.variation_id || "")).filter(Boolean)
    ));

    if (variationIds.length !== cartItems.length) {
      return NextResponse.json(
        { error: "Cart contains duplicate or invalid items" },
        { status: 400 }
      );
    }

    const { data: dbVariations } = await supabase
      .from("product_variations")
      .select(`
        id, price, sale_price, name, sku, product_id,
        products ( name )
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

    for (const cartItem of cartItems) {
      const quantity = Number(cartItem?.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_LINE_QTY) {
        return NextResponse.json(
          { error: "Invalid cart quantity" },
          { status: 400 }
        );
      }

      const dbVar = dbVariations.find(
        (v: any) => v.id === cartItem.variation_id
      );
      if (!dbVar) {
        return NextResponse.json(
          { error: `Product not found: ${cartItem.product_name}` },
          { status: 400 }
        );
      }

      // Note: stock check intentionally skipped — all products can be ordered regardless of
      // on-hand quantity, as items can be sourced within a day.

      const unitPrice = dbVar.sale_price || dbVar.price;
      const lineTotal = unitPrice * quantity;
      verifiedSubtotal += lineTotal;

      orderItems.push({
        product_id: dbVar.product_id,
        variation_id: dbVar.id,
        product_name: (dbVar.products as unknown as { name: string } | null)?.name || "Unknown Product",
        variation_name: dbVar.name,
        sku: dbVar.sku,
        quantity,
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
    const [firstName, ...lastNameParts] = customerName.split(/\s+/).filter(Boolean);
    const lastName = lastNameParts.join(" ") || null;
    let { data: dbCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", customerEmail)
      .maybeSingle();

    if (!dbCustomer) {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          email: customerEmail,
          first_name: firstName || null,
          last_name: lastName,
          phone: customerPhone || null,
          address_line1: shippingLine1 || null,
          city: shippingCity || null,
          state: shippingState || null,
          postcode: shippingPostcode || null,
        })
        .select("id")
        .single();
      if (customerError || !newCustomer) {
        console.error("Customer creation failed:", customerError);
        return NextResponse.json(
          { error: "Customer creation failed" },
          { status: 500 }
        );
      }
      dbCustomer = newCustomer;
    } else {
      const { error: customerUpdateError } = await supabase
        .from("customers")
        .update({
          first_name: firstName || null,
          last_name: lastName,
          phone: customerPhone,
          address_line1: shippingLine1,
          city: shippingCity,
          state: shippingState,
          postcode: shippingPostcode,
        })
        .eq("id", dbCustomer.id);

      if (customerUpdateError) {
        console.error("Customer update failed:", customerUpdateError);
      }
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
        shipping_name: customerName,
        shipping_line1: shippingLine1,
        shipping_city: shippingCity,
        shipping_state: shippingState,
        shipping_postcode: shippingPostcode,
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
    const { error: orderItemsError } = await supabase.from("order_items").insert(itemsToInsert);
    if (orderItemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      console.error("Order item creation failed:", orderItemsError);
      return NextResponse.json(
        { error: "Order item creation failed" },
        { status: 500 }
      );
    }

    // Create an itemised Square Order before payment so Square/Xero have a
    // real order reference instead of only a standalone card payment.
    const squareLineItems = orderItems.map((item: any) => ({
      name: item.product_name,
      variationName: item.variation_name !== "Regular" ? item.variation_name : undefined,
      quantity: String(item.quantity),
      note: item.sku ? `SKU: ${item.sku}` : undefined,
      basePriceMoney: {
        amount: BigInt(Math.round(item.unit_price * 100)),
        currency: "AUD",
      },
      metadata: {
        product_id: item.product_id,
        variation_id: item.variation_id,
        sku: item.sku || "",
      },
    }));

    let squareOrderId: string | null = null;
    try {
      const squareOrderResponse = await square.ordersApi.createOrder({
        idempotencyKey: `${idempotencyKey}-order`,
        order: {
          locationId: SQUARE_LOCATION_ID,
          referenceId: order.order_number,
          source: { name: "DS Racing Karts Website" },
          lineItems: squareLineItems,
          taxes: [
            {
              uid: "gst",
              name: "GST",
              type: "ADDITIVE",
              percentage: "10",
              scope: "ORDER",
            },
          ],
          metadata: {
            website_order_id: order.id,
            website_order_number: order.order_number,
          },
        },
      });

      squareOrderId = squareOrderResponse.result.order?.id ?? null;
      if (!squareOrderId) {
        throw new Error("Square did not return an order ID");
      }
      if (squareOrderId) {
        await supabase
          .from("orders")
          .update({ square_order_id: squareOrderId })
          .eq("id", order.id);
      }
    } catch (squareOrderError) {
      await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);
      console.error("Square order creation failed:", squareOrderError);
      revalidatePath("/admin/orders");
      revalidatePath(`/admin/orders/${order.id}`);
      return NextResponse.json(
        { error: "Order setup failed. Please try again." },
        { status: 500 }
      );
    }

    // ---- 3. Process Square payment ----
    // Square amounts are in cents (smallest currency unit)
    const amountCents = Math.round(total * 100);

    let paymentResult;
    try {
      const squareResponse = await square.paymentsApi.createPayment({
        sourceId,
        idempotencyKey: String(idempotencyKey),
        amountMoney: {
          amount: BigInt(amountCents),
          currency: "AUD",
        },
        locationId: SQUARE_LOCATION_ID,
        orderId: squareOrderId || undefined,
        referenceId: order.order_number,
        buyerEmailAddress: customerEmail,
        shippingAddress: {
          addressLine1: shippingLine1,
          locality: shippingCity,
          administrativeDistrictLevel1: shippingState,
          postalCode: shippingPostcode,
          country: "AU",
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        },
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
      revalidatePath("/admin/orders");
      revalidatePath(`/admin/orders/${order.id}`);
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
      revalidatePath("/admin/orders");
      revalidatePath(`/admin/orders/${order.id}`);
      return NextResponse.json(
        { error: "Payment failed. Please try again." },
        { status: 402 }
      );
    }

    // ---- 4. Update order to paid ----
    const { error: paidUpdateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        square_payment_id: paymentResult.payment.id,
        square_order_id: squareOrderId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (paidUpdateError) {
      console.error("Order payment update failed:", paidUpdateError);
    }

    if (customerSubscribe) {
      await syncCheckoutNewsletterSignup(supabase, customerEmail);
      revalidatePath("/admin/newsletter");
    }

    // ---- 5. Send customer confirmation and internal order notification ----
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.dsracingkarts.com.au").replace(/\/$/, "");
      const adminOrderUrl = `${siteUrl}/admin/orders/${order.id}`;
      const safeCustomerName = escapeHtml(customerName);
      const safeCustomerEmail = escapeHtml(customerEmail);
      const safeCustomerPhone = escapeHtml(customerPhone || "Not provided");
      const safeShippingAddress = [
        shippingLine1,
        [shippingCity, shippingState, shippingPostcode].filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .map(escapeHtml)
        .join("<br />");
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
        from: "DS Racing Karts <orders@dsracingkarts.com.au>",
        to: customerEmail,
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
      }).catch((error) => {
        console.error("Customer confirmation email failed:", error);
      });
      await resend.emails.send({
        from: "DS Racing Karts <orders@dsracingkarts.com.au>",
        to: ADMIN_ORDER_EMAIL,
        replyTo: customerEmail,
        subject: `New website order - #${order.order_number}`,
        html: `
          <div style="background:#0a0a0a;padding:32px;font-family:Arial,sans-serif;max-width:680px;margin:0 auto">
            <div style="height:4px;background:#e60012;margin-bottom:24px"></div>
            <h1 style="color:#fff;font-size:24px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.1em">New Website Order</h1>
            <p style="color:#e60012;font-size:18px;margin:0 0 24px;font-weight:bold">#${escapeHtml(order.order_number)}</p>
            <div style="background:#111;padding:16px;margin-bottom:24px;color:#b0b0b0;font-size:14px;line-height:1.5">
              <p style="margin:0 0 8px"><strong style="color:#fff">Customer:</strong> ${safeCustomerName}</p>
              <p style="margin:0 0 8px"><strong style="color:#fff">Email:</strong> ${safeCustomerEmail}</p>
              <p style="margin:0 0 8px"><strong style="color:#fff">Phone:</strong> ${safeCustomerPhone}</p>
              <p style="margin:0"><strong style="color:#fff">Shipping:</strong><br />${safeShippingAddress}</p>
            </div>
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
            <p style="margin:0 0 24px">
              <a href="${adminOrderUrl}" style="display:inline-block;background:#e60012;color:#fff;text-decoration:none;font-weight:bold;padding:12px 18px;text-transform:uppercase;letter-spacing:0.08em">Open order in admin</a>
            </p>
            <p style="color:#6b6b6b;font-size:12px;margin:0">This notification was sent automatically from the website checkout.</p>
            <div style="height:4px;background:#e60012;margin-top:24px"></div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Order email failed:", emailError);
    }

    // ---- 7. Return confirmation ----
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${order.id}`);
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
