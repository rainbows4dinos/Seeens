import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { emailConfigured } from "@/lib/email/send";
import { formatDate } from "@/lib/connections/labels";
import { ProfilePanel } from "@/components/profile/panel";
import { PageLoader } from "@/components/metronome";
import { NewLinkButton, StartBandForm } from "./start-band-form";

export const metadata: Metadata = { title: "Bands · Seeens" };

// Bands (#68), for app admins: start a new band and invite its first owner,
// and see which bands are still waiting on theirs.
export default function BandsPage() {
  return (
    <div className="page-measure flex flex-col gap-8">
      <Suspense fallback={<PageLoader />}>
        <Bands />
      </Suspense>
    </div>
  );
}

async function Bands() {
  const supabase = await createClient();
  const [{ data: admin }, membership] = await Promise.all([supabase.rpc("is_app_admin"), getMembership()]);
  if (!admin) notFound();
  const tz = membership?.timeZone ?? "America/Los_Angeles";
  const { data: bands } = await supabase.rpc("list_bands");

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="caption">App Admin</p>
        <h1 className="display-l">Bands</h1>
        <p className="text-muted">
          Seeens is invite only. Start a band here and invite its first owner; they bring in the rest.
        </p>
      </div>

      <ProfilePanel id="start-band" title="Start a Band">
        <StartBandForm emailReady={emailConfigured()} />
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
                  <p className="text-sm text-muted break-all">
                    {waiting
                      ? `Waiting on ${b.invite_email ?? "a link invite"} · ${
                          expired ? "Invite ran out" : `Invite runs out ${formatDate(b.invite_expires_at!, tz)}`
                        }`
                      : `${b.members} ${b.members === 1 ? "member" : "members"} · Started ${formatDate(b.created_at, tz)}`}
                  </p>
                </div>
                {waiting ? <NewLinkButton id={b.invite_id!} band={b.name} /> : null}
              </li>
            );
          })}
        </ul>
      </ProfilePanel>
    </>
  );
}
