import type { Metadata } from "next";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { updateScene } from "@/lib/scenes/actions";
import { getScene, listScenes } from "@/lib/scenes/queries";
import { formatPlace } from "@/lib/places";
import { SceneForm } from "@/components/scene-form";
import { NoWorkspace } from "@/components/no-workspace";

export const metadata: Metadata = { title: "Edit scene · Seeens" };

export default function EditScenePage({ params }: PageProps<"/scenes/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <EditScene params={params} />
    </Suspense>
  );
}

async function EditScene({ params }: { params: PageProps<"/scenes/[id]">["params"] }) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const { id } = await params;
  const [scene, scenes] = await Promise.all([getScene(id), listScenes()]);
  const l = scene.localities;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold sm:text-[52px] sm:leading-[52px] break-words">Edit {scene.name}</h1>
      <SceneForm
        action={updateScene.bind(null, id)}
        initial={{
          name: scene.name,
          description: scene.description ?? "",
          parentId: scene.parent_id ?? "",
          placeId: l?.place_id ? String(l.place_id) : "",
          placeText: l ? formatPlace({ ...l, country_name: l.country }) : "",
          keepLocalityId: l && !l.place_id && scene.locality_id ? scene.locality_id : "",
        }}
        parents={scenes.filter((s) => !s.parent_id && s.id !== id)}
        submitLabel="Save changes"
        sceneId={id}
        sceneName={scene.name}
      />
    </div>
  );
}
