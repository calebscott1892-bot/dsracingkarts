"use client";

import { useEffect, useState } from "react";
import { X, Megaphone, AlertTriangle, Calendar, Tag, ChevronDown, ChevronRight } from "lucide-react";
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
  info: {
    bg: "bg-racing-red",
    text: "text-white",
    body: "text-white/90",
    button: "text-white/85 hover:text-white hover:bg-white/10",
    icon: Megaphone,
  },
  warning: {
    bg: "bg-racing-gold",
    text: "text-racing-black",
    body: "text-racing-black/80",
    button: "text-racing-black/75 hover:text-racing-black hover:bg-black/10",
    icon: AlertTriangle,
  },
  event: {
    bg: "bg-surface-800 border-y border-racing-red/50",
    text: "text-white",
    body: "text-white/90",
    button: "text-white/85 hover:text-white hover:bg-white/10",
    icon: Calendar,
  },
  promo: {
    bg: "bg-emerald-700",
    text: "text-white",
    body: "text-white/90",
    button: "text-white/85 hover:text-white hover:bg-white/10",
    icon: Tag,
  },
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

function getDismissalId(announcement: Announcement) {
  const content = [
    announcement.id,
    announcement.type,
    announcement.title,
    announcement.body,
    announcement.cta_label ?? "",
    announcement.cta_url ?? "",
  ].join("|");
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) | 0;
  }
  return `${announcement.id}:${Math.abs(hash)}`;
}

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
  const [expanded, setExpanded] = useState(false);
  const dismissalId = getDismissalId(announcement);

  useEffect(() => {
    setMounted(true);
    setExpanded(false);
    setVisible(!getDismissed().includes(dismissalId));
  }, [dismissalId]);

  function handleDismiss() {
    markDismissed(dismissalId);
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  const cfg = TYPE_CONFIG[announcement.type] ?? TYPE_CONFIG.info;
  const Icon = cfg.icon;
  const showExpand = announcement.body.trim().length > 120 || announcement.body.includes("\n");

  return (
    <div
      role="banner"
      className={`relative ${cfg.bg} ${cfg.text} text-sm overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.18)]`}
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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 lg:px-24 py-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Icon size={17} className="shrink-0 opacity-90 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold">{announcement.title}:</span>
            <p className={`${cfg.body} whitespace-pre-line leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {announcement.body}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 md:pt-0.5">
          {showExpand && (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${cfg.button}`}
              aria-expanded={expanded}
            >
              {expanded ? "Less" : "More"}
              <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
          {announcement.cta_label && announcement.cta_url && (
            <Link
              href={announcement.cta_url}
              className={`flex items-center gap-1 underline underline-offset-2 transition-colors text-xs font-medium whitespace-nowrap ${cfg.button}`}
            >
              {announcement.cta_label} <ChevronRight size={12} />
            </Link>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss announcement"
            className={`rounded p-1 transition-colors ${cfg.button}`}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
