// Possible duplicates (#169): connections of the same type whose names
// match (see nameKeys). Members can say two aren't the same; a group keeps
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

// The ways a name can match another. Beyond the whole name (the import's
// matcher): the name without anything in parentheses, what's in them
// ("Grown Ass Bitch (G.A.B.)" also answers to "GAB"), and initials, but only
// against a name written as initials (GAB, G.A.B.), so "Night Gleaners"
// doesn't meet some band called "NG" by accident.
export function nameKeys(name: string): string[] {
  const keys = new Set<string>();
  const add = (k: string) => {
    if (k) keys.add(k);
  };
  add(matchKey(name));
  const base = name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  add(matchKey(base));
  for (const [, inner] of name.matchAll(/\(([^)]*)\)/g)) {
    add(matchKey(inner));
    if (isInitials(inner)) add(`initials:${matchKey(inner)}`);
  }
  if (isInitials(base)) add(`initials:${matchKey(base)}`);
  const words = base
    .replace(/^the\s+/i, "")
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length >= 2) add(`initials:${words.map((w) => w[0]).join("").toLowerCase()}`);
  return [...keys];
}

// "GAB", "G.A.B.", "K.X.X.X": two to six letters, all capitals or dotted.
function isInitials(s: string) {
  const t = s.trim();
  return /^(?:\p{Lu}\.?){2,6}$/u.test(t.replace(/\s+/g, "")) && (/\./.test(t) || t === t.toUpperCase());
}

// Same kind, and the same group type unless one isn't set (an import that
// couldn't tell). A band and a venue with one name are usually two places.
function sameType(a: DupCandidate, b: DupCandidate) {
  return a.kind === b.kind && (a.group_type === b.group_type || !a.group_type || !b.group_type);
}

export function duplicateGroups<T extends DupCandidate>(rows: T[], notSame: Iterable<string>): T[][] {
  const dismissed = new Set(notSame);

  // Anyone sharing a key with anyone else of the same type joins their
  // group, and groups that touch merge (union-find).
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const byKey = new Map<string, number[]>();
  rows.forEach((r, i) => {
    for (const k of nameKeys(r.name)) byKey.set(k, [...(byKey.get(k) ?? []), i]);
  });
  for (const ids of byKey.values())
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++)
        if (sameType(rows[ids[a]], rows[ids[b]])) parent[find(ids[a])] = find(ids[b]);
  const byRoot = new Map<number, T[]>();
  rows.forEach((r, i) => byRoot.set(find(i), [...(byRoot.get(find(i)) ?? []), r]));

  const groups: T[][] = [];
  for (const members of byRoot.values()) {
    if (members.length < 2) continue;
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
