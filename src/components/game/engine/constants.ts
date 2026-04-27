// All tunable game values in one place.
// Physics are tuned so a clean lap on The Oval ≈ 3.5 seconds at full chat,
// and a realistic racing lap with cornering lands around 5–6 seconds.

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 700;

// ── Base car physics (modulated per-difficulty for the player) ──
export const CAR_DEFAULTS = {
  maxSpeed: 8.4,         // absolute ceiling (pixels-per-frame along racing line)
  acceleration: 0.075,   // punchy pickup — takes ~110 frames (≈1.8s) from 0→max
  braking: 0.13,         // strong, responsive brakes
  friction: 0.022,       // coast deceleration
  spinDuration: 55,      // frames (~0.9s) — quick, snappy spin recovery
  recoveryDuration: 28,  // frames (~0.5s) half-power after spin
  // Failure thresholds (multipliers of segment maxSafeSpeed)
  driftSpeedMultiplier: 1.18,    // exceed safe by 18% → visual drift wobble
  overshootSpeedMultiplier: 1.18, // exceed safe by 18% on a curve → fly off track
  spinSpeedMultiplier: 1.40,     // exceed safe by 40% on a straight → spin out
  // Respawn animation timing (frames @ 60fps). Total ≈ 2.4s.
  respawnFlyingFrames: 30,    // 0.5s — visually shoot off into runoff
  respawnPlacingFrames: 24,   // 0.4s — fade-out / teleport
  respawnRevivingFrames: 60,  // 1.0s — flashing at checkpoint
  respawnRecoveryFrames: 24,  // 0.4s half-power throttle ramp
};

export const TRACK_CHECKPOINT_COUNT = 12; // 12 evenly-spaced checkpoints for respawn
// A car must enter a curving segment with curvature > this to risk fly-off
export const OVERSHOOT_CURVATURE_THRESHOLD = 0.06;

// ── Difficulty profiles ──
// "Win rate" targets: easy 90%, medium 65%, hard 40%, extreme 10%.
// Achieved by tuning AI pace AND player track conditions ("wet track / cold tires" etc).
export interface DifficultyProfile {
  key: "easy" | "medium" | "hard" | "extreme";
  label: string;
  flavour: string;       // shown on the difficulty card
  description: string;   // one-line description
  // Player physics modulation
  playerGripMult: number;        // multiplies safe-speed thresholds (>1 = more forgiving)
  playerAccelMult: number;       // multiplies acceleration
  playerBrakeMult: number;       // multiplies braking strength
  playerSpinMult: number;        // multiplies spin threshold (>1 = harder to spin)
  playerOvershootMult: number;   // multiplies overshoot threshold (>1 = more forgiving)
  // AI tuning
  aiSpeedFactor: number;         // fraction of safe-speed AI targets
  aiVariance: number;            // sine-wave wobble in target speed
  aiLookAhead: number;           // segments ahead AI inspects for braking
  aiBrakeThreshold: number;      // brake when speed > targetSpeed * this
  aiMistakeChance: number;       // per-frame chance of small AI lift-off
}

export const DIFFICULTY_PROFILES: Record<"easy" | "medium" | "hard" | "extreme", DifficultyProfile> = {
  easy: {
    key: "easy",
    label: "EASY",
    flavour: "DRY TRACK · WARM TIRES",
    description: "Maximum grip, forgiving runoff, lazy CPU.",
    playerGripMult: 1.32,
    playerAccelMult: 1.28,
    playerBrakeMult: 1.18,
    playerSpinMult: 1.45,        // very hard to spin
    playerOvershootMult: 1.35,   // big overshoot tolerance
    aiSpeedFactor: 0.62,
    aiVariance: 0.10,
    aiLookAhead: 6,
    aiBrakeThreshold: 0.96,      // AI brakes early
    aiMistakeChance: 0.004,
  },
  medium: {
    key: "medium",
    label: "MEDIUM",
    flavour: "RACE CONDITIONS",
    description: "Standard grip and a confident, clean CPU.",
    playerGripMult: 1.18,
    playerAccelMult: 1.15,
    playerBrakeMult: 1.08,
    playerSpinMult: 1.18,
    playerOvershootMult: 1.12,
    aiSpeedFactor: 0.80,
    aiVariance: 0.05,
    aiLookAhead: 12,
    aiBrakeThreshold: 1.04,
    aiMistakeChance: 0.0015,
  },
  hard: {
    key: "hard",
    label: "HARD",
    flavour: "DAMP TRACK · COOLING TIRES",
    description: "Reduced grip, slower acceleration, sharp CPU on its line.",
    playerGripMult: 0.92,
    playerAccelMult: 0.88,
    playerBrakeMult: 0.92,
    playerSpinMult: 0.95,
    playerOvershootMult: 0.92,
    aiSpeedFactor: 0.92,
    aiVariance: 0.025,
    aiLookAhead: 18,
    aiBrakeThreshold: 1.08,
    aiMistakeChance: 0.0006,
  },
  extreme: {
    key: "extreme",
    label: "EXTREME",
    flavour: "WET TRACK · COLD TIRES",
    description: "Greasy surface, slow tire warm-up, near-perfect CPU.",
    playerGripMult: 0.82,
    playerAccelMult: 0.78,
    playerBrakeMult: 0.82,
    playerSpinMult: 0.85,
    playerOvershootMult: 0.84,
    aiSpeedFactor: 0.99,
    aiVariance: 0.015,
    aiLookAhead: 24,
    aiBrakeThreshold: 1.12,
    aiMistakeChance: 0.0001,
  },
};

// Legacy export — some files still import AI_DIFFICULTY directly.
// Maps each tier to the legacy shape so older callers keep compiling
// while new callers use DIFFICULTY_PROFILES.
export const AI_DIFFICULTY = {
  easy: { speedFactor: DIFFICULTY_PROFILES.easy.aiSpeedFactor, variance: DIFFICULTY_PROFILES.easy.aiVariance, lookAhead: DIFFICULTY_PROFILES.easy.aiLookAhead, brakeThreshold: DIFFICULTY_PROFILES.easy.aiBrakeThreshold },
  medium: { speedFactor: DIFFICULTY_PROFILES.medium.aiSpeedFactor, variance: DIFFICULTY_PROFILES.medium.aiVariance, lookAhead: DIFFICULTY_PROFILES.medium.aiLookAhead, brakeThreshold: DIFFICULTY_PROFILES.medium.aiBrakeThreshold },
  hard: { speedFactor: DIFFICULTY_PROFILES.hard.aiSpeedFactor, variance: DIFFICULTY_PROFILES.hard.aiVariance, lookAhead: DIFFICULTY_PROFILES.hard.aiLookAhead, brakeThreshold: DIFFICULTY_PROFILES.hard.aiBrakeThreshold },
  extreme: { speedFactor: DIFFICULTY_PROFILES.extreme.aiSpeedFactor, variance: DIFFICULTY_PROFILES.extreme.aiVariance, lookAhead: DIFFICULTY_PROFILES.extreme.aiLookAhead, brakeThreshold: DIFFICULTY_PROFILES.extreme.aiBrakeThreshold },
} as const;

export const COLORS = {
  player1: "#e60012",
  player2: "#2060ff",
  track: "#2a2a2a",
  kerb1: "#e60012",
  kerb2: "#ffffff",
  grass: "#1f6a1f",
  grassDark: "#175e17",
  sand: "#c4a862",
  line: "#ffffff",
  asphalt: "#333333",
  asphaltDark: "#252525",
  finishWhite: "#ffffff",
  finishBlack: "#1a1a1a",
};

export const COUNTDOWN_LIGHT_INTERVAL = 1000;
export const COUNTDOWN_RANDOM_DELAY_MIN = 500;
export const COUNTDOWN_RANDOM_DELAY_MAX = 2500;

// Normalization: trackPosition advances by  speed / TRACK_SPEED_DIVISOR  per frame.
// With a typical track length of ~300 points and maxSpeed 8.4, a flat-out lap would
// take about 3.5s and a realistic race lap (with cornering) around 5–6s.
export const TRACK_SPEED_DIVISOR = 1800;
