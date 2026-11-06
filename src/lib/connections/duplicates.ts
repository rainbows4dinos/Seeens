// Possible duplicates (#169): connections whose names match the way the
// import matches them (case, "The", and punctuation don't count) and that
// are the same type. Members can say two aren't the same; a group keeps
// only the ones that could still be the same as another one in it.
import { matchKey } from "../import/rows.ts";

export type DupCandidate = {
  id: string;
  name: string;
  kind: string;
  group_type: string | null;
};

/** "a|b" with the ids in order, the way connection_not_duplicates stores them. */
export function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Every pair in a list, in stored order. */
export function pairsOf(ids: string[]): [string, string][] {
  const out: [string, string][] = [];
  const sorted = [...new Set(ids)].sort();
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++) out.push([sorted[i], sorted[j]]);
  return out;
}

export function duplicateGroups<T extends DupCandidate>(rows: T[], notSame: Iterable<string>): T[][] {
  const dismissed = new Set(notSame);
  const byKey = new Map<string, T[]>();
  for (const r of rows) {
    const k = matchKey(r.name);
    if (!k) continue;
    const key = `${r.kind}:${r.group_type ?? ""}:${k}`;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }

  const groups: T[][] = [];
  for (const members of byKey.values()) {
    // Drop anyone marked "not the same" as everyone else left, until the
    // group settles. Two that are only dismissed from each other both go.
    let left = members;
    for (;;) {
      const next = left.filter((m) => left.some((o) => o.id !== m.id && !dismissed.has(pairKey(m.id, o.id))));
      if (next.length === left.length) break;
      left = next;
    }
    if (left.length > 1) groups.push(left);
  }
  return groups.sort((a, b) => a[0].name.localeCompare(b[0].name));
}
