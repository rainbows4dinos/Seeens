import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { emailConfigured } from "@/lib/email/send";
import { formatDate } from "@/lib/connections/labels";
import { ProfilePanel } from "@/components/profile/panel";
import { PageLoader } from "@/components/metronome";
import { CancelInviteButton, InviteBandForm, NewLinkButton } from "./invite-band-form";

export const metadata: Metadata = { title: "Bands · Seeens" };

// Bands (#68), for app admins: invite a band's first owner, and see which
// bands are still waiting on theirs.
export default function BandsPage({ searchParams }: { searchParams: PageProps<"/admin/bands">["searchParams"] }) {
  return (
    <div className="page-measure flex flex-col gap-8">
      <Suspense fallback={<PageLoader />}>
        <Bands searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Bands({ searchParams }: { searchParams: PageProps<"/admin/bands">["searchParams"] }) {
  const supabase = await createClient();
  const [{ data: admin }, membership, { band }] = await Promise.all([
    supabase.rpc("is_app_admin"),
    getMembership(),
    searchParams,
  ]);
  if (!admin) notFound();
  const tz = membership?.timeZone ?? "America/Los_Angeles";
  const [{ data: bands }, { data: invitable }, { data: people }] = await Promise.all([
    supabase.rpc("list_bands"),
    supabase.rpc("invitable_bands"),
    supabase.rpc("invitable_people"),
  ]);
  const options = (invitable ?? []).map((b) => ({
    value: b.connection_id,
    label: b.name,
    hint: [b.town, `Added by ${b.added_by}`].filter(Boolean).join(" · "),
  }));

  const personOptions = (people ?? []).map((p) => ({
    value: p.connection_id,
    label: p.name,
    hint: [`Added by ${p.added_by}`, p.keep_private ? "Private" : null].filter(Boolean).join(" · "),
  }));

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="caption">App Admin</p>
        <h1 className="display-l">Bands</h1>
        <p className="text-muted">
          Seeens is invite only. Invite a band&rsquo;s first owner here; they bring in the rest.
        </p>
      </div>

      <ProfilePanel id="invite-band" title="Invite a Band">
        <InviteBandForm
          key={typeof band === "string" ? band : ""}
          bands={options}
          people={personOptions}
          picked={typeof band === "string" ? band : undefined}
          emailReady={emailConfigured()}
        />
      </ProfilePanel>

      <ProfilePanel id="bands" title={`Bands (${bands?.length ?? 0})`}>
        <ul className="rows flex flex-col">
          {(bands ?? []).map((b) => {
            const waiting = b.invite_id && b.members === 0;
            const expired = waiting && b.invite_expires_at && new Date(b.invite_expires_at) <= new Date();
            return (
              <li key={b.workspace_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-medium break-words">{b.name}</p>
                  <p className="text-sm text-muted [overflow-wrap:anywhere]">
                    {waiting
                      ? `Waiting on ${b.invite_email ?? "a link invite"} · ${
                          expired ? "Invite ran out" : `Invite runs out ${formatDate(b.invite_expires_at!, tz)}`
                        }`
                      : [
                          `${b.members} ${b.members === 1 ? "member" : "members"}`,
                          `Joined ${formatDate(b.created_at, tz)}`,
                          b.listing_from ? `Listing from ${b.listing_from}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </div>
                {waiting ? (
                  <div className="flex flex-wrap items-start gap-3 sm:justify-end">
                    <NewLinkButton id={b.invite_id!} band={b.name} />
                    <CancelInviteButton id={b.invite_id!} band={b.name} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </ProfilePanel>
    </>
  );
}
