import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Must be logged in
  if (!user) {
    redirect("/admin-login");
  }

  // Must have admin role
  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    redirect("/admin-login?error=unauthorized");
  }

  return (
    <div className="min-h-screen bg-surface-900 flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto pt-14 lg:pt-8">{children}</main>
    </div>
  );
}
