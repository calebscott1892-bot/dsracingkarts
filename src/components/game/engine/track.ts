import { CANVAS_WIDTH, CANVAS_HEIGHT, CAR_DEFAULTS, TRACK_CHECKPOINT_COUNT } from "./constants";

export interface Point {
  x: number;
  y: number;
}

export interface TrackData {
  name: string;
  racingLine: Point[];
  curvature: number[];        // unsigned 0–1 (used by AI braking & speed cap)
  signedCurvature: number[];  // signed: positive = left turn, negative = right (for overshoot direction)
  maxSafeSpeed: number[];
  trackWidth: number;
  checkpointIndices: number[];
  startIndex: number;
  trackLength: number; // total length in pixels (sum of segment distances)
}

// Helper: generate points along an elliptical path
function ellipse(cx: number, cy: number, rx: number, ry: number, numPoints: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    points.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return points;
}

// Compute curvature at each point (0 = straight, 1 = hairpin) — unsigned.
function computeCurvature(points: Point[]): number[] {
  const n = points.length;
  const curvatures: number[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
    const dist = Math.sqrt(dx1 * dx1 + dy1 * dy1) * Math.sqrt(dx2 * dx2 + dy2 * dy2);

    curvatures.push(dist > 0 ? Math.min(cross / dist, 1) : 0);
  }

  // Smooth curvature to avoid sudden spikes
  const smoothed: number[] = [];
  for (let i = 0; i < n; i++) {
    const window = 3;
    let sum = 0;
    let count = 0;
    for (let j = -window; j <= window; j++) {
      sum += curvatures[(i + j + n) % n];
      count++;
    }
    smoothed.push(sum / count);
  }

  return smoothed;
}

// Signed curvature: positive = turning one way, negative = the other.
// Used for "fly-off direction": centrifugal force pushes the car
// to the OUTSIDE of the curve.
function computeSignedCurvature(points: Point[]): number[] {
  const n = points.length;
  const raw: number[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const cross = dx1 * dy2 - dy1 * dx2; // signed
    const dist = Math.sqrt(dx1 * dx1 + dy1 * dy1) * Math.sqrt(dx2 * dx2 + dy2 * dy2);

    raw.push(dist > 0 ? Math.max(-1, Math.min(1, cross / dist)) : 0);
  }

  // Smooth so direction is stable around tight corners
  const smoothed: number[] = [];
  for (let i = 0; i < n; i++) {
    const window = 3;
    let sum = 0;
    let count = 0;
    for (let j = -window; j <= window; j++) {
      sum += raw[(i + j + n) % n];
      count++;
    }
    smoothed.push(sum / count);
  }
  return smoothed;
}

function curvatureToMaxSpeed(curvature: number[], baseMax: number): number[] {
  return curvature.map(c => {
    // Straight (c≈0) → full speed, tight corner (c≈1) → 25% speed
    // This creates meaningful speed differences that require braking
    const minFraction = 0.25;
    return baseMax * (1 - c * (1 - minFraction));
  });
}

// Catmull-Rom spline interpolation
function catmullRom(controlPoints: Point[], numSegPoints: number): Point[] {
  const result: Point[] = [];
  const n = controlPoints.length;

  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[(i - 1 + n) % n];
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % n];
    const p3 = controlPoints[(i + 2) % n];

    for (let j = 0; j < numSegPoints; j++) {
      const t = j / numSegPoints;
      const t2 = t * t;
      const t3 = t2 * t;

      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );

      result.push({ x, y });
    }
  }

  return result;
}

function computeTrackLength(points: Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const dx = next.x - points[i].x;
    const dy = next.y - points[i].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

// Find the index of the point on the longest straight for the start/finish line
function findBestStartIndex(points: Point[], curvature: number[]): number {
  const n = points.length;
  let bestIdx = 0;
  let bestScore = -1;

  // Look for the longest run of low curvature
  for (let i = 0; i < n; i++) {
    let score = 0;
    for (let j = -8; j <= 8; j++) {
      const c = curvature[(i + j + n) % n];
      if (c < 0.05) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function buildTrack(name: string, controlPoints: Point[], width: number, baseMax: number): TrackData {
  const racingLine = catmullRom(controlPoints, 12);
  const curvature = computeCurvature(racingLine);
  const signedCurvature = computeSignedCurvature(racingLine);
  const maxSafeSpeed = curvatureToMaxSpeed(curvature, baseMax);
  const trackLength = computeTrackLength(racingLine);

  const startIndex = findBestStartIndex(racingLine, curvature);

  // Densified checkpoints — TRACK_CHECKPOINT_COUNT evenly spaced from start.
  // Used purely for "respawn placement", so that flying off the track only
  // costs you a small chunk of progress (≈ 1/12th of the lap).
  const n = racingLine.length;
  const checkpointIndices: number[] = [];
  for (let i = 0; i < TRACK_CHECKPOINT_COUNT; i++) {
    checkpointIndices.push((startIndex + Math.floor((n * i) / TRACK_CHECKPOINT_COUNT)) % n);
  }

  return {
    name,
    racingLine,
    curvature,
    signedCurvature,
    maxSafeSpeed,
    trackWidth: width,
    checkpointIndices,
    startIndex,
    trackLength,
  };
}

const CX = CANVAS_WIDTH / 2;
const CY = CANVAS_HEIGHT / 2;

// Track 1: The Oval — fast, wide, gentle curves
const ovalPoints = ellipse(CX, CY, 400, 220, 24);

// Track 2: The Chicane — S-bends and a technical section
const chicaneControl: Point[] = [
  { x: CX - 350, y: CY },
  { x: CX - 250, y: CY - 180 },
  { x: CX - 100, y: CY - 180 },
  { x: CX, y: CY - 50 },
  { x: CX + 100, y: CY + 80 },
  { x: CX + 250, y: CY + 180 },
  { x: CX + 350, y: CY + 180 },
  { x: CX + 400, y: CY },
  { x: CX + 350, y: CY - 180 },
  { x: CX + 250, y: CY - 180 },
  { x: CX + 100, y: CY - 80 },
  { x: CX, y: CY + 50 },
  { x: CX - 100, y: CY + 180 },
  { x: CX - 250, y: CY + 180 },
  { x: CX - 350, y: CY },
];

// Track 3: The Circuit — hairpins and long straights
const circuitControl: Point[] = [
  { x: 150, y: CY + 100 },
  { x: 150, y: CY - 150 },
  { x: 250, y: CY - 250 },
  { x: 500, y: CY - 250 },
  { x: 600, y: CY - 150 },
  { x: 600, y: CY - 50 },
  { x: 500, y: CY + 50 },
  { x: 700, y: CY + 50 },
  { x: 900, y: CY - 100 },
  { x: 1050, y: CY - 250 },
  { x: 1100, y: CY - 100 },
  { x: 1050, y: CY + 100 },
  { x: 900, y: CY + 200 },
  { x: 500, y: CY + 200 },
  { x: 300, y: CY + 200 },
];

// Track 4: Campbelltown GP — most complex
const campbelltownControl: Point[] = [
  { x: 200, y: CY + 150 },
  { x: 150, y: CY - 50 },
  { x: 200, y: CY - 200 },
  { x: 350, y: CY - 250 },
  { x: 500, y: CY - 200 },
  { x: 550, y: CY - 100 },
  { x: 450, y: CY },
  { x: 550, y: CY + 50 },
  { x: 700, y: CY - 50 },
  { x: 800, y: CY - 200 },
  { x: 950, y: CY - 250 },
  { x: 1050, y: CY - 150 },
  { x: 1100, y: CY },
  { x: 1050, y: CY + 150 },
  { x: 900, y: CY + 220 },
  { x: 700, y: CY + 200 },
  { x: 550, y: CY + 250 },
  { x: 350, y: CY + 250 },
];

export const TRACKS: TrackData[] = [
  buildTrack("The Oval", ovalPoints, 62, CAR_DEFAULTS.maxSpeed),
  buildTrack("The Chicane", chicaneControl, 56, CAR_DEFAULTS.maxSpeed * 0.92),
  buildTrack("The Circuit", circuitControl, 52, CAR_DEFAULTS.maxSpeed * 0.85),
  buildTrack("Campbelltown GP", campbelltownControl, 50, CAR_DEFAULTS.maxSpeed * 0.8),
];
