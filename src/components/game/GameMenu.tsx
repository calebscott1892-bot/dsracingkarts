"use client";

import { useState, useEffect } from "react";

interface Props {
  onSelect: (multiplayer: boolean) => void;
}

// Pixel art kart with trophy — single player celebration
function PixelKartTrophy({ color, active }: { color: string; active: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" style={{ imageRendering: "pixelated" }}>
      {/* Trophy */}
      <rect x="18" y="2" width="12" height="3" fill={active ? "#d4af37" : "#555"} />
      <rect x="16" y="5" width="16" height="8" fill={active ? "#d4af37" : "#555"} />
      <rect x="12" y="5" width="4" height="6" fill={active ? "#c49b28" : "#444"} />
      <rect x="32" y="5" width="4" height="6" fill={active ? "#c49b28" : "#444"} />
      <rect x="20" y="13" width="8" height="3" fill={active ? "#d4af37" : "#555"} />
      <rect x="18" y="16" width="12" height="2" fill={active ? "#aa8820" : "#444"} />
      {/* Star on trophy */}
      <rect x="22" y="7" width="4" height="4" fill={active ? "#fff" : "#666"} />

      {/* Kart body */}
      <rect x="10" y="24" width="28" height="14" rx="2" fill={active ? color : "#3a3a3a"} />
      {/* Cockpit */}
      <rect x="18" y="26" width="12" height="10" rx="1" fill={active ? "#111" : "#2a2a2a"} />
      {/* Helmet */}
      <rect x="21" y="27" width="6" height="5" rx="3" fill={active ? (color === "#e60012" ? "#cc2200" : "#3366cc") : "#444"} />
      <rect x="24" y="28" width="3" height="3" fill={active ? "#1a1a1a" : "#333"} />
      {/* Helmet shine */}
      <rect x="22" y="27" width="2" height="1" fill={active ? "rgba(255,255,255,0.5)" : "#555"} />

      {/* Wheels */}
      <rect x="6" y="26" width="6" height="4" fill={active ? "#1a1a1a" : "#222"} />
      <rect x="6" y="34" width="6" height="4" fill={active ? "#1a1a1a" : "#222"} />
      <rect x="36" y="26" width="6" height="4" fill={active ? "#1a1a1a" : "#222"} />
      <rect x="36" y="34" width="6" height="4" fill={active ? "#1a1a1a" : "#222"} />

      {/* Front wing */}
      <rect x="38" y="24" width="4" height="16" rx="1" fill={active ? color : "#3a3a3a"} opacity="0.8" />
      {/* Rear wing */}
      <rect x="6" y="22" width="4" height="18" rx="1" fill={active ? color : "#3a3a3a"} opacity="0.6" />

      {/* Number */}
      <text x="24" y="42" textAnchor="middle" fontSize="6" fontFamily="monospace" fill={active ? "#fff" : "#555"} fontWeight="bold">1</text>

      {/* Champagne spray if active */}
      {active && (
        <>
          <rect x="8" y="4" width="1" height="6" fill="#d4af37" opacity="0.6" />
          <rect x="38" y="2" width="1" height="8" fill="#d4af37" opacity="0.6" />
          <rect x="14" y="1" width="1" height="4" fill="#d4af37" opacity="0.4" />
          <rect x="34" y="3" width="1" height="5" fill="#d4af37" opacity="0.5" />
          <rect x="26" y="0" width="1" height="3" fill="#fff" opacity="0.5" />
        </>
      )}
    </svg>
  );
}

// Pixel art two karts — doubles celebration
function PixelKartDoubles({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" style={{ imageRendering: "pixelated" }}>
      {/* Chequered flag */}
      {[0, 1, 2, 3, 4, 5].map(r =>
        [0, 1, 2, 3].map(c => (
          <rect
            key={`f${r}${c}`}
            x={16 + c * 4}
            y={1 + r * 3}
            width="4" height="3"
            fill={(r + c) % 2 === 0 ? (active ? "#fff" : "#555") : (active ? "#1a1a1a" : "#333")}
          />
        ))
      )}

      {/* Red kart (left) */}
      <rect x="2" y="24" width="18" height="10" rx="1" fill={active ? "#e60012" : "#3a3a3a"} />
      <rect x="7" y="26" width="8" height="6" rx="1" fill={active ? "#111" : "#2a2a2a"} />
      <rect x="9" y="26" width="4" height="4" rx="2" fill={active ? "#cc2200" : "#444"} />
      <rect x="11" y="27" width="2" height="2" fill={active ? "#1a1a1a" : "#333"} />
      <rect x="0" y="25" width="4" height="3" fill={active ? "#1a1a1a" : "#222"} />
      <rect x="0" y="31" width="4" height="3" fill={active ? "#1a1a1a" : "#222"} />
      <rect x="18" y="25" width="4" height="3" fill={active ? "#1a1a1a" : "#222"} />
      <rect x="18" y="31" width="4" height="3" fill={active ? "#1a1a1a" : "#222"} />
      <text x="11" y="38" textAnchor="middle" fontSize="5" fontFamily="monospace" fill={active ? "#fff" : "#555"} fontWeight="bold">1</text>

      {/* Blue kart (right) */}
      <rect x="28" y="24" width="18" height="10" rx="1" fill={active ? "#2060ff" : "#3a3a3a"} />
      <rect x="33" y="26" width="8" height="6" rx="1" fill={active ? "#111" : "#2a2a2a"} />
      <rect x="35" y="26" width="4" height="4" rx="2" fill={active ? "#3366cc" : "#444"} />
      <rect x="37" y="27" width="2" height="2" fill={active ? "#1a1a1a" : "#333"} />
      <rect x="26" y="25" width="4" height="3" fill={active ? "#1a1a1a" : "#222"} />
      <rect x="26" y="31" width="4" height="3" fill={active ? "#1a1a1a" : "#222"} />
      <rect x="44" y="25" width="4" height="3" fill={active ? "#1a1a1a" : "#222"} />
      <rect x="44" y="31" width="4" height="3" fill={active ? "#1a1a1a" : "#222"} />
      <text x="37" y="38" textAnchor="middle" fontSize="5" fontFamily="monospace" fill={active ? "#fff" : "#555"} fontWeight="bold">2</text>

      {/* VS text */}
      {active && (
        <text x="24" y="32" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#d4af37" fontWeight="bold">VS</text>
      )}
    </svg>
  );
}

export function GameMenu({ onSelect }: Props) {
  const [hovered, setHovered] = useState<"1p" | "2p" | null>(null);
  const [selected, setSelected] = useState<"1p" | "2p" | null>(null);
  const [flashFrame, setFlashFrame] = useState(0);
  const [titleGlow, setTitleGlow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile (no physical keyboard → single player only)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Flashing animation for menu items (Mario Kart style)
  useEffect(() => {
    const interval = setInterval(() => {
      setFlashFrame(f => f + 1);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Title glow pulse
  useEffect(() => {
    const interval = setInterval(() => {
      setTitleGlow(g => !g);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  function handleSelect(mode: "1p" | "2p") {
    setSelected(mode);
    setTimeout(() => onSelect(mode === "2p"), 1200);
  }

  const flash1p = hovered === "1p" && flashFrame % 2 === 0;
  const flash2p = hovered === "2p" && flashFrame % 2 === 0;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 overflow-hidden">
      {/* Animated chequered background */}
      <div className="absolute inset-0 chequered-bg opacity-8" />

      {/* Top chequered banner */}
      <div className="absolute top-0 left-0 right-0 h-16 chequered-stripe opacity-40" />
      <div className="absolute bottom-0 left-0 right-0 h-8 chequered-stripe opacity-30" />

      {/* Red racing stripe accents */}
      <div className="absolute top-16 left-0 right-0 h-1 bg-racing-red" />
      <div className="absolute bottom-8 left-0 right-0 h-1 bg-racing-red" />

      <div className="relative z-10 text-center">
        {/* Title with glow effect */}
        <div className="mb-2">
          <h2
            className="font-digital text-4xl md:text-6xl tracking-[0.2em] transition-all duration-500"
            style={{
              color: titleGlow ? "#d4af37" : "#ffffff",
              textShadow: titleGlow
                ? "0 0 30px rgba(212,175,55,0.8), 0 0 60px rgba(212,175,55,0.4)"
                : "0 0 10px rgba(255,255,255,0.3)",
            }}
          >
            DSR GRAND PRIX
          </h2>
        </div>
        <p className="font-digital text-xs tracking-[0.4em] text-text-muted mb-2">
          DS RACING KARTS PRESENTS
        </p>

        {/* Decorative line */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="h-[2px] w-16 bg-gradient-to-r from-transparent to-racing-red" />
          <div className="w-2 h-2 bg-racing-red rotate-45" />
          <div className="h-[2px] w-16 bg-gradient-to-l from-transparent to-racing-red" />
        </div>

        {/* Mode selection buttons */}
        <div className="flex gap-6 md:gap-12 justify-center mb-10">
          {/* Single Player */}
          <button
            onMouseEnter={() => setHovered("1p")}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleSelect("1p")}
            className="group flex flex-col items-center"
          >
            {/* Pixel art container with Mario Kart-style selection bar */}
            <div className="relative">
              {/* Flash bar (Mario Kart hover effect) */}
              {(flash1p || selected === "1p") && (
                <div
                  className="absolute -inset-2 z-0 transition-all"
                  style={{
                    background: selected === "1p"
                      ? "linear-gradient(180deg, rgba(212,175,55,0.3), rgba(212,175,55,0.1))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.15), transparent)",
                    boxShadow: selected === "1p"
                      ? "0 0 30px rgba(212,175,55,0.5), inset 0 0 20px rgba(212,175,55,0.2)"
                      : "0 0 15px rgba(255,255,255,0.2)",
                  }}
                />
              )}

              <div
                className={`relative z-10 w-28 h-28 md:w-36 md:h-36 border-2 p-2 transition-all duration-200 ${
                  selected === "1p"
                    ? "border-racing-gold bg-racing-gold/10 scale-110"
                    : hovered === "1p"
                    ? "border-white/60 bg-white/5"
                    : "border-surface-600 bg-surface-900/80"
                }`}
                style={{ imageRendering: "pixelated" }}
              >
                <PixelKartTrophy
                  color="#e60012"
                  active={hovered === "1p" || selected === "1p"}
                />
              </div>
            </div>

            <div className="mt-4">
              <span
                className={`font-digital text-sm md:text-base tracking-[0.15em] transition-all ${
                  selected === "1p"
                    ? "text-racing-gold"
                    : hovered === "1p"
                    ? "text-white"
                    : "text-text-muted"
                }`}
              >
                1 PLAYER
              </span>
              <div className="font-digital text-xs text-text-muted tracking-wider mt-1">
                {isMobile ? "TAP CONTROLS" : "W / S KEYS"}
              </div>
            </div>
          </button>

          {/* Divider */}
          <div className="flex flex-col items-center justify-center">
            <div className="h-20 w-[1px] bg-gradient-to-b from-transparent via-surface-500 to-transparent" />
            <span className="font-digital text-xs text-text-muted tracking-wider my-2">OR</span>
            <div className="h-20 w-[1px] bg-gradient-to-b from-transparent via-surface-500 to-transparent" />
          </div>

          {/* Doubles */}
          <div className="relative">
          <button
            onMouseEnter={() => setHovered("2p")}
            onMouseLeave={() => setHovered(null)}
            onClick={() => !isMobile && handleSelect("2p")}
            className={`group flex flex-col items-center ${isMobile ? "opacity-40 grayscale" : ""}`}
          >
            <div className="relative">
              {(flash2p || selected === "2p") && (
                <div
                  className="absolute -inset-2 z-0 transition-all"
                  style={{
                    background: selected === "2p"
                      ? "linear-gradient(180deg, rgba(192,192,192,0.3), rgba(192,192,192,0.1))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.15), transparent)",
                    boxShadow: selected === "2p"
                      ? "0 0 30px rgba(192,192,192,0.5), inset 0 0 20px rgba(192,192,192,0.2)"
                      : "0 0 15px rgba(255,255,255,0.2)",
                  }}
                />
              )}

              <div
                className={`relative z-10 w-28 h-28 md:w-36 md:h-36 border-2 p-2 transition-all duration-200 ${
                  selected === "2p"
                    ? "border-racing-silver bg-racing-silver/10 scale-110"
                    : hovered === "2p"
                    ? "border-white/60 bg-white/5"
                    : "border-surface-600 bg-surface-900/80"
                }`}
                style={{ imageRendering: "pixelated" }}
              >
                <PixelKartDoubles active={hovered === "2p" || selected === "2p"} />
              </div>
            </div>

            <div className="mt-4">
              <span
                className={`font-digital text-sm md:text-base tracking-[0.15em] transition-all ${
                  selected === "2p"
                    ? "text-racing-silver"
                    : hovered === "2p"
                    ? "text-white"
                    : "text-text-muted"
                }`}
              >
                2 PLAYERS
              </span>
              <div className="font-digital text-xs text-text-muted tracking-wider mt-1">
                W/S + ↑/↓
              </div>
            </div>
          </button>
          {isMobile && (
            <div className="absolute inset-0 flex items-center justify-center z-10 rounded-lg bg-black/70 backdrop-blur-[2px]">
              <span className="font-digital text-xs text-racing-gold tracking-wider text-center leading-tight uppercase">
                Desktop<br/>Exclusive
              </span>
            </div>
          )}
          </div>
        </div>

        {/* Bottom instruction */}
        <p className="font-digital text-xs tracking-[0.3em] text-text-muted animate-pulse">
          {isMobile ? "TAP 1 PLAYER TO BEGIN" : "SELECT MODE TO BEGIN"}
        </p>
      </div>
    </div>
  );
}
