import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
type ConnectionKind = Enums["connection_kind"];
type PersonRole = Enums["person_role"];
type GroupType = Enums["group_type"];
type ConnectionStatus = Enums["connection_status"];

// Status words by type (#139). The five stored statuses never change; each
// kind of connection gets its own words for them, and its own way of saying
// "played together". Words say how we feel, never what happened (that's the
// played fact), so the two can't contradict each other.
export type WordSet = "band" | "venue" | "people" | "collab";

// Order matters: this is also the directory's grouping order.
export const STATUS_WORDS: Record<WordSet, Record<ConnectionStatus, string>> = {
  band: { homies: "Homies", lets_play: "Let's play", prospect: "Eyeing", neutral: "Known", avoid: "Avoid" },
  venue: { homies: "Favorite", lets_play: "Let's book", prospect: "Eyeing", neutral: "Known", avoid: "Avoid" },
  people: { homies: "Homie", lets_play: "Let's collab", prospect: "Eyeing", neutral: "Known", avoid: "Avoid" },
  collab: { homies: "Homies", lets_play: "Let's collab", prospect: "Eyeing", neutral: "Known", avoid: "Avoid" },
};

export const STATUS_HINT_WORDS: Record<WordSet, Record<ConnectionStatus, string>> = {
  band: {
    homies: "Love playing together, love hanging out, top tour-mate pick.",
    lets_play: "We both want to play together. Just haven't booked it.",
    prospect: "We'd like to. Not mutual yet.",
    neutral: "We know of them. No plans.",
    avoid: "Nope.",
  },
  venue: {
    homies: "One of our favorites.",
    lets_play: "We want a date and they're into it.",
    prospect: "We'd like a show with them. Not there yet.",
    neutral: "We know of them. No plans.",
    avoid: "Not for us.",
  },
  people: {
    homies: "A friend. We look out for each other.",
    lets_play: "We both want to make something together.",
    prospect: "We'd like to meet or work with them.",
    neutral: "We know of them. No plans.",
    avoid: "Nope.",
  },
  collab: {
    homies: "We look out for each other.",
    lets_play: "We both want to work together.",
    prospect: "We'd like to work with them. Not mutual yet.",
    neutral: "We know of them. No plans.",
    avoid: "Nope.",
  },
};

/** The band words: menus on the All tab, history, and anywhere without a type. */
export const STATUS_LABELS = STATUS_WORDS.band;
export const STATUS_HINTS = STATUS_HINT_WORDS.band;

type Typed = { kind: ConnectionKind; group_type: GroupType | null; person_roles?: PersonRole[] | null };

/** Which words a connection uses: venues and promoters book, people and orgs collab. */
export function wordSetFor(c: Typed): WordSet {
  if (c.kind === "person") return "people";
  if (c.group_type === "band") return "band";
  if (c.group_type === "venue" || c.group_type === "promoter_collective") return "venue";
  return "collab";
}

export function statusLabel(status: ConnectionStatus, c?: Typed | null) {
  return STATUS_WORDS[c ? wordSetFor(c) : "band"][status];
}

export function statusHint(status: ConnectionStatus, c?: Typed | null) {
  return STATUS_HINT_WORDS[c ? wordSetFor(c) : "band"][status];
}

// "Played together", by what it means for each type: the checkbox label and
// the short tag. People go by their first matching role, in this order.
type Played = { label: string; tag: string };
const PLAYED = {
  played: { label: "We've played together", tag: "Played together" },
  here: { label: "We've played here", tag: "Played here" },
  booked: { label: "They've booked us", tag: "Booked us" },
  recorded: { label: "We've recorded here", tag: "Recorded here" },
  on: { label: "We've been on", tag: "Been on" },
  covered: { label: "They've covered us", tag: "Covered us" },
  worked: { label: "We've worked together", tag: "Worked together" },
} satisfies Record<string, Played>;

const PLAYED_BY_ROLE: [PersonRole[], Played][] = [
  [["musician", "dj"], PLAYED.played],
  [["promoter", "booker"], PLAYED.booked],
  [["radio_host"], PLAYED.on],
  [["writer"], PLAYED.covered],
];

const PLAYED_BY_GROUP: Partial<Record<GroupType, Played>> = {
  band: PLAYED.played,
  venue: PLAYED.here,
  promoter_collective: PLAYED.booked,
  recording_studio: PLAYED.recorded,
  production_studio: PLAYED.recorded,
  radio_station: PLAYED.on,
  press: PLAYED.covered,
};

export function playedWords(c?: Typed | null): Played {
  if (!c) return PLAYED.played;
  if (c.kind === "person") {
    const roles = c.person_roles ?? [];
    return PLAYED_BY_ROLE.find(([rs]) => rs.some((r) => roles.includes(r)))?.[1] ?? PLAYED.worked;
  }
  return (c.group_type && PLAYED_BY_GROUP[c.group_type]) || PLAYED.worked;
}
