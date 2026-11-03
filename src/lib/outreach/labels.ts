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

// Each band has its own time zone (workspaces.time_zone). Pacific is the
// default, and the fallback if a zone name isn't one this runtime knows.
export const DEFAULT_TIME_ZONE = "America/Los_Angeles";

export function safeTimeZone(timeZone: string | null | undefined) {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

// The calendar date (YYYY-MM-DD) at `now` in the band's time zone.
export function todayISO(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: safeTimeZone(timeZone) }).format(now);
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
