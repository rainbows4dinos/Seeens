import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { todayISO } from "@/lib/outreach/labels";
import { NextActionPanel } from "@/components/next-action-panel";
import { OutreachPanel } from "@/components/outreach-panel";
import { getConnection, type ConnectionDetail } from "@/lib/connections/queries";
import {
  STATUS_LABELS,
  formatDate,
  formatLocality,
  formatType,
} from "@/lib/connections/labels";
import { addOptionsFor, sectionFor } from "@/lib/affiliations/options";
import { ArchiveControl } from "@/components/archive-control";
import { LinksPanel, type LinkRow } from "@/components/links-panel";
import { NoWorkspace } from "@/components/no-workspace";
import { QuickStatus } from "@/components/quick-status";

export default function ConnectionPage({ params, searchParams }: PageProps<"/connections/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Connection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Connection({
  params,
  searchParams,
}: {
  params: PageProps<"/connections/[id]">["params"];
  searchParams: PageProps<"/connections/[id]">["searchParams"];
}) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;

  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [detail, user] = await Promise.all([getConnection(id), getCurrentUser()]);
  const today = todayISO();
  const { connection: c, nextAction, labelMates, sharedWithUs, isLabelMateWithUs, statusHistory } = detail;
  const rows = linkRows(c, detail.affiliations);
  const place = formatLocality(c.localities);
  const archived = Boolean(c.archived_at);

  return (
    <article className="flex flex-col gap-8">
      <Link href={archived ? "/?view=archived" : "/"} className="link text-sm text-muted">
        Back to directory
      </Link>

      <p role="status" className="text-sm font-medium empty:hidden">
        {saved ? "Saved." : ""}
      </p>

      {archived ? (
        <p className="window p-3 text-sm font-medium">
          Archived {formatDate(c.archived_at!)}. Hidden from the directory; everything below is kept.
        </p>
      ) : null}

      <header className="flex flex-col gap-2">
        <div className="pb-2">
          <Link href={`/connections/${c.id}/edit`} className="button-primary">
            Edit<span className="sr-only"> {c.name}</span>
          </Link>
        </div>
        <h1 className="text-4xl font-bold sm:text-[52px] sm:leading-[52px] break-words">{c.name}</h1>
        <p className="text-muted">
          {[formatType(c), place].filter(Boolean).join(" · ")}
        </p>
        <div className="flex flex-wrap gap-2 pt-1 empty:hidden">
          {c.is_us ? <span className="tag font-semibold">This is us</span> : null}
          {isLabelMateWithUs ? <span className="tag">Label mate</span> : null}
          {sharedWithUs.length ? (
            <span className="tag">Shares a member with us: {sharedWithUs.join(", ")}</span>
          ) : null}
        </div>
        {c.scenes.length ? (
          <p className="text-sm">
            <span className="text-muted">Scenes: </span>
            {c.scenes.map((s, i) => (
              <span key={s.id}>
                {i ? ", " : null}
                <Link href={`/?scene=${s.id}`} className="link">
                  {s.name}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </header>

      {/* Status, plans, and outreach are about other people, not us. */}
      {c.is_us ? null : (
      <>
      <Section title="Where things stand">
        <QuickStatus id={c.id} initial={{ status: c.status, playedTogether: c.played_together }} />
        {statusHistory.length > 1 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Status history</summary>
            <ol className="flex flex-col gap-1 pt-2">
              {statusHistory.map((h) => (
                <li key={h.id}>
                  {h.from_status ? `${STATUS_LABELS[h.from_status]} to ${STATUS_LABELS[h.to_status]}` : `Added as ${STATUS_LABELS[h.to_status]}`}
                  <span className="text-muted">
                    {" · "}
                    {[formatDate(h.changed_at), h.by].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </Section>

      <Section title="Next action">
        <NextActionPanel
          connectionId={c.id}
          current={nextAction}
          members={detail.members}
          me={user.id}
          today={today}
        />
        {detail.pastPlans.length ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Earlier plans</summary>
            <ul className="flex flex-col gap-1 pt-2">
              {detail.pastPlans.map((p) => (
                <li key={p.id}>
                  {p.description}
                  <span className="text-muted">
                    {" · "}
                    {p.status === "done" ? "done" : "dropped"}
                    {p.closed_at ? ` ${formatDate(p.closed_at)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Section>

      <Section title="Outreach log">
        <OutreachPanel connectionId={c.id} entries={detail.outreach} me={user.id} today={today} />
      </Section>
      </>
      )}

      <LinksPanel
        subjectId={c.id}
        rows={rows}
        options={addOptionsFor(c)}
        candidates={detail.candidates}
      />

      {c.group_type === "band" && labelMates.length ? (
        <Section title="Label mates">
          <ul className="flex flex-col gap-1">
            {labelMates.map((m) => (
              <li key={m.id}>
                <Link href={`/connections/${m.id}`} className="link">
                  {m.name}
                </Link>
                {m.is_us ? <span className="text-muted"> (us)</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {c.can_help_with.length ? (
        <Section title="Can help with">
          <ul className="flex flex-wrap gap-2">
            {c.can_help_with.map((s) => (
              <li key={s} className="tag">
                {s}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Contact and links">
        {c.email || c.phone || c.connection_links.length ? (
          <ul className="flex flex-col gap-2">
            {c.email ? (
              <li>
                <a href={`mailto:${c.email}`} className="link break-all">
                  {c.email}
                </a>
              </li>
            ) : null}
            {c.phone ? (
              <li>
                <a href={`tel:${c.phone}`} className="link">
                  {c.phone}
                </a>
              </li>
            ) : null}
            {c.connection_links.map((l) => (
              <li key={l.id}>
                <a href={l.url} className="link break-all" target="_blank" rel="noopener noreferrer">
                  {l.label || l.url}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No contact info or links yet.</p>
        )}
      </Section>

      {c.notes ? (
        <Section title="Notes">
          <p className="whitespace-pre-wrap">{c.notes}</p>
        </Section>
      ) : null}

      <footer className="flex flex-col gap-4 rule-top pt-6">
        <p className="text-sm text-muted">
          Added {formatDate(c.created_at)} · Updated {formatDate(c.updated_at)}
        </p>
        <ArchiveControl id={c.id} name={c.name} archived={archived} />
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl leading-6 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function linkRows(
  subject: ConnectionDetail["connection"],
  affiliations: ConnectionDetail["affiliations"],
): LinkRow[] {
  const make = (
    a: ConnectionDetail["affiliations"]["outgoing"][number],
    direction: "out" | "in",
  ): LinkRow | null =>
    a.other
      ? {
          id: a.id,
          section: sectionFor(subject, { kind: a.kind, direction }),
          otherId: a.other.id,
          otherName: a.other.is_us ? `${a.other.name} (us)` : a.other.name,
          otherArchived: Boolean(a.other.archived_at),
          role: a.role,
          isCurrent: a.is_current,
          notes: a.notes,
        }
      : null;
  return [
    ...affiliations.outgoing.map((a) => make(a, "out")),
    ...affiliations.incoming.map((a) => make(a, "in")),
  ].filter((r): r is LinkRow => r !== null);
}
