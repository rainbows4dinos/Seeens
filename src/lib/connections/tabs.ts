import type { ConnectionKind, GroupType } from "./labels";

// Tabs and per-tab details for the directory (#122). No server imports, so
// the results (a client component) can use them too.

// The directory by type (#122): one tab per kind of connection, Bands first.
// "Labels & more" is every group that isn't a band or a venue.
export type Tab = "bands" | "people" | "venues" | "more" | "all";
export const TABS: { id: Tab; label: string; one: string; many: string; add: string; addType: string | null }[] = [
  { id: "bands", label: "Bands", one: "band", many: "bands", add: "Add Band", addType: "band" },
  { id: "people", label: "People", one: "person", many: "people", add: "Add Person", addType: "person" },
  { id: "venues", label: "Venues", one: "venue", many: "venues", add: "Add Venue", addType: "venue" },
  { id: "more", label: "Labels & more", one: "connection", many: "connections", add: "Add Label", addType: "label" },
  { id: "all", label: "All", one: "connection", many: "connections", add: "Add Connection", addType: null },
];
export const DEFAULT_TAB: Tab = "bands";

/** The tab a connection is listed under. */
export function tabFor(kind: ConnectionKind, groupType: GroupType | null): Tab {
  if (kind === "person") return "people";
  if (groupType === "band") return "bands";
  if (groupType === "venue") return "venues";
  return "more";
}

/** Back to the directory, on a connection's own tab (and the archived half if it's archived). */
export function directoryHrefFor(kind: ConnectionKind, groupType: GroupType | null, archived: boolean) {
  const p = new URLSearchParams();
  const tab = tabFor(kind, groupType);
  if (tab !== DEFAULT_TAB) p.set("type", tab);
  if (archived) p.set("archived", "1");
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

export function readTab(v: string | string[] | undefined): Tab {
  const raw = (Array.isArray(v) ? v[0] : v) ?? "";
  if (TABS.some((t) => t.id === raw)) return raw as Tab;
  // The old Type filter (?type=group:band, person:dj) lands on its tab.
  if (raw.startsWith("person:")) return "people";
  if (raw === "group:band") return "bands";
  if (raw === "group:venue") return "venues";
  if (raw.startsWith("group:")) return "more";
  return DEFAULT_TAB;
}

/** The extra line a row or card shows on each tab (#122): who's in a band, which bands a person plays in, a label's note. Venue capacity and ages wait for #48. */
export function detailFor(item: { members: string[]; plays_in: string[]; note: string | null }, tab: Tab): string | null {
  if (tab === "bands") return item.members.length ? `Members: ${item.members.join(", ")}` : null;
  if (tab === "people") return item.plays_in.length ? `Plays in ${item.plays_in.join(", ")}` : null;
  if (tab === "more") return item.note;
  return null;
}
