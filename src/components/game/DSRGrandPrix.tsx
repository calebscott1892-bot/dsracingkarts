"use client";

import { useState, useCallback, useEffect } from "react";
import { GameCanvas } from "./GameCanvas";
import { GameMenu } from "./GameMenu";
import { TrackSelect } from "./TrackSelect";
import { GameHUD } from "./GameHUD";
import { GameOver } from "./GameOver";
import { ArcadeControls } from "./ArcadeControls";
import { OrientationHint } from "./OrientationHint";
import { createInitialState, type GameState, type AIDifficulty } from "./engine/state";
import { X } from "lucide-react";

interface Props {
  onExit: () => void;
}

export function DSRGrandPrix({ onExit }: Props) {
  const [state, setState] = useState<GameState>(createInitialState());

  const handleStateChange = useCallback((updates: Partial<GameState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  function handleModeSelect(multiplayer: boolean) {
    setState(prev => ({
      ...prev,
      isMultiplayer: multiplayer,
      phase: "track_select",
    }));
  }

  function handleTrackSelect(trackIndex: number, laps: number, difficulty?: AIDifficulty) {
    setState(prev => ({
      ...prev,
      trackIndex,
      totalLaps: laps,
      aiDifficulty: difficulty || prev.aiDifficulty,
      phase: "countdown",
      countdownStartTime: 0,
    }));
  }

  function handlePlayAgain() {
    setState(prev => ({
      ...createInitialState(),
      trackIndex: prev.trackIndex,
      totalLaps: prev.totalLaps,
      isMultiplayer: prev.isMultiplayer,
      aiDifficulty: prev.aiDifficulty,
      phase: "countdown",
      countdownStartTime: 0,
    }));
  }

  function handleNewTrack() {
    setState(prev => ({
      ...createInitialState(),
      isMultiplayer: prev.isMultiplayer,
      phase: "track_select",
    }));
  }

  function handleQuit() {
    onExit();
  }

  // ── Pause ── Pausing freezes physics; the game loop in GameCanvas honours
  // state.paused. We shift currentLapStart / raceStartTime on resume so on-screen
  // timers don't inflate by the paused duration.
  const togglePause = useCallback(() => {
    setState(prev => {
      if (prev.phase !== "racing") return prev;
      const now = Date.now();
      if (!prev.paused) {
        return { ...prev, paused: true, pauseStartedAt: now };
      }
      // Resume — shift timestamps forward by the paused interval.
      const pausedFor = now - prev.pauseStartedAt;
      const car1 = { ...prev.car1, currentLapStart: prev.car1.currentLapStart > 0 ? prev.car1.currentLapStart + pausedFor : prev.car1.currentLapStart };
      const car2 = { ...prev.car2, currentLapStart: prev.car2.currentLapStart > 0 ? prev.car2.currentLapStart + pausedFor : prev.car2.currentLapStart };
      return {
        ...prev,
        paused: false,
        pauseStartedAt: 0,
        totalPausedMs: prev.totalPausedMs + pausedFor,
        raceStartTime: prev.raceStartTime + pausedFor,
        car1,
        car2,
      };
    });
  }, []);

  // Esc to pause on desktop
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Escape" && state.phase === "racing") {
        togglePause();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, togglePause]);

  // During menu/track-select the container needs height for the overlay content.
  // During racing/countdown/game-over it must match the canvas exactly so HUD lands correctly.
  const needsMinHeight = state.phase === "menu" || state.phase === "track_select";
  const isPlaying = state.phase === "countdown" || state.phase === "racing";
  const isRacing = state.phase === "racing";

  return (
    // Outer wrapper:  flex column so canvas + controls stack on mobile.
    // On landscape phones we cap the canvas height so the whole thing fits in viewport.
    <div
      className="mx-auto flex flex-col"
      style={{ maxWidth: "1200px" }}
    >
      {/* Canvas container — maintains aspect ratio, capped to fit viewport on mobile */}
      <div
        className={`relative w-full bg-black touch-none mx-auto${needsMinHeight ? " min-h-[500px] md:min-h-0" : ""}`}
        style={{
          aspectRatio: "12/7",
          // On mobile, leave ~120px for the controller below; on desktop no cap.
          maxHeight: isPlaying ? "calc(100dvh - 120px)" : undefined,
        }}
      >
        {/* Exit button */}
        <button
          onClick={onExit}
          className="absolute top-3 right-3 z-50 w-8 h-8 flex items-center justify-center
                     bg-black/60 text-text-muted hover:text-white transition-colors"
          aria-label="Exit game"
        >
          <X size={16} />
        </button>

        {/* Canvas — always rendered for game loop */}
        {(state.phase === "countdown" || state.phase === "racing" || state.phase === "game_over") && (
          <GameCanvas state={state} onStateChange={handleStateChange} />
        )}

        {/* Overlays based on phase */}
        {state.phase === "menu" && (
          <GameMenu onSelect={handleModeSelect} />
        )}

        {state.phase === "track_select" && (
          <TrackSelect onSelect={handleTrackSelect} showDifficulty={!state.isMultiplayer} />
        )}

        {/* HUD: hidden on mobile (mobile gets a compact top banner instead) */}
        {isPlaying && (
          <div className="hidden md:block">
            <GameHUD state={state} />
          </div>
        )}

        {state.phase === "game_over" && (
          <GameOver
            state={state}
            onPlayAgain={handlePlayAgain}
            onNewTrack={handleNewTrack}
            onQuit={handleQuit}
          />
        )}

        {/* Mobile compact top banner */}
        {isPlaying && (
          <div className="md:hidden absolute top-1 left-0 right-0 flex justify-center pointer-events-none z-20">
            <span className="font-digital text-[9px] tracking-[0.2em] text-racing-gold bg-black/80 px-3 py-0.5 border border-racing-gold/30">
              LAP {Math.max(0, state.car1.lapCount - state.car1.penaltyLaps)} / {state.totalLaps}
              {" · "}
              <span className="text-white">{Math.round((state.car1.speed / 6) * 110)}km/h</span>
            </span>
          </div>
        )}

        {/* Pause overlay (covers canvas, both desktop & mobile) */}
        {state.paused && isRacing && (
          <PauseOverlay onResume={togglePause} onQuit={handleQuit} onNewTrack={handleNewTrack} />
        )}

        {/* Orientation hint (mobile portrait only — soft, dismissable) */}
        {isPlaying && <OrientationHint />}
      </div>

      {/* Mobile-only arcade controller below the canvas */}
      {isPlaying && (
        <ArcadeControls
          paused={state.paused}
          canPause={isRacing}
          onPauseToggle={togglePause}
        />
      )}
    </div>
  );
}

// ── Pause overlay ─────────────────────────────────────────────────────────
function PauseOverlay({
  onResume,
  onQuit,
  onNewTrack,
}: {
  onResume: () => void;
  onQuit: () => void;
  onNewTrack: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-surface-900/95 border border-racing-gold/40 px-6 py-5 md:px-10 md:py-8 max-w-sm w-full text-center shadow-[0_0_40px_rgba(212,175,55,0.25)]">
        <div className="font-digital text-[10px] tracking-[0.4em] text-racing-gold mb-2">— PIT LANE —</div>
        <h3 className="font-digital text-2xl md:text-3xl tracking-[0.2em] text-white mb-6">
          PAUSED
        </h3>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="font-digital text-sm tracking-[0.18em] px-6 py-3 bg-racing-red text-white border border-racing-red hover:bg-racing-red/80 transition-colors"
          >
            RESUME
          </button>
          <button
            onClick={onNewTrack}
            className="font-digital text-xs tracking-[0.18em] px-6 py-2.5 bg-surface-800 text-text-secondary border border-surface-600 hover:text-white hover:border-white/40 transition-colors"
          >
            NEW TRACK
          </button>
          <button
            onClick={onQuit}
            className="font-digital text-xs tracking-[0.18em] px-6 py-2.5 bg-surface-800 text-text-secondary border border-surface-600 hover:text-white hover:border-white/40 transition-colors"
          >
            QUIT
          </button>
        </div>
        <p className="font-digital text-[9px] tracking-[0.3em] text-text-muted mt-5">ESC TO RESUME</p>
      </div>
    </div>
  );
}
