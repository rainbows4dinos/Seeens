// Arrange Home (#313): which rows Home shows, and in what order, for one
// person in one band. Getting Started and the band header stay on top and
// aren't arranged.

export const HOME_ROWS = [
  { key: "up_next", label: "Up Next" },
  { key: "roster", label: "Roster", labelOnly: true },
  { key: "homies", label: "Homies" },
  { key: "lets_play", label: "Let’s Play" },
  { key: "new_near_you", label: "New Near You" },
  { key: "might_know", label: "Bands You Might Know" },
  // Added with #313, so it goes last for anyone who already knows Home.
  { key: "prospect", label: "Want to Play" },
] as const;

export type HomeRowKey = (typeof HOME_ROWS)[number]["key"];
export type HomeLayout = { shown: HomeRowKey[]; hidden: HomeRowKey[] };

const KEYS = new Set<string>(HOME_ROWS.map((r) => r.key));
const isKey = (k: string): k is HomeRowKey => KEYS.has(k);

/** The rows this kind of workspace has, in the default order. */
export function rowsFor(kind: "band" | "label") {
  return HOME_ROWS.filter((r) => kind === "label" || !("labelOnly" in r && r.labelOnly));
}

/**
 * A saved layout, cleaned up: unknown keys dropped, duplicates dropped,
 * and rows added since it was saved shown at the end. Nothing saved: the
 * default.
 */
export function resolveLayout(saved: { shown: string[]; hidden: string[] } | null, kind: "band" | "label"): HomeLayout {
  const all = rowsFor(kind).map((r) => r.key as HomeRowKey);
  if (!saved) return { shown: all, hidden: [] };
  const allowed = new Set<string>(all);
  const seen = new Set<string>();
  const take = (keys: string[]) =>
    keys.filter((k): k is HomeRowKey => isKey(k) && allowed.has(k) && !seen.has(k) && Boolean(seen.add(k)));
  const shown = take(saved.shown);
  const hidden = take(saved.hidden);
  return { shown: [...shown, ...all.filter((k) => !seen.has(k))], hidden };
}

/** Is this the default, so it needn't be saved? */
export function isDefault(layout: HomeLayout, kind: "band" | "label") {
  const all = rowsFor(kind).map((r) => r.key);
  return !layout.hidden.length && layout.shown.join() === all.join();
}
