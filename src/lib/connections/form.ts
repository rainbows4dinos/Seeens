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
};

export type ConnectionFormErrors = Partial<Record<keyof ConnectionFormValues | "form", string>> & {
  linkUrls?: Record<number, string>;
};

export type ConnectionFormState = {
  values: ConnectionFormValues;
  errors: ConnectionFormErrors;
  // Changes on every failed save so the form remounts with submitted values.
  attempt?: number;
};

export type ValidConnection = {
  name: string;
  kind: ConnectionKind;
  person_roles: PersonRole[];
  group_type: GroupType | null;
  status: ConnectionStatus;
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

export function validate(values: ConnectionFormValues):
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

  if (!STATUSES.includes(values.status as ConnectionStatus)) errors.status = "Choose a status.";

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

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name: values.name,
      kind: kind!,
      person_roles: kind === "person" ? personRoles : [],
      group_type: kind === "group" ? groupType : null,
      status: values.status as ConnectionStatus,
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
    },
  };
}
