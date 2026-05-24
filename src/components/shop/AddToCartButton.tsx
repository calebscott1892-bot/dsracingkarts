"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, MessageCircle, ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/utils";
import { isRealProductImageUrl } from "@/lib/product-images";
import {
  getInventoryQuantity,
  isUnavailableByStock,
  ZERO_STOCK_CONTACT_MESSAGE,
} from "@/lib/stock";
import type { ProductVariation } from "@/types/database";

interface Props {
  product: {
    id: string;
    slug: string;
    name: string;
    primary_image_url: string | null;
    is_stockable?: boolean;
  };
  variations: (ProductVariation & {
    variation_options?: { option_name: string; option_value: string }[];
  })[];
}

export function AddToCartButton({ product, variations }: Props) {
  const { addItem } = useCart();
  const [selectedId, setSelectedId] = useState(variations[0]?.id || "");
  const [added, setAdded] = useState(false);

  const selected = variations.find((v) => v.id === selectedId);
  const selectedQuantity = selected ? getInventoryQuantity(selected) : null;
  const selectedUnavailable = selected
    ? isUnavailableByStock(selected, product.is_stockable !== false)
    : false;

  function handleAdd() {
    if (!selected || selectedUnavailable) return;
    addItem({
      product_id: product.id,
      product_slug: product.slug,
      variation_id: selected.id,
      product_name: product.name,
      variation_name: selected.name,
      sku: selected.sku,
      price: selected.sale_price || selected.price,
      image_url: isRealProductImageUrl(product.primary_image_url)
        ? product.primary_image_url
        : null,
      max_quantity: selectedQuantity && selectedQuantity > 0 ? selectedQuantity : 999,
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
            {variations.map((v) => {
              const variationUnavailable = isUnavailableByStock(
                v,
                product.is_stockable !== false
              );
              return (
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
                  {variationUnavailable && (
                    <span className="ml-1.5 text-[10px] text-racing-red">
                      Sold out
                    </span>
                  )}
                  {v.price !== variations[0]?.price && (
                    <span className="ml-1.5 text-xs opacity-60">
                      ({formatPrice(v.sale_price || v.price)})
                    </span>
                  )}
                </button>
              );
            })}
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

      {selectedUnavailable && (
        <div className="border border-racing-red/30 bg-racing-red/10 px-4 py-3 text-sm text-text-secondary leading-relaxed">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-racing-red shrink-0 mt-0.5" />
            <div>
              <p className="font-heading text-xs uppercase tracking-[0.18em] text-racing-red mb-1">
                Not available for immediate purchase
              </p>
              <p>{ZERO_STOCK_CONTACT_MESSAGE}</p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 mt-3 text-racing-red hover:text-racing-red/80 underline underline-offset-2 transition-colors"
              >
                <MessageCircle size={14} />
                Contact us
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Add to cart */}
      <div aria-live="polite">
        <button
          onClick={handleAdd}
          disabled={!selected || selectedUnavailable}
          aria-disabled={!selected || selectedUnavailable}
          className={`btn-primary w-full flex items-center justify-center gap-3 text-base ${
            !selected || selectedUnavailable ? "opacity-40 cursor-not-allowed hover:shadow-none" : ""
          } ${added ? "bg-green-600 hover:bg-green-600 hover:shadow-none" : ""}`}
        >
          {added ? (
            <>
              <Check size={18} />
              <span>Added to Cart</span>
            </>
          ) : selectedUnavailable ? (
            <>
              <AlertTriangle size={18} />
              <span>Contact for ETA</span>
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
