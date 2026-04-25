"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the public-site chrome (Header, Footer, BackButton, etc.) on routes
 * that have their own admin chrome.
 *
 * Why this exists: Next.js root layout wraps every route, so without this gate
 * the admin pages would show the public Header on top — and clicking those nav
 * links from inside admin (which is what the client repeatedly hit) routes
 * away from admin and, if anything in those public pages errors at runtime,
 * lands the user on the global error boundary.
 *
 * The fix is to never expose the public nav from admin in the first place.
 */
export function PublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hidden =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/admin-login" ||
    pathname.startsWith("/admin-login/");

  if (hidden) return null;
  return <>{children}</>;
}
