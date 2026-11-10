import Link from "next/link";
import { Checkmark } from "@carbon/icons-react";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dismissGettingStarted } from "@/lib/onboarding/actions";
import { ProfilePanel } from "@/components/profile/panel";
import { SuggestedBands } from "@/components/suggested-bands";

// Getting Started (#68): what a new member does first, on My Network, until
// it's done or put away. Each step checks itself off. Per person, per band.

// A network this size has something to look at.
const NETWORK_GOAL = 3;

type Step = {
  done: boolean;
  title: string;
  body: string;
  progress?: string | null;
  extra?: React.ReactNode;
  links: { href: string; label: string; plain?: boolean }[];
};

type Progress = {
  dismissed: boolean;
  listing_id: string | null;
  listing_filled: boolean;
  members: number;
  network: number;
  linked: boolean;
};

export async function GettingStarted() {
  const membership = await getMembership();
  if (!membership) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("getting_started", {
    p_workspace_id: membership.workspaceId,
  });
  const p = data as Progress | null;
  if (!p || p.dismissed) return null;

  const band = membership.workspaceName;
  const { data: suggested } = await supabase.rpc("suggested_bands", { p_workspace_id: membership.workspaceId });
  const left = Math.max(0, NETWORK_GOAL - p.network);
  // In the order that pays off first: a network to look at, then your page,
  // you, and your bandmates.
  const steps: Step[] = [
    {
      done: p.network >= NETWORK_GOAL,
      title: suggested?.length ? "Start with bands you might know" : `Add ${NETWORK_GOAL} to your network`,
      body: suggested?.length
        ? `Give ${left === NETWORK_GOAL ? NETWORK_GOAL : `${left} more`} a status, like Homies or Want to play. They become your network, below.`
        : "The Full Directory has bands, venues, and people other bands shared. Give the ones you know a status, like Homies or Want to play. They become your network, below.",
      progress: p.network ? `${Math.min(p.network, NETWORK_GOAL)} of ${NETWORK_GOAL}` : null,
      extra: suggested?.length ? <SuggestedBands bands={suggested} /> : null,
      links: [
        {
          href: "/directory",
          label: suggested?.length ? "Find More in the Full Directory" : "Browse the Full Directory",
        },
        { href: "/add", label: "Add Your Own" },
      ],
    },
    {
      done: p.listing_filled,
      title: "Fill in your band's page",
      body: "Add your town and a link or two (Bandcamp, Instagram), so other bands can find you.",
      links: [
        {
          href: p.listing_id ? `/connections/${p.listing_id}` : "/add?us=1",
          label: "Open Your Band's Page",
          plain: true,
        },
      ],
    },
    {
      done: p.linked,
      title: "Find yourself",
      body: "You might already be in the directory. Link your login to your person, so other bands see you use Seeens.",
      links: [{ href: "/account#account-you", label: "Find Yourself" }],
    },
    {
      done: p.members > 1,
      title: "Invite your bandmates",
      body:
        p.members > 1
          ? `${p.members} of you are in ${band}.`
          : "From Band Settings, by email or with a link you send them.",
      links: [{ href: "/band#band-invite", label: "Invite Bandmates" }],
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const current = steps.findIndex((s) => !s.done);

  return (
    <ProfilePanel id="getting-started" title="Getting Started" summary={`${doneCount} of ${steps.length} done`}>
      <div className="flex flex-col gap-4">
        <p className="text-muted">
          Welcome to {band}! Seeens is a shared map of the bands, venues, and people in your scene. Start here, one step
          at a time.
        </p>
        {/* One step open at a time (the browser closes the others). The first
            one not done starts open; tap any other to look ahead. */}
        <div className="getting-started flex flex-col">
          {steps.map((s, i) => (
            <details key={s.title} name="getting-started" open={i === current} data-done={s.done ? "" : undefined}>
              <summary className="flex items-center gap-4 py-3">
                <span className="getting-started-mark" aria-hidden="true">
                  {s.done ? <Checkmark size={16} /> : i + 1}
                </span>
                <span className="getting-started-title flex-1 font-medium">
                  {s.title}
                  {s.done ? <span className="sr-only"> (done)</span> : null}
                </span>
                <span className="text-sm text-muted">{s.done ? "Done" : i === current ? s.progress : null}</span>
              </summary>
              <div className="flex flex-col gap-3 pb-4 sm:pl-11">
                <p className="text-sm text-muted">{s.body}</p>
                {s.done ? null : (
                  <>
                    {s.extra}
                    <div className="flex flex-wrap gap-3 pt-1">
                      {s.links.map((l, j) => {
                        const cls = j === 0 && !s.extra ? "button-primary" : "button-secondary";
                        return l.plain ? (
                          <a key={l.href} href={l.href} className={cls}>
                            {l.label}
                          </a>
                        ) : (
                          <Link key={l.href} href={l.href} className={cls}>
                            {l.label}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
        <form action={dismissGettingStarted}>
          <button type="submit" className="button-secondary">
            Put This Away
          </button>
        </form>
      </div>
    </ProfilePanel>
  );
}
