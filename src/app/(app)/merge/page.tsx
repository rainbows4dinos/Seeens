import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { todayISO } from "@/lib/outreach/labels";
import { loadMergeCandidates, undoDeadline } from "@/lib/connections/merge";
import { photoUrl } from "@/lib/photos/urls";
import { BackButton } from "@/components/back-button";
import { MergeReview } from "@/components/merge-review";
import { NoWorkspace } from "@/components/no-workspace";
import { PageLoader } from "@/components/metronome";

export const metadata: Metadata = { title: "Merge duplicates · Seeens" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Compare duplicates side by side and pick the one to keep (#169).
// /merge?ids=a&ids=b[&keep=a]
export default function MergePage({ searchParams }: PageProps<"/merge">) {
  return (
    <div className="flex flex-col gap-8">
      <BackButton href="/duplicates" label="Possible Duplicates" />
      <Suspense fallback={<PageLoader />}>
        <Merge searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Merge({ searchParams }: { searchParams: PageProps<"/merge">["searchParams"] }) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const params = await searchParams;
  const raw = params.ids;
  const ids = [...new Set((Array.isArray(raw) ? raw : raw ? [raw] : []).filter((id) => UUID.test(id)))].slice(0, 20);
  const candidates = ids.length > 1 ? await loadMergeCandidates(ids, todayISO(new Date(), membership.timeZone)) : [];

  if (candidates.length < 2) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="display-l">Nothing to merge</h1>
        <p className="text-muted">Pick at least two. Some of these may have been merged or removed already.</p>
        <Link href="/duplicates" className="button-secondary">
          See Possible Duplicates
        </Link>
      </div>
    );
  }

  // Default keep: the one asked for, else your band, else the fullest.
  const asked = typeof params.keep === "string" ? params.keep : null;
  const keep =
    candidates.find((c) => c.id === asked)?.id ??
    candidates.find((c) => c.isUs)?.id ??
    [...candidates].sort((a, b) => b.weight - a.weight)[0].id;

  const until = undoDeadline(new Date(), membership.timeZone);

  return (
    <MergeReview
      // A different set of ids is a different review.
      key={candidates.map((c) => c.id).join(",")}
      candidates={candidates.map((c) => ({ ...c, photo: photoUrl(c.photo_path, 320) }))}
      defaultKeep={keep}
      until={until}
    />
  );
}
