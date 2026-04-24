"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  // Don't render on home page or any admin page
  const isHome = pathname === "/";
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    // Show the button only if the user has navigated within the site
    setCanGoBack(window.history.length > 1);
  }, [pathname]);

  if (isHome || isAdmin || !canGoBack) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 pt-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 min-h-[44px] px-2 -ml-2 text-sm text-white/50 hover:text-racing-red transition-colors group"
        aria-label="Go back"
      >
        <ArrowLeft
          size={15}
          className="transition-transform duration-200 group-hover:-translate-x-1"
        />
        <span className="font-heading text-xs uppercase tracking-[0.15em]">Back</span>
      </button>
    </div>
  );
}
