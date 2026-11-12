import type { LinkRow } from "@/components/links-panel";
import type { ConnectionDetail } from "@/lib/connections/queries";
import { addOptionsFor, sectionFor } from "./options";
import { catalogNo } from "@/lib/connections/card";
import { formatLocality } from "@/lib/connections/labels";

// Everything the Connections block (LinksPanel) needs for one connection.
// Shared by the detail and edit pages so both show the same thing.
export function linksPanelProps(detail: ConnectionDetail) {
  return {
    subjectId: detail.connection.id,
    rows: linkRows(detail.connection, detail.affiliations),
    options: addOptionsFor(detail.connection),
    candidates: detail.candidates,
    // People already in this band (current or former), for the lineup paste.
    memberIds: detail.affiliations.incoming.filter((a) => a.kind === "member" && a.other).map((a) => a.other!.id),
    // A band offers its town, scenes, and played together to new members (#124).
    carry:
      detail.connection.kind === "group" && detail.connection.group_type === "band"
        ? {
            town: formatLocality(detail.connection.localities),
            scenes: detail.connection.scenes.map((s) => ({ id: s.id, name: s.name })),
            playedTogether: detail.connection.played_together,
          }
        : null,
  };
}

function linkRows(subject: ConnectionDetail["connection"], affiliations: ConnectionDetail["affiliations"]): LinkRow[] {
  const make = (a: ConnectionDetail["affiliations"]["outgoing"][number], direction: "out" | "in"): LinkRow | null =>
    a.other
      ? {
          id: a.id,
          section: sectionFor(subject, { kind: a.kind, direction }),
          otherId: a.other.id,
          otherName: a.other.is_us ? `${a.other.name} (us)` : a.other.name,
          otherArchived: Boolean(a.other.archived_at),
          otherCatalog: catalogNo(a.other),
          role: a.role,
          isCurrent: a.is_current,
          notes: a.notes,
          // Members and their bands each get their own status (#311): the
          // bass player is just the bass player. Not on our own listing.
          status:
            a.kind === "member" && !a.other.is_us
              ? {
                  value: a.other.status ?? null,
                  type: { kind: a.other.kind, group_type: a.other.group_type, person_roles: a.other.person_roles },
                }
              : null,
        }
      : null;
  return [
    ...affiliations.outgoing.map((a) => make(a, "out")),
    ...affiliations.incoming.map((a) => make(a, "in")),
  ].filter((r): r is LinkRow => r !== null);
}
