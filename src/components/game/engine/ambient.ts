// Ambient life — birds, dust puffs, occasional grass sparkles.
// Pure render-side flair to make the world feel alive while keeping the
// existing top-down POV. None of this affects physics.

import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./constants";

type Bird = {
  type: "bird";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  flapSpeed: number;
  shadowY: number;
};

type Dust = {
  type: "dust";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
};

type Butterfly = {
  type: "butterfly";
  x: number;
  y: number;
  age: number;
  life: number;
  cx: number; // anchor (it floats around this point)
  cy: number;
  hue: number;
};

type Critter = Bird | Dust | Butterfly;

const critters: Critter[] = [];
let lastBirdAt = 0;
let lastButterflyAt = 0;

export function clearAmbient(): void {
  critters.length = 0;
  lastBirdAt = 0;
  lastButterflyAt = 0;
}

export function updateAmbient(now: number, frame: number): void {
  // Update + cull
  for (let i = critters.length - 1; i >= 0; i--) {
    const c = critters[i];
    c.age++;
    if (c.type === "bird") {
      c.x += c.vx;
      c.y += c.vy;
      // Slight drift up & down so they don't fly straight lines
      c.y += Math.sin((c.age + i) * 0.04) * 0.25;
    } else if (c.type === "dust") {
      c.x += c.vx;
      c.y += c.vy;
      c.vx *= 0.97;
      c.vy *= 0.97;
    } else if (c.type === "butterfly") {
      // Stays near anchor — figure-8 wander
      const t = c.age * 0.05;
      c.x = c.cx + Math.cos(t) * 14;
      c.y = c.cy + Math.sin(t * 2) * 8;
    }
    if (c.age >= c.life) critters.splice(i, 1);
  }

  // Spawn birds in flocks frequently — every 2.5–5s — so the sky always has life.
  if (now - lastBirdAt > 2500 + Math.random() * 2500) {
    spawnBirdFlock();
    lastBirdAt = now;
  }

  // Spawn frequent dust puffs around the field for that "wind across the grass" feel.
  if (frame % 8 === 0 && Math.random() < 0.7) {
    spawnDust();
  }

  // Butterflies hang out near the track — keep up to 5 alive at once.
  if (now - lastButterflyAt > 1500 + Math.random() * 2000 && critters.filter(c => c.type === "butterfly").length < 5) {
    spawnButterfly();
    lastButterflyAt = now;
  }
}

function spawnBirdFlock(): void {
  // Birds fly diagonally across the canvas. Random direction L→R or R→L.
  const flockSize = 3 + Math.floor(Math.random() * 4);
  const dirRight = Math.random() > 0.5;
  const startX = dirRight ? -40 : CANVAS_WIDTH + 40;
  const startY = 50 + Math.random() * (CANVAS_HEIGHT * 0.45);
  const speed = 2.2 + Math.random() * 1.5;
  for (let i = 0; i < flockSize; i++) {
    critters.push({
      type: "bird",
      x: startX + (dirRight ? -1 : 1) * i * 22 + (Math.random() - 0.5) * 8,
      y: startY + (Math.random() - 0.5) * 18,
      vx: (dirRight ? 1 : -1) * speed,
      vy: -0.05 - Math.random() * 0.1,
      age: 0,
      life: 1200,
      size: 1.6 + Math.random() * 0.9,
      flapSpeed: 0.22 + Math.random() * 0.1,
      shadowY: 36 + Math.random() * 14,
    });
  }
}

function spawnDust(): void {
  const x = Math.random() * CANVAS_WIDTH;
  const y = Math.random() * CANVAS_HEIGHT;
  // Spawn anywhere; renderer will draw subtly so on-track puffs are inoffensive.
  critters.push({
    type: "dust",
    x,
    y,
    vx: (Math.random() - 0.5) * 0.6,
    vy: -0.2 - Math.random() * 0.4,
    age: 0,
    life: 60 + Math.floor(Math.random() * 40),
    size: 1.5 + Math.random() * 2,
  });
}

function spawnButterfly(): void {
  // Anchor on grass — pick a random spot away from the very centre.
  const cx = 60 + Math.random() * (CANVAS_WIDTH - 120);
  const cy = 60 + Math.random() * (CANVAS_HEIGHT - 120);
  critters.push({
    type: "butterfly",
    x: cx,
    y: cy,
    age: 0,
    life: 360 + Math.floor(Math.random() * 240),
    cx,
    cy,
    hue: Math.floor(Math.random() * 360),
  });
}

// Drawn UNDER cars but OVER track. Anything that should appear at ground level.
export function drawAmbientGround(ctx: CanvasRenderingContext2D): void {
  for (const c of critters) {
    if (c.type === "dust") drawDust(ctx, c);
    if (c.type === "butterfly") drawButterfly(ctx, c);
  }
}

// Drawn OVER everything — birds in the air.
export function drawAmbientAir(ctx: CanvasRenderingContext2D): void {
  for (const c of critters) {
    if (c.type === "bird") drawBird(ctx, c);
  }
}

function drawBird(ctx: CanvasRenderingContext2D, b: Bird): void {
  // Fade in & out at the edges of life.
  const fadeIn = Math.min(1, b.age / 30);
  const fadeOut = Math.min(1, (b.life - b.age) / 30);
  const alpha = Math.min(fadeIn, fadeOut);

  // Soft ground shadow drifting beneath bird.
  ctx.save();
  ctx.globalAlpha = 0.22 * alpha;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + b.shadowY, 5 * b.size, 1.8 * b.size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Body — bold "M" silhouette with flapping wings.
  ctx.save();
  ctx.translate(b.x, b.y);
  const flap = Math.sin(b.age * b.flapSpeed);
  const wingY = -1.8 - flap * 2.4;
  const s = b.size;
  ctx.globalAlpha = 0.95 * alpha;
  ctx.strokeStyle = "#101010";
  ctx.lineWidth = 2.2 * s;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-6 * s, 0);
  ctx.quadraticCurveTo(-2.5 * s, wingY * s, 0, 0);
  ctx.quadraticCurveTo(2.5 * s, wingY * s, 6 * s, 0);
  ctx.stroke();
  // Body dot for definition
  ctx.fillStyle = "#101010";
  ctx.beginPath();
  ctx.arc(0, 0, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDust(ctx: CanvasRenderingContext2D, d: Dust): void {
  const lifeFrac = d.age / d.life;
  const alpha = (1 - lifeFrac) * 0.35;
  if (alpha <= 0.02) return;
  const r = d.size * (1 + lifeFrac * 1.2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#d6c489"; // sandy puff
  ctx.beginPath();
  ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f1e3b2";
  ctx.globalAlpha = alpha * 0.65;
  ctx.beginPath();
  ctx.arc(d.x - r * 0.3, d.y - r * 0.3, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawButterfly(ctx: CanvasRenderingContext2D, bf: Butterfly): void {
  const fadeIn = Math.min(1, bf.age / 24);
  const fadeOut = Math.min(1, (bf.life - bf.age) / 24);
  const alpha = Math.min(fadeIn, fadeOut);
  const flap = Math.sin(bf.age * 0.3);
  const wingW = 5 + flap * 1.8;
  const wingH = 4.5 - flap * 0.9;
  ctx.save();
  ctx.globalAlpha = 0.92 * alpha;
  ctx.translate(bf.x, bf.y);
  // Two wings
  ctx.fillStyle = `hsl(${bf.hue}, 80%, 62%)`;
  ctx.beginPath();
  ctx.ellipse(-3.5, 0, wingW, wingH, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3.5, 0, wingW, wingH, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Wing accent dots — secondary hue contrast
  ctx.fillStyle = `hsl(${(bf.hue + 180) % 360}, 75%, 38%)`;
  ctx.beginPath();
  ctx.arc(-3.8, 0.6, 1.2, 0, Math.PI * 2);
  ctx.arc(3.8, 0.6, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = "#222";
  ctx.fillRect(-0.8, -3, 1.6, 6);
  ctx.restore();
}
