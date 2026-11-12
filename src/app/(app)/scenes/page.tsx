import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { listScenes, nestScenes, type SceneItem } from "@/lib/scenes/queries";
import { formatLocality } from "@/lib/connections/labels";
import { NoWorkspace } from "@/components/no-workspace";
import { PageLoader } from "@/components/metronome";
import { createClient } from "@/lib/supabase/server";
import { applySceneSuggestion, dismissSceneSuggestion } from "@/lib/scenes/nickname-actions";

export const metadata: Metadata = { title: "Scenes · Seeens" };

export default function ScenesPage({ searchParams }: PageProps<"/scenes">) {
  return (
    <div className="page-measure flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display-l sm:display-xl">Scenes</h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/scenes/nicknames" className="button-secondary">
            View Town Nicknames
          </Link>
          <Link href="/scenes/new" className="button-primary">
            Add Scene
          </Link>
        </div>
      </div>
      <Suspense fallback={<PageLoader label="loading scenes" />}>
        <Scenes searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Scenes({ searchParams }: { searchParams: PageProps<"/scenes">["searchParams"] }) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const supabase = await createClient();
  const [scenes, { saved }, { data: suggestions }] = await Promise.all([
    listScenes(),
    searchParams,
    supabase.rpc("scene_suggestions", { p_workspace_id: membership.workspaceId }),
  ]);
  const savedName = scenes.find((s) => s.id === saved)?.name;

  if (!scenes.length) {
    return (
      <div className="flex flex-col items-start gap-3 border border-dashed border-strong bg-surface p-6">
        <p className="font-medium">No scenes yet.</p>
        <p className="text-muted">
          Scenes group listings by local community, like &ldquo;Portland DIY.&rdquo; Put local scenes inside a bigger
          one, like &ldquo;Pacific Northwest,&rdquo; to see a whole region at once.
        </p>
        <Link href="/scenes/new" className="button-secondary">
          Add Your First Scene
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="text-sm font-medium empty:hidden">
        {savedName ? `Saved ${savedName}.` : ""}
      </p>
      {suggestions?.length ? <Suggestions items={suggestions} /> : null}
      <ul className="panel rows flex flex-col">
        {nestScenes(scenes).map(({ scene, children }) => (
          <li key={scene.id} className="px-3 py-3">
            <SceneRow
              scene={scene}
              total={new Set([scene, ...children].flatMap((s) => s.connectionIds)).size}
              hasChildren={children.length > 0}
            />
            {children.length ? (
              <ul className="mt-2 flex flex-col gap-2 border-l-2 border-line pl-4">
                {children.map((c) => (
                  <li key={c.id}>
                    <SceneRow scene={c} total={c.count} hasChildren={false} />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Scenes whose names point at a town (#234): "LA Punk" → Los Angeles, inside
// "LA". Nothing moves until someone takes it.
function Suggestions({
  items,
}: {
  items: { scene_id: string; scene_name: string; town: string | null; parent_name: string | null }[];
}) {
  return (
    <section
      aria-labelledby="scene-suggestions"
      className="flex flex-col gap-3 border border-dashed border-strong bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="scene-suggestions" className="font-medium">
            {items.length === 1 ? "A scene that looks local" : `${items.length} scenes that look local`}
          </h2>
          <p className="text-sm text-muted">
            Their names point at a town, by name or nickname (PDX, LA, Sactown). Place them to keep them with the
            town&rsquo;s scene.
          </p>
        </div>
        {items.length > 1 ? (
          <form action={applySceneSuggestion}>
            <input type="hidden" name="scene_id" value="all" />
            <button type="submit" className="button-primary">
              Place All
            </button>
          </form>
        ) : null}
      </div>
      <ul className="rows flex flex-col">
        {items.map((s) => (
          <li key={s.scene_id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <p className="min-w-0">
              <span className="font-medium">{s.scene_name}</span>
              <span className="text-sm text-muted">
                {" → "}
                {[s.town, s.parent_name ? `inside ${s.parent_name}` : null].filter(Boolean).join(", ")}
              </span>
            </p>
            <div className="flex gap-2">
              <form action={applySceneSuggestion}>
                <input type="hidden" name="scene_id" value={s.scene_id} />
                <button type="submit" className="button-secondary">
                  Place<span className="sr-only"> {s.scene_name}</span>
                </button>
              </form>
              <form action={dismissSceneSuggestion}>
                <input type="hidden" name="scene_id" value={s.scene_id} />
                <button type="submit" className="button-secondary">
                  Not This One<span className="sr-only">: {s.scene_name}</span>
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SceneRow({ scene, total, hasChildren }: { scene: SceneItem; total: number; hasChildren: boolean }) {
  const place = formatLocality(scene.localities);
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <p>
        <Link href={`/directory?scene=${scene.id}`} className="link font-medium">
          {scene.name}
        </Link>
        <span className="text-sm text-muted">
          {[place, `${total} ${total === 1 ? "listing" : "listings"}${hasChildren ? " across its scenes" : ""}`]
            .filter(Boolean)
            .map((t) => ` · ${t}`)
            .join("")}
        </span>
        {scene.description ? <span className="block text-sm text-muted">{scene.description}</span> : null}
      </p>
      <Link href={`/scenes/${scene.id}`} className="action-link text-sm">
        Edit<span className="sr-only"> {scene.name}</span>
      </Link>
    </div>
  );
}
