import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { GettingStarted } from "@/components/getting-started";
import { HomeHeader, MightKnow, NewOnSeeens, Roster, StatusShelf, UpNext } from "@/components/home";
import { NoWorkspace } from "@/components/no-workspace";
import { PageLoader } from "@/components/metronome";
import { DIRECTORY_PARAMS, oldNetworkLink } from "@/lib/connections/old-links";

export const metadata: Metadata = { title: "Home · Seeens" };

type Params = Record<string, string | string[] | undefined>;

// Home (#273): your band's own page. The Directory is the shared map; this
// points into it.
export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageLoader label="loading home" />}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

async function Home({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  if (Object.keys(params).some((k) => DIRECTORY_PARAMS.includes(k))) redirect(oldNetworkLink(params));
  if (!(await getMembership())) return <NoWorkspace />;
  const preview = params.preview === "getting-started";

  return (
    <div className="page-measure flex flex-col gap-10">
      <Suspense fallback={null}>
        <HomeHeader />
      </Suspense>
      {/* A new member's first steps (#68). */}
      <Suspense fallback={null}>
        <GettingStarted preview={preview} />
      </Suspense>
      <Suspense fallback={null}>
        <UpNext />
      </Suspense>
      {/* A label's bands (#298). */}
      <Suspense fallback={null}>
        <Roster />
      </Suspense>
      <Suspense fallback={null}>
        <StatusShelf status="homies" />
      </Suspense>
      <Suspense fallback={null}>
        <StatusShelf status="lets_play" />
      </Suspense>
      <Suspense fallback={null}>
        <NewOnSeeens />
      </Suspense>
      <Suspense fallback={null}>
        <MightKnow preview={preview} />
      </Suspense>
    </div>
  );
}
