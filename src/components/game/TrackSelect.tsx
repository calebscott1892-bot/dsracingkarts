"use client";

import { useRef, useEffect, useState } from "react";
import { TRACKS } from "./engine/track";
import type { AIDifficulty } from "./engine/state";
import { DIFFICULTY_PROFILES } from "./engine/constants";

interface Props {
  onSelect: (trackIndex: number, laps: number, difficulty?: AIDifficulty) => void;
  showDifficulty?: boolean; // true for single player
}

function TrackThumbnail({ trackIndex, selected, hovered }: { trackIndex: number; selected: boolean; hovered: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const track = TRACKS[trackIndex];
    const points = track.racingLine;
    if (points.length < 2) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const padding = 25;
    const scaleX = (canvas.width - padding * 2) / (maxX - minX);
    const scaleY = (canvas.height - padding * 2) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY);
    const offsetX = padding + ((canvas.width - padding * 2) - (maxX - minX) * scale) / 2;
    const offsetY = padding + ((canvas.height - padding * 2) - (maxY - minY) * scale) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grass pattern
    ctx.fillStyle = "#0d2a0d";
    for (let y = 0; y < canvas.height; y += 8) {
      if ((y / 8) % 2 === 0) ctx.fillRect(0, y, canvas.width, 4);
    }

    // Track surface (wide)
    ctx.strokeStyle = "#333";
    ctx.lineWidth = (selected || hovered) ? 10 : 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const x = (points[i].x - minX) * scale + offsetX;
      const y = (points[i].y - minY) * scale + offsetY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Kerbs
    ctx.lineWidth = (selected || hovered) ? 12 : 10;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = selected ? "#e60012" : "#666";
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.lineDashOffset = 4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Re-draw asphalt center
    ctx.lineWidth = (selected || hovered) ? 8 : 6;
    ctx.strokeStyle = "#333";
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const x = (points[i].x - minX) * scale + offsetX;
      const y = (points[i].y - minY) * scale + offsetY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Start/finish marker
    const sp = points[track.startIndex];
    const sx = (sp.x - minX) * scale + offsetX;
    const sy = (sp.y - minY) * scale + offsetY;

    // Chequered flag at start
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#fff" : "#1a1a1a";
        ctx.fillRect(sx - 4 + c * 3, sy - 4 + r * 3, 3, 3);
      }
    }

    // Selected glow
    if (selected) {
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#d4af37";
      ctx.shadowBlur = 15;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      ctx.shadowBlur = 0;
    }

  }, [trackIndex, selected, hovered]);

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={160}
      className="w-full h-auto"
    />
  );
}

const TRACK_DIFFICULTIES = ["Easy", "Medium", "Hard", "Expert"];

// Difficulty cards now read from the central profile so flavour text and
// realistic-conditions description stay consistent with the engine.
const DIFFICULTY_OPTIONS: { key: AIDifficulty; color: string }[] = [
  { key: "easy", color: "#4ade80" },
  { key: "medium", color: "#d4af37" },
  { key: "hard", color: "#f97316" },
  { key: "extreme", color: "#e60012" },
];

export function TrackSelect({ onSelect, showDifficulty }: Props) {
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [hoveredTrack, setHoveredTrack] = useState<number | null>(null);
  const [laps, setLaps] = useState(5);
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium");
  const [flashFrame, setFlashFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setFlashFrame(f => f + 1), 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 bg-black z-20 overflow-y-auto overflow-x-hidden">
      {/* Background */}
      <div className="absolute inset-0 chequered-bg opacity-5 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-10 md:h-12 chequered-stripe opacity-30 pointer-events-none" />
      <div className="absolute top-10 md:top-12 left-0 right-0 h-1 bg-racing-red pointer-events-none" />

      <div className="relative min-h-full flex flex-col items-center justify-center px-4 pt-16 pb-6 md:pt-14 md:pb-8">
      <div className="relative z-10 text-center max-w-4xl mx-auto w-full">
        <h3
          className="font-digital text-xl md:text-3xl tracking-[0.2em] mb-2 text-racing-gold"
          style={{ textShadow: "0 0 20px rgba(212,175,55,0.4)" }}
        >
          SELECT TRACK
        </h3>
        <div className="flex items-center justify-center gap-2 mb-4 md:mb-8">
          <div className="h-[1px] w-12 bg-racing-red" />
          <div className="w-1.5 h-1.5 bg-racing-red rotate-45" />
          <div className="h-[1px] w-12 bg-racing-red" />
        </div>

        {/* Track grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-8">
          {TRACKS.map((track, i) => {
            const isSelected = selectedTrack === i;
            const isHovered = hoveredTrack === i;
            const showFlash = isHovered && flashFrame % 2 === 0;

            return (
              <button
                key={track.name}
                onClick={() => setSelectedTrack(i)}
                onMouseEnter={() => setHoveredTrack(i)}
                onMouseLeave={() => setHoveredTrack(null)}
                className="relative group"
              >
                {/* Selection glow */}
                {isSelected && (
                  <div
                    className="absolute -inset-1 z-0"
                    style={{
                      boxShadow: "0 0 25px rgba(212,175,55,0.5), 0 0 50px rgba(212,175,55,0.2)",
                      border: "2px solid #d4af37",
                    }}
                  />
                )}

                {/* Flash bar on hover */}
                {showFlash && !isSelected && (
                  <div className="absolute -inset-1 z-0 bg-white/10" />
                )}

                <div
                  className={`relative z-10 border-2 transition-all ${
                    isSelected
                      ? "border-racing-gold"
                      : isHovered
                      ? "border-white/40"
                      : "border-surface-700"
                  }`}
                >
                  <TrackThumbnail trackIndex={i} selected={isSelected} hovered={isHovered || false} />

                  {/* Track info overlay */}
                  <div className="bg-black/80 p-2">
                    <div
                      className={`font-digital text-[11px] tracking-wider uppercase ${
                        isSelected ? "text-racing-gold" : "text-text-secondary"
                      }`}
                    >
                      {track.name}
                    </div>
                    <div className="font-digital text-[10px] md:text-xs tracking-wider text-text-muted mt-0.5">
                      {TRACK_DIFFICULTIES[i]} — {Math.round(track.trackLength)}m
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Lap selector */}
        <div className="mb-4 md:mb-8 flex items-center justify-center gap-4 flex-wrap">
          <span className="font-digital text-xs text-text-muted tracking-wider">LAPS:</span>
          <div className="flex gap-1">
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setLaps(n)}
                className={`font-digital text-sm px-5 py-2.5 transition-all border ${
                  laps === n
                    ? "bg-racing-red text-white border-racing-red shadow-[0_0_15px_rgba(230,0,18,0.4)]"
                    : "bg-surface-800 text-text-muted border-surface-600 hover:text-white hover:border-surface-400"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* CPU Difficulty selector (single player only) — realistic-conditions cards */}
        {showDifficulty && (
          <div className="mb-5 md:mb-8 flex flex-col items-center gap-2">
            <span className="font-digital text-[10px] text-text-muted tracking-[0.3em]">CONDITIONS</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full max-w-3xl px-1">
              {DIFFICULTY_OPTIONS.map((d) => {
                const profile = DIFFICULTY_PROFILES[d.key];
                const selected = difficulty === d.key;
                return (
                  <button
                    key={d.key}
                    onClick={() => setDifficulty(d.key)}
                    className={`group relative font-digital text-left px-3 py-2 transition-all border ${
                      selected
                        ? "text-white"
                        : "bg-surface-800/70 text-text-muted border-surface-600 hover:text-white hover:border-surface-400"
                    }`}
                    style={selected ? {
                      backgroundColor: d.color + "22",
                      borderColor: d.color,
                      boxShadow: `0 0 14px ${d.color}55`,
                    } : undefined}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="text-[12px] tracking-[0.2em] font-bold"
                        style={selected ? { color: d.color } : undefined}
                      >
                        {profile.label}
                      </span>
                    </div>
                    <div
                      className="text-[8.5px] tracking-[0.18em] mt-0.5"
                      style={{ color: selected ? d.color : "#7a8088" }}
                    >
                      {profile.flavour}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="font-digital text-[10px] md:text-[11px] text-text-secondary text-center mt-1 max-w-md px-2 leading-relaxed">
              {DIFFICULTY_PROFILES[difficulty].description}
            </div>
          </div>
        )}

        {/* Go button */}
        <button
          onClick={() => onSelect(selectedTrack, laps, showDifficulty ? difficulty : undefined)}
          className="font-digital text-lg md:text-xl px-12 md:px-16 py-3 md:py-4 bg-racing-red text-white border-2 border-racing-red
                     hover:bg-racing-red/80 transition-all tracking-[0.2em]
                     shadow-[0_0_30px_rgba(230,0,18,0.4)]
                     hover:shadow-[0_0_40px_rgba(230,0,18,0.6)]"
        >
          RACE!
        </button>
      </div>
      </div>
    </div>
  );
}
