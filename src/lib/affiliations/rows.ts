import type { LinkRow } from "@/components/links-panel";
import type { ConnectionDetail } from "@/lib/connections/queries";
import { addOptionsFor, sectionFor } from "./options";

// Everything the Connections block (LinksPanel) needs for one connection.
// Shared by the detail and edit pages so both show the same thing.
export function linksPanelProps(detail: ConnectionDetail) {
  return {
    subjectId: detail.connection.id,
    rows: linkRows(detail.connection, detail.affiliations),
    options: addOptionsFor(detail.connection),
    candidates: detail.candidates,
  };
}

function linkRows(
  subject: ConnectionDetail["connection"],
  affiliations: ConnectionDetail["affiliations"],
): LinkRow[] {
  const make = (
    a: ConnectionDetail["affiliations"]["outgoing"][number],
    direction: "out" | "in",
  ): LinkRow | null =>
    a.other
      ? {
          id: a.id,
          section: sectionFor(subject, { kind: a.kind, direction }),
          otherId: a.other.id,
          otherName: a.other.is_us ? `${a.other.name} (us)` : a.other.name,
          otherArchived: Boolean(a.other.archived_at),
          role: a.role,
          isCurrent: a.is_current,
          notes: a.notes,
        }
      : null;
  return [
    ...affiliations.outgoing.map((a) => make(a, "out")),
    ...affiliations.incoming.map((a) => make(a, "in")),
  ].filter((r): r is LinkRow => r !== null);
}
