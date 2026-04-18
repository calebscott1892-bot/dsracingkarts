// All tunable game values in one place

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 700;

// Physics are tuned so a "reasonably fast" lap ≈ 5 seconds on The Oval.
// Cars accelerate gradually and must brake into corners or they spin out.
export const CAR_DEFAULTS = {
  maxSpeed: 6,          // absolute ceiling (pixels-per-frame along racing line)
  acceleration: 0.035,  // gradual pickup — takes ~170 frames (≈2.8s) from 0→max
  braking: 0.08,        // strong brakes
  friction: 0.012,      // gentle coast-down when not accelerating
  spinDuration: 120,    // frames (~2s at 60fps) — big penalty
  recoveryDuration: 60, // frames (~1s) half-power after spin
  spinSpeedMultiplier: 1.25, // exceed maxSafeSpeed by 25% → spin out
  driftSpeedMultiplier: 1.08, // exceed by 8% → visual drift warning
  draftBoost: 0.04,
  draftDistance: 60,
};

export const AI_DEFAULTS = {
  baseSpeedFactor: 0.88,
  variance: 0.06,
  updateInterval: 30,
};

// Difficulty presets: controls how fast the AI drives relative to maxSafeSpeed
// and how far ahead it looks to brake for corners
export const AI_DIFFICULTY = {
  easy: { speedFactor: 0.68, variance: 0.08, lookAhead: 8, brakeThreshold: 1.0 },
  medium: { speedFactor: 0.78, variance: 0.06, lookAhead: 12, brakeThreshold: 1.05 },
  hard: { speedFactor: 0.88, variance: 0.04, lookAhead: 18, brakeThreshold: 1.08 },
  extreme: { speedFactor: 0.95, variance: 0.02, lookAhead: 25, brakeThreshold: 1.12 },
} as const;

export const COLORS = {
  player1: "#e60012",
  player2: "#2060ff",
  track: "#2a2a2a",
  kerb1: "#e60012",
  kerb2: "#ffffff",
  grass: "#1a5c1a",
  grassDark: "#145214",
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
// With a typical track length of ~300 points and maxSpeed 6, a flat-out lap would
// take about 3s and a "reasonably fast" lap about 5s.
export const TRACK_SPEED_DIVISOR = 1800;
