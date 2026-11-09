import type { Metadata } from "next";
import { Suspense } from "react";
import { isModerator } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatShortPlace } from "@/lib/places";
import { BackButton } from "@/components/back-button";
import { PageLoader } from "@/components/metronome";
import { removeNickname } from "@/lib/scenes/nickname-actions";
import { AddNicknameForm } from "./add-nickname-form";

export const metadata: Metadata = { title: "Town Nicknames · Seeens" };

// Town nicknames (#234): PDX, LA, Sactown. A scene named with one finds its
// town; town search knows them too. Everyone sees the list; moderators keep it.
export default function NicknamesPage() {
  return (
    <div className="page-measure flex flex-col gap-6">
      <BackButton href="/scenes" label="Back to Scenes" />
      <div className="flex flex-col gap-2">
        <h1 className="display-l sm:display-xl">Town Nicknames</h1>
        <p className="text-muted">
          What people call a town in scene names. A scene named &ldquo;LA Punk&rdquo; or &ldquo;PDX Garage&rdquo; finds
          its town and goes inside that town&rsquo;s scene, and town search knows these too. All-caps nicknames only
          match in caps, so &ldquo;La Luz&rdquo; isn&rsquo;t LA.
        </p>
      </div>
      <Suspense fallback={<PageLoader />}>
        <Nicknames />
      </Suspense>
    </div>
  );
}

async function Nicknames() {
  const supabase = await createClient();
  const [{ data }, moderator] = await Promise.all([
    supabase
      .from("place_aliases")
      .select("alias, place:places ( name, region_code, region_name, country_name, country_code )")
      .order("alias"),
    isModerator(),
  ]);
  const rows = (data ?? [])
    .map((r) => ({
      alias: r.alias,
      town: r.place
        ? formatShortPlace({
            name: r.place.name,
            region_code: r.place.region_code,
            region: r.place.region_name,
            country: r.place.country_name,
            country_code: r.place.country_code,
          })
        : "",
    }))
    .sort((a, b) => a.town.localeCompare(b.town) || a.alias.localeCompare(b.alias));

  return (
    <>
      {moderator ? (
        <section aria-labelledby="add-nickname" className="panel flex flex-col gap-4 p-4">
          <h2 id="add-nickname" className="font-medium">
            Add a Nickname
          </h2>
          <AddNicknameForm />
        </section>
      ) : (
        <p className="text-sm text-muted">Missing one? Tell us with Send Feedback, and a moderator will add it.</p>
      )}
      <table className="about-table">
        <thead>
          <tr>
            <th scope="col">Town</th>
            <th scope="col">Nickname</th>
            {moderator ? (
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.alias}>
              <td>{r.town}</td>
              <td className="font-medium">{r.alias}</td>
              {moderator ? (
                <td>
                  <form action={removeNickname}>
                    <input type="hidden" name="alias" value={r.alias} />
                    <button type="submit" className="action-link text-sm">
                      Remove<span className="sr-only"> {r.alias}</span>
                    </button>
                  </form>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
