"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, ArrowRight, Phone } from "lucide-react";
import { Suspense, useEffect } from "react";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNumber = searchParams.get("order");

  useEffect(() => {
    if (!orderNumber) {
      router.replace("/shop");
    }
  }, [orderNumber, router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 md:py-24 text-center">
      {/* Success icon */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle size={40} className="text-green-500" />
        </div>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl uppercase tracking-wider mb-4">
        Order Confirmed
      </h1>

      {orderNumber && (
        <p className="text-text-secondary text-sm mb-2">
          Order number:{" "}
          <span className="font-heading text-white tracking-wider">
            {orderNumber}
          </span>
        </p>
      )}

      <p className="text-text-muted text-sm max-w-md mx-auto mb-8 leading-relaxed">
        Thank you for your order! We&apos;ll send a confirmation email shortly.
        Shipping will be quoted separately and we&apos;ll be in touch to arrange
        delivery or pickup.
      </p>

      {/* Divider */}
      <div className="chequered-stripe-sm mb-8" />

      {/* Next steps */}
      <div className="bg-surface-800 border border-surface-600 p-6 mb-8 text-left space-y-4">
        <h2 className="font-heading text-sm uppercase tracking-[0.3em] text-brand-red">
          What happens next
        </h2>
        <ul className="space-y-3 text-sm text-text-secondary">
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 bg-brand-red/10 text-brand-red text-xs font-heading flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            You&apos;ll receive an order confirmation email with your details.
          </li>
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 bg-brand-red/10 text-brand-red text-xs font-heading flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            We&apos;ll calculate shipping based on your order size and location.
          </li>
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 bg-brand-red/10 text-brand-red text-xs font-heading flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            We&apos;ll contact you with a shipping quote or to arrange workshop pickup.
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/shop" className="btn-primary inline-flex items-center justify-center gap-2">
          Continue Shopping
          <ArrowRight size={16} />
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-surface-600 text-text-secondary hover:text-white hover:border-surface-500 transition-colors text-sm font-heading uppercase tracking-wider"
        >
          <Phone size={14} />
          Contact Us
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="h-20 w-20 mx-auto mb-6 bg-surface-700 rounded-full animate-pulse" />
        <div className="h-8 bg-surface-700 animate-pulse w-64 mx-auto mb-4" />
        <div className="h-4 bg-surface-700 animate-pulse w-48 mx-auto" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
