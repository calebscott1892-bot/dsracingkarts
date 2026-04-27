import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

// Always render fresh — never serve a stale auth state from the edge cache.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check is wrapped in try/catch so a transient Supabase hiccup (cold
  // start, network blip, expired refresh token) never bubbles up to the
  // global error boundary as "Something Went Wrong" — which the client
  // reported seeing. The redirect() call sits OUTSIDE the try/catch because
  // it works by throwing a special NEXT_REDIRECT exception that a catch-all
  // would swallow.
  let userId: string | null = null;
  let role: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;

    if (userId) {
      // maybeSingle so a missing row doesn't throw (returns data=null instead).
      const { data: profile } = await supabase
        .from("admin_profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      role = profile?.role ?? null;
    }
  } catch {
    // Transient Supabase failure → bounce to login rather than crash the page.
    userId = null;
    role = null;
  }

  if (!userId) {
    redirect("/admin-login");
  }

  if (!role || !["admin", "super_admin"].includes(role)) {
    redirect("/admin-login?error=unauthorized");
  }

  return (
    <div className="min-h-screen bg-surface-900 flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto pt-14 lg:pt-8">{children}</main>
    </div>
  );
}
