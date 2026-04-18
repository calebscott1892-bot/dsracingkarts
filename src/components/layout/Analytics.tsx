"use client";

import Script from "next/script";
import { useState, useEffect } from "react";

function CookieConsent({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 md:p-6">
      <div className="max-w-xl mx-auto bg-surface-800 border border-surface-600 p-4 md:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-sm text-text-secondary flex-1">
          We use cookies for analytics to improve your experience.{" "}
          <a href="/privacy" className="text-racing-red hover:underline">Privacy Policy</a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onDecline}
            className="px-4 py-2 text-xs font-heading uppercase tracking-wider text-text-muted hover:text-white border border-surface-600 hover:border-surface-400 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2 text-xs font-heading uppercase tracking-wider bg-racing-red text-white hover:bg-red-700 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("dsr-cookie-consent");
    if (stored === "granted" || stored === "denied") {
      setConsent(stored);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem("dsr-cookie-consent", "granted");
    setConsent("granted");
  }

  function handleDecline() {
    localStorage.setItem("dsr-cookie-consent", "denied");
    setConsent("denied");
  }

  if (!gaId) return null;

  // Show consent banner if no choice has been made
  if (consent === null) {
    return <CookieConsent onAccept={handleAccept} onDecline={handleDecline} />;
  }

  // Only load GA if consent was granted
  if (consent !== "granted") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
