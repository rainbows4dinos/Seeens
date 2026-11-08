import {
  GROUP_TYPES,
  KINDS,
  PERSON_ROLES,
  STATUSES,
  type ConnectionKind,
  type ConnectionStatus,
  type GroupType,
  type PersonRole,
} from "./labels";
import { joinLinkLabel } from "./link-types";
import { VENUE_KEYS, venueDetailsFromForm, type VenueDetails } from "./venue-details";

export type VenueKey = (typeof VENUE_KEYS)[number];
const EMPTY_VENUE = Object.fromEntries(VENUE_KEYS.map((k) => [k, ""])) as Record<VenueKey, string>;

// Raw form values, kept as strings so a failed save can repopulate the form.
export type ConnectionFormValues = {
  name: string;
  kind: string;
  personRoles: string[];
  groupType: string;
  status: string;
  playedTogether: boolean;
  isUs: boolean;
  canHelpWith: string;
  placeId: string;
  placeText: string;
  keepLocalityId: string;
  sceneIds: string[];
  newScenes: string;
  email: string;
  phone: string;
  notes: string;
  links: { label: string; url: string }[];
  /** Venue details (#48), as form strings; ignored for other types. */
  venue: Record<VenueKey, string>;
  // Edit only: the connection's updated_at when the form was opened, so a
  // save can tell if a bandmate saved in the meantime.
  updatedAt: string;
};

export type ConnectionFormErrors = Partial<Record<Exclude<keyof ConnectionFormValues, "venue"> | "form", string>> & {
  linkUrls?: Record<number, string>;
  venue?: Partial<Record<VenueKey, string>>;
};

export type ConnectionFormState = {
  values: ConnectionFormValues;
  errors: ConnectionFormErrors;
  // Changes on every failed save so the form remounts with submitted values.
  attempt?: number;
  // Set when a bandmate saved this connection while the form was open.
  conflict?: boolean;
  // Add with a photo or links waiting: the new connection, for the form to finish.
  createdId?: string;
};

export type ValidConnection = {
  name: string;
  kind: ConnectionKind;
  person_roles: PersonRole[];
  group_type: GroupType | null;
  /** Null: no status (#192). */
  status: ConnectionStatus | null;
  played_together: boolean;
  is_us: boolean;
  can_help_with: string[];
  locality: { placeId: number } | { keepLocalityId: string } | null;
  scene_ids: string[];
  new_scenes: string[];
  email: string | null;
  phone: string | null;
  notes: string | null;
  links: { label: string | null; url: string }[];
  /** Venue details for a venue; null for anything else, which leaves stored details alone. */
  venue: VenueDetails | null;
};

export const EMPTY_FORM: ConnectionFormValues = {
  name: "",
  kind: "group",
  personRoles: [],
  groupType: "",
  status: "neutral",
  playedTogether: false,
  isUs: false,
  canHelpWith: "",
  placeId: "",
  placeText: "",
  keepLocalityId: "",
  sceneIds: [],
  newScenes: "",
  email: "",
  phone: "",
  notes: "",
  links: [{ label: "", url: "" }],
  venue: EMPTY_VENUE,
  updatedAt: "",
};

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optional = (v: string) => (v === "" ? null : v);

export function readForm(fd: FormData): ConnectionFormValues {
  const types = fd.getAll("link_type").map(String);
  const customs = fd.getAll("link_label").map((v) => String(v).trim());
  const labels = types.map((t, i) => joinLinkLabel(t, customs[i] ?? ""));
  const urls = fd.getAll("link_url").map((v) => String(v).trim());
  return {
    name: str(fd, "name"),
    kind: str(fd, "kind"),
    personRoles: fd.getAll("person_roles").map(String),
    groupType: str(fd, "group_type"),
    status: str(fd, "status"),
    playedTogether: fd.get("played_together") === "on",
    isUs: fd.get("is_us") === "on",
    canHelpWith: str(fd, "can_help_with"),
    placeId: str(fd, "place_id"),
    placeText: str(fd, "place_text"),
    keepLocalityId: str(fd, "keep_locality_id"),
    sceneIds: fd.getAll("scene_ids").map(String),
    newScenes: str(fd, "new_scenes"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    notes: str(fd, "notes"),
    links: urls.map((url, i) => ({ label: labels[i] ?? "", url })),
    venue: Object.fromEntries(VENUE_KEYS.map((k) => [k, str(fd, `venue_${k}`)])) as Record<VenueKey, string>,
    updatedAt: str(fd, "updated_at"),
  };
}

// Accepts "bandcamp.com/x" as well as full URLs; only http(s) is allowed.
export function normalizeUrl(raw: string): string | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Portland DIY, Pacific Northwest" -> two names, duplicates dropped.
export function splitList(raw: string) {
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The zoned profile page (#126) saves a field (or a few that belong
// together) at a time. Each group names the form values it owns and the
// form fields that post them.
export const AUTOSAVE_GROUPS = {
  name: { values: ["name"], fields: ["name"] },
  type: { values: ["kind", "personRoles", "groupType"], fields: ["kind", "group_type", "person_roles"] },
  isUs: { values: ["isUs"], fields: ["is_us"] },
  place: { values: ["placeId", "placeText", "keepLocalityId"], fields: ["place_id", "place_text", "keep_locality_id"] },
  scenes: { values: ["sceneIds", "newScenes"], fields: ["scene_ids", "new_scenes"] },
  email: { values: ["email"], fields: ["email"] },
  phone: { values: ["phone"], fields: ["phone"] },
  links: { values: ["links"], fields: ["link_url", "link_type", "link_label"] },
  canHelpWith: { values: ["canHelpWith"], fields: ["can_help_with"] },
  notes: { values: ["notes"], fields: ["notes"] },
  venue: { values: ["venue"], fields: VENUE_KEYS.map((k) => `venue_${k}`) },
} as const satisfies Record<string, { values: readonly (keyof ConnectionFormValues)[]; fields: readonly string[] }>;

export type AutosaveGroup = keyof typeof AUTOSAVE_GROUPS;

/** The group a posted field belongs to, or null for fields autosave ignores. */
export function groupForField(field: string): AutosaveGroup | null {
  for (const [group, g] of Object.entries(AUTOSAVE_GROUPS)) {
    if ((g.fields as readonly string[]).includes(field)) return group as AutosaveGroup;
  }
  return null;
}

// Which groups an error blocks. "Only a band can be ours" comes from either
// the type or the checkbox, so it blocks both.
const ERROR_GROUPS: Record<string, AutosaveGroup[]> = {
  name: ["name"],
  kind: ["type"],
  personRoles: ["type"],
  groupType: ["type"],
  isUs: ["type", "isUs"],
  email: ["email"],
  placeText: ["place"],
  newScenes: ["scenes"],
  linkUrls: ["links"],
  venue: ["venue", "type"],
};

/**
 * The stored values with the changed groups laid over them, validated for
 * just those groups: a problem elsewhere (an imported person with no roles,
 * say) doesn't block saving a new email.
 */
export function mergeForAutosave(
  stored: ConnectionFormValues,
  incoming: ConnectionFormValues,
  groups: AutosaveGroup[],
): { ok: true; data: ValidConnection } | { ok: false; errors: ConnectionFormErrors } {
  const merged: ConnectionFormValues = { ...stored };
  for (const group of groups) {
    for (const key of AUTOSAVE_GROUPS[group].values) {
      (merged as Record<string, unknown>)[key] = incoming[key];
    }
  }
  const touched = new Set(groups);
  return validate(merged, (key) => (ERROR_GROUPS[key] ?? []).some((g) => touched.has(g)));
}

export function validate(
  values: ConnectionFormValues,
  // Autosave: only these errors count; the rest are left as stored.
  counts: (key: string) => boolean = () => true,
):
  | { ok: true; data: ValidConnection }
  | { ok: false; errors: ConnectionFormErrors } {
  const errors: ConnectionFormErrors = {};

  if (!values.name) errors.name = "Add a name.";
  else if (values.name.length > 200) errors.name = "Keep the name under 200 characters.";

  const kind = KINDS.includes(values.kind as ConnectionKind) ? (values.kind as ConnectionKind) : null;
  if (!kind) errors.kind = "Choose person or band, venue, or org.";
  const personRoles = values.personRoles.filter((r): r is PersonRole =>
    PERSON_ROLES.includes(r as PersonRole),
  );
  const groupType = GROUP_TYPES.includes(values.groupType as GroupType)
    ? (values.groupType as GroupType)
    : null;
  if (kind === "person" && personRoles.length === 0) errors.personRoles = "Pick at least one.";
  if (kind === "group" && !groupType) errors.groupType = "Pick one.";
  if (kind === "group" && values.isUs && groupType && groupType !== "band") {
    errors.isUs = "Only a band can be ours. Change the type back to Band, or untick this.";
  }

  // Empty is no status (#192); anything else must be one of the five.
  if (values.status && !STATUSES.includes(values.status as ConnectionStatus)) errors.status = "Choose a status.";

  if (values.email && !EMAIL_RE.test(values.email)) errors.email = "That email doesn't look right.";

  const placeId = /^\d+$/.test(values.placeId) ? Number(values.placeId) : null;
  if (values.placeText && !placeId && !values.keepLocalityId) {
    errors.placeText = "Pick a town from the suggestions, or clear the field.";
  }

  const newScenes = splitList(values.newScenes);
  if (newScenes.some((n) => n.length > 120)) errors.newScenes = "Keep each scene name under 120 characters.";

  const links: ValidConnection["links"] = [];
  const linkUrls: Record<number, string> = {};
  values.links.forEach((link, i) => {
    if (!link.url) {
      if (link.label) linkUrls[i] = "Add a URL or remove this link.";
      return;
    }
    const url = normalizeUrl(link.url);
    if (!url) linkUrls[i] = "Use a web address like bandcamp.com/yourband.";
    else links.push({ label: optional(link.label), url });
  });
  if (Object.keys(linkUrls).length) errors.linkUrls = linkUrls;

  const isVenue = kind === "group" && groupType === "venue";
  const venue = isVenue ? venueDetailsFromForm(values.venue) : null;
  if (venue && !venue.ok) errors.venue = venue.errors;

  for (const key of Object.keys(errors)) {
    if (!counts(key)) delete errors[key as keyof ConnectionFormErrors];
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name: values.name,
      kind: kind!,
      person_roles: kind === "person" ? personRoles : [],
      group_type: kind === "group" ? groupType : null,
      status: (values.status || null) as ConnectionStatus | null,
      played_together: values.playedTogether,
      is_us: kind === "group" && values.isUs,
      can_help_with: values.canHelpWith
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      locality: placeId
        ? { placeId }
        : values.keepLocalityId
          ? { keepLocalityId: values.keepLocalityId }
          : null,
      scene_ids: [...new Set(values.sceneIds.filter((id) => UUID_RE.test(id)))],
      new_scenes: newScenes,
      email: optional(values.email),
      phone: optional(values.phone),
      notes: optional(values.notes),
      links,
      venue: venue?.ok ? venue.details : null,
    },
  };
}
