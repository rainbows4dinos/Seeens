import type { ConnectionStatus } from "@/lib/connections/labels";

// Copier settings (#37), saved with each photo so it can be re-copied later.
// Shared by the browser copier and the server action that saves them.

export const PLATES = ["none", "cyan", "magenta", "yellow"] as const;
export type Plate = (typeof PLATES)[number];

export type CopierSettings = {
  /** The copier's lighter/darker dial: -0.5 (darker) to 0.5 (lighter). */
  exposure: number;
  /** 1 (soft) to 4 (crushed). */
  contrast: number;
  /** Toner speckle and blots, 0 to 1. */
  grit: number;
  plate: Plate;
  /** Plate misregistration in px, measured on a 600px-wide copy. */
  offset: number;
  /** Which grain: "New grain" picks another. */
  seed: number;
};

export const EXPOSURE = { min: -0.5, max: 0.5, step: 0.05 };
export const CONTRAST = { min: 1, max: 4, step: 0.1 };
export const GRIT = { min: 0, max: 1, step: 0.05 };
export const OFFSET = { min: 0, max: 12, step: 1 };
const DEFAULT_OFFSET = 4;

// The plate starts on the status color, like the tape. Clear tape, no plate.
const STATUS_PLATE: Record<ConnectionStatus, Plate> = {
  homies: "magenta",
  lets_play: "yellow",
  prospect: "cyan",
  neutral: "none",
  avoid: "none",
};

export function defaultSettings(status: ConnectionStatus | null, isUs: boolean): CopierSettings {
  // No status (#192) takes Heard of's plate.
  return {
    exposure: 0,
    contrast: 2.4,
    grit: 0.5,
    plate: isUs ? "none" : STATUS_PLATE[status ?? "neutral"],
    offset: DEFAULT_OFFSET,
    seed: 3,
  };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Settings from untrusted input (a form, the database), or null. */
export function readSettings(value: unknown): CopierSettings | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.contrast !== "number" || typeof v.grit !== "number" || typeof v.seed !== "number") return null;
  if (!Number.isFinite(v.contrast) || !Number.isFinite(v.grit) || !Number.isFinite(v.seed)) return null;
  if (!PLATES.includes(v.plate as Plate)) return null;
  // Photos saved before these sliders used no exposure and a fixed 4px offset.
  const exposure = typeof v.exposure === "number" && Number.isFinite(v.exposure) ? v.exposure : 0;
  const offset = typeof v.offset === "number" && Number.isFinite(v.offset) ? v.offset : DEFAULT_OFFSET;
  return {
    exposure: clamp(Math.round(exposure * 100) / 100, EXPOSURE.min, EXPOSURE.max),
    contrast: clamp(v.contrast, CONTRAST.min, CONTRAST.max),
    grit: clamp(v.grit, GRIT.min, GRIT.max),
    plate: v.plate as Plate,
    offset: clamp(Math.round(offset), OFFSET.min, OFFSET.max),
    seed: clamp(Math.round(v.seed), 0, 999),
  };
}
