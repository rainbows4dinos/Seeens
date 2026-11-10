import Link from "next/link";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dismissGettingStarted } from "@/lib/onboarding/actions";
import { ProfilePanel } from "@/components/profile/panel";
import { SuggestedBands } from "@/components/suggested-bands";
import { GettingStartedSteps, type Step } from "@/components/getting-started-steps";

// Getting Started (#68): what a new member does first, on My Network, until
// it's done or put away. Each step checks itself off. Per person, per band.

// A network this size has something to look at.
const NETWORK_GOAL = 3;

type Progress = {
  dismissed: boolean;
  listing_id: string | null;
  listing_filled: boolean;
  members: number;
  network: number;
  linked: boolean;
};

// An app admin can preview it as a brand-new band sees it, at
// /?preview=getting-started: nothing done, and nothing picked there saves.
export async function GettingStarted({ preview: asked = false }: { preview?: boolean }) {
  const membership = await getMembership();
  if (!membership) return null;
  const supabase = await createClient();
  const preview = asked && Boolean((await supabase.rpc("is_app_admin")).data);
  const { data } = await supabase.rpc("getting_started", {
    p_workspace_id: membership.workspaceId,
  });
  const saved = data as Progress | null;
  if (!saved) return null;
  const p: Progress = preview
    ? { ...saved, dismissed: false, listing_filled: false, members: 1, network: 0, linked: false }
    : saved;
  if (p.dismissed) return null;

  const band = membership.workspaceName;
  const { data: suggested } = await supabase.rpc("suggested_bands", {
    p_workspace_id: membership.workspaceId,
    p_preview: preview,
  });
  const left = Math.max(0, NETWORK_GOAL - p.network);
  // In the order that pays off first: a network to look at, then your page,
  // you, and your bandmates.
  const steps: Step[] = [
    {
      done: p.network >= NETWORK_GOAL,
      title: suggested?.length ? "Start with bands you might know" : `Add ${NETWORK_GOAL} to your network`,
      body: suggested?.length
        ? `Give ${left === NETWORK_GOAL ? NETWORK_GOAL : `${left} more`} a status, like Homies or Want to play. They become your network.`
        : "The Full Directory has bands, venues, and people other bands shared. Give the ones you know a status, like Homies or Want to play. They become your network.",
      progress: p.network ? `${Math.min(p.network, NETWORK_GOAL)} of ${NETWORK_GOAL}` : null,
      extra: suggested?.length ? <SuggestedBands bands={suggested.slice(0, 4)} preview={preview} /> : null,
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
  if (steps.every((s) => s.done)) return null;

  return (
    <ProfilePanel
      id="getting-started"
      title="Getting Started"
      summary={`${steps.filter((s) => s.done).length} of ${steps.length} done`}
    >
      <GettingStartedSteps
        welcome={`Welcome to ${band}! Seeens is a shared map of the bands, venues, and people in your scene.`}
        note={preview ? "Admin preview: what a new band sees. Nothing you pick here saves." : null}
        steps={steps}
        putAway={
          preview ? (
            <Link href="/" className="action-link link text-sm text-muted">
              Close Preview
            </Link>
          ) : (
            <form action={dismissGettingStarted}>
              <button type="submit" className="action-link link text-sm text-muted">
                Put This Away
              </button>
            </form>
          )
        }
      />
    </ProfilePanel>
  );
}
