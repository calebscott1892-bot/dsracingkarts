"use client";

import { useEffect, useRef, useCallback } from "react";
import type { GameState } from "./engine/state";
import { createCarState } from "./engine/state";
import { TRACKS } from "./engine/track";
import { updateCar, updateAI } from "./engine/physics";
import { renderFrame, renderCountdownLights, renderText, clearSkidMarks } from "./engine/renderer";
import { createInputHandler } from "./engine/input";
import { CANVAS_WIDTH, CANVAS_HEIGHT, CAR_DEFAULTS, COUNTDOWN_LIGHT_INTERVAL, COUNTDOWN_RANDOM_DELAY_MIN, COUNTDOWN_RANDOM_DELAY_MAX } from "./engine/constants";

interface Props {
  state: GameState;
  onStateChange: (updates: Partial<GameState>) => void;
}

export function GameCanvas({ state, onStateChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const inputRef = useRef(createInputHandler());
  const frameRef = useRef(0);
  const rafRef = useRef<number>(0);
  const falseStartCooldown = useRef<{ p1: number; p2: number }>({ p1: 0, p2: 0 });

  // Keep stateRef in sync
  stateRef.current = state;

  const startCountdown = useCallback(() => {
    const track = TRACKS[state.trackIndex];
    const n = track.racingLine.length;

    // Position cars at start line
    const startIdx = track.startIndex;
    const p = track.racingLine[startIdx];
    const nextP = track.racingLine[(startIdx + 1) % n];
    const angle = Math.atan2(nextP.y - p.y, nextP.x - p.x);

    const car1 = createCarState(p.x, p.y, angle);
    car1.trackPosition = startIdx / n;
    car1.laneOffset = -14;
    car1.maxSpeed = CAR_DEFAULTS.maxSpeed;

    const car2 = createCarState(p.x, p.y, angle);
    car2.trackPosition = startIdx / n;
    car2.laneOffset = 14;
    car2.maxSpeed = CAR_DEFAULTS.maxSpeed;

    clearSkidMarks();

    onStateChange({
      phase: "countdown",
      car1,
      car2,
      lightsLit: 0,
      lightsOut: false,
      countdownStartTime: Date.now(),
      winner: null,
    });

    // Sequence the lights
    const totalLightTime = 5 * COUNTDOWN_LIGHT_INTERVAL;
    const randomDelay = COUNTDOWN_RANDOM_DELAY_MIN + Math.random() * (COUNTDOWN_RANDOM_DELAY_MAX - COUNTDOWN_RANDOM_DELAY_MIN);

    for (let i = 1; i <= 5; i++) {
      setTimeout(() => {
        onStateChange({ lightsLit: i });
      }, i * COUNTDOWN_LIGHT_INTERVAL);
    }

    // Lights out!
    setTimeout(() => {
      onStateChange({
        lightsOut: true,
        phase: "racing",
        raceStartTime: Date.now(),
      });
      setTimeout(() => {
        onStateChange({
          car1: { ...stateRef.current.car1, currentLapStart: Date.now() },
          car2: { ...stateRef.current.car2, currentLapStart: Date.now() },
        });
      }, 50);
    }, totalLightTime + randomDelay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.trackIndex]);

  // Start countdown when phase transitions
  useEffect(() => {
    if (state.phase === "countdown" && state.countdownStartTime === 0) {
      startCountdown();
    }
  }, [state.phase, state.countdownStartTime, startCountdown]);

  // Input handling
  useEffect(() => {
    const input = inputRef.current;
    input.attach();
    return () => input.detach();
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function gameLoop() {
      const s = stateRef.current;
      const track = TRACKS[s.trackIndex];
      const input = inputRef.current.state;
      const now = Date.now();
      frameRef.current++;

      if (s.phase === "racing") {
        const dt = 1; // fixed timestep

        // Update player 1
        updateCar(s.car1, input.p1Accelerate, input.p1Brake, track, dt, now);

        // Update player 2 (AI or human)
        if (s.isMultiplayer) {
          updateCar(s.car2, input.p2Accelerate, input.p2Brake, track, dt, now);
        } else {
          updateAI(s.car2, track, dt, now, frameRef.current, s.aiDifficulty);
        }

        // Check win condition
        const effectiveLaps1 = s.car1.lapCount - s.car1.penaltyLaps;
        const effectiveLaps2 = s.car2.lapCount - s.car2.penaltyLaps;

        if (effectiveLaps1 >= s.totalLaps && s.winner === null) {
          onStateChange({ winner: 1, phase: "game_over", raceEndTime: Date.now() });
        } else if (effectiveLaps2 >= s.totalLaps && s.winner === null) {
          onStateChange({ winner: 2, phase: "game_over", raceEndTime: Date.now() });
        }
      }

      // ── False start detection during countdown ──
      if (s.phase === "countdown" && !s.lightsOut) {
        // Cooldown to prevent multiple triggers per press
        if (falseStartCooldown.current.p1 > 0) falseStartCooldown.current.p1--;
        if (falseStartCooldown.current.p2 > 0) falseStartCooldown.current.p2--;

        if (input.p1Accelerate && s.car1.falseStarts < 3 && falseStartCooldown.current.p1 <= 0) {
          falseStartCooldown.current.p1 = 30; // half second cooldown
          const newCar1 = { ...s.car1 };
          newCar1.falseStarts++;
          if (newCar1.falseStarts >= 3) {
            onStateChange({ winner: 2, phase: "game_over", raceEndTime: Date.now(), car1: newCar1 });
          } else if (newCar1.falseStarts >= 2) {
            newCar1.penaltyLaps = 1;
            onStateChange({ car1: newCar1 });
          } else {
            onStateChange({ car1: newCar1 });
          }
        }
        if (s.isMultiplayer && input.p2Accelerate && s.car2.falseStarts < 3 && falseStartCooldown.current.p2 <= 0) {
          falseStartCooldown.current.p2 = 30;
          const newCar2 = { ...s.car2 };
          newCar2.falseStarts++;
          if (newCar2.falseStarts >= 3) {
            onStateChange({ winner: 1, phase: "game_over", raceEndTime: Date.now(), car2: newCar2 });
          } else if (newCar2.falseStarts >= 2) {
            newCar2.penaltyLaps = 1;
            onStateChange({ car2: newCar2 });
          } else {
            onStateChange({ car2: newCar2 });
          }
        }
      }

      // ── Render ──
      renderFrame(ctx!, s, track);

      // Countdown lights overlay
      if (s.phase === "countdown") {
        renderCountdownLights(ctx!, s.lightsLit, s.lightsOut);

        if (s.car1.falseStarts === 1) {
          renderText(ctx!, "⚠ FALSE START — WARNING", CANVAS_WIDTH / 4, CANVAS_HEIGHT / 2, 16, "#e60012");
        } else if (s.car1.falseStarts === 2) {
          renderText(ctx!, "⚠ 1 LAP PENALTY", CANVAS_WIDTH / 4, CANVAS_HEIGHT / 2, 16, "#e60012");
        }
        if (s.car2.falseStarts === 1) {
          renderText(ctx!, "⚠ FALSE START — WARNING", CANVAS_WIDTH * 3 / 4, CANVAS_HEIGHT / 2, 16, "#2060ff");
        } else if (s.car2.falseStarts === 2) {
          renderText(ctx!, "⚠ 1 LAP PENALTY", CANVAS_WIDTH * 3 / 4, CANVAS_HEIGHT / 2, 16, "#2060ff");
        }
      }

      // "LIGHTS OUT AND AWAY WE GO" flash
      if (s.phase === "racing" && now - s.raceStartTime < 2500) {
        const elapsed = now - s.raceStartTime;
        const alpha = elapsed < 500 ? elapsed / 500 : Math.max(0, 1 - (elapsed - 500) / 2000);
        ctx!.globalAlpha = alpha;
        renderText(ctx!, "LIGHTS OUT AND AWAY WE GO!", CANVAS_WIDTH / 2, 80, 22, "#d4af37");
        ctx!.globalAlpha = 1;
      }

      // Spin-out warning text
      if (s.phase === "racing") {
        if (s.car1.spinning) {
          renderText(ctx!, "SPIN OUT!", s.car1.x, s.car1.y - 30, 12, "#ff4444");
        }
        if (s.car2.spinning) {
          renderText(ctx!, "SPIN OUT!", s.car2.x, s.car2.y - 30, 12, "#4444ff");
        }
        if (s.car1.drifting && !s.car1.spinning) {
          renderText(ctx!, "SLOW DOWN!", s.car1.x, s.car1.y - 25, 10, "#ffaa00");
        }
        if (s.car2.drifting && !s.car2.spinning) {
          renderText(ctx!, "SLOW DOWN!", s.car2.x, s.car2.y - 25, 10, "#ffaa00");
        }
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    }

    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="w-full h-auto bg-black"
      style={{ imageRendering: "auto", maxWidth: "1200px" }}
    />
  );
}
