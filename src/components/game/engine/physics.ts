import type { CarState } from "./state";
import type { TrackData } from "./track";
import {
  CAR_DEFAULTS,
  TRACK_SPEED_DIVISOR,
  DIFFICULTY_PROFILES,
  OVERSHOOT_CURVATURE_THRESHOLD,
  type DifficultyProfile,
} from "./constants";
import type { AIDifficulty } from "./state";

// ── Public API ───────────────────────────────────────────────────────────

export function updateCar(
  car: CarState,
  accelerate: boolean,
  brake: boolean,
  track: TrackData,
  dt: number,
  now: number,
  profile?: DifficultyProfile,
): void {
  // ── Respawn state machine takes full control until done ──
  if (car.respawn) {
    car.inputAccel = false;
    car.inputBrake = false;
    updateRespawn(car, track, dt);
    return;
  }

  // ── Spinning state ──
  if (car.spinning) {
    car.inputAccel = false;
    car.inputBrake = false;
    car.spinFramesLeft -= dt;
    // Faster rotation + sharper speed bleed → spin reads as a real loss-of-grip
    // event instead of slow-motion. Most of the speed is gone in ~0.5s.
    car.spinAngle += 0.42 * dt;
    car.speed *= Math.pow(0.84, dt);

    if (car.spinFramesLeft <= 0) {
      car.spinning = false;
      car.drifting = false;
      car.recoveryFramesLeft = CAR_DEFAULTS.recoveryDuration;
      car.speed = 0;
      car.spinAngle = 0;
    }
    advanceOnTrack(car, track);
    return;
  }

  // ── Modulate physics by difficulty profile (player only — AI gets raw) ──
  const accelMult = profile?.playerAccelMult ?? 1;
  const brakeMult = profile?.playerBrakeMult ?? 1;
  const spinMult = profile?.playerSpinMult ?? 1;
  const overshootMult = profile?.playerOvershootMult ?? 1;
  const gripMult = profile?.playerGripMult ?? 1;

  // ── Recovery (reduced acceleration after spin / respawn) ──
  const recoveryMult = car.recoveryFramesLeft > 0 ? 0.6 : 1;
  if (car.recoveryFramesLeft > 0) car.recoveryFramesLeft -= dt;

  // ── Track current input state for the renderer (headlights / brake lights) ──
  car.inputAccel = accelerate;
  car.inputBrake = brake;

  // ── Acceleration / braking ──
  if (accelerate) {
    // Speed-dependent acceleration: faster = less acceleration (diminishing returns),
    // but the curve is gentler than before so top speed feels reachable, not asymptotic.
    // accelMult applies the difficulty's tire-warmth penalty / bonus.
    const speedRatio = car.speed / car.maxSpeed;
    const accelCurve = 1 - speedRatio * 0.35;
    car.speed = Math.min(
      car.speed + car.acceleration * accelMult * recoveryMult * accelCurve * dt,
      car.maxSpeed,
    );
  } else if (brake) {
    car.speed = Math.max(car.speed - car.braking * brakeMult * dt, -0.3);
  } else {
    if (car.speed > 0) {
      car.speed = Math.max(car.speed - car.friction * dt, 0);
    } else if (car.speed < 0) {
      car.speed = Math.min(car.speed + car.friction * dt, 0);
    }
  }

  // ── Curvature-based grip checks ──
  const n = track.racingLine.length;
  const trackIdx = Math.floor(car.trackPosition * n) % n;
  // gripMult > 1 means a higher effective safe speed (more forgiving track).
  const maxSafe = track.maxSafeSpeed[trackIdx] * gripMult;

  // Drift visual warning — yellow wobble well before consequences hit.
  if (car.speed > maxSafe * CAR_DEFAULTS.driftSpeedMultiplier) {
    car.drifting = true;
  } else {
    car.drifting = false;
  }

  // ── Overshoot detection — "fly off into the barriers" on a curve ──
  // Triggered by entering a curving segment too fast. Uses lookahead so the
  // failure happens at corner ENTRY, like in real karting (not mid-corner).
  const lookAhead = 3;
  let willOvershoot = false;
  for (let i = 0; i <= lookAhead; i++) {
    const ai = (trackIdx + i) % n;
    if (track.curvature[ai] > OVERSHOOT_CURVATURE_THRESHOLD) {
      const safe = track.maxSafeSpeed[ai] * gripMult;
      if (car.speed > safe * CAR_DEFAULTS.overshootSpeedMultiplier * overshootMult) {
        willOvershoot = true;
        break;
      }
    }
  }

  if (willOvershoot) {
    triggerOvershoot(car, track);
    advanceOnTrack(car, track);
    return;
  }

  // ── Spin-out detection — extreme overspeed, even on a straight ──
  // With overshoot covering corners, this only fires when something has gone
  // very wrong (e.g. modded throttle on a near-straight that has slight curve).
  if (car.speed > maxSafe * CAR_DEFAULTS.spinSpeedMultiplier * spinMult) {
    car.spinning = true;
    car.spinFramesLeft = CAR_DEFAULTS.spinDuration;
    car.spinOuts++;
    car.drifting = false;
    advanceOnTrack(car, track);
    return;
  }

  // ── Track top speed (for display) — internal speed → display km/h (max 110) ──
  const speedKmh = (car.speed / CAR_DEFAULTS.maxSpeed) * 110;
  if (speedKmh > car.topSpeed) car.topSpeed = speedKmh;

  // ── Advance position on track ──
  advanceOnTrack(car, track);
}

// ── Lap counting (monotonic) ─────────────────────────────────────────────
// Called from GameCanvas once per frame for each car, only while racing.
// Robust against missed checkpoints, position jumps, and direction flips.
export function tickLapProgress(car: CarState, now: number, totalLaps: number): void {
  if (car.respawn) {
    // Position will be artificially moved during respawn; treat as no progress.
    car.prevTrackPosition = car.trackPosition;
    return;
  }

  let delta = car.trackPosition - car.prevTrackPosition;
  // Wrap correction
  if (delta < -0.5) delta += 1;       // forward wrap (1 → 0)
  else if (delta > 0.5) delta -= 1;   // backward wrap (0 → 1)

  // Cap unrealistic deltas — protects against any stray teleport.
  if (Math.abs(delta) < 0.25) {
    car.lapProgress += delta;
  }
  car.prevTrackPosition = car.trackPosition;

  // Lap progress is a continuous counter. Each integer crossed going up
  // represents one completed revolution past the start/finish line.
  const completedLaps = Math.max(0, Math.floor(car.lapProgress));
  if (completedLaps > car.lapCount) {
    const lapsCrossed = completedLaps - car.lapCount;
    for (let i = 0; i < lapsCrossed; i++) {
      car.lapCount++;
      const lapTime = now - car.currentLapStart;
      if (lapTime > 1500 && car.currentLapStart > 0) {
        car.lapTimes.push(lapTime);
        if (lapTime < car.fastestLap) car.fastestLap = lapTime;
      }
      car.currentLapStart = now;
      // Stop counting after the race is done — defensive.
      if (car.lapCount >= totalLaps) break;
    }
  }
}

// ── Overshoot → Respawn ──────────────────────────────────────────────────

function triggerOvershoot(car: CarState, track: TrackData): void {
  const n = track.racingLine.length;
  const trackIdx = Math.floor(car.trackPosition * n) % n;

  // Outward direction of the curve = perpendicular to track, away from inside.
  // Convention from cross product: positive signedCurvature = turning one way,
  // outward is opposite of that turn direction.
  const sign = Math.sign(track.signedCurvature[trackIdx]) || 1;
  const perpX = -Math.sin(car.angle) * sign;
  const perpY = Math.cos(car.angle) * sign;

  // Initial fly velocity: mostly forward (carrying current speed), kicked outward.
  const fwdX = Math.cos(car.angle) * car.speed;
  const fwdY = Math.sin(car.angle) * car.speed;
  const flyVx = fwdX * 0.6 + perpX * car.speed * 0.85;
  const flyVy = fwdY * 0.6 + perpY * car.speed * 0.85;

  // Pick respawn point: nearest checkpoint that's "behind" the car
  // (smallest forward-distance from checkpoint TO the car).
  let bestCpPos = track.checkpointIndices[0] / n;
  let bestDist = Infinity;
  for (const cpI of track.checkpointIndices) {
    const cpPos = cpI / n;
    let d = car.trackPosition - cpPos;
    if (d < 0) d += 1;
    if (d < bestDist) {
      bestDist = d;
      bestCpPos = cpPos;
    }
  }

  car.respawn = {
    phase: "flying",
    framesLeft: CAR_DEFAULTS.respawnFlyingFrames,
    flyX: car.x,
    flyY: car.y,
    flyVx,
    flyVy,
    flyAngle: car.angle,
    flyAvel: 0.22 * sign,
    targetTrackPosition: bestCpPos,
  };
  car.speed = 0;
  car.drifting = false;
  car.offTrackResets++;
}

function updateRespawn(car: CarState, track: TrackData, dt: number): void {
  const r = car.respawn;
  if (!r) return;
  r.framesLeft -= dt;

  if (r.phase === "flying") {
    // Ballistic tumble outward, decelerating each frame.
    r.flyX += r.flyVx * dt;
    r.flyY += r.flyVy * dt;
    r.flyVx *= Math.pow(0.93, dt);
    r.flyVy *= Math.pow(0.93, dt);
    r.flyAngle += r.flyAvel * dt;
    r.flyAvel *= Math.pow(0.96, dt);

    car.x = r.flyX;
    car.y = r.flyY;
    car.angle = r.flyAngle;
    car.speed = 0;

    if (r.framesLeft <= 0) {
      r.phase = "placing";
      r.framesLeft = CAR_DEFAULTS.respawnPlacingFrames;
    }
    return;
  }

  if (r.phase === "placing") {
    // Teleport to checkpoint. Renderer will fade us out for a moment.
    car.trackPosition = r.targetTrackPosition;
    car.prevTrackPosition = r.targetTrackPosition; // freeze lap delta
    placeAtTrackPosition(car, track);
    car.speed = 0;

    if (r.framesLeft <= 0) {
      r.phase = "reviving";
      r.framesLeft = CAR_DEFAULTS.respawnRevivingFrames;
    }
    return;
  }

  if (r.phase === "reviving") {
    // Stay parked at the checkpoint, blinking; controls disabled.
    placeAtTrackPosition(car, track);
    car.speed = 0;

    if (r.framesLeft <= 0) {
      car.respawn = null;
      car.recoveryFramesLeft = CAR_DEFAULTS.respawnRecoveryFrames;
      // Ensure prev pos is current so first racing frame doesn't see a delta.
      car.prevTrackPosition = car.trackPosition;
    }
  }
}

function placeAtTrackPosition(car: CarState, track: TrackData): void {
  const n = track.racingLine.length;
  const idx = Math.floor(car.trackPosition * n) % n;
  const nextIdx = (idx + 1) % n;
  const frac = (car.trackPosition * n) % 1;

  const p1 = track.racingLine[idx];
  const p2 = track.racingLine[nextIdx];
  car.x = p1.x + (p2.x - p1.x) * frac;
  car.y = p1.y + (p2.y - p1.y) * frac;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  car.angle = Math.atan2(dy, dx);

  // Apply lane offset perpendicular to track.
  const perpX = -Math.sin(car.angle);
  const perpY = Math.cos(car.angle);
  car.x += perpX * car.laneOffset;
  car.y += perpY * car.laneOffset;
}

// ── Track advancement (no respawn / no spin) ─────────────────────────────

function advanceOnTrack(car: CarState, track: TrackData): void {
  const n = track.racingLine.length;

  const speedNormalized = car.speed / TRACK_SPEED_DIVISOR;
  car.trackPosition += speedNormalized;
  car.totalDistance += Math.abs(car.speed);

  if (car.trackPosition >= 1) car.trackPosition -= 1;
  if (car.trackPosition < 0) car.trackPosition += 1;

  const idx = Math.floor(car.trackPosition * n) % n;
  const nextIdx = (idx + 1) % n;
  const frac = (car.trackPosition * n) % 1;

  const p1 = track.racingLine[idx];
  const p2 = track.racingLine[nextIdx];

  car.x = p1.x + (p2.x - p1.x) * frac;
  car.y = p1.y + (p2.y - p1.y) * frac;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  car.angle = Math.atan2(dy, dx);

  const perpX = -Math.sin(car.angle);
  const perpY = Math.cos(car.angle);
  car.x += perpX * car.laneOffset;
  car.y += perpY * car.laneOffset;

  if (car.spinning) {
    car.angle += car.spinAngle;
  }
  if (car.drifting && !car.spinning) {
    car.angle += Math.sin(Date.now() * 0.015) * 0.18;
  }
}

// ── AI brain ─────────────────────────────────────────────────────────────

export function updateAI(
  car: CarState,
  track: TrackData,
  dt: number,
  now: number,
  frame: number,
  difficulty: AIDifficulty = "medium",
): void {
  if (car.respawn) {
    updateRespawn(car, track, dt);
    return;
  }

  const profile = DIFFICULTY_PROFILES[difficulty];
  const n = track.racingLine.length;
  const idx = Math.floor(car.trackPosition * n) % n;
  const maxSafe = track.maxSafeSpeed[idx];

  // Look ahead so the AI brakes BEFORE corners, not in them.
  let minAheadSafe = maxSafe;
  for (let i = 1; i <= profile.aiLookAhead; i++) {
    const aIdx = (idx + i) % n;
    minAheadSafe = Math.min(minAheadSafe, track.maxSafeSpeed[aIdx]);
  }

  // Random small mistakes (lift-off for ~half a second). Tuned so easy AI
  // visibly hesitates and extreme AI almost never does.
  if (car.aiMistakeFramesLeft <= 0 && Math.random() < profile.aiMistakeChance) {
    car.aiMistakeFramesLeft = 25 + Math.floor(Math.random() * 20);
  }
  if (car.aiMistakeFramesLeft > 0) {
    car.aiMistakeFramesLeft -= dt;
  }

  const variance = Math.sin(frame * 0.03) * profile.aiVariance;
  const targetSpeed = Math.min(maxSafe, minAheadSafe * 1.1)
    * (profile.aiSpeedFactor + variance);

  const mistaking = car.aiMistakeFramesLeft > 0;
  const accelerate = !mistaking && car.speed < targetSpeed;
  const brake = car.speed > targetSpeed * profile.aiBrakeThreshold;

  // AI uses raw physics — no profile applied; the profile drives only its targets.
  updateCar(car, accelerate, brake, track, dt, now);
}

export function getDistance(a: CarState, b: CarState): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
