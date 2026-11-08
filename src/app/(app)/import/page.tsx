import type { Metadata } from "next";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NoWorkspace } from "@/components/no-workspace";
import { ImportWizard } from "@/components/import-wizard";
import { PageLoader } from "@/components/metronome";

export const metadata: Metadata = { title: "Import · Seeens" };

export default function ImportPage() {
  return (
    <div className="page-measure flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Import a spreadsheet</h1>
      <Suspense fallback={<PageLoader />}>
        <Import />
      </Suspense>
    </div>
  );
}

async function Import() {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const supabase = await createClient();
  // Everyone already here, so the review can say who a row fills in.
  const { data } = await supabase
    .from("connections")
    .select("id, name, kind, group_type, band:connection_band_details!inner ( archived_at )")
    .eq("workspace_id", membership.workspaceId)
    .is("band.archived_at", null)
    .eq("is_us", false)
    .limit(5000);
  return <ImportWizard existing={data ?? []} />;
}
