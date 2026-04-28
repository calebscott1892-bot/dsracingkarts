"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/utils";
import type { Product, ProductVariation } from "@/types/database";

interface Props {
  product: Product;
  variations: (ProductVariation & {
    variation_options?: { option_name: string; option_value: string }[];
  })[];
}

export function AddToCartButton({ product, variations }: Props) {
  const { addItem } = useCart();
  const [selectedId, setSelectedId] = useState(variations[0]?.id || "");
  const [added, setAdded] = useState(false);

  const selected = variations.find((v) => v.id === selectedId);

  function handleAdd() {
    if (!selected) return;
    addItem({
      product_id: product.id,
      product_slug: product.slug,
      variation_id: selected.id,
      product_name: product.name,
      variation_name: selected.name,
      sku: selected.sku,
      price: selected.sale_price || selected.price,
      image_url: product.primary_image_url,
      max_quantity: 999,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="space-y-5">
      {/* Variation selector */}
      {variations.length > 1 && (
        <div>
          <label className="font-heading text-xs uppercase tracking-[0.3em] text-brand-red block mb-3">
            {variations[0]?.variation_options?.[0]?.option_name || "Option"}
          </label>
          <div className="flex flex-wrap gap-2">
            {variations.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`px-4 py-2.5 text-sm font-heading tracking-wider uppercase transition-all ${
                    selectedId === v.id
                      ? "bg-brand-red/15 border border-brand-red text-white"
                      : "bg-surface-700 border border-surface-500 text-text-secondary hover:border-surface-400 hover:text-white"
                  }`}
                >
                  {v.name}
                  {v.price !== variations[0]?.price && (
                    <span className="ml-1.5 text-xs opacity-60">
                      ({formatPrice(v.sale_price || v.price)})
                    </span>
                  )}
                </button>
            ))}
          </div>
        </div>
      )}

      {/* Price for selected variation */}
      {selected && (
        <p className="text-2xl font-heading tracking-wide">
          {selected.sale_price ? (
            <>
              <span className="text-brand-red">{formatPrice(selected.sale_price)}</span>
              <span className="text-text-muted line-through text-base ml-3">
                {formatPrice(selected.price)}
              </span>
            </>
          ) : (
            <span className="text-white">{formatPrice(selected.price)}</span>
          )}
        </p>
      )}

      {/* Add to cart */}
      <div aria-live="polite">
        <button
          onClick={handleAdd}
          disabled={!selected}
          aria-disabled={!selected}
          className={`btn-primary w-full flex items-center justify-center gap-3 text-base ${
            !selected ? "opacity-40 cursor-not-allowed hover:shadow-none" : ""
          } ${added ? "bg-green-600 hover:bg-green-600 hover:shadow-none" : ""}`}
        >
          {added ? (
            <>
              <Check size={18} />
              <span>Added to Cart</span>
            </>
          ) : (
            <>
              <ShoppingCart size={18} />
              <span>Add to Cart</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
