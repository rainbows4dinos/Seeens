import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/connections/labels";
import { revokeModerator } from "@/lib/auth/moderator-actions";
import { ProfilePanel } from "@/components/profile/panel";
import { GrantForm } from "./grant-form";
import { PageLoader } from "@/components/metronome";

export const metadata: Metadata = { title: "Moderators · Seeens" };

// Moderators (#195), for app admins: trusted people who can fix any shared
// record and keep any record private. Admins are moderators too.
export default function ModeratorsPage() {
  return (
    <div className="page-measure flex flex-col gap-8">
      <Suspense fallback={<PageLoader />}>
        <Moderators />
      </Suspense>
    </div>
  );
}

async function Moderators() {
  const supabase = await createClient();
  const [{ data: admin }, membership] = await Promise.all([supabase.rpc("is_app_admin"), getMembership()]);
  if (!admin) notFound();
  const tz = membership?.timeZone ?? "America/Los_Angeles";
  const [{ data: people }, { data: everyone }] = await Promise.all([
    supabase.rpc("list_moderators"),
    supabase.rpc("list_accounts"),
  ]);
  // Who can still be made one: by name, with their bands, email when there's no name.
  const accounts = (everyone ?? [])
    .filter((a) => !a.moderator && !a.admin)
    .map((a) => ({
      value: a.user_id,
      label: `${a.display_name ?? a.email}${a.bands ? ` (${a.bands})` : " (no band)"}`,
    }));

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="caption">App Admin</p>
        <h1 className="display-l">Moderators</h1>
        <p className="text-muted">
          Moderators can fix any listing other bands share (name, type, town, links, venue details) and keep any listing
          private. Every edit they make is logged. Bands&rsquo; statuses and notes stay their own.
        </p>
      </div>

      <ProfilePanel id="add-moderator" title="Make a Moderator">
        <GrantForm accounts={accounts} />
      </ProfilePanel>

      <ProfilePanel id="moderators" title={`Moderators (${people?.length ?? 0})`}>
        <ul className="rows flex flex-col">
          {(people ?? []).map((p) => (
            <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-medium break-words">{p.display_name ?? p.email}</p>
                <p className="text-sm text-muted break-all">
                  {p.email} · {p.admin ? "Admin" : `Since ${formatDate(p.granted_at, tz)}`}
                </p>
              </div>
              {p.admin ? null : (
                <form action={revokeModerator}>
                  <input type="hidden" name="user_id" value={p.user_id} />
                  <button type="submit" className="button-secondary">
                    Remove<span className="sr-only"> {p.display_name ?? p.email}</span>
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </ProfilePanel>
    </>
  );
}
