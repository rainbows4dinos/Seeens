import type { Metadata } from "next";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createScene } from "@/lib/scenes/actions";
import { listSceneOptions } from "@/lib/scenes/queries";
import { SceneForm } from "@/components/scene-form";
import { NoWorkspace } from "@/components/no-workspace";
import { PageLoader } from "@/components/metronome";

export const metadata: Metadata = { title: "New scene · Seeens" };

export default function NewScenePage() {
  return (
    <div className="page-measure flex flex-col gap-6">
      <h1 className="display-l sm:display-xl">New scene</h1>
      <Suspense fallback={<PageLoader />}>
        <NewScene />
      </Suspense>
    </div>
  );
}

async function NewScene() {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const scenes = await listSceneOptions();

  return (
    <SceneForm
      action={createScene}
      initial={{ name: "", description: "", parentId: "", placeId: "", placeText: "", keepLocalityId: "" }}
      parents={scenes.filter((s) => !s.parent_id)}
      submitLabel="Add Scene"
    />
  );
}
