import { STATUSES, type ConnectionStatus } from "./labels";
import { INSTRUMENTS, type Instrument } from "@/lib/affiliations/instruments";
import {
  AGES,
  CAPACITY,
  SPACE,
  VENUE_TYPES,
  type Ages,
  type Capacity,
  type Space,
  type VenueType,
} from "./venue-details";

// Directory filters live in the URL (?q=&status=&scene=&town=&plays=&ages=&cap=&space=&archived=1), so
// a filtered view can be bookmarked or shared with a bandmate. The type tab
// (?type=) is separate: it's where you are, not a filter (see directory.ts).
export type DirectoryFilters = {
  q: string;
  /** Empty: everyone, Avoid last (#273). The status select sets one. */
  statuses: ConnectionStatus[];
  scene: string;
  town: string;
  /** Plays (#140): people with this instrument in a band role. */
  instrument: Instrument | "";
  /** Venue details (#48), on the Venues tab. */
  ages: Ages | "";
  capacity: Capacity | "";
  /** Space (#262): DIY or licensed, or one venue type. */
  space: Space | VenueType | "";
  archived: boolean;
  /** Only records with no status (#192): ?status=none. */
  noStatus: boolean;
  /**
   * Everyone; or, in the archived view, only this band's own (what it added
   * or touched). The Directory shows everyone (#273).
   */
  scope: "network" | "all";
};

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const all = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

// Old directory views (?view=) from before the tabs still land on the right list.
const VIEW_STATUS: Record<string, ConnectionStatus> = {
  lets_play: "lets_play",
  crushes: "prospect",
  prospects: "prospect",
};

export function readFilters(params: Params): DirectoryFilters {
  const view = first(params.view);
  const statuses = all(params.status).filter((s): s is ConnectionStatus => STATUSES.includes(s as ConnectionStatus));
  return {
    q: first(params.q).slice(0, 200),
    statuses: statuses.length ? statuses : VIEW_STATUS[view] ? [VIEW_STATUS[view]] : [],
    scene: first(params.scene),
    town: first(params.town),
    instrument: first(params.plays) in INSTRUMENTS ? (first(params.plays) as Instrument) : "",
    ages: first(params.ages) in AGES ? (first(params.ages) as Ages) : "",
    capacity: first(params.cap) in CAPACITY ? (first(params.cap) as Capacity) : "",
    space:
      first(params.space) in SPACE || first(params.space) in VENUE_TYPES
        ? (first(params.space) as Space | VenueType)
        : "",
    archived: first(params.archived) === "1" || view === "archived",
    noStatus: all(params.status).includes("none"),
    scope: "all",
  };
}

/** Filters that narrow the list: search, status, scene, town. Archived is a different half, not a narrowing. */
export function hasFilters(f: DirectoryFilters) {
  return Boolean(
    f.q || f.statuses.length || f.noStatus || f.scene || f.town || f.instrument || f.ages || f.capacity || f.space,
  );
}
