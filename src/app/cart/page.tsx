"use client";

import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart, ChevronRight } from "lucide-react";

export default function CartPage() {
  const { cart, updateQuantity, removeItem, clearCart } = useCart();

  if (cart.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 mx-auto mb-6 border border-surface-600 flex items-center justify-center">
          <ShoppingCart size={32} className="text-text-muted" />
        </div>
        <h1 className="font-heading text-3xl uppercase tracking-[0.15em] text-white mb-3">
          Your Cart is Empty
        </h1>
        <p className="text-text-secondary mb-8">
          Looks like you haven&apos;t added anything yet.
        </p>
        <Link href="/shop" className="btn-primary inline-block text-sm">
          Browse Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-muted mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <ChevronRight size={12} />
        <Link href="/shop" className="hover:text-white transition-colors">Shop</Link>
        <ChevronRight size={12} />
        <span className="text-text-secondary">Cart</span>
      </div>

      <h1 className="font-heading text-2xl md:text-3xl uppercase tracking-[0.15em] text-white mb-8">
        Your <span className="text-racing-red">Cart</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-0">
          {/* Header row — desktop only */}
          <div className="hidden md:grid grid-cols-[1fr_120px_120px_40px] gap-4 text-xs font-heading uppercase tracking-[0.1em] text-text-muted border-b border-surface-600 pb-3 mb-4">
            <span>Product</span>
            <span className="text-center">Quantity</span>
            <span className="text-right">Subtotal</span>
            <span />
          </div>

          {cart.items.map((item, i) => (
            <div
              key={item.variation_id}
              className={`grid grid-cols-[72px_1fr] md:grid-cols-[72px_1fr_120px_120px_40px] gap-3 md:gap-4 items-center py-4 ${
                i < cart.items.length - 1 ? "border-b border-surface-600/50" : ""
              }`}
            >
              {/* Image */}
              <div className="w-[72px] h-[72px] bg-surface-700 overflow-hidden flex-shrink-0 border border-surface-600">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.product_name}
                    width={72}
                    height={72}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted">
                    <ShoppingCart size={20} />
                  </div>
                )}
              </div>

              {/* Name / variant / price */}
              <div className="min-w-0">
                <Link
                  href={`/product/${item.product_slug}`}
                  className="font-heading text-sm uppercase tracking-wide text-white hover:text-racing-red transition-colors line-clamp-2"
                >
                  {item.product_name}
                </Link>
                {item.variation_name && item.variation_name !== "Regular" && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {item.variation_name}
                  </p>
                )}
                <p className="text-sm text-white/80 mt-1 md:hidden">
                  {formatPrice(item.price)}
                </p>

                {/* Mobile quantity + remove */}
                <div className="flex items-center gap-3 mt-2 md:hidden">
                  <div className="flex items-center border border-surface-600 bg-surface-700">
                    <button
                      onClick={() => updateQuantity(item.variation_id, item.quantity - 1)}
                      className="p-1.5 text-text-muted hover:text-racing-red transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.variation_id, item.quantity + 1)}
                      className="p-1.5 text-text-muted hover:text-racing-red transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-sm font-heading text-white ml-auto">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                  <button
                    onClick={() => removeItem(item.variation_id)}
                    className="text-text-muted hover:text-racing-red transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Desktop quantity */}
              <div className="hidden md:flex items-center justify-center border border-surface-600 bg-surface-700 h-9">
                <button
                  onClick={() => updateQuantity(item.variation_id, item.quantity - 1)}
                  className="px-2 h-full text-text-muted hover:text-racing-red transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-medium text-white">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.variation_id, item.quantity + 1)}
                  className="px-2 h-full text-text-muted hover:text-racing-red transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Line subtotal */}
              <div className="hidden md:block text-right text-sm font-heading text-white">
                {formatPrice(item.price * item.quantity)}
              </div>

              {/* Remove — desktop */}
              <div className="hidden md:flex justify-center">
                <button
                  onClick={() => removeItem(item.variation_id)}
                  className="text-text-muted hover:text-racing-red transition-colors"
                  aria-label="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {/* Clear cart */}
          <div className="pt-4 border-t border-surface-600/50">
            <button
              onClick={clearCart}
              className="text-xs uppercase tracking-[0.1em] text-text-muted hover:text-racing-red transition-colors"
            >
              Clear Cart
            </button>
          </div>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="bg-surface-800 border border-surface-600 p-6 sticky top-20 lg:top-28">
            <div className="h-1 bg-racing-red -mt-6 -mx-6 mb-5" />
            <h2 className="font-heading text-sm uppercase tracking-[0.15em] text-white mb-5">
              Order Summary
            </h2>

            <div className="space-y-3 text-sm border-b border-surface-600 pb-4 mb-4">
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Subtotal ({cart.item_count} {cart.item_count === 1 ? "item" : "items"})
                </span>
                <span className="text-white font-medium">{formatPrice(cart.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Shipping</span>
                <span className="text-text-muted text-xs">Calculated at checkout</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">GST (10%)</span>
                <span className="text-white font-medium">
                  {formatPrice(Math.round(cart.subtotal * 0.1 * 100) / 100)}
                </span>
              </div>
            </div>

            <div className="flex justify-between text-base font-heading uppercase tracking-wide text-white mb-6">
              <span>Estimated Total</span>
              <span className="text-racing-red">
                {formatPrice(cart.subtotal + Math.round(cart.subtotal * 0.1 * 100) / 100)}
              </span>
            </div>

            <Link
              href="/checkout"
              className="btn-primary block w-full text-center text-sm"
            >
              Proceed to Checkout
            </Link>

            <Link
              href="/shop"
              className="block w-full text-center text-xs uppercase tracking-[0.1em] text-text-muted hover:text-racing-red mt-4 py-2 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
