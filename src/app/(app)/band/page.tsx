import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, getMembership, getUsConnection } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { loadPendingInvites } from "@/lib/band/queries";
import { formatDate } from "@/lib/connections/labels";
import { ProfilePanel } from "@/components/profile/panel";
import { NoWorkspace } from "@/components/no-workspace";
import { BandNameField, InviteForm, MemberControls, PendingInviteActions } from "@/components/band-settings";
import { PageLoader } from "@/components/metronome";

export const metadata: Metadata = { title: "Band Settings · Seeens" };

// Band Settings (#69): shared by everyone in the band. Members see who's in
// and invite bandmates; owners also rename the band, change roles, and
// remove members.
export default function BandPage() {
  return (
    <div className="page-measure flex flex-col gap-8">
      <Suspense fallback={<PageLoader />}>
        <Band />
      </Suspense>
    </div>
  );
}

async function Band() {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const [user, us, supabase] = await Promise.all([getCurrentUser(), getUsConnection(), createClient()]);
  const ws = membership.workspaceId;
  const owner = membership.role === "owner";
  const [{ data: members }, invites, { count: shared }, { count: kept }] = await Promise.all([
    supabase.rpc("band_members", { p_workspace_id: ws }),
    loadPendingInvites(ws),
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws)
      .eq("keep_private", false),
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws)
      .eq("keep_private", true),
  ]);
  const tz = membership.timeZone;

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="caption">Band Settings</p>
        <h1 className="display-l break-words">{membership.workspaceName}</h1>
        <p className="text-muted">
          Shared with everyone in {membership.workspaceName}.{" "}
          {owner
            ? "As an owner, you can rename the band and change roles."
            : "Owners can rename the band and change roles."}
        </p>
      </div>

      <ProfilePanel id="band-band" title="Band" summary={membership.workspaceName}>
        {owner ? (
          <BandNameField initial={membership.workspaceName} />
        ) : (
          <p>
            <span className="label">Band Name</span>
            <br />
            {membership.workspaceName}
          </p>
        )}
        <p className="text-sm text-muted">
          In the directory as{" "}
          {us ? (
            // A full page load, not the directory's quick view (#44).
            <a href={`/connections/${us.id}`} className="link">
              {membership.workspaceName}
            </a>
          ) : (
            <>
              nothing yet.{" "}
              <Link href="/add?us=1" className="link">
                Add your band&rsquo;s page
              </Link>
            </>
          )}
        </p>
      </ProfilePanel>

      <ProfilePanel id="band-sharing" title="What You Share" summary={sharingSummary(shared, kept)}>
        <p>
          Other bands see the listings {membership.workspaceName} shares. Status, notes, and contacts stay yours either
          way.
        </p>
        <p className="text-sm text-muted">{sharingSummary(shared, kept)}.</p>
        <Link href="/band/sharing" className="button-secondary self-start">
          Review What You Share
        </Link>
      </ProfilePanel>

      <ProfilePanel id="band-invite" title="Invite a Bandmate">
        <InviteForm canInviteOwners={owner} bandName={membership.workspaceName} />
      </ProfilePanel>

      <ProfilePanel id="band-members" title={`Members (${members?.length ?? 0})`}>
        <ul className="rows flex flex-col">
          {(members ?? []).map((m) => {
            const you = m.user_id === user.id;
            return (
              <li key={m.user_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-medium break-words">
                    {m.display_name}
                    {you ? <span className="text-muted"> (you)</span> : null}
                  </p>
                  <p className="text-sm break-all text-muted">
                    {m.email} · joined {formatDate(m.joined_at, tz)}
                  </p>
                </div>
                {owner && !you ? (
                  <MemberControls userId={m.user_id} name={m.display_name} role={m.role} />
                ) : (
                  <p className="text-sm text-muted">{m.role === "owner" ? "Owner" : "Member"}</p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted">
          To leave {membership.workspaceName}, use{" "}
          <Link href="/account" className="link">
            Account Settings
          </Link>
          .
        </p>
      </ProfilePanel>

      <ProfilePanel id="band-pending" title={`Pending Invites (${invites.length})`}>
        {invites.length ? (
          <ul className="rows flex flex-col">
            {invites.map((i) => {
              const label = i.email ?? "Invite link";
              const mine = i.invited_by === user.id;
              return (
                <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-medium break-all">
                      {label}
                      {i.name ? <span className="text-muted"> ({i.name})</span> : null}
                    </p>
                    <p className="text-sm text-muted">
                      {i.role === "owner" ? "Owner · " : ""}
                      {i.email ? "Invited" : "Made"} by {mine ? "you" : i.invited_by_name},{" "}
                      {formatDate(i.created_at, tz)} · expires {formatDate(i.expires_at, tz)}
                      {i.email && !i.sent_at ? " · not emailed" : ""}
                    </p>
                  </div>
                  {mine || owner ? <PendingInviteActions id={i.id} hasEmail={Boolean(i.email)} label={label} /> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">No open invites.</p>
        )}
      </ProfilePanel>
    </>
  );
}

function sharingSummary(shared: number | null, kept: number | null) {
  return `${shared ?? 0} shared · ${kept ?? 0} kept private`;
}
