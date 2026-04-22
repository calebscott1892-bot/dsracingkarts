"use client";

import { useState } from "react";
import { Gift, ShoppingCart, Mail, Check } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import Link from "next/link";

const FIXED_AMOUNTS = [
  { label: "$50", amount: 50, variationId: "", sku: "GIFTCARD-50" },
  { label: "$100", amount: 100, variationId: "", sku: "GIFTCARD-100" },
  { label: "$200", amount: 200, variationId: "", sku: "GIFTCARD-200" },
  { label: "$500", amount: 500, variationId: "", sku: "GIFTCARD-500" },
];

interface GiftCardClientProps {
  variations: {
    id: string;
    name: string;
    sku: string | null;
    price: number;
  }[];
  productId: string;
  productName: string;
}

export function GiftCardClient({ variations, productId, productName }: GiftCardClientProps) {
  const { addItem } = useCart();
  const [selected, setSelected] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  // Map variations by SKU
  const variationBySku = Object.fromEntries(
    variations.map((v) => [v.sku, v])
  );

  const enrichedAmounts = FIXED_AMOUNTS.map((a) => ({
    ...a,
    variation: variationBySku[a.sku] || null,
  })).filter((a) => a.variation);

  function handleAdd() {
    const chosen = enrichedAmounts.find((a) => a.sku === selected);
    if (!chosen?.variation) return;

    addItem({
      product_id: productId,
      product_slug: "ds-racing-karts-e-gift-card",
      variation_id: chosen.variation.id,
      product_name: productName,
      variation_name: chosen.variation.name,
      sku: chosen.variation.sku,
      price: chosen.variation.price,
      image_url: null,
      max_quantity: 99,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  }

  return (
    <div className="space-y-8">
      {/* Amount selector */}
      <div>
        <h2 className="font-heading text-sm uppercase tracking-[0.3em] text-brand-red mb-4">
          Select an Amount
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {enrichedAmounts.map((a) => (
            <button
              key={a.sku}
              onClick={() => setSelected(a.sku)}
              className={`relative border-2 rounded py-6 text-center transition-all font-heading text-2xl uppercase tracking-wider ${
                selected === a.sku
                  ? "border-brand-red text-white bg-brand-red/10"
                  : "border-surface-600 text-text-secondary hover:border-surface-400 hover:text-white"
              }`}
            >
              {selected === a.sku && (
                <span className="absolute top-2 right-2">
                  <Check size={14} className="text-brand-red" />
                </span>
              )}
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom amount notice */}
      <div className="border border-surface-600 rounded p-4 flex items-start gap-3 bg-surface-700/30">
        <Mail size={18} className="text-text-muted mt-0.5 shrink-0" />
        <div>
          <p className="text-sm text-text-secondary font-medium mb-1">Need a custom amount?</p>
          <p className="text-xs text-text-muted">
            We can arrange gift cards for any value.{" "}
            <Link href="/contact" className="text-brand-red hover:underline">
              Contact us
            </Link>{" "}
            and we&apos;ll sort it out for you.
          </p>
        </div>
      </div>

      {/* Add to cart */}
      <button
        onClick={handleAdd}
        disabled={!selected || added}
        className={`w-full flex items-center justify-center gap-3 py-4 font-heading uppercase tracking-[0.15em] text-sm transition-all ${
          added
            ? "bg-green-700 text-white cursor-default"
            : selected
            ? "btn-primary"
            : "bg-surface-700 text-text-muted cursor-not-allowed"
        }`}
      >
        {added ? (
          <>
            <Check size={18} /> Added to Cart
          </>
        ) : (
          <>
            <ShoppingCart size={18} />
            {selected
              ? `Add ${enrichedAmounts.find((a) => a.sku === selected)?.label} Gift Card to Cart`
              : "Select an Amount"}
          </>
        )}
      </button>

      {added && (
        <div className="flex justify-center">
          <Link href="/cart" className="text-sm text-brand-red hover:underline">
            View cart →
          </Link>
        </div>
      )}

      {/* How it works */}
      <div className="border-t border-surface-600/50 pt-6 space-y-3">
        <h3 className="font-heading text-xs uppercase tracking-[0.3em] text-text-muted">How It Works</h3>
        <ol className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-brand-red font-heading font-bold shrink-0">01.</span>
            Purchase your gift card above and complete checkout.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-red font-heading font-bold shrink-0">02.</span>
            We&apos;ll send the gift card details to your email within one business day.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-red font-heading font-bold shrink-0">03.</span>
            The recipient redeems it at checkout on any order.
          </li>
        </ol>
      </div>
    </div>
  );
}
