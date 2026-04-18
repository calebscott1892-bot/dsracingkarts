"use client";

import { useEffect, useState } from "react";
import type { GameState } from "./engine/state";
import { CAR_DEFAULTS } from "./engine/constants";

interface Props {
  state: GameState;
}

function formatTime(ms: number): string {
  if (!ms || ms === Infinity || ms <= 0) return "--:--.---";
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
}

function speedToKmh(speed: number): number {
  return Math.round((speed / CAR_DEFAULTS.maxSpeed) * 110);
}

export function GameHUD({ state }: Props) {
  const [now, setNow] = useState(Date.now());

  // Re-render every frame for live timer updates
  useEffect(() => {
    let raf: number;
    function tick() {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const car1EffectiveLap = Math.max(0, state.car1.lapCount - state.car1.penaltyLaps);
  const car2EffectiveLap = Math.max(0, state.car2.lapCount - state.car2.penaltyLaps);
  const car1CurrentLap = state.car1.currentLapStart > 0 ? now - state.car1.currentLapStart : 0;
  const car2CurrentLap = state.car2.currentLapStart > 0 ? now - state.car2.currentLapStart : 0;
  const car1Speed = speedToKmh(state.car1.speed);
  const car2Speed = speedToKmh(state.car2.speed);

  const leader =
    car1EffectiveLap > car2EffectiveLap ? "P1 LEADS" :
    car2EffectiveLap > car1EffectiveLap ? "P2 LEADS" :
    state.car1.trackPosition > state.car2.trackPosition ? "P1 LEADS" :
    state.car2.trackPosition > state.car1.trackPosition ? "P2 LEADS" :
    "NECK AND NECK";

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-3">
      {/* Top: Race status */}
      <div className="text-center">
        <span className="font-digital text-xs tracking-[0.3em] text-racing-gold uppercase bg-black/70 px-4 py-1.5 inline-block border border-racing-gold/30">
          {leader}
        </span>
      </div>

      {/* Bottom: Player stats panels */}
      <div className="flex justify-between items-end gap-4">
        {/* P1 Panel */}
        <div className="bg-black/80 backdrop-blur-sm border border-surface-600/50 border-l-3 border-l-[#e60012] min-w-[150px] md:min-w-[170px]">
          <div className="bg-[#e60012]/20 px-3 py-1 border-b border-surface-600/30">
            <span className="font-digital text-xs text-[#e60012] tracking-[0.2em]">P1 — RED</span>
          </div>
          <div className="px-3 py-2 space-y-1">
            <div className="flex justify-between font-digital text-[10px] md:text-xs">
              <span className="text-text-muted">LAP</span>
              <span className="text-white tabular-nums">{car1EffectiveLap} / {state.totalLaps}</span>
            </div>
            <div className="flex justify-between font-digital text-[10px] md:text-xs">
              <span className="text-text-muted">SPEED</span>
              <span className={`tabular-nums ${car1Speed > 90 ? "text-[#e60012]" : car1Speed > 70 ? "text-racing-gold" : "text-white"}`}>
                {car1Speed} km/h
              </span>
            </div>
            <div className="flex justify-between font-digital text-[10px] md:text-xs">
              <span className="text-text-muted">BEST</span>
              <span className="text-racing-gold tabular-nums">{formatTime(state.car1.fastestLap)}</span>
            </div>
            <div className="flex justify-between font-digital text-[10px] md:text-xs">
              <span className="text-text-muted">CURRENT</span>
              <span className="text-white tabular-nums">{formatTime(car1CurrentLap)}</span>
            </div>
            {state.car1.spinOuts > 0 && (
              <div className="flex justify-between font-digital text-[10px] md:text-xs">
                <span className="text-text-muted">SPINS</span>
                <span className="text-[#e60012] tabular-nums">{state.car1.spinOuts}</span>
              </div>
            )}
          </div>
          {/* Speed bar */}
          <div className="h-1 bg-surface-800">
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${Math.min(100, (car1Speed / 110) * 100)}%`,
                background: car1Speed > 90 ? "#e60012" : car1Speed > 70 ? "#d4af37" : "#4ade80",
              }}
            />
          </div>
        </div>

        {/* P2 Panel */}
        <div className="bg-black/80 backdrop-blur-sm border border-surface-600/50 border-r-3 border-r-[#2060ff] min-w-[150px] md:min-w-[170px]">
          <div className="bg-[#2060ff]/20 px-3 py-1 border-b border-surface-600/30 text-right">
            <span className="font-digital text-xs text-[#2060ff] tracking-[0.2em]">
              P2 — {state.isMultiplayer ? "BLUE" : "CPU"}
            </span>
          </div>
          <div className="px-3 py-2 space-y-1">
            <div className="flex justify-between font-digital text-[10px] md:text-xs">
              <span className="text-text-muted">LAP</span>
              <span className="text-white tabular-nums">{car2EffectiveLap} / {state.totalLaps}</span>
            </div>
            <div className="flex justify-between font-digital text-[10px] md:text-xs">
              <span className="text-text-muted">SPEED</span>
              <span className={`tabular-nums ${car2Speed > 90 ? "text-[#2060ff]" : car2Speed > 70 ? "text-racing-gold" : "text-white"}`}>
                {car2Speed} km/h
              </span>
            </div>
            <div className="flex justify-between font-digital text-[10px] md:text-xs">
              <span className="text-text-muted">BEST</span>
              <span className="text-racing-gold tabular-nums">{formatTime(state.car2.fastestLap)}</span>
            </div>
            <div className="flex justify-between font-digital text-[10px] md:text-xs">
              <span className="text-text-muted">CURRENT</span>
              <span className="text-white tabular-nums">{formatTime(car2CurrentLap)}</span>
            </div>
            {state.car2.spinOuts > 0 && (
              <div className="flex justify-between font-digital text-[10px] md:text-xs">
                <span className="text-text-muted">SPINS</span>
                <span className="text-[#2060ff] tabular-nums">{state.car2.spinOuts}</span>
              </div>
            )}
          </div>
          {/* Speed bar */}
          <div className="h-1 bg-surface-800">
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${Math.min(100, (car2Speed / 110) * 100)}%`,
                background: car2Speed > 90 ? "#2060ff" : car2Speed > 70 ? "#d4af37" : "#4ade80",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
