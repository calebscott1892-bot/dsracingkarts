"use client";

import { useState, useCallback } from "react";
import { GameCanvas } from "./GameCanvas";
import { GameMenu } from "./GameMenu";
import { TrackSelect } from "./TrackSelect";
import { GameHUD } from "./GameHUD";
import { GameOver } from "./GameOver";
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

  // During menu/track-select the container needs height for the overlay content.
  // During racing/countdown/game-over it must match the canvas exactly so HUD lands correctly.
  const needsMinHeight = state.phase === "menu" || state.phase === "track_select";
  const isPlaying = state.phase === "countdown" || state.phase === "racing";

  return (
    // Outer wrapper: not aspect-ratio constrained — allows mobile controls below canvas
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Canvas container — maintains aspect ratio */}
      <div
        className={`relative w-full bg-black touch-none${needsMinHeight ? " min-h-[500px] md:min-h-0" : ""}`}
        style={{ aspectRatio: "12/7" }}
      >
        {/* Exit button */}
        <button
          onClick={onExit}
          className="absolute top-3 right-3 z-50 w-8 h-8 flex items-center justify-center
                     bg-black/60 text-text-muted hover:text-white transition-colors"
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

        {/* HUD: hidden on mobile (shown in the strip below instead) */}
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

        {/* Leader banner — visible on mobile inside canvas (compact, top-centre) */}
        {isPlaying && (
          <div className="md:hidden absolute top-1 left-0 right-0 flex justify-center pointer-events-none z-20">
            <span className="font-digital text-[9px] tracking-[0.2em] text-racing-gold bg-black/80 px-3 py-0.5 border border-racing-gold/30">
              LAP {Math.max(0, state.car1.lapCount - state.car1.penaltyLaps)} / {state.totalLaps}
            </span>
          </div>
        )}
      </div>

      {/* Mobile-only strip below canvas: GAS | stats | BRAKE */}
      {isPlaying && (
        <div
          className="md:hidden flex items-stretch bg-black border-t border-surface-700 touch-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* GAS */}
          <button
            className="flex-1 py-4 bg-green-900/40 border-r border-surface-700 active:bg-green-600/60
                       flex flex-col items-center justify-center gap-1 select-none touch-none"
            onTouchStart={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); }}
            onTouchEnd={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); }}
            onTouchCancel={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="font-digital text-green-400 text-lg leading-none">▲</span>
            <span className="font-digital text-[10px] text-green-300 tracking-widest">GAS</span>
          </button>

          {/* Centre: P1 mini stats */}
          <div className="flex-[2] px-3 py-2 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
            <span className="font-digital text-[9px] text-text-muted tracking-wider uppercase">P1 · RED</span>
            <span className="font-digital text-xs text-white tabular-nums">
              {Math.round((state.car1.speed / 6) * 110)} km/h
            </span>
            <span className="font-digital text-[9px] text-text-muted tabular-nums">
              Lap {Math.max(0, state.car1.lapCount - state.car1.penaltyLaps)}/{state.totalLaps}
            </span>
          </div>

          {/* BRAKE */}
          <button
            className="flex-1 py-4 bg-red-900/40 border-l border-surface-700 active:bg-red-600/60
                       flex flex-col items-center justify-center gap-1 select-none touch-none"
            onTouchStart={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' })); }}
            onTouchEnd={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' })); }}
            onTouchCancel={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' })); }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="font-digital text-red-400 text-lg leading-none">▼</span>
            <span className="font-digital text-[10px] text-red-300 tracking-widest">BRAKE</span>
          </button>
        </div>
      )}
    </div>
  );
}
