import type { Metadata } from "next";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createConnection } from "@/lib/connections/actions";
import { EMPTY_FORM } from "@/lib/connections/form";
import { ConnectionForm } from "@/components/connection-form";
import { NoWorkspace } from "@/components/no-workspace";
import { listScenes } from "@/lib/scenes/queries";

export const metadata: Metadata = { title: "Add connection · Seeens" };

export default function NewConnectionPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold sm:text-[52px] sm:leading-[52px]">Add connection</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NewConnection />
      </Suspense>
    </div>
  );
}

async function NewConnection() {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const scenes = await listScenes();

  return (
    <ConnectionForm
      action={createConnection}
      initial={EMPTY_FORM}
      scenes={scenes}
      submitLabel="Add connection"
      cancelHref="/"
    />
  );
}
