import type { Metadata } from "next";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { updateConnection } from "@/lib/connections/actions";
import { getConnection, toFormValues } from "@/lib/connections/queries";
import { ConnectionForm } from "@/components/connection-form";
import { NoWorkspace } from "@/components/no-workspace";
import { listScenes } from "@/lib/scenes/queries";

export const metadata: Metadata = { title: "Edit connection · Seeens" };

export default function EditConnectionPage({ params }: PageProps<"/connections/[id]/edit">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <EditConnection params={params} />
    </Suspense>
  );
}

async function EditConnection({ params }: { params: PageProps<"/connections/[id]/edit">["params"] }) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;

  const { id } = await params;
  const [{ connection }, scenes] = await Promise.all([getConnection(id), listScenes()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold sm:text-[52px] sm:leading-[52px] break-words">Edit {connection.name}</h1>
      <ConnectionForm
        action={updateConnection.bind(null, id)}
        initial={toFormValues(connection)}
        scenes={scenes}
        submitLabel="Save changes"
        cancelHref={`/connections/${id}`}
      />
    </div>
  );
}
