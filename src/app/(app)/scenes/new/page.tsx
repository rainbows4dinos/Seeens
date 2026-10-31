import type { Metadata } from "next";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createScene } from "@/lib/scenes/actions";
import { listScenes } from "@/lib/scenes/queries";
import { SceneForm } from "@/components/scene-form";
import { NoWorkspace } from "@/components/no-workspace";

export const metadata: Metadata = { title: "New scene · Seeens" };

export default function NewScenePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold sm:text-[52px] sm:leading-[52px]">New scene</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NewScene />
      </Suspense>
    </div>
  );
}

async function NewScene() {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const scenes = await listScenes();

  return (
    <SceneForm
      action={createScene}
      initial={{ name: "", description: "", parentId: "", placeId: "", placeText: "", keepLocalityId: "" }}
      parents={scenes.filter((s) => !s.parent_id)}
      submitLabel="Add scene"
    />
  );
}
