import type { Metadata } from "next";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { updateConnection } from "@/lib/connections/actions";
import { getConnection, toFormValues } from "@/lib/connections/queries";
import { ConnectionForm } from "@/components/connection-form";
import { LinksPanel } from "@/components/links-panel";
import { linksPanelProps } from "@/lib/affiliations/rows";
import { NoWorkspace } from "@/components/no-workspace";
import { listSceneOptions } from "@/lib/scenes/queries";
import { PhotoPanel } from "@/components/photo-panel";
import { signPhotos } from "@/lib/photos/urls";
import { defaultSettings, readSettings } from "@/lib/photos/settings";

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
  const [detail, scenes] = await Promise.all([getConnection(id), listSceneOptions()]);
  const { connection } = detail;
  const photos = await signPhotos([connection.photo_path, connection.photo_original_path]);

  return (
    <div className="page-measure flex flex-col gap-6">
      <h1 className="display-l sm:display-xl break-words">Edit {connection.name}</h1>
      <ConnectionForm
        action={updateConnection.bind(null, id)}
        initial={toFormValues(connection)}
        scenes={scenes}
        submitLabel="Save Changes"
        cancelHref={`/connections/${id}`}
        photoSlot={
          <div className="flex items-center gap-3">
            <PhotoPanel
              connectionId={connection.id}
              workspaceId={membership.workspaceId}
              name={connection.name}
              photoUrl={connection.photo_path ? (photos.get(connection.photo_path) ?? null) : null}
              originalUrl={connection.photo_original_path ? (photos.get(connection.photo_original_path) ?? null) : null}
              photoPath={connection.photo_path}
              originalPath={connection.photo_original_path}
              settings={readSettings(connection.photo_settings)}
              alt={connection.photo_alt}
              defaults={defaultSettings(connection.status, connection.is_us)}
            />
            <p className="text-sm text-muted">The photo saves on its own. Save Changes and Cancel don&rsquo;t affect it.</p>
          </div>
        }
        linksSlot={
          <LinksPanel
            {...linksPanelProps(detail)}
            note="Changes here save right away. Save Changes and Cancel don't affect them."
          />
        }
      />
    </div>
  );
}
