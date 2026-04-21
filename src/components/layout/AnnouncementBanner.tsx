"use client";

import { useEffect, useState } from "react";
import { X, Megaphone, AlertTriangle, Calendar, Tag, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: "info" | "warning" | "event" | "promo";
  cta_label: string | null;
  cta_url: string | null;
}

const TYPE_CONFIG = {
  info:    { bg: "bg-blue-600",   icon: Megaphone },
  warning: { bg: "bg-yellow-500", icon: AlertTriangle },
  event:   { bg: "bg-purple-600", icon: Calendar },
  promo:   { bg: "bg-green-600",  icon: Tag },
};

const DISMISSED_KEY = "dsr_dismissed_announcements";

function getDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch { return []; }
}

function markDismissed(id: string) {
  try {
    const current = getDismissed();
    if (!current.includes(id)) localStorage.setItem(DISMISSED_KEY, JSON.stringify([...current, id]));
  } catch { /* ignore */ }
}

// White diagonal checkerboard pattern for the side wings
const checkerStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,rgba(255,255,255,0.25) 25%,transparent 25%)," +
    "linear-gradient(-45deg,rgba(255,255,255,0.25) 25%,transparent 25%)," +
    "linear-gradient(45deg,transparent 75%,rgba(255,255,255,0.25) 75%)," +
    "linear-gradient(-45deg,transparent 75%,rgba(255,255,255,0.25) 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
};

export function AnnouncementBanner({ announcement }: { announcement: Announcement }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!getDismissed().includes(announcement.id)) setVisible(true);
  }, [announcement.id]);

  function handleDismiss() {
    markDismissed(announcement.id);
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  const cfg = TYPE_CONFIG[announcement.type] ?? TYPE_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div
      role="banner"
      className={`relative ${cfg.bg} text-white text-sm overflow-hidden`}
      style={{ animation: "bannerDrop 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      <style>{`
        @keyframes bannerDrop {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>

      {/* Left checkered wing */}
      <div className="absolute left-0 top-0 bottom-0 w-20 pointer-events-none" style={checkerStyle} />
      {/* Right checkered wing */}
      <div className="absolute right-0 top-0 bottom-0 w-20 pointer-events-none" style={checkerStyle} />

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-24 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon size={16} className="shrink-0 opacity-90" />
          <span className="font-semibold shrink-0">{announcement.title}:</span>
          <span className="text-white/90 truncate hidden sm:block">{announcement.body}</span>
          <span className="text-white/90 sm:hidden line-clamp-1">{announcement.body}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {announcement.cta_label && announcement.cta_url && (
            <Link
              href={announcement.cta_url}
              className="flex items-center gap-1 underline underline-offset-2 text-white/90 hover:text-white transition-colors text-xs font-medium whitespace-nowrap"
            >
              {announcement.cta_label} <ChevronRight size={12} />
            </Link>
          )}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss announcement"
            className="text-white/70 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
