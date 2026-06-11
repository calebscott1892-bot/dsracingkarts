"use client";

import { useEffect, useRef, useCallback } from "react";
import type { GameState } from "./engine/state";
import { createCarState } from "./engine/state";
import { TRACKS } from "./engine/track";
import { updateCar, updateAI, updateInteractions, tickLapProgress } from "./engine/physics";
import { renderFrame, renderCountdownLights, renderText, clearSkidMarks } from "./engine/renderer";
import { createInputHandler } from "./engine/input";
import { updateEngine, idleEngine, blip, screech } from "./engine/audio";
import { CANVAS_WIDTH, CANVAS_HEIGHT, CAR_DEFAULTS, COUNTDOWN_LIGHT_INTERVAL, COUNTDOWN_RANDOM_DELAY_MIN, COUNTDOWN_RANDOM_DELAY_MAX, DIFFICULTY_PROFILES } from "./engine/constants";

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
  const lastFrameTime = useRef(0);
  const falseStartCooldown = useRef<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
  // Audio edge-detection refs (one-shot SFX fire only on state transitions).
  const prevLightsLit = useRef(0);
  const prevLightsOut = useRef(false);
  const prevSpinning = useRef<{ p1: boolean; p2: boolean }>({ p1: false, p2: false });
  // Lead tracking for the overtake stat (null until the race settles).
  const prevLeader = useRef<1 | 2 | null>(null);

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
    car1.prevTrackPosition = startIdx / n;
    car1.laneOffset = -14;
    car1.maxSpeed = CAR_DEFAULTS.maxSpeed;

    const car2 = createCarState(p.x, p.y, angle);
    car2.trackPosition = startIdx / n;
    car2.prevTrackPosition = startIdx / n;
    car2.laneOffset = 14;
    car2.maxSpeed = CAR_DEFAULTS.maxSpeed;

    clearSkidMarks();
    prevLeader.current = null;

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

      // ── Frame-rate-independent timestep ──
      // dt is measured in "60fps frames": 1.0 at 60Hz, ~0.5 at 120Hz, ~0.42 at
      // 144Hz. The physics constants are all tuned per-60fps-frame and the engine
      // already multiplies linear terms by dt and raises decays to Math.pow(_, dt),
      // so feeding real elapsed time keeps the sim identical across refresh rates.
      // Clamped to 3 so a backgrounded tab (rAF paused) doesn't teleport cars on
      // return.
      const elapsed = lastFrameTime.current ? now - lastFrameTime.current : 1000 / 60;
      lastFrameTime.current = now;
      const dt = Math.min(3, Math.max(0, elapsed / (1000 / 60)));

      // ── Start-light audio cues (edge-triggered; no-op when sound off) ──
      if (s.lightsLit !== prevLightsLit.current) {
        if (s.lightsLit > prevLightsLit.current && s.lightsLit > 0) blip(620, 110);
        prevLightsLit.current = s.lightsLit;
      }
      if (s.lightsOut && !prevLightsOut.current) blip(990, 280);
      prevLightsOut.current = s.lightsOut;

      // Drop the engine to silence whenever we're not actively racing.
      if (s.phase !== "racing" || s.paused) idleEngine();

      // In single-player the arrow keys drive P1 too, so either hand position works.
      const solo = !s.isMultiplayer;
      const p1Accel = input.p1Accelerate || (solo && input.p2Accelerate);
      const p1Brake = input.p1Brake || (solo && input.p2Brake);
      const p1Steer =
        (input.p1Right ? 1 : 0) - (input.p1Left ? 1 : 0) +
        (solo ? (input.p2Right ? 1 : 0) - (input.p2Left ? 1 : 0) : 0);

      if (s.phase === "racing" && !s.paused) {

        // Player 1 (always human) — apply difficulty profile only in single-player.
        const p1Profile = s.isMultiplayer ? undefined : DIFFICULTY_PROFILES[s.aiDifficulty];
        updateCar(s.car1, p1Accel, p1Brake, track, dt, now, p1Profile, p1Steer);

        // Update player 2 (AI or human)
        if (s.isMultiplayer) {
          const p2Steer = (input.p2Right ? 1 : 0) - (input.p2Left ? 1 : 0);
          updateCar(s.car2, input.p2Accelerate, input.p2Brake, track, dt, now, undefined, p2Steer);
        } else {
          updateAI(s.car2, s.car1, track, dt, now, frameRef.current, s.aiDifficulty);
        }

        // Slipstream flags + wheel-to-wheel contact (after both karts move).
        updateInteractions(s.car1, s.car2, track, dt);

        // Overtake stat: count lead changes once the race is genuinely under way.
        const leader: 1 | 2 = s.car1.lapProgress >= s.car2.lapProgress ? 1 : 2;
        if (prevLeader.current !== null && leader !== prevLeader.current && now - s.raceStartTime > 3000) {
          if (leader === 1) s.car1.overtakes++;
          else s.car2.overtakes++;
        }
        prevLeader.current = leader;

        // Monotonic lap progress — robust against missed checkpoints.
        tickLapProgress(s.car1, now, s.totalLaps);
        tickLapProgress(s.car2, now, s.totalLaps);

        // ── Engine audio + spin screech (no-ops when sound is disabled) ──
        updateEngine(s.car1.speed / CAR_DEFAULTS.maxSpeed, !s.car1.spinning && !s.car1.respawn);
        if (s.car1.spinning && !prevSpinning.current.p1) screech();
        if (s.car2.spinning && !prevSpinning.current.p2) screech(220);
        prevSpinning.current.p1 = s.car1.spinning;
        prevSpinning.current.p2 = s.car2.spinning;

        // Check win condition (effective laps = laps minus false-start penalty).
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
        // Cooldown to prevent multiple triggers per press (dt-scaled so the
        // half-second window is the same on every refresh rate)
        if (falseStartCooldown.current.p1 > 0) falseStartCooldown.current.p1 -= dt;
        if (falseStartCooldown.current.p2 > 0) falseStartCooldown.current.p2 -= dt;

        if (p1Accel && s.car1.falseStarts < 3 && falseStartCooldown.current.p1 <= 0) {
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

      // Spin-out / off-track / drift warning text
      if (s.phase === "racing") {
        // Off track (respawn) — strongest warning, supersedes spin/drift text.
        if (s.car1.respawn) {
          const msg = s.car1.respawn.phase === "flying" ? "OFF TRACK!" : "RESPAWNING…";
          renderText(ctx!, msg, s.car1.x, s.car1.y - 30, 12, "#ff8844");
        } else if (s.car1.spinning) {
          renderText(ctx!, "SPIN OUT!", s.car1.x, s.car1.y - 30, 12, "#ff4444");
        } else if (s.car1.drifting) {
          renderText(ctx!, "SLOW DOWN!", s.car1.x, s.car1.y - 25, 10, "#ffaa00");
        }

        if (s.car2.respawn) {
          const msg = s.car2.respawn.phase === "flying" ? "OFF TRACK!" : "RESPAWNING…";
          renderText(ctx!, msg, s.car2.x, s.car2.y - 30, 12, "#88aaff");
        } else if (s.car2.spinning) {
          renderText(ctx!, "SPIN OUT!", s.car2.x, s.car2.y - 30, 12, "#4444ff");
        } else if (s.car2.drifting) {
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
