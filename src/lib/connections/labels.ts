import type { Database } from "@/lib/supabase/database.types";
import { formatShortPlace } from "@/lib/places";
import { DEFAULT_TIME_ZONE, safeTimeZone } from "@/lib/outreach/labels";
import { STATUS_LABELS } from "./status-words";

type Enums = Database["public"]["Enums"];
export type ConnectionKind = Enums["connection_kind"];
export type PersonRole = Enums["person_role"];
export type GroupType = Enums["group_type"];
export type ConnectionStatus = Enums["connection_status"];

export const KIND_LABELS: Record<ConnectionKind, string> = {
  group: "Band, venue, or org",
  person: "Person",
};

export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  musician: "Musician",
  dj: "DJ",
  promoter: "Promoter",
  booker: "Booker",
  manager: "Manager",
  label_owner: "Label owner",
  producer: "Producer",
  recording_engineer: "Recording engineer",
  live_sound_engineer: "Live sound engineer",
  photographer: "Photographer",
  videographer: "Videographer",
  artist_designer: "Artist/Designer",
  writer: "Writer",
  radio_host: "Radio host",
  other: "Other",
};

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  band: "Band",
  venue: "Venue",
  label: "Label",
  recording_studio: "Recording studio",
  production_studio: "Production studio",
  radio_station: "Radio station",
  press: "Press (zine, blog, mag)",
  promoter_collective: "Promoter or collective",
  other: "Other",
};

// Status words by type (#139) live in status-words.ts (no imports, so tests run it).
export {
  STATUS_WORDS,
  STATUS_HINT_WORDS,
  STATUS_LABELS,
  STATUS_HINTS,
  wordSetFor,
  statusLabel,
  statusHint,
  NO_STATUS,
  NO_STATUS_HINT,
  historyLine,
  playedWords,
  type WordSet,
} from "./status-words";
export const KINDS = Object.keys(KIND_LABELS) as ConnectionKind[];
export const PERSON_ROLES = Object.keys(PERSON_ROLE_LABELS) as PersonRole[];
export const GROUP_TYPES = Object.keys(GROUP_TYPE_LABELS) as GroupType[];
export const STATUSES = Object.keys(STATUS_LABELS) as ConnectionStatus[];

// "Band" for a group; "Musician, DJ" for a person.
export function formatType(c: { kind: ConnectionKind; person_roles: PersonRole[]; group_type: GroupType | null }) {
  if (c.kind === "group") return c.group_type ? GROUP_TYPE_LABELS[c.group_type] : "Group";
  return c.person_roles.map((r) => PERSON_ROLE_LABELS[r]).join(", ") || "Person";
}

export function formatLocality(
  locality: {
    name: string;
    region: string | null;
    region_code?: string | null;
    country: string | null;
    country_code?: string | null;
  } | null,
) {
  return locality ? formatShortPlace(locality) : null;
}

// A timestamp as a date in the band's time zone: "Nov 2, 2026".
export function formatDate(iso: string, timeZone = DEFAULT_TIME_ZONE) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: safeTimeZone(timeZone),
  });
}
