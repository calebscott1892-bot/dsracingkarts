"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Users,
  Settings,
  LogOut,
  Mail,
  Flag,
  Megaphone,
  TrendingUp,
  Star,
  Car,
  Menu,
  X,
  BarChart2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { href: "/admin/team", label: "Team Profiles", icon: Flag },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/pricing", label: "Bulk Pricing", icon: TrendingUp },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/chassis-listings", label: "Chassis Listings", icon: Car },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin-login");
  }

  const navContent = (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-surface-600 flex items-center justify-between">
        <Link href="/admin" className="font-heading text-xl uppercase tracking-wider">
          DSR <span className="text-brand-red">Admin</span>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-text-muted hover:text-white transition-colors"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
                isActive
                  ? "bg-brand-red/10 text-brand-red"
                  : "text-text-secondary hover:text-white hover:bg-surface-700"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-surface-600">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded text-sm text-text-muted hover:text-white hover:bg-surface-700 w-full transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
        <Link
          href="/"
          className="block text-xs text-text-muted text-center mt-3 hover:text-white transition-colors"
        >
          ← View Store
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-64 bg-surface-800 border-r border-surface-600 min-h-screen hidden lg:flex flex-col shrink-0">
        {navContent}
      </aside>

      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 p-2 bg-surface-800 border border-surface-600 rounded text-text-secondary hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-out drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-surface-800 border-r border-surface-600 flex flex-col
          transition-transform duration-200 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {navContent}
      </aside>
    </>
  );
}
