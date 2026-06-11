import type { CarState } from "./state";
import type { TrackData } from "./track";
import {
  CAR_DEFAULTS,
  TRACK_SPEED_DIVISOR,
  DIFFICULTY_PROFILES,
  OVERSHOOT_CURVATURE_THRESHOLD,
  HANDLING,
  DRAFT,
  CONTACT,
  type DifficultyProfile,
} from "./constants";
import type { AIDifficulty } from "./state";

// ── Lane geometry ────────────────────────────────────────────────────────
// laneOffset is measured along the perpendicular (-sin θ, cos θ). Positive
// trueCurvature ⇒ the corner's centre is on the positive lane side, so the
// local path length for a kart offset by d scales by (1 - d·κ): the inside
// line is shorter but its tighter radius lowers the safe speed (∝ √radius).
// This is what makes line choice a real racing decision.

export function pathScaleAt(track: TrackData, idx: number, laneOffset: number): number {
  const k = track.trueCurvature[idx];
  return Math.min(HANDLING.pathScaleMax, Math.max(HANDLING.pathScaleMin, 1 - laneOffset * k));
}

export function effectiveMaxSafe(
  track: TrackData,
  idx: number,
  laneOffset: number,
  gripMult: number,
): number {
  return track.maxSafeSpeed[idx] * Math.sqrt(pathScaleAt(track, idx, laneOffset)) * gripMult;
}

/** Outer-most usable |laneOffset| (asphalt + kerb). */
export function laneLimit(track: TrackData): number {
  return track.trackWidth / 2 - HANDLING.asphaltMargin + HANDLING.kerbZone;
}

/** |laneOffset| beyond which the kart is riding the kerb. */
function kerbThreshold(track: TrackData): number {
  return track.trackWidth / 2 - HANDLING.asphaltMargin;
}

/** Signed forward gap in px from `from` to `to` along the lap (+ = `to` is ahead). */
function forwardGapPx(from: CarState, to: CarState, track: TrackData): number {
  let d = to.trackPosition - from.trackPosition;
  if (d < -0.5) d += 1;
  else if (d > 0.5) d -= 1;
  return d * track.trackLength;
}

// ── Public API ───────────────────────────────────────────────────────────

export function updateCar(
  car: CarState,
  accelerate: boolean,
  brake: boolean,
  track: TrackData,
  dt: number,
  now: number,
  profile?: DifficultyProfile,
  steer: number = 0,
): void {
  // ── Respawn state machine takes full control until done ──
  if (car.respawn) {
    car.inputAccel = false;
    car.inputBrake = false;
    car.steerInput = 0;
    updateRespawn(car, track, dt);
    return;
  }

  // ── Spinning state ──
  if (car.spinning) {
    car.inputAccel = false;
    car.inputBrake = false;
    car.steerInput = 0;
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
    advanceOnTrack(car, track, dt);
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
  car.steerInput = Math.max(-1, Math.min(1, steer));

  // ── Steering — move laneOffset across the track width ──
  // Lateral authority scales up with forward speed (a parked kart can't crab
  // sideways), and the lane is clamped to asphalt + kerb. Riding the kerb
  // bleeds speed so the short-cut line has a cost.
  const steerAuthority = Math.min(1, Math.max(0, car.speed) / 2.2);
  car.laneOffset += car.steerInput * HANDLING.laneChangeSpeed * steerAuthority * dt;
  const limit = laneLimit(track);
  car.laneOffset = Math.max(-limit, Math.min(limit, car.laneOffset));
  car.onKerb = Math.abs(car.laneOffset) > kerbThreshold(track);
  if (car.onKerb) {
    car.speed *= Math.pow(HANDLING.kerbSpeedBleed, dt);
  }

  // ── Acceleration / braking ──
  // Slipstream raises the effective ceiling and pickup while in the tow.
  const speedCeil = car.maxSpeed * (car.slipstream ? DRAFT.speedBonus : 1);
  const draftAccel = car.slipstream ? DRAFT.accelBonus : 1;
  if (accelerate) {
    if (car.speed > speedCeil) {
      // Over the ceiling (just lost the slipstream) — bleed down gently
      // instead of snap-clamping ~7% of the speed away in a single frame.
      car.speed = Math.max(speedCeil, car.speed - car.friction * 2 * dt);
    } else {
      // Speed-dependent acceleration: faster = less acceleration (diminishing returns),
      // but the curve is gentler than before so top speed feels reachable, not asymptotic.
      // accelMult applies the difficulty's tire-warmth penalty / bonus.
      const speedRatio = car.speed / speedCeil;
      const accelCurve = 1 - speedRatio * 0.35;
      car.speed = Math.min(
        car.speed + car.acceleration * accelMult * recoveryMult * accelCurve * draftAccel * dt,
        speedCeil,
      );
    }
  } else if (brake) {
    car.speed = Math.max(car.speed - car.braking * brakeMult * dt, -0.3);
  } else {
    if (car.speed > 0) {
      car.speed = Math.max(car.speed - car.friction * dt, 0);
    } else if (car.speed < 0) {
      car.speed = Math.min(car.speed + car.friction * dt, 0);
    }
  }

  // ── Curvature-based grip checks — lane-aware ──
  // The inside line's tighter radius lowers the safe speed; the outside line
  // raises it. gripMult > 1 means a more forgiving track.
  const n = track.racingLine.length;
  const trackIdx = Math.floor(car.trackPosition * n) % n;
  const maxSafe = effectiveMaxSafe(track, trackIdx, car.laneOffset, gripMult);

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
      const safe = effectiveMaxSafe(track, ai, car.laneOffset, gripMult);
      if (car.speed > safe * CAR_DEFAULTS.overshootSpeedMultiplier * overshootMult) {
        willOvershoot = true;
        break;
      }
    }
  }

  if (willOvershoot) {
    triggerOvershoot(car, track);
    advanceOnTrack(car, track, dt);
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
    advanceOnTrack(car, track, dt);
    return;
  }

  // ── Track top speed (for display) — internal speed → display km/h (max 110) ──
  const speedKmh = (car.speed / CAR_DEFAULTS.maxSpeed) * 110;
  if (speedKmh > car.topSpeed) car.topSpeed = speedKmh;

  // ── Advance position on track ──
  advanceOnTrack(car, track, dt);
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

  // Outward (centrifugal) direction = away from the corner's centre. The
  // centre lies on the +perp side when signedCurvature > 0 (verified
  // numerically against the oval), so outward is MINUS perp·sign(κ). The old
  // code used +perp·sign(κ), which flung karts into the infield.
  // Overshoot triggers on lookahead, so sample the sign at the strongest
  // upcoming curvature — the current segment may still be near-straight.
  const n2 = track.racingLine.length;
  let signIdx = trackIdx;
  for (let i = 1; i <= 3; i++) {
    const ai = (trackIdx + i) % n2;
    if (Math.abs(track.signedCurvature[ai]) > Math.abs(track.signedCurvature[signIdx])) signIdx = ai;
  }
  const sign = Math.sign(track.signedCurvature[signIdx]) || 1;
  const perpX = Math.sin(car.angle) * sign;
  const perpY = -Math.cos(car.angle) * sign;

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
      // One-time: bring the kart back near the centre line so it never
      // revives on the kerb. (Doing this per-frame would collapse it to 0.)
      car.laneOffset *= 0.3;
      car.onKerb = false;
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

function advanceOnTrack(car: CarState, track: TrackData, dt: number = 1): void {
  const n = track.racingLine.length;

  // Lane-aware advancement: trackPosition is a fraction of the centre racing
  // line, but a kart on the outside of a corner is on a longer physical path —
  // so the same ground speed advances it less. This is what makes the inside
  // line genuinely faster (when you can carry the speed).
  const idx0 = Math.floor(car.trackPosition * n) % n;
  const pathScale = pathScaleAt(track, idx0, car.laneOffset);
  const speedNormalized = car.speed / TRACK_SPEED_DIVISOR;
  // dt-scaled: speed is px-per-60fps-frame, so advancement must scale with the
  // real frame time or high-refresh displays replay the old 144Hz speed bug.
  car.trackPosition += (speedNormalized / pathScale) * dt;
  car.totalDistance += Math.abs(car.speed) * dt;

  // Smoothed steering for the visual lean (decays to 0 when input stops).
  car.steerSmooth += (car.steerInput - car.steerSmooth) * Math.min(1, HANDLING.steerSmoothing * dt);

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
  if (!car.spinning) {
    // Visual yaw toward the steered direction + a kerb rattle when riding the
    // rumble strip.
    car.angle += car.steerSmooth * HANDLING.steerLean;
    if (car.onKerb && car.speed > 1.5) {
      car.angle += Math.sin(Date.now() * 0.06) * 0.045;
    }
  }
}

// ── AI brain ─────────────────────────────────────────────────────────────

export function updateAI(
  car: CarState,
  opponent: CarState,
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
  const halfRoad = kerbThreshold(track);

  // ── Racing line: hunt the apex ──
  // Look at the signed curvature ahead and aim toward the inside of the
  // upcoming corner (positive trueCurvature ⇒ inside is the positive lane
  // side). apexSkill scales both how far in the AI dares to go and how early
  // it commits; a low-skill AI wanders near the centre line.
  let kAhead = 0;
  const apexLook = 10;
  for (let i = 1; i <= apexLook; i++) {
    const w = 1 - (i - 1) / apexLook; // weight nearer segments higher
    kAhead += track.trueCurvature[(idx + i) % n] * w;
  }
  kAhead /= apexLook * 0.55; // normalise the triangular weights
  let targetLane = Math.sign(kAhead)
    * Math.min(halfRoad * 0.8, Math.abs(kAhead) * 1800 * profile.aiApexSkill);

  // ── Overtaking — commit to a side and hold it ──
  // If the opponent is close ahead in the same lane, a willing AI picks the
  // side with more room and commits for ~1.5s so it doesn't dither mid-pass.
  const gapToOpponent = forwardGapPx(car, opponent, track);
  const laneDiff = opponent.laneOffset - car.laneOffset;
  if (car.aiOvertakeFrames > 0) {
    car.aiOvertakeFrames -= dt;
    targetLane = car.aiOvertakeSide * halfRoad * 0.7;
    // Pass complete (clearly ahead) or commitment expired → release.
    if (gapToOpponent < -30 || car.aiOvertakeFrames <= 0) {
      car.aiOvertakeSide = 0;
      car.aiOvertakeFrames = 0;
    }
  } else if (
    profile.aiOvertakeAggression > 0 &&
    gapToOpponent > 0 && gapToOpponent < 120 &&
    Math.abs(laneDiff) < 14 &&
    !opponent.respawn
  ) {
    if (Math.random() < profile.aiOvertakeAggression * 0.05 * dt) {
      // Go to whichever side of the road the opponent isn't using.
      car.aiOvertakeSide = opponent.laneOffset > 0 ? -1 : 1;
      car.aiOvertakeFrames = 90;
    }
  }

  const aiSteer = Math.max(-1, Math.min(1, (targetLane - car.laneOffset) * 0.12));

  // ── Speed targets — lane-aware, looking ahead to brake before corners ──
  const maxSafe = effectiveMaxSafe(track, idx, car.laneOffset, 1);
  let minAheadSafe = maxSafe;
  for (let i = 1; i <= profile.aiLookAhead; i++) {
    const aIdx = (idx + i) % n;
    minAheadSafe = Math.min(minAheadSafe, effectiveMaxSafe(track, aIdx, car.laneOffset, 1));
  }

  // Random small mistakes (lift-off for ~half a second). Tuned so easy AI
  // visibly hesitates and extreme AI almost never does. The chance is per
  // 60fps-frame, so scale by dt to stay refresh-rate independent.
  if (car.aiMistakeFramesLeft <= 0 && Math.random() < profile.aiMistakeChance * dt) {
    car.aiMistakeFramesLeft = 25 + Math.floor(Math.random() * 20);
  }
  if (car.aiMistakeFramesLeft > 0) {
    car.aiMistakeFramesLeft -= dt;
  }

  // Wall-clock-based wobble so the pace variance period doesn't change with
  // display refresh rate (0.0018/ms ≡ the old 0.03/frame at 60fps).
  const variance = Math.sin(now * 0.0018) * profile.aiVariance;
  const targetSpeed = Math.min(maxSafe, minAheadSafe * 1.1)
    * (profile.aiSpeedFactor + variance);

  const mistaking = car.aiMistakeFramesLeft > 0;
  const accelerate = !mistaking && car.speed < targetSpeed;
  const brake = car.speed > targetSpeed * profile.aiBrakeThreshold;

  // AI uses raw physics — no profile applied; the profile drives only its targets.
  updateCar(car, accelerate, brake, track, dt, now, undefined, aiSteer);
}

// ── Kart-to-kart interactions ────────────────────────────────────────────
// Called once per frame after both cars have moved. Sets slipstream flags
// (consumed by updateCar next frame — one frame of latency is imperceptible)
// and resolves contact so karts can race wheel-to-wheel but never pass
// through each other.

export function updateInteractions(
  car1: CarState,
  car2: CarState,
  track: TrackData,
  dt: number,
): void {
  car1.slipstream = isSlipstreaming(car1, car2, track);
  car2.slipstream = isSlipstreaming(car2, car1, track);

  // No contact while either kart is in a failure state.
  if (car1.respawn || car2.respawn || car1.spinning || car2.spinning) return;

  const dist = getDistance(car1, car2);
  if (dist >= CONTACT.radiusPx * 2) return;

  const gap = forwardGapPx(car1, car2, track); // + = car2 ahead
  const behind = gap > 0 ? car1 : car2;
  const ahead = gap > 0 ? car2 : car1;
  const laneGap = Math.abs(car1.laneOffset - car2.laneOffset);

  if (laneGap < CONTACT.sameLaneGapPx) {
    // Nose-to-tail: hard block. The follower bunches up behind the leader and
    // has to change lanes to get past — this is what makes overtaking real.
    if (behind.speed > ahead.speed * CONTACT.blockSpeedRatio) {
      behind.speed = ahead.speed * CONTACT.blockSpeedRatio;
    }
  }

  // Lateral separation: rub apart whenever touching (also unsticks perfect
  // nose-to-tail overlap). Both karts scrub a little speed while in contact.
  const push = CONTACT.lateralPush * dt;
  if (car1.laneOffset <= car2.laneOffset) {
    car1.laneOffset -= push;
    car2.laneOffset += push;
  } else {
    car1.laneOffset += push;
    car2.laneOffset -= push;
  }
  const limit = laneLimit(track);
  car1.laneOffset = Math.max(-limit, Math.min(limit, car1.laneOffset));
  car2.laneOffset = Math.max(-limit, Math.min(limit, car2.laneOffset));
  car1.speed *= Math.pow(CONTACT.rubSpeedScrub, dt);
  car2.speed *= Math.pow(CONTACT.rubSpeedScrub, dt);
}

function isSlipstreaming(follower: CarState, leader: CarState, track: TrackData): boolean {
  if (follower.respawn || follower.spinning || leader.respawn || leader.spinning) return false;
  const gap = forwardGapPx(follower, leader, track);
  return (
    gap > DRAFT.minGapPx &&
    gap < DRAFT.maxGapPx &&
    Math.abs(follower.laneOffset - leader.laneOffset) < DRAFT.laneTolerancePx &&
    follower.speed > follower.maxSpeed * 0.5
  );
}

export function getDistance(a: CarState, b: CarState): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
