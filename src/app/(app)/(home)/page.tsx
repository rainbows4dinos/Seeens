import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HomeArrange, HomeRow } from "@/components/arrange-home";
import { HOME_ROWS, isDefault, type HomeRowKey } from "@/lib/home/layout";
import { loadHomeLayout } from "@/lib/home/queries";
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
  const home = await loadHomeLayout();
  if (!home) return <NoWorkspace />;
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
      {/* The rest in this person's order (#313), hidden ones too, for
          Arrange Home's edit mode. */}
      <HomeArrange
        isDefault={isDefault(home.layout, home.kind)}
        rows={[
          ...home.layout.shown.map((key) => ({ key, label: label(key), shown: true })),
          ...home.layout.hidden.map((key) => ({ key, label: label(key), shown: false })),
        ]}
      >
        {[...home.layout.shown, ...home.layout.hidden].map((key) => (
          <HomeRow key={key} id={key}>
            <Suspense fallback={null}>{row(key, preview)}</Suspense>
          </HomeRow>
        ))}
      </HomeArrange>
    </div>
  );
}

function row(key: HomeRowKey, preview: boolean) {
  switch (key) {
    case "up_next":
      return <UpNext />;
    // A label's bands (#298).
    case "roster":
      return <Roster />;
    case "homies":
    case "lets_play":
    case "prospect":
      return <StatusShelf status={key} />;
    case "new_near_you":
      return <NewOnSeeens />;
    case "might_know":
      return <MightKnow preview={preview} />;
  }
}

const label = (key: HomeRowKey) => HOME_ROWS.find((r) => r.key === key)!.label;
