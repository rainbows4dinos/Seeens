import type { Database } from "@/lib/supabase/database.types";

export type OutreachChannel = Database["public"]["Enums"]["outreach_channel"];

export const CHANNEL_LABELS: Record<OutreachChannel, string> = {
  in_person: "In person",
  email: "Email",
  text: "Text",
  call: "Call",
  instagram: "Instagram",
  other_social: "Other social",
  other: "Other",
};

export const CHANNELS = Object.keys(CHANNEL_LABELS) as OutreachChannel[];

// The band's dates are Pacific for now (Seeens' first workspace is in Portland).
const TZ = "America/Los_Angeles";

export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(v: string) {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// "Oct 12" this year, "Oct 12, 2025" otherwise. A plain fact, never a warning.
export function formatDay(iso: string, today = todayISO()) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(iso.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
