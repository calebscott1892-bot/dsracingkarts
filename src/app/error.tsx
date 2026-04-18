"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-24 md:py-32 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-full bg-racing-red/10 flex items-center justify-center">
          <AlertTriangle size={32} className="text-racing-red" />
        </div>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl uppercase tracking-wider mb-4">
        Something Went Wrong
      </h1>

      <p className="text-text-muted text-sm max-w-md mx-auto mb-8 leading-relaxed">
        An unexpected error occurred. Please try again or head back to the homepage.
      </p>

      <div className="chequered-stripe-sm mb-8" />

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={reset} className="btn-primary inline-flex items-center justify-center gap-2">
          Try Again
          <ChevronRight size={16} />
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-surface-600 text-text-secondary hover:text-white hover:border-surface-500 transition-colors text-sm font-heading uppercase tracking-wider"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
