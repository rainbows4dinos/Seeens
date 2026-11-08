import type { Metadata } from "next";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createConnection } from "@/lib/connections/actions";
import { EMPTY_FORM, type ConnectionFormValues } from "@/lib/connections/form";
import { ConnectionForm } from "@/components/connection-form";
import { NoWorkspace } from "@/components/no-workspace";
import { BackButton } from "@/components/back-button";
import { TABS } from "@/lib/connections/tabs";
import { listSceneOptions } from "@/lib/scenes/queries";
import { loadNetwork } from "@/lib/connections/queries";
import { catalogNo } from "@/lib/connections/card";
import { defaultSettings } from "@/lib/photos/settings";
import type { ConnectionStatus } from "@/lib/connections/labels";

const PRESETS: Record<string, Partial<ConnectionFormValues>> = {
  band: { kind: "group", groupType: "band" },
  venue: { kind: "group", groupType: "venue" },
  label: { kind: "group", groupType: "label" },
  person: { kind: "person" },
};

export const metadata: Metadata = { title: "Add connection · Seeens" };

// At /add, not /connections/new: from the directory, the quick view's
// intercepted /connections/[id] would take "new" for an id.
export default function NewConnectionPage({ searchParams }: PageProps<"/add">) {
  return (
    <div className="page-measure flex flex-col gap-6">
      <Suspense fallback={<BackButton href="/" />}>
        <Back searchParams={searchParams} />
      </Suspense>
      <h1 className="display-l sm:display-xl">Add connection</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NewConnection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Back to the tab Add came from (#122), or the directory.
async function Back({ searchParams }: { searchParams: PageProps<"/add">["searchParams"] }) {
  const { type } = await searchParams;
  const tab = TABS.find((t) => t.addType && t.addType === type);
  return <BackButton href={tab ? `/?type=${tab.id}` : "/"} />;
}

async function NewConnection({ searchParams }: { searchParams: PageProps<"/add">["searchParams"] }) {
  const [membership, params] = await Promise.all([getMembership(), searchParams]);
  if (!membership) return <NoWorkspace />;
  const [scenes, network] = await Promise.all([listSceneOptions(), loadNetwork()]);
  // Who links can point at, as on a connection's page.
  const candidates = network.connections
    .filter((c) => !c.archived_at)
    .map((c) => ({ id: c.id, name: c.name, kind: c.kind, group_type: c.group_type, person_roles: c.person_roles, catalog: catalogNo(c) }));
  // From the header's band chip when there's no Us yet: start our own band.
  // From a directory tab's Add (#122): start with that type set.
  const preset = PRESETS[String(params.type ?? "")];
  const initial =
    params.us === "1"
      ? { ...EMPTY_FORM, name: membership.workspaceName, groupType: "band", isUs: true }
      : preset
        ? { ...EMPTY_FORM, ...preset }
        : EMPTY_FORM;

  return (
    <ConnectionForm
      action={createConnection}
      initial={initial}
      scenes={scenes}
      submitLabel="Add Connection"
      cancelHref="/"
      create={{
        workspaceId: membership.workspaceId,
        candidates,
        photoDefaults: defaultSettings(initial.status as ConnectionStatus, initial.isUs),
      }}
    />
  );
}
