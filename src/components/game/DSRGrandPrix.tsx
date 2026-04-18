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

  return (
    <div className="relative w-full bg-black touch-none" style={{ aspectRatio: "12/7", maxWidth: "1200px", margin: "0 auto" }}>
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

      {(state.phase === "racing" || state.phase === "countdown") && (
        <GameHUD state={state} />
      )}

      {state.phase === "game_over" && (
        <GameOver
          state={state}
          onPlayAgain={handlePlayAgain}
          onNewTrack={handleNewTrack}
          onQuit={handleQuit}
        />
      )}

      {/* Touch controls for mobile — during gameplay */}
      {(state.phase === "countdown" || state.phase === "racing") && (
        <div className="md:hidden absolute inset-0 z-30 pointer-events-none" onContextMenu={(e) => e.preventDefault()}>
          <button
            className="absolute right-2 top-[12%] w-16 h-24 pointer-events-auto touch-none select-none
                       bg-green-600/30 border-2 border-green-400/50 rounded-xl
                       flex items-center justify-center active:bg-green-500/60
                       backdrop-blur-sm"
            onTouchStart={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); }}
            onTouchEnd={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); }}
            onTouchCancel={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="font-digital text-xs text-green-200 text-center leading-tight">▲<br/>GAS</span>
          </button>
          <button
            className="absolute right-2 bottom-[12%] w-16 h-24 pointer-events-auto touch-none select-none
                       bg-red-600/30 border-2 border-red-400/50 rounded-xl
                       flex items-center justify-center active:bg-red-500/60
                       backdrop-blur-sm"
            onTouchStart={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' })); }}
            onTouchEnd={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' })); }}
            onTouchCancel={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' })); }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="font-digital text-xs text-red-200 text-center leading-tight">▼<br/>BRAKE</span>
          </button>
        </div>
      )}
    </div>
  );
}
