// Lightweight WebAudio engine for DSR Grand Prix.
//
// Everything is synthesised — no audio files to ship. A persistent two-oscillator
// "engine" drone is pitched and swelled by the player's speed, with one-shot
// blips for the start-light sequence and a noise screech for spins. The whole
// module is a no-op until enabled (sound is opt-in), and degrades silently if
// the browser has no WebAudio.

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;

let engineOsc1: OscillatorNode | null = null;
let engineOsc2: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let engineFilter: BiquadFilterNode | null = null;
let engineStarted = false;

let enabled = false;

const ENGINE_IDLE_HZ = 46;
const ENGINE_TOP_HZ = 210;
const ENGINE_MAX_GAIN = 0.07;
const MASTER_GAIN = 0.6;

function ensureContext(): boolean {
  if (typeof window === "undefined") return false;
  if (ctx) return true;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    return true;
  } catch {
    ctx = null;
    return false;
  }
}

function startEngine(): void {
  if (engineStarted || !ctx || !master) return;
  try {
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 900;

    engineGain = ctx.createGain();
    engineGain.gain.value = 0;

    engineOsc1 = ctx.createOscillator();
    engineOsc1.type = "sawtooth";
    engineOsc1.frequency.value = ENGINE_IDLE_HZ;

    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = "square";
    engineOsc2.frequency.value = ENGINE_IDLE_HZ * 0.5;
    engineOsc2.detune.value = 8;

    engineOsc1.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);

    engineOsc1.start();
    engineOsc2.start();
    engineStarted = true;
  } catch {
    /* ignore — audio just won't play */
  }
}

/** Resume the context after a user gesture (browsers block autoplay otherwise). */
export function resumeAudio(): void {
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

/** Turn sound on/off. Enabling lazily builds the graph. */
export function setAudioEnabled(on: boolean): void {
  enabled = on;
  if (on) {
    if (!ensureContext()) return;
    startEngine();
    resumeAudio();
  } else if (engineGain && ctx) {
    // Silence immediately; keep nodes for cheap re-enable.
    engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
  }
}

export function isAudioEnabled(): boolean {
  return enabled;
}

/**
 * Per-frame engine update. speedRatio is 0..1 of top speed; active is false when
 * the kart can't accelerate (countdown, respawn, spin) so we drop to idle.
 */
export function updateEngine(speedRatio: number, active: boolean): void {
  if (!enabled || !ctx || !engineGain || !engineOsc1 || !engineOsc2) return;
  const t = ctx.currentTime;
  const r = Math.max(0, Math.min(1, speedRatio));
  const hz = ENGINE_IDLE_HZ + (ENGINE_TOP_HZ - ENGINE_IDLE_HZ) * r;
  // A touch of nonlinearity so low speeds still have audible "revs".
  engineOsc1.frequency.setTargetAtTime(hz, t, 0.04);
  engineOsc2.frequency.setTargetAtTime(hz * 0.5, t, 0.04);
  if (engineFilter) {
    engineFilter.frequency.setTargetAtTime(700 + r * 1800, t, 0.05);
  }
  const targetGain = active ? ENGINE_MAX_GAIN * (0.35 + 0.65 * r) : ENGINE_MAX_GAIN * 0.18;
  engineGain.gain.setTargetAtTime(targetGain, t, 0.05);
}

/** Silence the engine drone (e.g. when leaving the racing phase). */
export function idleEngine(): void {
  if (!enabled || !ctx || !engineGain) return;
  engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}

/** Short tone — used for the start-light beeps. */
export function blip(freq: number, durationMs = 120): void {
  if (!enabled || !ensureContext() || !ctx || !master) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + durationMs / 1000 + 0.02);
  } catch {
    /* ignore */
  }
}

/** Noise burst for tyre screech on spin-out / heavy drift. */
export function screech(durationMs = 300): void {
  if (!enabled || !ensureContext() || !ctx || !master) return;
  try {
    const t = ctx.currentTime;
    const frames = Math.floor((ctx.sampleRate * durationMs) / 1000);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durationMs / 1000);
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + durationMs / 1000 + 0.02);
  } catch {
    /* ignore */
  }
}
