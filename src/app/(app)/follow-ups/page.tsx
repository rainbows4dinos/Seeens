import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDay, todayISO } from "@/lib/outreach/labels";
import { NoWorkspace } from "@/components/no-workspace";

export const metadata: Metadata = { title: "Follow-ups · Seeens" };

export default function FollowUpsPage({ searchParams }: PageProps<"/follow-ups">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold sm:text-[52px] sm:leading-[52px]">Follow-ups</h1>
      <Suspense fallback={<p className="text-muted">Loading follow-ups…</p>}>
        <FollowUps searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FollowUps({ searchParams }: { searchParams: PageProps<"/follow-ups">["searchParams"] }) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const who = typeof params.who === "string" ? params.who : "";

  const supabase = await createClient();
  const [actions, members] = await Promise.all([
    supabase
      .from("next_actions")
      .select(
        "id, description, due_on, assignee_id, assignee:workspace_members!next_actions_workspace_id_assignee_id_fkey ( display_name ), connection:connections!next_actions_workspace_id_connection_id_fkey ( id, name, archived_at )",
      )
      .eq("status", "open")
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase.from("workspace_members").select("user_id, display_name").order("display_name"),
  ]);
  if (actions.error || members.error) throw new Error("Couldn't load follow-ups.");

  const today = todayISO();
  const open = actions.data.filter((a) => a.connection && !a.connection.archived_at);
  const shown = open.filter((a) => (who === "" ? true : who === "anyone" ? !a.assignee_id : a.assignee_id === who));
  const dated = shown.filter((a) => a.due_on);
  const undated = shown.filter((a) => !a.due_on);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">
        Every connection&rsquo;s next step, by date. Dates are just plans; move them whenever you like.
      </p>

      <form action="/follow-ups" method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="fu-who" className="text-sm font-medium">
            Who&rsquo;s on it
          </label>
          <select id="fu-who" name="who" defaultValue={who} className="field">
            <option value="">Everyone</option>
            {members.data.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
                {m.user_id === user.id ? " (you)" : ""}
              </option>
            ))}
            <option value="anyone">Not assigned</option>
          </select>
        </div>
        <button type="submit" className="button-secondary">
          Show
        </button>
      </form>

      {open.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border border-dashed border-strong bg-surface p-6">
          <p className="font-medium">Nothing planned.</p>
          <p className="text-muted">Plan a next step from any connection&rsquo;s page and it shows up here.</p>
          <Link href="/" className="button-secondary">
            Go to the directory
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border border-dashed border-strong bg-surface p-6">
          <p className="font-medium">Nothing planned for them.</p>
          <Link href="/follow-ups" className="button-secondary">
            Show everyone
          </Link>
        </div>
      ) : (
        <>
          {dated.length ? <ActionList title="With a date" actions={dated} today={today} /> : null}
          {undated.length ? <ActionList title="No date yet" actions={undated} today={today} /> : null}
        </>
      )}
    </div>
  );
}

type Action = {
  id: string;
  description: string;
  due_on: string | null;
  assignee: { display_name: string } | null;
  connection: { id: string; name: string } | null;
};

function ActionList({ title, actions, today }: { title: string; actions: Action[]; today: string }) {
  const id = `fu-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="label text-muted">
        {title}
      </h2>
      <ul className="panel rows flex flex-col">
        {actions.map((a) => (
          <li key={a.id}>
            <Link
              href={`/connections/${a.connection!.id}`}
              className="flex flex-col gap-1 px-3 py-3 row-link sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <span className="flex flex-col">
                <span className="font-display text-xl leading-6 font-semibold tracking-[-0.03em] break-words">{a.connection!.name}</span>
                <span>{a.description}</span>
              </span>
              <span className="flex flex-wrap gap-x-3 text-sm text-muted sm:justify-end">
                <span>{a.assignee?.display_name ?? "Anyone"}</span>
                {a.due_on ? <span>planned for {formatDay(a.due_on, today)}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
