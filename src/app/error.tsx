"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Copy, Check } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Sentry.captureException(error);
    // Mirror to console in production so we can see it in Vercel logs.
    console.error("[error.tsx]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const debugSummary = [
    error.digest ? `digest: ${error.digest}` : null,
    error.message ? `message: ${error.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  function copyDebug() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(debugSummary || "no error details").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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

      <p className="text-text-muted text-sm max-w-md mx-auto mb-6 leading-relaxed">
        An unexpected error occurred. Please try again or head back to the homepage.
      </p>

      {/* Debug strip — small, low-noise, but recoverable. The digest lets us
          look the error up in Vercel + Sentry; copy-button helps non-dev users
          send a useful message. */}
      {(error.digest || error.message) && (
        <div className="mx-auto max-w-md mb-8 border border-surface-600/60 bg-surface-800/40 px-3 py-2.5 rounded text-left">
          <div className="flex items-start gap-2 text-[11px] text-text-muted font-mono leading-relaxed">
            <span className="break-all flex-1">
              {error.digest && <span className="text-racing-red">digest: {error.digest}</span>}
              {error.digest && error.message && <br />}
              {error.message && <span className="opacity-70">{error.message}</span>}
            </span>
            <button
              type="button"
              onClick={copyDebug}
              className="shrink-0 text-text-muted hover:text-white transition-colors mt-0.5"
              aria-label="Copy error details"
              title="Copy details to clipboard"
            >
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      )}

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
