// Link types are a fixed list in the app; the database keeps plain label
// text, so adding a type needs no migration. "Other" carries its own label.
export const LINK_TYPES = [
  "Website",
  "Instagram",
  "Bandcamp",
  "Subvert",
  "Spotify",
  "YouTube",
  "SoundCloud",
  "Other",
] as const;
export type LinkType = (typeof LINK_TYPES)[number];

const HOSTS: [RegExp, LinkType][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)bandcamp\.com$/, "Bandcamp"],
  [/(^|\.)subvert\.fm$/, "Subvert"],
  [/(^|\.)spotify\.com$/, "Spotify"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)soundcloud\.com$/, "SoundCloud"],
];

// The type a URL most likely is, or null while it doesn't look like one yet.
export function detectLinkType(raw: string): LinkType | null {
  const text = raw.trim();
  if (!text) return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host.includes(".")) return null;
  return HOSTS.find(([re]) => re.test(host))?.[1] ?? "Website";
}

// Stored label → what the form shows. Known names match in any case;
// anything else is Other with its text kept.
export function splitLinkLabel(label: string): { type: LinkType | ""; custom: string } {
  const text = label.trim();
  if (!text) return { type: "", custom: "" };
  const known = LINK_TYPES.find((t) => t !== "Other" && t.toLowerCase() === text.toLowerCase());
  if (known) return { type: known, custom: "" };
  if (text.toLowerCase() === "other") return { type: "Other", custom: "" };
  return { type: "Other", custom: text };
}

// Form → stored label.
export function joinLinkLabel(type: string, custom: string): string {
  if (type === "Other") return custom.trim() || "Other";
  return (LINK_TYPES as readonly string[]).includes(type) ? type : "";
}
