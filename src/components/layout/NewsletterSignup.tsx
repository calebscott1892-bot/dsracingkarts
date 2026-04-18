"use client";

import { useState } from "react";
import { Send, CheckCircle } from "lucide-react";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="relative overflow-hidden bg-surface-800 border border-surface-600/50 p-8 md:p-12">
      {/* Background texture */}
      <div className="absolute inset-0 checkered-bg opacity-30 pointer-events-none" />
      {/* Red accent glow */}
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-brand-red/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative text-center">
        {/* Overline */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="h-[1px] w-8 bg-brand-red" />
          <span className="font-heading text-xs tracking-[0.4em] text-brand-red uppercase">
            Newsletter
          </span>
          <span className="h-[1px] w-8 bg-brand-red" />
        </div>

        <h2 className="font-heading text-3xl md:text-4xl uppercase tracking-[0.1em] mb-3 text-white">
          Stay in the <span className="text-brand-yellow">Fast Lane</span>
        </h2>
        <p className="text-text-secondary mb-8 max-w-md mx-auto text-sm">
          New products, race specials, and track day updates. No spam — just speed.
        </p>

        {status === "success" ? (
          <div className="flex items-center justify-center gap-3 text-brand-yellow animate-fade-in">
            <CheckCircle size={20} />
            <span className="font-heading uppercase tracking-wider text-sm">You&apos;re in the race</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark flex-1"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Send size={14} />
              {status === "loading" ? "Sending..." : "Subscribe"}
            </button>
          </form>
        )}

        {status === "error" && (
          <p className="text-brand-red text-sm mt-3 animate-fade-in">
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
