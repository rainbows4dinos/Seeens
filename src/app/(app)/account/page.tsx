import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/connections/labels";
import { ProfilePanel } from "@/components/profile/panel";
import { DisplayNameField, EmailForm, LeaveBand, PasswordForm, SignOutOthersForm } from "@/components/account-forms";

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
  const { data: counts } = await supabase.from("workspace_members").select("workspace_id");
  const members = (id: string) => (counts ?? []).filter((m) => m.workspace_id === id).length;
  const tz = membership?.timeZone ?? "America/Los_Angeles";
  const note = Object.keys(NOTES).find((k) => params[k]);
  const name = bands?.[0]?.display_name ?? membership?.displayName ?? "";

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
    </>
  );
}
