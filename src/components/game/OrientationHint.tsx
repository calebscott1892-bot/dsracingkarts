"use client";

import { useEffect, useState } from "react";
import { RotateCw, X } from "lucide-react";

const DISMISS_KEY = "dsr-orientation-hint-dismissed";

/**
 * Soft, dismissable hint that nudges mobile portrait users to rotate
 * their device for a fullscreen-feeling landscape race. Pokémon-DS-style:
 * a tiny banner pinned to the bottom of the canvas, never blocks play.
 * Auto-hides on rotation; remembers dismissal for the session.
 */
export function OrientationHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    const portraitQuery = window.matchMedia("(orientation: portrait)");
    const mobileQuery = window.matchMedia("(max-width: 900px)");

    function evaluate() {
      setShow(portraitQuery.matches && mobileQuery.matches);
    }
    evaluate();

    portraitQuery.addEventListener?.("change", evaluate);
    mobileQuery.addEventListener?.("change", evaluate);
    return () => {
      portraitQuery.removeEventListener?.("change", evaluate);
      mobileQuery.removeEventListener?.("change", evaluate);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-auto md:hidden"
      style={{ maxWidth: "calc(100% - 16px)" }}
    >
      <div
        className="flex items-center gap-2 bg-black/85 border border-racing-gold/40 px-3 py-1.5 rounded-sm shadow-[0_0_18px_rgba(212,175,55,0.25)]"
      >
        <span className="inline-flex items-center justify-center text-racing-gold animate-[spin_3s_linear_infinite]">
          <RotateCw size={12} />
        </span>
        <span className="font-digital text-[9px] tracking-[0.18em] text-text-secondary leading-tight">
          ROTATE FOR FULLSCREEN
        </span>
        <button
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setShow(false);
          }}
          className="ml-1 text-text-muted hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}
