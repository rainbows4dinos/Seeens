import Link from "next/link";
import { Checkmark } from "@carbon/icons-react";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dismissGettingStarted } from "@/lib/onboarding/actions";
import { ProfilePanel } from "@/components/profile/panel";

// Getting Started (#68): what a new member does first, on My Network, until
// it's done or put away. Each step checks itself off. Per person, per band.

// A network this size has something to look at.
const NETWORK_GOAL = 5;

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
  const steps = [
    {
      done: p.listing_filled,
      title: `Fill in ${band}'s page`,
      body: "Add your town and a link or two (Bandcamp, Instagram), so other bands can find you.",
      // A full page load: a link to a listing would otherwise open the quick view.
      links: [
        {
          href: p.listing_id ? `/connections/${p.listing_id}` : "/add?us=1",
          label: "Open Your Band's Page",
          plain: true,
        },
      ],
    },
    {
      done: p.members > 1,
      title: "Invite your bandmates",
      body:
        p.members > 1
          ? `${p.members} of you are in ${band}.`
          : "From Band Settings, by email or with a link you send them.",
      links: [{ href: "/band", label: "Invite Bandmates" }],
    },
    {
      done: p.network >= NETWORK_GOAL,
      title: "Build your network",
      body: `The Full Directory already has bands, venues, and people other bands shared. Give the ones you know a status, like Homies or Want to play, and they show up here. Or add your own.${
        p.network ? ` ${p.network} so far.` : ""
      }`,
      links: [
        { href: "/directory", label: "Browse the Full Directory" },
        { href: "/add", label: "Add a Listing" },
        { href: "/import", label: "Import a Spreadsheet" },
      ],
    },
    {
      done: p.linked,
      title: "Find yourself",
      body: "Link your login to your person in the directory, so other bands see you use Seeens.",
      links: [{ href: "/account#account-you", label: "Find Yourself" }],
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <ProfilePanel
      id="getting-started"
      title="Getting Started"
      summary={`${doneCount} of ${steps.length} done`}
    >
      <div className="flex flex-col gap-5">
        <p className="text-muted">
          Welcome to {band} on Seeens. A few things to do first, in any order.
          They check themselves off.
        </p>
        <ol className="getting-started flex flex-col">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="flex gap-4 py-4"
              data-done={s.done ? "" : undefined}
            >
              <span className="getting-started-mark" aria-hidden="true">
                {s.done ? <Checkmark size={16} /> : i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="font-medium">
                  {s.title}
                  {s.done ? <span className="sr-only"> (done)</span> : null}
                </p>
                <p className="text-sm text-muted">{s.body}</p>
                {s.done ? null : (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {s.links.map((l, j) =>
                      "plain" in l ? (
                        <a
                          key={l.href}
                          href={l.href}
                          className={
                            j === 0 ? "button-primary" : "button-secondary"
                          }
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={
                            j === 0 ? "button-primary" : "button-secondary"
                          }
                        >
                          {l.label}
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <form action={dismissGettingStarted}>
          <button type="submit" className="button-secondary">
            Put This Away
          </button>
        </form>
      </div>
    </ProfilePanel>
  );
}
