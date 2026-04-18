import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 md:py-32 text-center">
      <div className="mb-6">
        <span className="font-heading text-8xl md:text-9xl text-brand-red/20 leading-none">
          404
        </span>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl uppercase tracking-wider mb-4">
        Page Not Found
      </h1>

      <p className="text-text-muted text-sm max-w-md mx-auto mb-8 leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="chequered-stripe-sm mb-8" />

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/" className="btn-primary inline-flex items-center justify-center gap-2">
          Back to Home
          <ChevronRight size={16} />
        </Link>
        <Link
          href="/shop"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-surface-600 text-text-secondary hover:text-white hover:border-surface-500 transition-colors text-sm font-heading uppercase tracking-wider"
        >
          Browse Shop
        </Link>
      </div>
    </div>
  );
}
