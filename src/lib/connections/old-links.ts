// Old Network links (#273). Network used to be / and read its filters from
// the URL (#192); those links now open the Directory with the same filters.
// Pure, so it's testable.

type Params = Record<string, string | string[] | undefined>;

// What the old Network page (/) read from its URL (#192).
export const DIRECTORY_PARAMS = [
  "type",
  "q",
  "status",
  "scene",
  "town",
  "plays",
  "ages",
  "cap",
  "space",
  "archived",
  "layout",
  "after",
  "view",
  "scope",
];

/** An old Network link, as the Directory with its filters. */
export function oldNetworkLink(params: Params) {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || key === "scope" || key === "preview") continue;
    (Array.isArray(value) ? value : [value]).forEach((v) => p.append(key, v));
  }
  const qs = p.toString();
  return qs ? `/directory?${qs}` : "/directory";
}
