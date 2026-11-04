import type { Metadata } from "next";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createConnection } from "@/lib/connections/actions";
import { EMPTY_FORM } from "@/lib/connections/form";
import { ConnectionForm } from "@/components/connection-form";
import { NoWorkspace } from "@/components/no-workspace";
import { listSceneOptions } from "@/lib/scenes/queries";

export const metadata: Metadata = { title: "Add connection · Seeens" };

export default function NewConnectionPage({ searchParams }: PageProps<"/connections/new">) {
  return (
    <div className="page-measure flex flex-col gap-6">
      <h1 className="display-l sm:display-xl">Add connection</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NewConnection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewConnection({ searchParams }: { searchParams: PageProps<"/connections/new">["searchParams"] }) {
  const [membership, params] = await Promise.all([getMembership(), searchParams]);
  if (!membership) return <NoWorkspace />;
  const scenes = await listSceneOptions();
  // From the header's band chip when there's no Us yet: start our own band.
  const initial =
    params.us === "1" ? { ...EMPTY_FORM, name: membership.workspaceName, groupType: "band", isUs: true } : EMPTY_FORM;

  return (
    <ConnectionForm
      action={createConnection}
      initial={initial}
      scenes={scenes}
      submitLabel="Add Connection"
      cancelHref="/"
    />
  );
}
