import {
  GROUP_TYPES,
  GROUP_TYPE_LABELS,
  PERSON_ROLES,
  PERSON_ROLE_LABELS,
  STATUSES,
  type ConnectionStatus,
} from "./labels";

// Directory filters live in the URL (?q=&status=&type=&scene=&town=), so a
// filtered view can be bookmarked or shared with a bandmate.
export type DirectoryFilters = {
  q: string;
  statuses: ConnectionStatus[];
  type: string; // "group:band" or "person:dj"
  scene: string;
  town: string;
};

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const all = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export function readFilters(params: Params): DirectoryFilters {
  return {
    q: first(params.q).slice(0, 200),
    statuses: all(params.status).filter((s): s is ConnectionStatus => STATUSES.includes(s as ConnectionStatus)),
    type: TYPE_OPTIONS.some((o) => o.value === first(params.type)) ? first(params.type) : "",
    scene: first(params.scene),
    town: first(params.town),
  };
}

export function hasFilters(f: DirectoryFilters) {
  return Boolean(f.q || f.statuses.length || f.type || f.scene || f.town);
}

export const TYPE_OPTIONS: { value: string; label: string; group: "Groups" | "People" }[] = [
  ...GROUP_TYPES.map((g) => ({ value: `group:${g}`, label: GROUP_TYPE_LABELS[g], group: "Groups" as const })),
  ...PERSON_ROLES.map((r) => ({ value: `person:${r}`, label: PERSON_ROLE_LABELS[r], group: "People" as const })),
];
