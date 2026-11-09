import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AcceptForm, JoinForms, OptOutButton } from "./join-forms";
import { PageLoader } from "@/components/metronome";
import { SignOutForm } from "@/components/sign-out-form";

// The token is the key: don't send it on to other sites.
export const metadata: Metadata = { title: "You're invited · Seeens", referrer: "no-referrer" };

// Where an invite link lands (#69): who invited you to which band, before
// any account step. Then join with the account you're signed in to, sign
// in, or make one. Works signed out.
export default function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-4 py-16">
      <Link href="/" className="logo self-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/seeens-logo.svg" alt="Seeens" width={75} height={18} />
      </Link>
      <Suspense fallback={<PageLoader />}>
        <Invite params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Invite({
  params,
  searchParams,
}: {
  params: PageProps<"/invite/[token]">["params"];
  searchParams: PageProps<"/invite/[token]">["searchParams"];
}) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  if (sp.stopped) {
    return (
      <Closed title="Got it.">
        Seeens won&rsquo;t email you again. If you change your mind, ask for an invite link instead.
      </Closed>
    );
  }
  const supabase = await createClient();
  const [{ data }, { data: auth }] = await Promise.all([
    /^[0-9a-f]{64}$/.test(token) ? supabase.rpc("invite_preview", { p_token: token }) : Promise.resolve({ data: null }),
    supabase.auth.getClaims(),
  ]);
  const inv = data?.[0];
  if (!inv)
    return (
      <Closed title="This invite link doesn't work.">Check that you copied all of it, or ask for a new one.</Closed>
    );
  if (inv.status === "used")
    return (
      <Closed title="This invite was already used.">
        If that was you,{" "}
        <Link href="/login" className="link">
          sign in
        </Link>
        . Otherwise, ask for a new one.
      </Closed>
    );
  if (inv.status === "revoked")
    return <Closed title="This invite was cancelled.">Ask {inv.invited_by} for a new one if you still want in.</Closed>;
  if (inv.status === "expired")
    return <Closed title="This invite ran out.">Invites work for 7 days. Ask {inv.invited_by} for a new one.</Closed>;

  const signedInEmail = typeof auth?.claims?.email === "string" ? auth.claims.email.toLowerCase() : null;
  const signedIn = Boolean(auth?.claims?.sub);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-4xl leading-[40px] font-bold tracking-[-0.04em] sm:text-5xl sm:leading-[48px]">
          {inv.invited_by} invited you to {inv.band} on Seeens
        </h1>
        <p className="max-w-2xl">
          Seeens is where {inv.band} keeps track of the people, venues, labels, and scenes it knows: who you&rsquo;ve
          played with, who books what, and what&rsquo;s next.
          {inv.role === "owner" ? " You'd join as an owner." : ""}
        </p>
        <p className="max-w-2xl text-sm text-muted">
          It&rsquo;s in beta, so you&rsquo;d be one of the first to use it. Things will change, and your feedback shapes
          what&rsquo;s next.
        </p>
      </header>

      <section aria-labelledby="join-heading" className="window flex w-full max-w-md flex-col">
        <h2
          id="join-heading"
          className="bg-inverse px-2 py-1 font-mono text-xs font-normal tracking-normal text-[var(--color-text-inverse)]"
        >
          Join {inv.band}
        </h2>
        <div className="flex flex-col gap-4 p-4">
          {signedIn && inv.email && signedInEmail !== inv.email ? (
            <div className="flex flex-col gap-3">
              <p>
                This invite is for <strong>{inv.email}</strong>, but you&rsquo;re signed in as {signedInEmail}. Sign
                out, and you&rsquo;ll come back here to join as {inv.email}.
              </p>
              <SignOutForm buttonClassName="button-secondary" next={`/invite/${token}`} />
            </div>
          ) : signedIn ? (
            <AcceptForm token={token} band={inv.band} email={signedInEmail} />
          ) : (
            <JoinForms token={token} band={inv.band} inviteEmail={inv.email} name={inv.name} />
          )}
        </div>
      </section>

      {inv.email ? <OptOutButton token={token} /> : null}
    </div>
  );
}

function Closed({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="display-l">{title}</h1>
      <p className="max-w-xl">{children}</p>
    </div>
  );
}
