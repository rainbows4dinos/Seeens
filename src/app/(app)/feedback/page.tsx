import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/connections/labels";
import { appVersion } from "@/lib/feedback/version";
import { cleanPath, isKind, kindLabel, statusLabel } from "@/lib/feedback/labels";
import { ProfilePanel } from "@/components/profile/panel";
import { NoWorkspace } from "@/components/no-workspace";
import { FeedbackForm } from "./feedback-form";
import { PageLoader } from "@/components/metronome";

export const metadata: Metadata = { title: "Send Feedback · Seeens" };

// Beta feedback (#71). Private: it goes to the people building Seeens, and
// they decide what, if anything, becomes a public issue.
export default function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  return (
    <div className="page-measure flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="caption">Beta</p>
        <h1 className="display-l">Send Feedback</h1>
        <p className="text-muted">
          Seeens is in beta, and you&rsquo;re testing it. Anything helps: what broke, what confused you, what you wish
          it did. It goes straight to the people building Seeens, not anywhere public.
        </p>
      </div>
      <Suspense fallback={<PageLoader />}>
        <Feedback searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Feedback({ searchParams }: { searchParams: PageProps<"/feedback">["searchParams"] }) {
  const [user, membership, sp] = await Promise.all([getCurrentUser(), getMembership(), searchParams]);
  if (!membership) return <NoWorkspace />;
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("feedback")
    .select("id, kind, body, status, github_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const kind = one(sp.kind);
  const digest = one(sp.digest)?.slice(0, 100) ?? null;

  return (
    <>
      <ProfilePanel id="feedback-send" title="Send Feedback">
        <FeedbackForm
          userId={user.id}
          from={membership.displayName}
          band={membership.workspaceName}
          path={cleanPath(one(sp.from))}
          version={appVersion()}
          digest={digest}
          initialKind={isKind(kind) ? kind : null}
        />
      </ProfilePanel>

      <ProfilePanel id="feedback-mine" title={`What You've Sent (${mine?.length ?? 0})`}>
        {mine?.length ? (
          <ul className="rows flex flex-col">
            {mine.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 py-3">
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="tag">{statusLabel(f.status)}</span>
                  {kindLabel(f.kind)} · {formatDate(f.created_at, membership.timeZone)}
                  {f.github_url ? (
                    <a href={f.github_url} className="link" target="_blank" rel="noopener noreferrer">
                      On GitHub
                    </a>
                  ) : null}
                </p>
                <p className="line-clamp-3 break-words whitespace-pre-line">{f.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nothing yet. What you send shows up here, with where it&rsquo;s at.</p>
        )}
      </ProfilePanel>
    </>
  );
}
