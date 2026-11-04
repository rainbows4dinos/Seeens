import { STATUSES, type ConnectionStatus } from "./labels";

// Directory filters live in the URL (?q=&status=&scene=&town=&archived=1), so
// a filtered view can be bookmarked or shared with a bandmate. The type tab
// (?type=) is separate: it's where you are, not a filter (see directory.ts).
export type DirectoryFilters = {
  q: string;
  /** Empty: everyone but Avoid. The status select sets one. */
  statuses: ConnectionStatus[];
  scene: string;
  town: string;
  archived: boolean;
};

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const all = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

// Old directory views (?view=) from before the tabs still land on the right list.
const VIEW_STATUS: Record<string, ConnectionStatus> = { lets_play: "lets_play", crushes: "prospect", prospects: "prospect" };

export function readFilters(params: Params): DirectoryFilters {
  const view = first(params.view);
  const statuses = all(params.status).filter((s): s is ConnectionStatus => STATUSES.includes(s as ConnectionStatus));
  return {
    q: first(params.q).slice(0, 200),
    statuses: statuses.length ? statuses : VIEW_STATUS[view] ? [VIEW_STATUS[view]] : [],
    scene: first(params.scene),
    town: first(params.town),
    archived: first(params.archived) === "1" || view === "archived",
  };
}

/** Filters that narrow the list: search, status, scene, town. Archived is a different half, not a narrowing. */
export function hasFilters(f: DirectoryFilters) {
  return Boolean(f.q || f.statuses.length || f.scene || f.town);
}
