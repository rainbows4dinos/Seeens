// Small, pure helpers for the directory card (Figma Connection Card).

// A stable number in [0, 1) from a record id, so a card's tilt is the same on
// every visit and every device.
function hash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seed(id: string) {
  return hash(id) / 2 ** 32;
}

// Photo tilt in degrees: between 0.4 and 1 either way (Figma: about 1°),
// never flat, so the print reads as stuck on by hand. The meta box below
// never tilts.
export function tiltFor(id: string) {
  const s = seed(id);
  const size = 0.4 + ((s * 2) % 1) * 0.6;
  return Math.round((s < 0.5 ? -size : size) * 10) / 10;
}

// Short, stable record ID for the card corner, e.g. "CN-3F2A". From a hash,
// not the id's first characters, so similar ids still look different.
export function recordId(id: string) {
  return `CN-${hash(id).toString(16).padStart(8, "0").slice(0, 4).toUpperCase()}`;
}

// Up to two initials for the placeholder print: "The Tin Hollows" -> "TH".
export function initials(name: string) {
  const words = name
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ") // "(sample)", "[ex]"
    .replace(/^\s*the\s+/i, "")
    .split(/[\s\-–—/&+]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const letters = (words.length > 1 ? [words[0], words[words.length - 1]] : words).map((w) => w[0]);
  return letters.join("").toUpperCase() || "?";
}

export type DirectoryLayout = "list" | "cards";
export const LAYOUT_COOKIE = "seeens-directory-layout";

export function readLayout(value: string | string[] | undefined | null): DirectoryLayout | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "cards" || v === "list" ? v : null;
}
