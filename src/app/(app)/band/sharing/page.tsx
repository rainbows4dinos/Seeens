import type { Metadata } from "next";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { loadSharing } from "@/lib/connections/sharing";
import { BackButton } from "@/components/back-button";
import { NoWorkspace } from "@/components/no-workspace";
import { SharingList } from "@/components/sharing-list";

export const metadata: Metadata = { title: "What You Share · Seeens" };

// Review what the band shares before the directory opens (phase 2).
export default function SharingPage() {
  return (
    <div className="page-measure flex flex-col gap-8">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Sharing />
      </Suspense>
    </div>
  );
}

async function Sharing() {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const sections = await loadSharing();
  const band = membership.workspaceName;

  return (
    <>
      <BackButton href="/band" label="Back to Band Settings" />
      <div className="flex flex-col gap-2">
        <p className="caption">Band Settings</p>
        <h1 className="display-l break-words">What You Share</h1>
        <p className="text-muted">
          Seeens is becoming one directory that every band shares. When it opens, other bands will see the
          records {band} shares: names, types, towns, scenes, links, and photos. Anything you keep private stays in{" "}
          {band}&rsquo;s directory only.
        </p>
        <p className="text-muted">
          Status, notes, contacts, played together, and archiving are always {band}&rsquo;s own, shared or not.
          People start private; everything else starts shared. Nothing is visible to other bands yet.
        </p>
      </div>
      <SharingList sections={sections} band={band} />
    </>
  );
}
