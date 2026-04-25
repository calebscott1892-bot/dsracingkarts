import { CAR_DEFAULTS } from "./constants";

export type GamePhase = "menu" | "track_select" | "countdown" | "racing" | "game_over";

export type RespawnPhase = "flying" | "placing" | "reviving";

export interface RespawnState {
  phase: RespawnPhase;
  framesLeft: number;
  // Visual fly-off (only used during "flying" phase)
  flyX: number;
  flyY: number;
  flyVx: number;
  flyVy: number;
  flyAngle: number;
  flyAvel: number;
  // Where the car will be placed when "placing" finishes
  targetTrackPosition: number;
}

export interface CarState {
  x: number;
  y: number;
  angle: number;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  braking: number;
  friction: number;
  // Track position
  trackPosition: number; // 0–1 along the racing line
  prevTrackPosition: number; // for monotonic lap-progress delta
  laneOffset: number;
  // Drift / spin
  drifting: boolean;
  spinning: boolean;
  spinFramesLeft: number;
  recoveryFramesLeft: number;
  spinAngle: number;
  // Live input flags (set every frame by physics) — used by renderer for
  // headlights, brake lights, and brake-scuff marks.
  inputAccel: boolean;
  inputBrake: boolean;
  // Respawn (corner overshoot → fly off → carry back)
  respawn: RespawnState | null;
  // Lap counting (monotonic — robust against missed checkpoints)
  lapProgress: number; // strictly forward-only continuous lap progress
  lapCount: number; // floor(lapProgress) but only counted once countdown is done
  lastCheckpoint: number; // densified for respawn placement
  penaltyLaps: number;
  fastestLap: number;
  currentLapStart: number;
  lapTimes: number[];
  topSpeed: number;
  spinOuts: number;
  offTrackResets: number;
  totalDistance: number;
  // False start
  falseStarts: number;
  // AI brain (only used when car is driven by AI)
  aiMistakeFramesLeft: number;
}

export type AIDifficulty = "easy" | "medium" | "hard" | "extreme";

export interface GameState {
  phase: GamePhase;
  trackIndex: number;
  totalLaps: number;
  car1: CarState;
  car2: CarState;
  isMultiplayer: boolean;
  aiDifficulty: AIDifficulty;
  raceStartTime: number;
  raceEndTime: number; // frozen when winner is decided
  winner: 1 | 2 | null;
  // Countdown
  lightsLit: number;
  lightsOut: boolean;
  countdownStartTime: number;
  // Pause — true while the user has tapped the pause button mid-race
  paused: boolean;
  // Accumulated paused time so on-screen lap timers stay correct
  pauseStartedAt: number; // 0 when not currently paused
  totalPausedMs: number;
}

export function createCarState(x: number, y: number, angle: number): CarState {
  return {
    x, y, angle,
    speed: 0,
    maxSpeed: CAR_DEFAULTS.maxSpeed,
    acceleration: CAR_DEFAULTS.acceleration,
    braking: CAR_DEFAULTS.braking,
    friction: CAR_DEFAULTS.friction,
    trackPosition: 0,
    prevTrackPosition: 0,
    laneOffset: 0,
    drifting: false,
    spinning: false,
    spinFramesLeft: 0,
    recoveryFramesLeft: 0,
    spinAngle: 0,
    inputAccel: false,
    inputBrake: false,
    respawn: null,
    lapProgress: 0,
    lapCount: 0,
    lastCheckpoint: -1,
    penaltyLaps: 0,
    fastestLap: Infinity,
    currentLapStart: 0,
    lapTimes: [],
    topSpeed: 0,
    spinOuts: 0,
    offTrackResets: 0,
    totalDistance: 0,
    falseStarts: 0,
    aiMistakeFramesLeft: 0,
  };
}

export function createInitialState(): GameState {
  return {
    phase: "menu",
    trackIndex: 0,
    totalLaps: 5,
    car1: createCarState(0, 0, 0),
    car2: createCarState(0, 0, 0),
    isMultiplayer: false,
    aiDifficulty: "medium",
    raceStartTime: 0,
    raceEndTime: 0,
    winner: null,
    lightsLit: 0,
    lightsOut: false,
    countdownStartTime: 0,
    paused: false,
    pauseStartedAt: 0,
    totalPausedMs: 0,
  };
}
