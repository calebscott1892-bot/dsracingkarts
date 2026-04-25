import type { CarState, GameState } from "./state";
import type { TrackData, Point } from "./track";
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT, CAR_DEFAULTS } from "./constants";
import {
  updateAmbient,
  drawAmbientGround,
  drawAmbientAir,
  clearAmbient as clearAmbientCritters,
} from "./ambient";

// Persistent skid marks
const skidMarks: { x: number; y: number; age: number; alpha: number }[] = [];

// Frame counter purely for ambient pacing
let ambientFrameCounter = 0;

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  track: TrackData,
): void {
  const w = CANVAS_WIDTH;
  const h = CANVAS_HEIGHT;

  // ── Background: grass with texture ──
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, w, h);

  // Grass texture stripes
  ctx.fillStyle = COLORS.grassDark;
  for (let y = 0; y < h; y += 24) {
    if ((y / 24) % 2 === 0) {
      ctx.fillRect(0, y, w, 12);
    }
  }

  // ── Scenery behind track ──
  drawScenery(ctx, track);

  // ── Track ──
  drawTrack(ctx, track);

  // ── Ambient critters (ground layer: dust, butterflies) ──
  ambientFrameCounter++;
  updateAmbient(Date.now(), ambientFrameCounter);
  drawAmbientGround(ctx);

  // ── Skid marks (persistent) ──
  drawSkidMarks(ctx);

  // Add new skid marks from spinning cars (suppressed during respawn animation).
  if (state.car1.spinning && !state.car1.respawn) addSkidMark(state.car1);
  if (state.car2.spinning && !state.car2.respawn) addSkidMark(state.car2);
  if (state.car1.drifting && !state.car1.respawn) addSkidMark(state.car1, 0.3);
  if (state.car2.drifting && !state.car2.respawn) addSkidMark(state.car2, 0.3);
  // Brake scuff streaks — short black asphalt marks behind the rear wheels.
  if (state.car1.inputBrake && state.car1.speed > 2 && !state.car1.respawn) addBrakeScuff(state.car1);
  if (state.car2.inputBrake && state.car2.speed > 2 && !state.car2.respawn) addBrakeScuff(state.car2);

  // ── Cars (draw car behind first) ──
  const car1Ahead = state.car1.trackPosition > state.car2.trackPosition;
  if (car1Ahead) {
    drawCar(ctx, state.car2, COLORS.player2, "2");
    drawCar(ctx, state.car1, COLORS.player1, "1");
  } else {
    drawCar(ctx, state.car1, COLORS.player1, "1");
    drawCar(ctx, state.car2, COLORS.player2, "2");
  }

  // ── Respawn checkpoint glow (drawn over track, behind cars in flying state) ──
  // Already drawn cars; draw an overlay halo over reviving/placing cars on top.
  drawRespawnHaloIfNeeded(ctx, state.car1, COLORS.player1);
  drawRespawnHaloIfNeeded(ctx, state.car2, COLORS.player2);

  // ── Ambient critters (air layer: birds) ──
  drawAmbientAir(ctx);
}

function drawRespawnHaloIfNeeded(
  ctx: CanvasRenderingContext2D,
  car: CarState,
  color: string,
): void {
  if (!car.respawn) return;
  const r = car.respawn;

  if (r.phase === "placing" || r.phase === "reviving") {
    // Soft pulsing ring at the checkpoint to telegraph "respawning here".
    const t = Date.now() * 0.008;
    const pulse = (Math.sin(t) + 1) / 2;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.globalAlpha = 0.35 + 0.25 * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 18 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.2 + 0.15 * pulse;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + pulse * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Seeded random for consistent scenery placement per frame ──
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── Pre-compute scenery positions (called once, cached) ──
const sceneryCache = new Map<string, { x: number; y: number; type: string; scale: number }[]>();

function getSceneryPositions(track: TrackData) {
  const key = track.name;
  if (sceneryCache.has(key)) return sceneryCache.get(key)!;

  const w = CANVAS_WIDTH;
  const h = CANVAS_HEIGHT;
  const items: { x: number; y: number; type: string; scale: number }[] = [];

  // Build a set of "near track" points to avoid placing scenery on the road
  const trackPoints = new Set<string>();
  for (const p of track.racingLine) {
    // Mark a wide area around the track as off-limits
    for (let dx = -50; dx <= 50; dx += 10) {
      for (let dy = -50; dy <= 50; dy += 10) {
        trackPoints.add(`${Math.round((p.x + dx) / 20)},${Math.round((p.y + dy) / 20)}`);
      }
    }
  }

  // Scatter trees
  for (let i = 0; i < 80; i++) {
    const x = seededRandom(i * 3 + 1) * w;
    const y = seededRandom(i * 3 + 2) * h;
    const gridKey = `${Math.round(x / 20)},${Math.round(y / 20)}`;
    if (trackPoints.has(gridKey)) continue;
    // Skip if too close to edges
    if (x < 15 || x > w - 15 || y < 15 || y > h - 15) continue;
    const scale = 0.6 + seededRandom(i * 3 + 3) * 0.6;
    const type = seededRandom(i * 7) > 0.3 ? "tree" : "bush";
    items.push({ x, y, type, scale });
  }

  // Add tire walls near sharp corners
  for (let i = 0; i < track.racingLine.length; i += 8) {
    if (track.curvature[i] > 0.15) {
      const p = track.racingLine[i];
      const nextP = track.racingLine[(i + 1) % track.racingLine.length];
      const angle = Math.atan2(nextP.y - p.y, nextP.x - p.x);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const dist = track.trackWidth / 2 + 18;
      // Outer side tire wall
      const side = seededRandom(i) > 0.5 ? 1 : -1;
      items.push({
        x: p.x + perpX * dist * side,
        y: p.y + perpY * dist * side,
        type: "tirewall",
        scale: 1,
      });
    }
  }

  sceneryCache.set(key, items);
  return items;
}

function drawScenery(ctx: CanvasRenderingContext2D, track: TrackData): void {
  const items = getSceneryPositions(track);

  for (const item of items) {
    ctx.save();
    ctx.translate(item.x, item.y);

    if (item.type === "tree") {
      const s = item.scale;
      // Tree shadow
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(3, 3, 8 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Trunk
      ctx.fillStyle = "#5c3d1e";
      ctx.fillRect(-2 * s, -2 * s, 4 * s, 8 * s);
      // Canopy (dark green circle with highlight)
      ctx.fillStyle = "#0e4a0e";
      ctx.beginPath();
      ctx.arc(0, -4 * s, 8 * s, 0, Math.PI * 2);
      ctx.fill();
      // Lighter top highlight
      ctx.fillStyle = "#1a6b1a";
      ctx.beginPath();
      ctx.arc(-1 * s, -6 * s, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === "bush") {
      const s = item.scale;
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.beginPath();
      ctx.ellipse(2, 2, 6 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a5c1a";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#228b22";
      ctx.beginPath();
      ctx.ellipse(-1 * s, -1 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === "tirewall") {
      // Red and white tire barrier
      for (let t = 0; t < 4; t++) {
        ctx.fillStyle = t % 2 === 0 ? "#e60012" : "#ffffff";
        ctx.beginPath();
        ctx.arc(t * 6 - 9, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

function drawTrack(ctx: CanvasRenderingContext2D, track: TrackData): void {
  const points = track.racingLine;
  const w = track.trackWidth;

  if (points.length < 2) return;

  ctx.save();

  // ── Sand/gravel runoff (wider than track) ──
  ctx.lineWidth = w + 20;
  ctx.strokeStyle = COLORS.sand;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  // ── Kerbs (outer edge) — alternating red/white blocks ──
  ctx.lineWidth = w + 10;
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = COLORS.kerb1;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = COLORS.kerb2;
  ctx.lineDashOffset = 10;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // ── Main asphalt surface ──
  ctx.lineWidth = w;
  ctx.strokeStyle = COLORS.asphalt;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  // ── Subtle asphalt texture (slightly darker lane markings) ──
  ctx.lineWidth = w * 0.6;
  ctx.strokeStyle = COLORS.asphaltDark;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Centre dashed line ──
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.line;
  ctx.setLineDash([14, 12]);
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // ── Start/finish line — chequered flag pattern ──
  const si = track.startIndex;
  const p = points[si];
  const next = points[(si + 1) % points.length];
  const angle = Math.atan2(next.y - p.y, next.x - p.x);
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);

  const cellSize = 7;
  const rows = Math.ceil(w / cellSize) + 2;
  const cols = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = p.x + perpX * (r - rows / 2) * cellSize + Math.cos(angle) * (c - cols / 2) * cellSize;
      const oy = p.y + perpY * (r - rows / 2) * cellSize + Math.sin(angle) * (c - cols / 2) * cellSize;
      ctx.fillStyle = (r + c) % 2 === 0 ? COLORS.finishWhite : COLORS.finishBlack;
      ctx.fillRect(ox - cellSize / 2, oy - cellSize / 2, cellSize, cellSize);
    }
  }

  // ── Checkpoint markers (subtle dashed lines across track) ──
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  for (const cpIdx of track.checkpointIndices) {
    const cp = points[cpIdx];
    const cpNext = points[(cpIdx + 1) % points.length];
    const cpAngle = Math.atan2(cpNext.y - cp.y, cpNext.x - cp.x);
    const cpPerpX = -Math.sin(cpAngle);
    const cpPerpY = Math.cos(cpAngle);
    ctx.beginPath();
    ctx.moveTo(cp.x + cpPerpX * w / 2, cp.y + cpPerpY * w / 2);
    ctx.lineTo(cp.x - cpPerpX * w / 2, cp.y - cpPerpY * w / 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  car: CarState,
  color: string,
  label: string,
): void {
  // ── Respawn render modes ──
  let respawnAlpha = 1;
  let respawnFlash = false;
  let respawnTumble = false;
  if (car.respawn) {
    if (car.respawn.phase === "flying") {
      respawnTumble = true;
    } else if (car.respawn.phase === "placing") {
      // Carrying back — render very faded.
      respawnAlpha = 0.15 + 0.1 * Math.abs(Math.sin(Date.now() * 0.025));
    } else if (car.respawn.phase === "reviving") {
      // Strobe between visible and bright-white "reviving" flash.
      respawnFlash = Math.floor(Date.now() / 110) % 2 === 0;
      respawnAlpha = respawnFlash ? 1 : 0.45;
    }
  }

  ctx.save();
  // Subtle vertical bob at speed — gives the kart a slight "rumble" feel.
  const bob = (car.speed > 1.2 && !car.respawn && !car.spinning)
    ? Math.sin(Date.now() * 0.022 + car.x * 0.012) * (Math.min(1, car.speed / 4) * 0.9)
    : 0;
  ctx.translate(car.x, car.y + bob);
  ctx.rotate(car.angle);
  ctx.globalAlpha = respawnAlpha;

  const isDark = color === COLORS.player2;

  // ── Shadow ──
  ctx.globalAlpha = 0.3 * respawnAlpha;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(2, 2, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = respawnAlpha;

  // ── Headlights — soft yellow forward cone whenever moving forward ──
  // Drawn before the body so it projects onto the asphalt (under the car nose).
  if (car.speed > 0.3 && !car.spinning && !car.respawn) {
    const intensity = Math.min(1, car.speed / 3);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const grad = ctx.createLinearGradient(18, 0, 60, 0);
    grad.addColorStop(0, `rgba(255,245,192,${0.42 * intensity * respawnAlpha})`);
    grad.addColorStop(0.55, `rgba(255,238,170,${0.18 * intensity * respawnAlpha})`);
    grad.addColorStop(1, "rgba(255,245,192,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(18, -3);
    ctx.lineTo(52, -14);
    ctx.lineTo(60, 0);
    ctx.lineTo(52, 14);
    ctx.lineTo(18, 3);
    ctx.closePath();
    ctx.fill();
    // Two bright bulbs at the nose corners
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.85 * intensity * respawnAlpha;
    ctx.fillStyle = "#fff5c0";
    ctx.beginPath();
    ctx.arc(16, -4, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(16, 4, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = respawnAlpha;
  }

  // ── Rear wing ──
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(-18, -11, 5, 22);
  // Wing endplates
  ctx.fillStyle = "#222";
  ctx.fillRect(-18, -12, 5, 2);
  ctx.fillRect(-18, 10, 5, 2);
  ctx.globalAlpha = 1;

  // ── Wheels (4 with tread detail) ──
  const wheelPositions = [
    { x: 8, y: -12 },  // front-right
    { x: 8, y: 8 },    // front-left
    { x: -13, y: -12 }, // rear-right
    { x: -13, y: 8 },  // rear-left
  ];
  for (const wp of wheelPositions) {
    // Tire
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(wp.x, wp.y, 7, 4);
    // Tread highlight
    ctx.fillStyle = "#333";
    ctx.fillRect(wp.x + 1, wp.y + 1, 5, 2);
  }

  // ── Main body ──
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-14, -8);
  ctx.lineTo(12, -6);
  ctx.lineTo(15, -3);
  ctx.lineTo(15, 3);
  ctx.lineTo(12, 6);
  ctx.lineTo(-14, 8);
  ctx.closePath();
  ctx.fill();

  // Body highlight stripe
  ctx.fillStyle = isDark ? "#4080ff" : "#ff3333";
  ctx.globalAlpha = 0.4;
  ctx.fillRect(-10, -2, 20, 4);
  ctx.globalAlpha = 1;

  // ── Cockpit ──
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Helmet (more detailed) ──
  // Helmet base
  ctx.fillStyle = isDark ? "#3366cc" : "#cc2200";
  ctx.beginPath();
  ctx.arc(1, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Visor
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(2.5, 0, 2, -0.6, 0.6);
  ctx.lineTo(1.5, 0);
  ctx.closePath();
  ctx.fill();
  // Helmet highlight
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.arc(0, -1.5, 2, -Math.PI, 0);
  ctx.fill();

  // ── Front nose cone ──
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(12, -4);
  ctx.lineTo(18, -1);
  ctx.lineTo(18, 1);
  ctx.lineTo(12, 4);
  ctx.closePath();
  ctx.fill();

  // ── Number circle ──
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-6, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "bold 6px var(--font-digital), monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, -6, 0.5);

  // ── Exhaust / smoke particles ──
  if ((car.drifting || car.spinning) && !car.respawn) {
    ctx.globalAlpha = 0.4 * respawnAlpha;
    for (let i = 0; i < 5; i++) {
      const ox = -20 - Math.random() * 15;
      const oy = (Math.random() - 0.5) * 14;
      const size = 2 + Math.random() * 4;
      ctx.fillStyle = car.spinning ? "#ff6600" : "#999";
      ctx.beginPath();
      ctx.arc(ox, oy, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = respawnAlpha;
  }

  // ── Speed exhaust when accelerating fast ──
  if (car.speed > car.maxSpeed * 0.7 && !car.spinning && !car.respawn) {
    ctx.globalAlpha = 0.15 * respawnAlpha;
    ctx.fillStyle = "#aaa";
    for (let i = 0; i < 2; i++) {
      const ox = -18 - Math.random() * 8;
      const oy = (Math.random() - 0.5) * 6;
      ctx.beginPath();
      ctx.arc(ox, oy, 1.5 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = respawnAlpha;
  }

  // ── Respawn fly-off tumble: dust & debris ──
  if (respawnTumble) {
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 8; i++) {
      const ox = -10 + Math.random() * 20;
      const oy = -8 + Math.random() * 16;
      const size = 1 + Math.random() * 3;
      ctx.fillStyle = i % 3 === 0 ? "#c4a862" : "#d6c489";
      ctx.beginPath();
      ctx.arc(ox, oy, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Brake lights — two glowing red dots at the rear ──
  if (car.inputBrake && !car.spinning && !car.respawn) {
    ctx.save();
    ctx.globalAlpha = respawnAlpha;
    ctx.shadowColor = "#ff2a00";
    ctx.shadowBlur = 9;
    ctx.fillStyle = "#ff3a14";
    ctx.beginPath();
    ctx.arc(-14, -7, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-14, 7, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Inner bright core
    ctx.fillStyle = "#ffd0a0";
    ctx.beginPath();
    ctx.arc(-14, -7, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-14, 7, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Reviving flash: bright white wash over the whole car ──
  if (respawnFlash) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function addSkidMark(car: CarState, baseAlpha: number = 0.6): void {
  skidMarks.push({
    x: car.x,
    y: car.y,
    age: 0,
    alpha: baseAlpha,
  });
  // Cap total skid marks
  if (skidMarks.length > 300) {
    skidMarks.splice(0, 50);
  }
}

// Add two black scuff dots behind the car's rear wheels — visible as a
// short pair of streaks while braking under speed.
function addBrakeScuff(car: CarState): void {
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  // Rear-wheel offsets in local space (approx): x ≈ -13, y ≈ ±10
  for (const lateral of [-10, 10]) {
    const wx = car.x + cos * -13 - sin * lateral;
    const wy = car.y + sin * -13 + cos * lateral;
    skidMarks.push({ x: wx, y: wy, age: 0, alpha: 0.28 });
  }
  if (skidMarks.length > 300) {
    skidMarks.splice(0, 50);
  }
}

function drawSkidMarks(ctx: CanvasRenderingContext2D): void {
  for (let i = skidMarks.length - 1; i >= 0; i--) {
    const mark = skidMarks[i];
    mark.age++;
    const fade = Math.max(0, mark.alpha - mark.age * 0.002);
    if (fade <= 0) {
      skidMarks.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(mark.x, mark.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function renderCountdownLights(
  ctx: CanvasRenderingContext2D,
  lightsLit: number,
  lightsOut: boolean,
): void {
  const w = CANVAS_WIDTH;
  const lightSpacing = 52;
  const startX = w / 2 - (4 * lightSpacing) / 2;
  const y = 65;
  const r = 18;

  // Background bar with border
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  const barX = startX - 40;
  const barW = 5 * lightSpacing + 40;
  ctx.beginPath();
  ctx.roundRect(barX, y - 35, barW, 70, 8);
  ctx.fill();
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.stroke();

  for (let i = 0; i < 5; i++) {
    const x = startX + i * lightSpacing;

    // Light housing
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (lightsOut) {
      ctx.fillStyle = "#222";
    } else if (i < lightsLit) {
      ctx.fillStyle = "#e60012";
      ctx.shadowColor = "#e60012";
      ctx.shadowBlur = 25;
    } else {
      ctx.fillStyle = "#1a1a1a";
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner glow for lit lights
    if (!lightsOut && i < lightsLit) {
      ctx.fillStyle = "#ff3333";
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

export function renderText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string = "#ffffff",
): void {
  // Text shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.font = `bold ${size}px var(--font-digital), monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 2, y + 2);

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function clearSkidMarks(): void {
  skidMarks.length = 0;
  clearAmbientCritters();
}
