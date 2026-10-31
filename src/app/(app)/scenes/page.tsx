import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { listScenes, nestScenes, type SceneItem } from "@/lib/scenes/queries";
import { formatLocality } from "@/lib/connections/labels";
import { NoWorkspace } from "@/components/no-workspace";

export const metadata: Metadata = { title: "Scenes · Seeens" };

export default function ScenesPage({ searchParams }: PageProps<"/scenes">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl font-bold sm:text-[52px] sm:leading-[52px]">Scenes</h1>
        <Link href="/scenes/new" className="button-primary">
          New scene
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted">Loading scenes…</p>}>
        <Scenes searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Scenes({ searchParams }: { searchParams: PageProps<"/scenes">["searchParams"] }) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const [scenes, { saved }] = await Promise.all([listScenes(), searchParams]);
  const savedName = scenes.find((s) => s.id === saved)?.name;

  if (!scenes.length) {
    return (
      <div className="flex flex-col items-start gap-3 border border-dashed border-strong bg-surface p-6">
        <p className="font-medium">No scenes yet.</p>
        <p className="text-muted">
          Scenes group connections by local community, like &ldquo;Portland
          DIY.&rdquo; Put local scenes inside a bigger one, like &ldquo;Pacific
          Northwest,&rdquo; to see a whole region at once.
        </p>
        <Link href="/scenes/new" className="button-secondary">
          Add your first scene
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
    <p role="status" className="text-sm font-medium empty:hidden">
      {savedName ? `Saved ${savedName}.` : ""}
    </p>
    <ul className="panel rows flex flex-col">
      {nestScenes(scenes).map(({ scene, children }) => (
        <li key={scene.id} className="px-3 py-3">
          <SceneRow
            scene={scene}
            total={
              new Set([scene, ...children].flatMap((s) => s.connectionIds)).size
            }
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

function SceneRow({
  scene,
  total,
  hasChildren,
}: {
  scene: SceneItem;
  total: number;
  hasChildren: boolean;
}) {
  const place = formatLocality(scene.localities);
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <p>
        <Link href={`/?scene=${scene.id}`} className="link font-semibold">
          {scene.name}
        </Link>
        <span className="text-sm text-muted">
          {[
            place,
            `${total} ${total === 1 ? "connection" : "connections"}${hasChildren ? " across its scenes" : ""}`,
          ]
            .filter(Boolean)
            .map((t) => ` · ${t}`)
            .join("")}
        </span>
        {scene.description ? (
          <span className="block text-sm text-muted">{scene.description}</span>
        ) : null}
      </p>
      <Link href={`/scenes/${scene.id}`} className="action-link text-sm">
        Edit<span className="sr-only"> {scene.name}</span>
      </Link>
    </div>
  );
}
