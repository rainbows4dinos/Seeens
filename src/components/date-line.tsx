import { formatDay, shortLabel } from "@/lib/outreach/labels";

// Figma Date Line: is this date history or a plan?
//   ← Same bill · Sep 14     past outreach, muted
//   → Follow up · Nov 12     the next plan, bold with a dashed underline
// The arrows and the dot are decoration; screen readers hear "Last
// outreach: Same bill, Sep 14" and "Next: Follow up, Nov 12". Dates are plain
// facts: nothing turns red or says "overdue" (the no-pressure rule).

export function DateLine({
  kind,
  label,
  date,
  today,
}: {
  kind: "past" | "future";
  label: string;
  date: string | null; // YYYY-MM-DD; plans may have none
  today: string;
}) {
  const past = kind === "past";
  return (
    <span className={`date-line ${past ? "date-line-past" : "date-line-future"}`}>
      <span aria-hidden="true">{past ? "←" : "→"}</span>
      <span className="date-line-label">
        <span className="sr-only">{past ? "Last outreach: " : "Next: "}</span>
        {shortLabel(label)}
        {date ? (
          <>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            {formatDay(date, today)}
          </>
        ) : null}
      </span>
    </span>
  );
}

// At most one past and one future line for a connection.
export function DateLines({
  lastOutreach,
  nextAction,
  today,
}: {
  lastOutreach: { occurred_on: string; summary: string } | null | undefined;
  nextAction: { description: string; due_on: string | null } | null | undefined;
  today: string;
}) {
  if (!lastOutreach && !nextAction) return null;
  return (
    <span className="flex flex-col gap-1">
      {lastOutreach ? (
        <DateLine kind="past" label={lastOutreach.summary} date={lastOutreach.occurred_on} today={today} />
      ) : null}
      {nextAction ? (
        <DateLine kind="future" label={nextAction.description} date={nextAction.due_on} today={today} />
      ) : null}
    </span>
  );
}
