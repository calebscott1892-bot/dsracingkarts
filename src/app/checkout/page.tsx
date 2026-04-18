"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/utils";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Square: any;
  }
}

export default function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const [customer, setCustomer] = useState({
    email: "",
    name: "",
    phone: "",
    address: { line1: "", city: "", state: "NSW", postcode: "" },
  });

  // Load Square Web Payments SDK
  useEffect(() => {
    const script = document.createElement("script");
    const isProduction = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production";
    script.src = isProduction
      ? "https://web.squarecdn.com/v1/square.js"
      : "https://sandbox.web.squarecdn.com/v1/square.js";
    script.onload = initializeSquare;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  async function initializeSquare() {
    if (!window.Square) return;

    const payments = window.Square.payments(
      process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
      process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
    );

    const cardInstance = await payments.card();
    await cardInstance.attach(cardRef.current!);
    setCard(cardInstance);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!card || cart.items.length === 0) return;

    setLoading(true);
    setError("");

    try {
      // Tokenize the card
      const result = await card.tokenize();
      if (result.status !== "OK") {
        setError("Card validation failed. Please check your details.");
        setLoading(false);
        return;
      }

      // Send to our checkout API
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: result.token,
          idempotencyKey: idempotencyKeyRef.current,
          cart: {
            items: cart.items,
            subtotal: cart.subtotal,
          },
          customer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Payment failed");
        setLoading(false);
        return;
      }

      // Success — clear cart and redirect to confirmation
      clearCart();
      router.push(`/checkout/confirmation?order=${data.order_number}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  }

  const tax = Math.round(cart.subtotal * 0.1 * 100) / 100;
  const total = cart.subtotal + tax;

  if (cart.items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-heading text-3xl uppercase mb-4">Your Cart is Empty</h1>
        <a href="/shop" className="btn-primary inline-block">Continue Shopping</a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-4xl uppercase tracking-wider mb-8">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Customer details */}
        <div className="space-y-6">
          <h2 className="font-heading text-xl uppercase tracking-wider">Your Details</h2>

          <div className="space-y-4">
            <label htmlFor="checkout-email" className="sr-only">Email address</label>
            <input
              id="checkout-email"
              type="email"
              required
              placeholder="Email address"
              autoComplete="email"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            />
            <label htmlFor="checkout-name" className="sr-only">Full name</label>
            <input
              id="checkout-name"
              type="text"
              required
              placeholder="Full name"
              autoComplete="name"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            />
            <label htmlFor="checkout-phone" className="sr-only">Phone number</label>
            <input
              id="checkout-phone"
              type="tel"
              placeholder="Phone number"
              autoComplete="tel"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            />
          </div>

          <h2 className="font-heading text-xl uppercase tracking-wider">Shipping Address</h2>
          <div className="space-y-4">
            <label htmlFor="checkout-line1" className="sr-only">Street address</label>
            <input
              id="checkout-line1"
              type="text"
              required
              placeholder="Street address"
              autoComplete="street-address"
              value={customer.address.line1}
              onChange={(e) =>
                setCustomer({
                  ...customer,
                  address: { ...customer.address, line1: e.target.value },
                })
              }
              className="w-full bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label htmlFor="checkout-city" className="sr-only">City</label>
              <input
                id="checkout-city"
                type="text"
                required
                placeholder="City"
                autoComplete="address-level2"
                value={customer.address.city}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    address: { ...customer.address, city: e.target.value },
                  })
                }
                className="bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
              />
              <label htmlFor="checkout-state" className="sr-only">State</label>
              <select
                id="checkout-state"
                value={customer.address.state}
                autoComplete="address-level1"
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    address: { ...customer.address, state: e.target.value },
                  })
                }
                className="bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-red/50"
              >
                {["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map(
                  (s) => (
                    <option key={s} value={s}>{s}</option>
                  )
                )}
              </select>
              <label htmlFor="checkout-postcode" className="sr-only">Postcode</label>
              <input
                id="checkout-postcode"
                type="text"
                required
                placeholder="Postcode"
                autoComplete="postal-code"
                value={customer.address.postcode}
                onChange={(e) =>
                  setCustomer({
                    ...customer,
                    address: { ...customer.address, postcode: e.target.value },
                  })
                }
                className="bg-surface-700 border border-surface-600 rounded px-4 py-3 text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-red/50"
              />
            </div>
          </div>

          {/* Square card input */}
          <h2 className="font-heading text-xl uppercase tracking-wider">Payment</h2>
          <div
            ref={cardRef}
            className="bg-surface-700 border border-surface-600 rounded p-4 min-h-[100px]"
          />

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !card}
            className="btn-primary w-full text-lg"
          >
            {loading ? "Processing…" : `Pay ${formatPrice(total)}`}
          </button>
        </div>

        {/* Order summary */}
        <div className="card p-6 h-fit lg:sticky lg:top-24">
          <h2 className="font-heading text-xl uppercase tracking-wider mb-4">Order Summary</h2>
          <div className="space-y-3 border-b border-surface-600 pb-4 mb-4">
            {cart.items.map((item) => (
              <div key={item.variation_id} className="flex justify-between text-sm">
                <span className="text-text-secondary">
                  {item.product_name}
                  {item.variation_name !== "Regular" && ` — ${item.variation_name}`}
                  <span className="text-text-muted"> × {item.quantity}</span>
                </span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Subtotal</span>
              <span>{formatPrice(cart.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Shipping</span>
              <span className="text-text-muted text-xs">Quoted separately</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">GST (10%)</span>
              <span>{formatPrice(tax)}</span>
            </div>
            <div className="flex justify-between font-heading text-lg pt-2 border-t border-surface-600">
              <span>Total</span>
              <span className="text-brand-red">{formatPrice(total)}</span>
            </div>
          </div>

          <p className="text-text-muted text-xs mt-3">
            Shipping will be quoted based on order size and destination. We&apos;ll be in touch after your order.
          </p>
        </div>
      </form>
    </div>
  );
}
