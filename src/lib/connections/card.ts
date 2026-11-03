// Small, pure helpers for the directory card (Figma Connection Card).
import type { ConnectionKind, GroupType, PersonRole } from "./labels";

// A stable hash of a record id. seed() maps it to [0, 1), for anything that
// should vary per record but look the same on every visit (tape, #63).
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

// Catalog number (#106): a stored number, counted per workspace in the order
// connections were added, with a prefix from the current type, or a person's
// first role. "BND-0042", "MUS-0012". Changing the type changes the prefix,
// never the number.
const GROUP_PREFIX: Record<GroupType, string> = {
  band: "BND",
  venue: "VEN",
  label: "LBL",
  recording_studio: "STU",
  production_studio: "STU",
  radio_station: "RAD",
  press: "PRS",
  promoter_collective: "PRO",
  other: "ORG",
};

const ROLE_PREFIX: Record<PersonRole, string> = {
  musician: "MUS",
  dj: "DJ",
  promoter: "PMT",
  booker: "BKR",
  manager: "MGR",
  label_owner: "LBO",
  producer: "PDR",
  recording_engineer: "REC",
  live_sound_engineer: "SND",
  photographer: "PHO",
  videographer: "VID",
  artist_designer: "ART",
  writer: "WRT",
  radio_host: "HST",
  other: "PPL",
};

export function catalogPrefix(c: { kind: ConnectionKind; group_type: GroupType | null; person_roles: PersonRole[] }) {
  if (c.kind === "group") return c.group_type ? GROUP_PREFIX[c.group_type] : "ORG";
  return c.person_roles[0] ? ROLE_PREFIX[c.person_roles[0]] : "PPL";
}

export function catalogNo(c: {
  kind: ConnectionKind;
  group_type: GroupType | null;
  person_roles: PersonRole[];
  catalog_no: number;
}) {
  return `${catalogPrefix(c)}-${String(c.catalog_no).padStart(4, "0")}`;
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
