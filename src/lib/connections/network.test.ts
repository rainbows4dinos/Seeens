// Network facts: label mates and members shared with "us". Run with: npm test
// Fictional data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNetwork, type Edge, type NetworkConnection } from "./network.ts";

const band = (id: string, extra: Partial<NetworkConnection> = {}): NetworkConnection => ({
  id,
  name: id,
  kind: "group",
  group_type: "band",
  is_us: false,
  archived_at: null,
  ...extra,
});
const person = (id: string): NetworkConnection => ({ ...band(id), kind: "person", group_type: null });
const edge = (from: string, kind: string, to: string): Edge => ({ from_connection_id: from, to_connection_id: to, kind });

test("label mates, shared members, and us", () => {
  const net = buildNetwork(
    [
      band("Us", { is_us: true }),
      band("Mates"),
      band("Gone", { archived_at: "2026-01-01" }),
      band("Stranger"),
      band("Label", { group_type: "label" }),
      person("Jo"),
      person("Ri"),
    ],
    [
      edge("Us", "on_label", "Label"),
      edge("Mates", "on_label", "Label"),
      edge("Gone", "on_label", "Label"),
      edge("Jo", "member", "Us"),
      edge("Jo", "member", "Mates"),
      edge("Ri", "member", "Stranger"),
    ],
  );
  assert.equal(net.usId, "Us");
  assert.deepEqual(
    net.labelMatesOf("Mates").map((c) => c.id).sort(),
    ["Us"],
    "archived bands aren't label mates",
  );
  assert.equal(net.isLabelMateWithUs("Mates"), true);
  assert.equal(net.isLabelMateWithUs("Stranger"), false);
  assert.deepEqual(net.sharedMembersWithUs("Mates"), ["Jo"]);
  assert.deepEqual(net.sharedMembersWithUs("Stranger"), []);
  assert.deepEqual(net.sharedMembersWithUs("Us"), [], "we don't share members with ourselves");
});

test("no band marked as us", () => {
  const net = buildNetwork([band("A"), band("B")], [edge("A", "on_label", "L"), edge("B", "on_label", "L")]);
  assert.equal(net.usId, null);
  assert.equal(net.isLabelMateWithUs("A"), false);
  assert.deepEqual(net.sharedMembersWithUs("A"), []);
});

// The previous implementation, kept here to check the faster one agrees.
function reference(connections: NetworkConnection[], edges: Edge[]) {
  const byId = new Map(connections.map((c) => [c.id, c]));
  const usId = connections.find((c) => c.is_us)?.id ?? null;
  const labelsOf = (id: string) =>
    edges.filter((e) => e.kind === "on_label" && e.from_connection_id === id).map((e) => e.to_connection_id);
  const membersOf = (id: string) =>
    new Set(edges.filter((e) => e.kind === "member" && e.to_connection_id === id).map((e) => e.from_connection_id));
  const labelMatesOf = (id: string) => {
    const labels = new Set(labelsOf(id));
    const ids = new Set(
      edges
        .filter((e) => e.kind === "on_label" && labels.has(e.to_connection_id) && e.from_connection_id !== id)
        .map((e) => e.from_connection_id),
    );
    return [...ids]
      .map((mid) => byId.get(mid))
      .filter((c): c is NonNullable<typeof c> => Boolean(c && !c.archived_at))
      .map((c) => ({ id: c.id, name: c.name, is_us: c.is_us }));
  };
  const usLabelMates = new Set(usId ? labelMatesOf(usId).map((c) => c.id) : []);
  const usMembers = usId ? membersOf(usId) : new Set<string>();
  return {
    labelMatesOf,
    isLabelMateWithUs: (id: string) => usLabelMates.has(id),
    sharedMembersWithUs: (id: string) =>
      id === usId
        ? []
        : [...membersOf(id)]
            .filter((m) => usMembers.has(m))
            .map((m) => byId.get(m)?.name)
            .filter((n): n is string => Boolean(n)),
  };
}

test("matches the previous implementation on random networks", () => {
  let seed = 7;
  const rand = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed % n;
  };
  const kinds = ["on_label", "member", "related", "works_with"];
  for (let round = 0; round < 50; round++) {
    const n = 5 + rand(40);
    const conns = Array.from({ length: n }, (_, i) =>
      band(`c${i}`, { is_us: i === 0, archived_at: rand(6) === 0 ? "2026-01-01" : null }),
    );
    const edges = Array.from({ length: rand(n * 3) }, () =>
      edge(`c${rand(n)}`, kinds[rand(kinds.length)], `c${rand(n)}`),
    ).filter((e) => e.from_connection_id !== e.to_connection_id);

    const fast = buildNetwork(conns, edges);
    const slow = reference(conns, edges);
    for (const c of conns) {
      const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();
      assert.deepEqual(ids(fast.labelMatesOf(c.id)), ids(slow.labelMatesOf(c.id)));
      assert.equal(fast.isLabelMateWithUs(c.id), slow.isLabelMateWithUs(c.id));
      assert.deepEqual(fast.sharedMembersWithUs(c.id).sort(), slow.sharedMembersWithUs(c.id).sort());
    }
  }
});
