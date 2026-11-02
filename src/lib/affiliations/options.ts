import type { Database } from "@/lib/supabase/database.types";
import type { ConnectionKind, GroupType, PersonRole } from "@/lib/connections/labels";

export type AffiliationKind = Database["public"]["Enums"]["affiliation_kind"];

type Subject = { kind: ConnectionKind; group_type: GroupType | null };
type Candidate = { kind: ConnectionKind; group_type: GroupType | null };

// What kind of connection can sit on the other end of a link.
export type Target =
  | { kind: "person" }
  | { kind: "group"; only?: GroupType[]; except?: GroupType[] };

// One "add a link" choice offered on a detail page. Direction is from the
// page's point of view: "out" means this connection -> other.
export type AddOption = {
  id: string;
  label: string;
  kind: AffiliationKind;
  direction: "out" | "in";
  target: Target;
  rolePlaceholder: string;
  newPersonRoles?: PersonRole[];
};

const NON_BAND: GroupType[] = [
  "venue",
  "label",
  "recording_studio",
  "production_studio",
  "radio_station",
  "press",
  "promoter_collective",
  "other",
];

export function addOptionsFor(subject: Subject): AddOption[] {
  if (subject.kind === "person") {
    return [
      {
        id: "plays_in",
        label: "Plays in a Band",
        kind: "member",
        direction: "out",
        target: { kind: "group", only: ["band"] },
        rolePlaceholder: "vocals, guitar",
      },
      {
        id: "works_with",
        label: "Works With a Venue, Label, Studio…",
        kind: "works_with",
        direction: "out",
        target: { kind: "group", except: ["band"] },
        rolePlaceholder: "books shows, runs it, engineer",
      },
    ];
  }

  if (subject.group_type === "band") {
    return [
      {
        id: "member",
        label: "Add Member",
        kind: "member",
        direction: "in",
        target: { kind: "person" },
        rolePlaceholder: "vocals, guitar",
        newPersonRoles: ["musician"],
      },
      {
        id: "label",
        label: "Add Label",
        kind: "on_label",
        direction: "out",
        target: { kind: "group", only: ["label"] },
        rolePlaceholder: "optional",
      },
      {
        id: "related",
        label: "Related Band",
        kind: "related",
        direction: "out",
        target: { kind: "group", only: ["band"] },
        rolePlaceholder: "side project, split 7-inch",
      },
    ];
  }

  if (subject.group_type === "label") {
    return [
      {
        id: "band_on_label",
        label: "Add Band on This Label",
        kind: "on_label",
        direction: "in",
        target: { kind: "group", only: ["band"] },
        rolePlaceholder: "optional",
      },
      {
        id: "person",
        label: "Add Person",
        kind: "works_with",
        direction: "in",
        target: { kind: "person" },
        rolePlaceholder: "owner, runs it",
        newPersonRoles: ["label_owner"],
      },
    ];
  }

  return [
    {
      id: "person",
      label: "Add Person",
      kind: "works_with",
      direction: "in",
      target: { kind: "person" },
      rolePlaceholder: "books shows, engineer, host",
      newPersonRoles: ["other"],
    },
    {
      id: "related",
      label: "Related Place or Org",
      kind: "related",
      direction: "out",
      target: { kind: "group", except: ["band"] },
      rolePlaceholder: "same owners, sister venue",
    },
  ];
}

export function fitsTarget(target: Target, c: Candidate) {
  if (target.kind === "person") return c.kind === "person";
  if (c.kind !== "group" || !c.group_type) return false;
  if (target.only) return target.only.includes(c.group_type);
  if (target.except) return !target.except.includes(c.group_type);
  return true;
}

// Group types a brand-new connection could have for this target.
export function newGroupTypes(target: Target): GroupType[] {
  if (target.kind !== "group") return [];
  if (target.only) return target.only;
  return NON_BAND.filter((t) => !target.except?.includes(t));
}

// How a link reads from this page: which section it lands in.
export function sectionFor(
  subject: Subject,
  link: { kind: AffiliationKind; direction: "out" | "in" },
): string {
  const { kind, direction } = link;
  if (subject.kind === "person") {
    if (direction === "out" && kind === "member") return "Bands";
    if (direction === "out" && kind === "works_with") return "Works With";
    return "Other Links";
  }
  if (kind === "related") return subject.group_type === "band" ? "Related Bands" : "Related";
  if (direction === "in" && kind === "member") return "Members";
  if (direction === "in" && kind === "on_label") return "Bands on This Label";
  if (direction === "out" && kind === "on_label") return "Labels";
  if (direction === "in" && kind === "works_with") return "People";
  return "Other Links";
}

export const SECTION_ORDER = [
  "Members",
  "Bands",
  "Labels",
  "Bands on This Label",
  "People",
  "Works With",
  "Related Bands",
  "Related",
  "Other Links",
];
