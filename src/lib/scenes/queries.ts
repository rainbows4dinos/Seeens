import "server-only";
import { notFound } from "next/navigation";
import { requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/paginate";

const SCENE_FIELDS =
  "id, name, description, parent_id, locality_id, localities ( name, region, region_code, country, country_code, place_id ), connection_scenes ( connection_id, connection:connections ( archived_at ) )";

// Counts leave out archived connections, matching what the directory shows.
function withCount<
  T extends {
    connection_scenes: { connection_id: string; connection: { archived_at: string | null } | null }[];
  },
>(s: T) {
  const ids = s.connection_scenes
    .filter((cs) => cs.connection && !cs.connection.archived_at)
    .map((cs) => cs.connection_id);
  return { ...s, connectionIds: ids, count: ids.length };
}

export async function listScenes() {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);
  const scenes = await fetchAll((from, to) =>
    supabase.from("scenes").select(SCENE_FIELDS).eq("workspace_id", ws).order("name").order("id").range(from, to),
  ).catch(() => {
    throw new Error("Couldn't load scenes.");
  });
  return scenes.map(withCount);
}

export type SceneItem = Awaited<ReturnType<typeof listScenes>>[number];

// Just names and nesting, for pickers and filters. listScenes() also loads
// every tagged connection to count them, which only the Scenes page needs.
export async function listSceneOptions() {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);
  return fetchAll((from, to) =>
    supabase
      .from("scenes")
      .select("id, name, parent_id")
      .eq("workspace_id", ws)
      .order("name")
      .order("id")
      .range(from, to),
  ).catch(() => {
    throw new Error("Couldn't load scenes.");
  });
}

export async function getScene(id: string) {
  const [supabase, ws] = await Promise.all([createClient(), requireWorkspaceId()]);
  const { data, error } = await supabase
    .from("scenes")
    .select(SCENE_FIELDS)
    .eq("id", id)
    .eq("workspace_id", ws)
    .maybeSingle();
  if (error?.code === "22P02") notFound();
  if (error) throw new Error("Couldn't load this scene.");
  if (!data) notFound();
  return withCount(data);
}

// Top-level scenes first, each followed by the scenes inside it.
export function nestScenes<T extends { id: string; parent_id: string | null }>(
  scenes: T[],
) {
  const top = scenes.filter(
    (s) => !s.parent_id || !scenes.some((p) => p.id === s.parent_id),
  );
  return top.map((s) => ({
    scene: s,
    children: scenes.filter((c) => c.parent_id === s.id),
  }));
}

// A scene plus everything inside it, for "show me the Pacific Northwest".
export function sceneAndChildren(
  scenes: { id: string; parent_id: string | null }[],
  id: string,
) {
  return new Set([
    id,
    ...scenes.filter((s) => s.parent_id === id).map((s) => s.id),
  ]);
}
