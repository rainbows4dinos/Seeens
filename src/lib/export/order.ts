import type { ConnectionKind, GroupType, PersonRole } from "@/lib/connections/labels";

type Sortable = {
  name: string;
  kind: ConnectionKind;
  group_type: GroupType | null;
  person_roles: PersonRole[];
  is_us: boolean;
  catalog_no: number;
};

/**
 * Export order: your band first, then groups by type (in `groupOrder`), then
 * people by their first role (in `roleOrder`). Within a type: name A to Z with
 * numbers in order, then catalog number.
 */
export function byTypeThenName(groupOrder: readonly GroupType[], roleOrder: readonly PersonRole[]) {
  const rank = (c: Sortable) => {
    if (c.is_us) return 0;
    if (c.kind === "group") {
      const i = c.group_type ? groupOrder.indexOf(c.group_type) : -1;
      return 1 + (i < 0 ? groupOrder.length : i);
    }
    const i = c.person_roles[0] ? roleOrder.indexOf(c.person_roles[0]) : -1;
    return 1000 + (i < 0 ? roleOrder.length : i);
  };
  return (a: Sortable, b: Sortable) =>
    rank(a) - rank(b) ||
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) ||
    a.catalog_no - b.catalog_no;
}
