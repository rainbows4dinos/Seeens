import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, getMembership, getLinkedPeople, getUsConnection } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/connections/labels";
import { ProfilePanel } from "@/components/profile/panel";
import { YourPage } from "@/components/your-page";
import {
  DeleteAccountForm,
  DisplayNameField,
  EmailForm,
  LeaveBand,
  PasswordForm,
  SignOutOthersForm,
} from "@/components/account-forms";

export const metadata: Metadata = { title: "Account Settings · Seeens" };

// Your account (#67): you, across every band you're in. Only you see it.
// Bands are shared; they get their own settings with invites (#69).
export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <div className="page-measure flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="display-l">Account Settings</h1>
          <p className="text-sm text-muted">Your name saves as you go</p>
        </div>
        <p className="text-muted">Your login, across every band you&rsquo;re in. Only you see this page.</p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Account searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const NOTES: Record<string, string> = {
  email: "Your email is changed.",
  password: "Your new password is set.",
  left: "You left the band.",
};

async function Account({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const [user, membership, params] = await Promise.all([getCurrentUser(), getMembership(), searchParams]);
  const supabase = await createClient();
  const { data: bands } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, created_at, display_name, workspaces ( name )")
    .eq("user_id", user.id)
    .order("created_at");
  const { data: counts } = await supabase.from("workspace_members").select("workspace_id, user_id, role");
  const members = (id: string) => (counts ?? []).filter((m) => m.workspace_id === id).length;
  const tz = membership?.timeZone ?? "America/Los_Angeles";
  const you = membership ? await loadYourPage(membership.workspaceId, membership.connectionId) : null;
  const note = Object.keys(NOTES).find((k) => params[k]);
  const name = bands?.[0]?.display_name ?? membership?.displayName ?? "";
  // Bands that would be left without an owner. The database checks again.
  const soleOwnerOf = (bands ?? [])
    .filter(
      (b) =>
        b.role === "owner" &&
        !(counts ?? []).some((m) => m.workspace_id === b.workspace_id && m.role === "owner" && m.user_id !== user.id),
    )
    .map((b) => b.workspaces?.name ?? "Your band");

  return (
    <>
      {note ? (
        <p role="status" className="window p-3 text-sm font-medium">
          {note === "email" && user.email ? `Your email is now ${user.email}.` : NOTES[note]}
        </p>
      ) : null}

      {bands?.length ? (
        <ProfilePanel id="account-you" title="You" summary={name}>
          <DisplayNameField initial={name} />
          {membership && you ? (
            <YourPage
              linked={you.linked}
              people={you.people}
              band={membership.workspaceName}
              hasBandPage={you.hasBandPage}
            />
          ) : null}
        </ProfilePanel>
      ) : null}

      <ProfilePanel id="account-email" title="Email" summary={user.email}>
        <EmailForm current={user.email ?? ""} />
      </ProfilePanel>

      <ProfilePanel id="account-password" title="Password">
        <PasswordForm email={user.email ?? ""} />
      </ProfilePanel>

      <ProfilePanel id="account-devices" title="Devices">
        <SignOutOthersForm />
      </ProfilePanel>

      <ProfilePanel
        id="account-bands"
        title="Your Bands"
        summary={bands?.map((b) => b.workspaces?.name).filter(Boolean).join(", ")}
      >
        {bands?.length ? (
          <ul className="rows flex flex-col">
            {bands.map((b) => {
              const band = b.workspaces?.name ?? "Your band";
              const n = members(b.workspace_id);
              return (
                <li key={b.workspace_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-medium">{band}</p>
                    <p className="text-sm text-muted">
                      {b.role === "owner" ? "Owner" : "Member"} · since {formatDate(b.created_at, tz)} · {n}{" "}
                      {n === 1 ? "member" : "members"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {b.workspace_id === membership?.workspaceId ? (
                      <Link href="/band" className="button-secondary">
                        Band Settings<span className="sr-only"> for {band}</span>
                      </Link>
                    ) : null}
                    <LeaveBand workspaceId={b.workspace_id} name={band} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">You&rsquo;re not in a band yet. Ask a bandmate to invite you.</p>
        )}
      </ProfilePanel>

      <ProfilePanel id="account-delete" title="Delete Account">
        <DeleteAccountForm email={user.email ?? ""} blockedBy={soleOwnerOf} />
      </ProfilePanel>
    </>
  );
}

// Your person in the band's directory, and the people you could be (#44):
// those not linked to anyone yet, your band's members first.
async function loadYourPage(workspaceId: string, connectionId: string | null) {
  const supabase = await createClient();
  const [us, linkedPeople] = await Promise.all([getUsConnection(), getLinkedPeople()]);
  if (connectionId) {
    const { data } = await supabase.from("connections").select("id, name").eq("id", connectionId).maybeSingle();
    return { linked: data ? { id: data.id, name: data.name } : null, people: [], hasBandPage: Boolean(us) };
  }
  const [{ data: people }, { data: ours }] = await Promise.all([
    supabase
      .from("connections")
      .select("id, name, band:connection_band_details!inner ( archived_at )")
      .eq("workspace_id", workspaceId)
      .eq("kind", "person")
      .is("merged_into", null)
      .is("band.archived_at", null)
      .order("name")
      .limit(2000),
    us
      ? supabase.from("affiliations").select("from_connection_id").eq("to_connection_id", us.id).eq("kind", "member")
      : Promise.resolve({ data: [] as { from_connection_id: string }[] }),
  ]);
  const inBand = new Set((ours ?? []).map((a) => a.from_connection_id));
  const options = (people ?? [])
    .filter((p) => !linkedPeople.has(p.id))
    .map((p) => ({ value: p.id, label: p.name, hint: inBand.has(p.id) ? "In the band" : undefined }))
    .sort((a, b) => Number(Boolean(b.hint)) - Number(Boolean(a.hint)));
  return { linked: null, people: options, hasBandPage: Boolean(us) };
}
