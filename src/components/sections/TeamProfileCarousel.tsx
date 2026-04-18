"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, Flag, Trophy, ExternalLink } from "lucide-react";

/* ── Team Data ── */
interface Team {
  number: string;
  name: string;
  accent: string;
  accentRgb: string;
  logo?: string;
  tagline?: string;
  website?: string;
}

const teams: Team[] = [
  {
    number: "338",
    name: "Scaff It Up",
    accent: "#f97316",
    accentRgb: "249,115,22",
    tagline: "Building speed from the ground up",
  },
  {
    number: "43",
    name: "Kart Blanche",
    accent: "#e2e8f0",
    accentRgb: "226,232,240",
    logo: "/images/history/Kart Blanch #43.jpeg",
    tagline: "Full freedom on the track",
  },
  {
    number: "114",
    name: "Skid Mark Racing",
    accent: "#22c55e",
    accentRgb: "34,197,94",
    logo: "/images/history/Skid Mark Marcing.jpeg",
    tagline: "Leaving our mark on every lap",
  },
  {
    number: "5",
    name: "Claw Racing #2",
    accent: "#a855f7",
    accentRgb: "168,85,247",
    logo: "/images/history/Claw Racing.jpg",
    tagline: "Grip it and rip it",
    website: "https://clawconstruction.com.au/",
  },
  {
    number: "555",
    name: "Claw Racing",
    accent: "#ef4444",
    accentRgb: "239,68,68",
    logo: "/images/history/Claw Racing.jpg",
    tagline: "Clutching every podium",
    website: "https://clawconstruction.com.au/",
  },
  {
    number: "272",
    name: "Venom Racing",
    accent: "#84cc16",
    accentRgb: "132,204,22",
    tagline: "Striking fast, finishing first",
  },
  {
    number: "285",
    name: "Team 285",
    accent: "#64748b",
    accentRgb: "100,116,139",
    tagline: "Profile coming soon",
  },
  {
    number: "22",
    name: "Kart GPT",
    accent: "#06b6d4",
    accentRgb: "6,182,212",
    logo: "/images/history/KartGPT.jpeg",
    tagline: "Precision engineered racing",
  },
  {
    number: "249",
    name: "Torque it Up",
    accent: "#eab308",
    accentRgb: "234,179,8",
    tagline: "Maximum torque, maximum send",
  },
];

/* ── Decorative Patterns ── */
function CheckeredCorner({ color }: { color: string }) {
  return (
    <svg className="absolute top-0 right-0 w-20 h-20 opacity-20 pointer-events-none" viewBox="0 0 80 80" fill="none">
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 4 }, (_, col) =>
          (row + col) % 2 === 0 ? (
            <rect key={`${row}-${col}`} x={col * 20} y={row * 20} width="20" height="20" fill={color} />
          ) : null,
        ),
      )}
    </svg>
  );
}

function TireTrack({ color }: { color: string }) {
  return (
    <svg className="absolute bottom-0 left-0 w-full h-8 opacity-[0.07] pointer-events-none" viewBox="0 0 400 32" preserveAspectRatio="none">
      {Array.from({ length: 20 }, (_, i) => (
        <rect key={i} x={i * 20 + 2} y="4" width="12" height="24" rx="2" fill={color} />
      ))}
    </svg>
  );
}

function SpeedLines({ color }: { color: string }) {
  return (
    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-16 flex flex-col gap-2 opacity-15 pointer-events-none">
      {[24, 20, 16, 20, 24].map((w, i) => (
        <div key={i} className="h-[2px] rounded-full" style={{ width: `${w}px`, background: color }} />
      ))}
    </div>
  );
}

/* ── Single Team Card ── */
function TeamCard({ team }: { team: Team }) {
  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div
        className="relative bg-[#141414] border overflow-hidden"
        style={{ borderColor: `rgba(${team.accentRgb}, 0.3)` }}
      >
        {/* Top accent bar */}
        <div className="h-1.5 w-full" style={{ background: team.accent }} />

        {/* Decorative elements */}
        <CheckeredCorner color={team.accent} />
        <SpeedLines color={team.accent} />
        <TireTrack color={team.accent} />

        <div className="relative px-6 pt-8 pb-4">
          {/* Large watermark number */}
          <div
            className="absolute top-2 right-4 text-[80px] md:text-[120px] leading-none font-bold opacity-[0.06] select-none pointer-events-none"
            style={{ color: team.accent, fontFamily: "var(--font-heading), system-ui, sans-serif" }}
          >
            {team.number}
          </div>

          {/* Number badge */}
          <div className="relative z-10 inline-flex items-center gap-3 mb-6">
            <div
              className="flex items-center justify-center w-16 h-16 text-2xl font-bold border-2"
              style={{
                borderColor: team.accent,
                color: team.accent,
                boxShadow: `0 0 20px rgba(${team.accentRgb}, 0.2)`,
                fontFamily: "var(--font-heading), system-ui, sans-serif",
              }}
            >
              #{team.number}
            </div>
            <div>
              <div
                className="text-xs uppercase tracking-[0.3em]"
                style={{ color: team.accent, fontFamily: "var(--font-heading), system-ui, sans-serif" }}
              >
                Kart Number
              </div>
            </div>
          </div>

          {/* Logo area */}
          <div className="relative z-10 mb-6">
            {team.logo ? (
              <div
                className="relative w-full h-44 bg-black/30 border overflow-hidden"
                style={{ borderColor: `rgba(${team.accentRgb}, 0.15)` }}
              >
                <Image
                  src={team.logo}
                  alt={`${team.name} logo`}
                  fill
                  className="object-contain p-4"
                  sizes="420px"
                />
              </div>
            ) : (
              <div
                className="relative w-full h-44 bg-black/30 border flex items-center justify-center"
                style={{ borderColor: `rgba(${team.accentRgb}, 0.15)` }}
              >
                <div className="flex flex-col items-center gap-3">
                  <Flag size={40} style={{ color: team.accent }} strokeWidth={1} className="opacity-40" />
                  <span className="text-xs uppercase tracking-[0.2em] text-white/30" style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}>
                    Logo Coming Soon
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Team Name */}
          <div className="relative z-10">
            <h3
              className="text-2xl md:text-3xl uppercase tracking-[0.08em] text-white mb-2"
              style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}
            >
              {team.name}
            </h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-[2px] w-10" style={{ background: team.accent }} />
              <div className="h-[2px] w-3" style={{ background: `rgba(${team.accentRgb}, 0.4)` }} />
            </div>
            {team.tagline && (
              <p className="text-sm text-white/50 italic tracking-wide">
                &ldquo;{team.tagline}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: `rgba(${team.accentRgb}, 0.15)`, background: `rgba(${team.accentRgb}, 0.03)` }}
        >
          <div className="flex items-center gap-2">
            <Trophy size={14} style={{ color: team.accent }} strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-[0.2em] text-white/40" style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}>
              DS Racing Karts Team
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="w-2 h-2"
                style={{ background: i % 2 === 0 ? team.accent : "transparent", opacity: 0.3 }}
              />
            ))}
          </div>
        </div>

        {/* Website CTA */}
        {team.website && (
          <a
            href={team.website}
            target="_blank"
            rel="noopener noreferrer"
            className="group/link flex items-center justify-center gap-2 px-6 py-3 border-t transition-all duration-300 hover:brightness-125"
            style={{
              borderColor: `rgba(${team.accentRgb}, 0.15)`,
              background: `rgba(${team.accentRgb}, 0.08)`,
            }}
          >
            <ExternalLink size={14} style={{ color: team.accent }} strokeWidth={2} className="group-hover/link:translate-x-0.5 transition-transform" />
            <span
              className="text-xs uppercase tracking-[0.2em] transition-colors duration-300"
              style={{ color: team.accent, fontFamily: "var(--font-heading), system-ui, sans-serif" }}
            >
              See Our Other Work
            </span>
            <span
              className="text-xs opacity-0 group-hover/link:opacity-60 transition-opacity duration-300"
              style={{ color: team.accent }}
            >
              →
            </span>
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Main Carousel ── */
export default function TeamProfileCarousel() {
  const [isOpen, setIsOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const [animKey, setAnimKey] = useState(0);
  const isAnimating = useRef(false);

  const navigate = useCallback(
    (dir: "right" | "left") => {
      if (isAnimating.current) return;
      isAnimating.current = true;
      setSlideDir(dir);
      setCurrent((prev) =>
        dir === "right"
          ? (prev + 1) % teams.length
          : (prev - 1 + teams.length) % teams.length,
      );
      setAnimKey((k) => k + 1);
      setTimeout(() => { isAnimating.current = false; }, 350);
    },
    [],
  );

  const goNext = useCallback(() => navigate("right"), [navigate]);
  const goPrev = useCallback(() => navigate("left"), [navigate]);

  /* Keyboard nav */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, goNext, goPrev]);

  /* Body scroll lock */
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  /* Touch swipe */
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const diff = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? goNext() : goPrev();
    touchX.current = null;
  };

  const team = teams[current];

  return (
    <>
      {/* CTA Button */}
      <div className="text-center mt-10">
        <button
          onClick={() => { setCurrent(0); setIsOpen(true); }}
          className="group relative inline-flex items-center gap-3 bg-[#e60012] text-white
                     uppercase tracking-[0.15em] px-8 py-4 transition-all duration-300
                     hover:bg-[#ff1a2e] hover:shadow-[0_0_30px_rgba(230,0,18,0.4)]
                     active:scale-[0.98] overflow-hidden"
          style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}
        >
          <span
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ background: "repeating-conic-gradient(rgba(255,255,255,0.08) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px" }}
          />
          <Flag size={18} strokeWidth={2} className="relative z-10" />
          <span className="relative z-10 text-sm">Check Out Our Teams</span>
          <ChevronRight size={16} strokeWidth={2} className="relative z-10" />
        </button>
      </div>

      {/* ── Modal ── */}
      {isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
          style={{ zIndex: 9999 }}
          role="dialog"
          aria-modal="true"
          aria-label="Team profiles"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/90"
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              zIndex: 9999,
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Content */}
          <div
            className="relative w-full max-w-[480px] my-auto"
            style={{ zIndex: 10000 }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Close */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute -top-10 right-0 z-10 flex items-center gap-2 text-white/50 hover:text-white transition-colors"
              aria-label="Close"
            >
              <span className="text-xs uppercase tracking-[0.2em] hidden sm:inline" style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}>
                Close
              </span>
              <X size={24} strokeWidth={1.5} />
            </button>

            {/* Counter */}
            <div className="text-center mb-4">
              <span className="text-sm" style={{ color: team.accent, fontFamily: "var(--font-digital), monospace" }}>
                {String(current + 1).padStart(2, "0")}
              </span>
              <span className="text-white/30 text-sm mx-2" style={{ fontFamily: "var(--font-digital), monospace" }}>/</span>
              <span className="text-white/30 text-sm" style={{ fontFamily: "var(--font-digital), monospace" }}>
                {String(teams.length).padStart(2, "0")}
              </span>
            </div>

            {/* Card — key change forces re-mount for animation */}
            <div
              key={animKey}
              className="team-card-enter"
              style={{
                "--slide-from": slideDir === "right" ? "40px" : "-40px",
              } as React.CSSProperties}
            >
              <TeamCard team={team} />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 gap-4">
              <button
                onClick={goPrev}
                className="flex items-center gap-2 px-4 py-3 border border-white/10 bg-white/5
                           hover:bg-white/10 hover:border-white/20 text-white/70 hover:text-white
                           transition-all group"
                aria-label="Previous team"
              >
                <ChevronLeft size={20} strokeWidth={2} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs uppercase tracking-[0.15em]" style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}>Prev</span>
              </button>

              {/* Dot indicators */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {teams.map((t, i) => (
                  <button
                    key={t.number}
                    onClick={() => {
                      if (i === current) return;
                      setSlideDir(i > current ? "right" : "left");
                      setCurrent(i);
                      setAnimKey((k) => k + 1);
                    }}
                    className="p-0.5"
                    aria-label={`View ${t.name}`}
                  >
                    <div
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === current ? "18px" : "6px",
                        height: "6px",
                        background: i === current ? t.accent : `rgba(${t.accentRgb}, 0.3)`,
                      }}
                    />
                  </button>
                ))}
              </div>

              <button
                onClick={goNext}
                className="flex items-center gap-2 px-4 py-3 border border-white/10 bg-white/5
                           hover:bg-white/10 hover:border-white/20 text-white/70 hover:text-white
                           transition-all group"
                aria-label="Next team"
              >
                <span className="text-xs uppercase tracking-[0.15em]" style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}>Next</span>
                <ChevronRight size={20} strokeWidth={2} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Team label */}
            <div className="text-center mt-4 mb-2">
              <span
                className="text-xs uppercase tracking-[0.15em] transition-colors duration-300"
                style={{ color: team.accent, fontFamily: "var(--font-heading), system-ui, sans-serif" }}
              >
                #{team.number} — {team.name}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Inline styles for animations — guaranteed to work without Tailwind arbitrary value issues */}
      <style jsx global>{`
        .team-card-enter {
          animation: teamCardSlide 0.35s ease-out forwards;
        }
        @keyframes teamCardSlide {
          from {
            opacity: 0;
            transform: translateX(var(--slide-from, 40px));
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
