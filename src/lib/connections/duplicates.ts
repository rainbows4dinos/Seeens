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
// matcher): the name without anything in parentheses, and what's in them
// ("Grown Ass Bitch (G.A.B.)" also answers to "GAB").
//
// Initials work one way only: a name written as initials ("initials:gab",
// from GAB or G.A.B.) meets a spelled-out name with those initials
// ("spells:gab", from Grown Ass Bitch). Two spelled-out names never meet on
// initials alone (Backseat Plastic isn't The Birthday Party), and it takes
// three letters, so "Night Gleaners" doesn't meet a band called "NG".
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
  if (words.length >= 3) add(`spells:${words.map((w) => w[0]).join("").toLowerCase()}`);
  return [...keys];
}

/** Whether two names match by the rules above (types aside). */
export function namesMatch(a: string, b: string) {
  const ka = nameKeys(a);
  const kb = new Set(nameKeys(b));
  const flip = (k: string) =>
    k.startsWith("initials:") ? `spells:${k.slice(9)}` : k.startsWith("spells:") ? `initials:${k.slice(7)}` : null;
  return ka.some((k) => (!k.startsWith("spells:") && kb.has(k)) || (flip(k) !== null && kb.has(flip(k)!)));
}

// "GAB", "G.A.B.", "K.X.X.X": three to six letters, all capitals or dotted.
function isInitials(s: string) {
  const t = s.trim();
  return /^(?:\p{Lu}\.?){3,6}$/u.test(t.replace(/\s+/g, "")) && (/\./.test(t) || t === t.toUpperCase());
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
  const join = (a: number, b: number) => {
    if (a !== b && sameType(rows[a], rows[b])) parent[find(a)] = find(b);
  };
  for (const [key, ids] of byKey) {
    if (key.startsWith("spells:")) continue;
    if (key.startsWith("initials:")) {
      // Written initials meet spelled-out names, and each other.
      const spelled = byKey.get(`spells:${key.slice("initials:".length)}`) ?? [];
      for (const a of ids) for (const b of [...ids, ...spelled]) join(a, b);
      continue;
    }
    for (const a of ids) for (const b of ids) join(a, b);
  }
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
