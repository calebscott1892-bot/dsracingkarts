import type { CarState } from "./state";
import type { TrackData } from "./track";
import { CAR_DEFAULTS, TRACK_SPEED_DIVISOR, AI_DIFFICULTY } from "./constants";
import type { AIDifficulty } from "./state";

export function updateCar(
  car: CarState,
  accelerate: boolean,
  brake: boolean,
  track: TrackData,
  dt: number,
  now: number,
): void {
  // ── Spinning state ──
  if (car.spinning) {
    car.spinFramesLeft--;
    car.spinAngle += 0.25;
    car.speed *= 0.92; // decelerate hard during spin

    if (car.spinFramesLeft <= 0) {
      car.spinning = false;
      car.drifting = false;
      car.recoveryFramesLeft = CAR_DEFAULTS.recoveryDuration;
      car.speed = 0;
      car.spinAngle = 0;
    }
    // Slide forward slowly while spinning
    advanceOnTrack(car, track);
    return;
  }

  // ── Recovery (half acceleration after spin) ──
  const recoveryMult = car.recoveryFramesLeft > 0 ? 0.4 : 1;
  if (car.recoveryFramesLeft > 0) car.recoveryFramesLeft--;

  // ── Acceleration / braking ──
  if (accelerate) {
    // Speed-dependent acceleration: faster = less acceleration (diminishing returns)
    const speedRatio = car.speed / car.maxSpeed;
    const accelCurve = 1 - speedRatio * 0.6; // at max speed, only 40% accel effectiveness
    car.speed = Math.min(
      car.speed + car.acceleration * recoveryMult * accelCurve * dt,
      car.maxSpeed
    );
  } else if (brake) {
    car.speed = Math.max(car.speed - car.braking * dt, -0.3);
  } else {
    // Friction decay — gradual coast
    if (car.speed > 0) {
      car.speed = Math.max(car.speed - car.friction * dt, 0);
    } else if (car.speed < 0) {
      car.speed = Math.min(car.speed + car.friction * dt, 0);
    }
  }

  // ── Curvature checks ──
  const n = track.racingLine.length;
  const trackIdx = Math.floor(car.trackPosition * n) % n;
  const maxSafe = track.maxSafeSpeed[trackIdx];

  // Drift detection (visual warning before spin)
  if (car.speed > maxSafe * CAR_DEFAULTS.driftSpeedMultiplier && !car.spinning) {
    car.drifting = true;
  } else {
    car.drifting = false;
  }

  // Spin-out detection — exceeding safe speed by too much
  if (car.speed > maxSafe * CAR_DEFAULTS.spinSpeedMultiplier && !car.spinning) {
    car.spinning = true;
    car.spinFramesLeft = CAR_DEFAULTS.spinDuration;
    car.spinOuts++;
    car.drifting = false;
  }

  // ── Track top speed (for display) ──
  // Convert internal speed to a display km/h: max internal speed → ~110 km/h
  const speedKmh = (car.speed / CAR_DEFAULTS.maxSpeed) * 110;
  if (speedKmh > car.topSpeed) car.topSpeed = speedKmh;

  // ── Advance position on track ──
  advanceOnTrack(car, track);

  // ── Lap counting ──
  checkLaps(car, track, now);
}

function advanceOnTrack(car: CarState, track: TrackData): void {
  const n = track.racingLine.length;

  // Normalize speed against a fixed divisor so lap times are consistent
  // Higher divisor = slower laps. Tuned so max speed ≈ 3.5s lap on Oval
  const speedNormalized = car.speed / TRACK_SPEED_DIVISOR;

  car.trackPosition += speedNormalized;
  car.totalDistance += Math.abs(car.speed);

  // Wrap around
  if (car.trackPosition >= 1) {
    car.trackPosition -= 1;
  }
  if (car.trackPosition < 0) {
    car.trackPosition += 1;
  }

  // Interpolate x, y from track position
  const idx = Math.floor(car.trackPosition * n) % n;
  const nextIdx = (idx + 1) % n;
  const frac = (car.trackPosition * n) % 1;

  const p1 = track.racingLine[idx];
  const p2 = track.racingLine[nextIdx];

  car.x = p1.x + (p2.x - p1.x) * frac;
  car.y = p1.y + (p2.y - p1.y) * frac;

  // Compute angle from track direction
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  car.angle = Math.atan2(dy, dx);

  // Apply lane offset (perpendicular to track)
  const perpX = -Math.sin(car.angle);
  const perpY = Math.cos(car.angle);
  car.x += perpX * car.laneOffset;
  car.y += perpY * car.laneOffset;

  // Spin visual rotation
  if (car.spinning) {
    car.angle += car.spinAngle;
  }

  // Drift wobble
  if (car.drifting && !car.spinning) {
    car.angle += Math.sin(Date.now() * 0.015) * 0.2;
  }
}

function checkLaps(car: CarState, track: TrackData, now: number): void {
  const n = track.racingLine.length;
  const idx = Math.floor(car.trackPosition * n) % n;

  // Check checkpoints (must hit them in order to count a lap)
  for (let i = 0; i < track.checkpointIndices.length; i++) {
    const cpIdx = track.checkpointIndices[i];
    const dist = Math.abs(idx - cpIdx);
    // Wrap-around distance check
    const wrapDist = Math.min(dist, n - dist);
    if (wrapDist < 5 && car.lastCheckpoint < i) {
      car.lastCheckpoint = i;
    }
  }

  // Check start/finish line crossing
  const startDist = Math.abs(idx - track.startIndex);
  const wrapStartDist = Math.min(startDist, n - startDist);
  if (wrapStartDist < 5 && car.lastCheckpoint >= track.checkpointIndices.length - 1) {
    // Completed a lap!
    car.lapCount++;
    const lapTime = now - car.currentLapStart;
    if (lapTime > 1000) { // ignore very short false laps
      car.lapTimes.push(lapTime);
      if (lapTime < car.fastestLap) car.fastestLap = lapTime;
    }
    car.currentLapStart = now;
    car.lastCheckpoint = -1;
  }
}

export function updateAI(
  car: CarState,
  track: TrackData,
  dt: number,
  now: number,
  frame: number,
  difficulty: AIDifficulty = "medium",
): void {
  const diff = AI_DIFFICULTY[difficulty];
  const n = track.racingLine.length;
  const idx = Math.floor(car.trackPosition * n) % n;
  const maxSafe = track.maxSafeSpeed[idx];

  // Look ahead to anticipate corners (smarter AI looks further ahead)
  let minAheadSafe = maxSafe;
  for (let i = 1; i <= diff.lookAhead; i++) {
    const aIdx = (idx + i) % n;
    minAheadSafe = Math.min(minAheadSafe, track.maxSafeSpeed[aIdx]);
  }

  // AI targets a fraction of the safe speed, with some variance for realism
  const variance = Math.sin(frame * 0.03) * diff.variance;
  const targetSpeed = Math.min(maxSafe, minAheadSafe * 1.1) * (diff.speedFactor + variance);

  const accelerate = car.speed < targetSpeed;
  const brake = car.speed > targetSpeed * diff.brakeThreshold;

  updateCar(car, accelerate, brake, track, dt, now);
}

export function getDistance(a: CarState, b: CarState): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
