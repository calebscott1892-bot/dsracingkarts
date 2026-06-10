// Local best-lap persistence (localStorage). Records are kept per track and per
// difficulty so "The Oval on Extreme" has its own record separate from Easy.
// Multiplayer races share a single "mp" bucket.

import type { AIDifficulty } from "./state";

export type RecordKey = AIDifficulty | "mp";

function storageKey(trackIndex: number, key: RecordKey): string {
  return `dsr_gp_best_${trackIndex}_${key}`;
}

/** Best lap in ms for a track+difficulty, or null if none / unavailable. */
export function getBestLap(trackIndex: number, key: RecordKey): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(trackIndex, key));
    if (!raw) return null;
    const ms = Number(raw);
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  } catch {
    return null;
  }
}

/**
 * Persist a lap time if it beats (or sets) the record.
 * Returns true when a new record was stored.
 */
export function saveBestLap(trackIndex: number, key: RecordKey, ms: number): boolean {
  if (typeof window === "undefined") return false;
  if (!Number.isFinite(ms) || ms <= 0) return false;
  try {
    const prev = getBestLap(trackIndex, key);
    if (prev !== null && prev <= ms) return false;
    window.localStorage.setItem(storageKey(trackIndex, key), String(Math.round(ms)));
    return true;
  } catch {
    return false;
  }
}
