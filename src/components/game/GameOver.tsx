"use client";

import { useEffect, useState } from "react";
import type { GameState } from "./engine/state";

interface Props {
  state: GameState;
  onPlayAgain: () => void;
  onNewTrack: () => void;
  onQuit: () => void;
}

function formatTime(ms: number): string {
  if (!ms || ms === Infinity || ms <= 0) return "--:--.---";
  const s = ms / 1000;
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
}

export function GameOver({ state, onPlayAgain, onNewTrack, onQuit }: Props) {
  const winner = state.winner;
  const winnerColor = winner === 1 ? "#e60012" : "#2060ff";
  const winnerName = winner === 1 ? "PLAYER 1" : (state.isMultiplayer ? "PLAYER 2" : "CPU");
  const [showContent, setShowContent] = useState(false);
  const [trophyBounce, setTrophyBounce] = useState(false);
  const [sparkles, setSparkles] = useState<{ x: number; y: number; delay: number }[]>([]);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [flashFrame, setFlashFrame] = useState(0);

  useEffect(() => {
    // Stagger the reveal
    setTimeout(() => setTrophyBounce(true), 200);
    setTimeout(() => setShowContent(true), 600);

    // Generate sparkle positions
    const s = Array.from({ length: 12 }, () => ({
      x: 20 + Math.random() * 60,
      y: 10 + Math.random() * 40,
      delay: Math.random() * 2,
    }));
    setSparkles(s);

    const interval = setInterval(() => setFlashFrame(f => f + 1), 150);
    return () => clearInterval(interval);
  }, []);

  const car1 = state.car1;
  const car2 = state.car2;
  // Use frozen raceEndTime so the timer doesn't keep counting
  const endTime = state.raceEndTime || Date.now();
  const raceTime = endTime - state.raceStartTime;

  // Each player's total = sum of their lap times (more accurate per-player)
  const car1Total = car1.lapTimes.length > 0 ? car1.lapTimes.reduce((a, b) => a + b, 0) : raceTime;
  const car2Total = car2.lapTimes.length > 0 ? car2.lapTimes.reduce((a, b) => a + b, 0) : raceTime;

  const stats = [
    { label: "Total Time", p1: formatTime(car1Total), p2: formatTime(car2Total) },
    { label: "Best Lap", p1: formatTime(car1.fastestLap), p2: formatTime(car2.fastestLap) },
    { label: "Top Speed", p1: `${Math.round(car1.topSpeed)} km/h`, p2: `${Math.round(car2.topSpeed)} km/h` },
    { label: "Spin-Outs", p1: String(car1.spinOuts), p2: String(car2.spinOuts) },
    { label: "Laps", p1: String(Math.max(0, car1.lapCount - car1.penaltyLaps)), p2: String(Math.max(0, car2.lapCount - car2.penaltyLaps)) },
  ];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-30">
      <div className="absolute inset-0 chequered-bg opacity-10" />

      {/* Top chequered banner */}
      <div className="absolute top-0 left-0 right-0 h-10 chequered-stripe opacity-40" />
      <div className="absolute top-10 left-0 right-0 h-1" style={{ backgroundColor: winnerColor }} />

      <div className="relative z-10 text-center max-w-lg mx-auto px-4">
        {/* Animated Trophy */}
        <div
          className={`mb-4 transition-all duration-700 ${
            trophyBounce ? "opacity-100 scale-100" : "opacity-0 scale-50"
          }`}
          style={{ transform: trophyBounce ? "translateY(0)" : "translateY(-30px)" }}
        >
          <svg viewBox="0 0 100 80" width="140" height="112" className="mx-auto">
            {/* Sparkles */}
            {sparkles.map((s, i) => (
              <g key={i} opacity="0.8">
                <circle cx={s.x} cy={s.y} r="1.5" fill="#d4af37">
                  <animate attributeName="opacity" values="0;1;0" dur="1.5s" begin={`${s.delay}s`} repeatCount="indefinite" />
                  <animate attributeName="r" values="0.5;2;0.5" dur="1.5s" begin={`${s.delay}s`} repeatCount="indefinite" />
                </circle>
              </g>
            ))}

            {/* Trophy base */}
            <rect x="35" y="60" width="30" height="6" fill="#888" rx="2" />
            <rect x="30" y="66" width="40" height="5" fill="#666" rx="2" />
            {/* Trophy stem */}
            <rect x="44" y="50" width="12" height="12" fill="#aa8820" rx="1" />

            {/* Trophy cup */}
            <path d="M 28 12 L 72 12 L 68 48 C 66 54 58 56 50 56 C 42 56 34 54 32 48 Z" fill={winnerColor} />
            {/* Cup shine */}
            <path d="M 34 14 L 40 14 L 38 44 C 37 46 36 47 35 47 Z" fill="rgba(255,255,255,0.2)" />

            {/* Left handle */}
            <path d="M 28 12 L 16 14 C 12 15 10 18 12 26 C 14 34 22 36 28 30" fill={winnerColor} opacity="0.75" />
            {/* Right handle */}
            <path d="M 72 12 L 84 14 C 88 15 90 18 88 26 C 86 34 78 36 72 30" fill={winnerColor} opacity="0.75" />

            {/* Winner number plate */}
            <rect x="40" y="20" width="20" height="18" rx="3" fill="#d4af37" />
            <rect x="42" y="22" width="16" height="14" rx="2" fill="#0a0a0a" />
            <text x="50" y="33" textAnchor="middle" fontSize="12" fontFamily="var(--font-digital)" fill="#d4af37" fontWeight="bold">
              P{winner}
            </text>

            {/* Stars */}
            <text x="50" y="8" textAnchor="middle" fontSize="8" fill="#d4af37">
              ★
            </text>
            <text x="38" y="11" textAnchor="middle" fontSize="5" fill="#d4af37" opacity="0.6">
              ★
            </text>
            <text x="62" y="11" textAnchor="middle" fontSize="5" fill="#d4af37" opacity="0.6">
              ★
            </text>
          </svg>
        </div>

        {/* Winner announcement */}
        <div className={`transition-all duration-700 ${showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h3
            className="font-digital text-3xl md:text-5xl tracking-[0.15em] mb-1"
            style={{ color: winnerColor, textShadow: `0 0 30px ${winnerColor}66` }}
          >
            {winnerName} WINS!
          </h3>

          <p className="font-digital text-xs text-text-muted tracking-[0.3em] mb-1">
            — RACE COMPLETE —
          </p>

          {car1.falseStarts >= 3 && (
            <p className="font-digital text-xs text-[#e60012] mb-2 animate-pulse">P1 DISQUALIFIED — 3 FALSE STARTS</p>
          )}
          {car2.falseStarts >= 3 && (
            <p className="font-digital text-xs text-[#2060ff] mb-2 animate-pulse">P2 DISQUALIFIED — 3 FALSE STARTS</p>
          )}

          {/* Stats table */}
          <div className="mt-6 mb-8 bg-black/60 border border-surface-600/30">
            <div className="flex justify-between text-[10px] font-digital tracking-wider text-text-muted py-2 px-4 bg-surface-800/50 border-b border-surface-600/30">
              <span className="text-[#e60012] w-20 text-left">P1</span>
              <span className="flex-1 text-center">STAT</span>
              <span className="text-[#2060ff] w-20 text-right">P2</span>
            </div>
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`flex justify-between items-center py-2 px-4 ${
                  i < stats.length - 1 ? "border-b border-surface-700/30" : ""
                }`}
              >
                <span className="font-digital text-[11px] text-white w-20 text-left tabular-nums">{s.p1}</span>
                <span className="font-digital text-[10px] md:text-xs text-text-muted tracking-wider uppercase flex-1 text-center">{s.label}</span>
                <span className="font-digital text-[11px] text-white w-20 text-right tabular-nums">{s.p2}</span>
              </div>
            ))}
          </div>

          {/* Action buttons with Mario Kart-style flash hover */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {[
              { key: "again", label: "RACE AGAIN", onClick: onPlayAgain, primary: true },
              { key: "track", label: "NEW TRACK", onClick: onNewTrack, primary: false },
              { key: "quit", label: "QUIT", onClick: onQuit, primary: false },
            ].map((btn) => {
              const isHovered = hoveredButton === btn.key;
              const flash = isHovered && flashFrame % 2 === 0;
              return (
                <button
                  key={btn.key}
                  onClick={btn.onClick}
                  onMouseEnter={() => setHoveredButton(btn.key)}
                  onMouseLeave={() => setHoveredButton(null)}
                  className={`font-digital text-sm tracking-[0.15em] px-6 py-3 border transition-all ${
                    btn.primary
                      ? "bg-racing-red text-white border-racing-red hover:bg-racing-red/80"
                      : "bg-surface-800 text-text-secondary border-surface-600 hover:text-white hover:border-white/40"
                  }`}
                  style={{
                    boxShadow: flash ? `0 0 20px ${btn.primary ? "rgba(230,0,18,0.5)" : "rgba(255,255,255,0.15)"}` : "none",
                    background: flash && !btn.primary ? "rgba(255,255,255,0.08)" : undefined,
                  }}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
