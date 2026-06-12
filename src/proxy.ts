import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Old /shop?category=<slug> URLs (Google's index, bookmarks, Square
  // descriptions) get a real HTTP 308 to /shop/<slug>. This lives here
  // rather than in next.config redirects because a config rule can't drop
  // the matched query param from the destination, and the in-page
  // permanentRedirect only manages a client-side hop since /shop streams
  // behind loading.tsx.
  if (request.nextUrl.pathname === "/shop") {
    const category = request.nextUrl.searchParams.get("category");
    if (category) {
      const url = request.nextUrl.clone();
      url.pathname = `/shop/${encodeURIComponent(category)}`;
      url.searchParams.delete("category");
      return NextResponse.redirect(url, 308);
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all routes except static files, images, favicon
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
