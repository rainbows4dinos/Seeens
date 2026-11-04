import type { ConnectionStatus } from "@/lib/connections/labels";

// Copier settings (#37), saved with each photo so it can be re-copied later.
// Shared by the browser copier and the server action that saves them.

export const PLATES = ["none", "cyan", "magenta", "yellow"] as const;
export type Plate = (typeof PLATES)[number];

export type CopierSettings = {
  /** 1 (soft) to 4 (crushed). */
  contrast: number;
  /** Toner speckle and blots, 0 to 1. */
  grit: number;
  plate: Plate;
  /** Which grain: "New grain" picks another. */
  seed: number;
};

export const CONTRAST = { min: 1, max: 4, step: 0.1 };
export const GRIT = { min: 0, max: 1, step: 0.05 };

// The plate starts on the status color, like the tape. Clear tape, no plate.
const STATUS_PLATE: Record<ConnectionStatus, Plate> = {
  homies: "magenta",
  lets_play: "yellow",
  prospect: "cyan",
  neutral: "none",
  avoid: "none",
};

export function defaultSettings(status: ConnectionStatus, isUs: boolean): CopierSettings {
  return { contrast: 2.4, grit: 0.5, plate: isUs ? "none" : STATUS_PLATE[status], seed: 3 };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Settings from untrusted input (a form, the database), or null. */
export function readSettings(value: unknown): CopierSettings | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.contrast !== "number" || typeof v.grit !== "number" || typeof v.seed !== "number") return null;
  if (!Number.isFinite(v.contrast) || !Number.isFinite(v.grit) || !Number.isFinite(v.seed)) return null;
  if (!PLATES.includes(v.plate as Plate)) return null;
  return {
    contrast: clamp(v.contrast, CONTRAST.min, CONTRAST.max),
    grit: clamp(v.grit, GRIT.min, GRIT.max),
    plate: v.plate as Plate,
    seed: clamp(Math.round(v.seed), 0, 999),
  };
}
