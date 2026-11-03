// Network facts derived from a workspace's connections and links:
// label mates (bands sharing a label) and members shared with "us".
// Pure, so it can be tested without a database.

export type NetworkConnection = {
  id: string;
  name: string;
  kind: string;
  group_type: string | null;
  is_us: boolean;
  archived_at: string | null;
};
export type Edge = { from_connection_id: string; to_connection_id: string; kind: string };

// Lookups are built once, so asking about every row in the directory stays
// cheap.
export function buildNetwork<C extends NetworkConnection>(connections: C[], edges: Edge[]) {
  const byId = new Map(connections.map((c) => [c.id, c]));
  const usId = connections.find((c) => c.is_us)?.id ?? null;

  const labelsOf = new Map<string, Set<string>>(); // band -> its labels
  const bandsOn = new Map<string, Set<string>>(); // label -> its bands
  const membersOf = new Map<string, Set<string>>(); // band -> its members
  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    const set = map.get(key);
    if (set) set.add(value);
    else map.set(key, new Set([value]));
  };
  for (const e of edges) {
    if (e.kind === "on_label") {
      add(labelsOf, e.from_connection_id, e.to_connection_id);
      add(bandsOn, e.to_connection_id, e.from_connection_id);
    } else if (e.kind === "member") {
      add(membersOf, e.to_connection_id, e.from_connection_id);
    }
  }

  const labelMatesOf = (id: string) => {
    const ids = new Set<string>();
    for (const label of labelsOf.get(id) ?? []) {
      for (const band of bandsOn.get(label) ?? []) if (band !== id) ids.add(band);
    }
    return [...ids]
      .map((mid) => byId.get(mid))
      .filter((c): c is NonNullable<typeof c> => Boolean(c && !c.archived_at))
      .map((c) => ({ id: c.id, name: c.name, is_us: c.is_us }));
  };

  const usLabelMates = new Set(usId ? labelMatesOf(usId).map((c) => c.id) : []);
  const usMembers = (usId && membersOf.get(usId)) || new Set<string>();

  return {
    connections,
    usId,
    labelMatesOf,
    isLabelMateWithUs: (id: string) => usLabelMates.has(id),
    // Names of people in both this band and ours (current or former).
    sharedMembersWithUs: (id: string) =>
      id === usId
        ? []
        : [...(membersOf.get(id) ?? [])]
            .filter((m) => usMembers.has(m))
            .map((m) => byId.get(m)?.name)
            .filter((n): n is string => Boolean(n)),
  };
}
