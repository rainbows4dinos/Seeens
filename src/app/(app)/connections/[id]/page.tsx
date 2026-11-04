import Link from "next/link";
import { catalogNo } from "@/lib/connections/card";
import { Suspense } from "react";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { todayISO } from "@/lib/outreach/labels";
import { NextActionPanel } from "@/components/next-action-panel";
import { OutreachPanel } from "@/components/outreach-panel";
import { DateLines } from "@/components/date-line";
import { getConnection } from "@/lib/connections/queries";
import { directoryHrefFor } from "@/lib/connections/directory";
import { loadPlayedOffer } from "@/lib/connections/played-together";
import { createClient } from "@/lib/supabase/server";
import {
  STATUS_LABELS,
  formatDate,
  formatLocality,
  formatType,
} from "@/lib/connections/labels";
import { linksPanelProps } from "@/lib/affiliations/rows";
import { ArchiveControl } from "@/components/archive-control";
import { LinksPanel } from "@/components/links-panel";
import { NoWorkspace } from "@/components/no-workspace";
import { QuickStatus } from "@/components/quick-status";
import { PhotoPanel } from "@/components/photo-panel";
import { signPhotos } from "@/lib/photos/urls";
import { defaultSettings, readSettings } from "@/lib/photos/settings";

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

  const [{ id }, { saved, offer }] = await Promise.all([params, searchParams]);
  const [detail, user] = await Promise.all([getConnection(id), getCurrentUser()]);
  const tz = membership.timeZone;
  const today = todayISO(new Date(), tz);
  const { connection: c, nextAction, labelMates, sharedWithUs, isLabelMateWithUs, statusHistory } = detail;
  const place = formatLocality(c.localities);
  const archived = Boolean(c.archived_at);
  const photos = await signPhotos([c.photo_path, c.photo_original_path]);
  // Just saved from the edit form with "played together" newly on (#124).
  const playedOffer =
    offer === "played" && c.played_together && !c.is_us
      ? await loadPlayedOffer(await createClient(), membership.workspaceId, c.id)
      : null;

  return (
    <article className="page-measure flex flex-col gap-8">
      <Link href={directoryHrefFor(c.kind, c.group_type, archived)} className="link text-sm text-muted">
        Back to directory
      </Link>

      <p role="status" className="text-sm font-medium empty:hidden">
        {saved ? "Saved." : ""}
      </p>

      {archived ? (
        <p className="window p-3 text-sm font-medium">
          Archived {formatDate(c.archived_at!, tz)}. Hidden from the directory; everything below is kept.
        </p>
      ) : null}

      <header className="flex items-start gap-4">
        <PhotoPanel
          connectionId={c.id}
          workspaceId={membership.workspaceId}
          name={c.name}
          photoUrl={c.photo_path ? (photos.get(c.photo_path) ?? null) : null}
          originalUrl={c.photo_original_path ? (photos.get(c.photo_original_path) ?? null) : null}
          photoPath={c.photo_path}
          originalPath={c.photo_original_path}
          settings={readSettings(c.photo_settings)}
          alt={c.photo_alt}
          defaults={defaultSettings(c.status, c.is_us)}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* Same layout as the Directory and Scenes headers: action on the right. */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="min-w-0 display-l sm:display-xl break-words">{c.name}</h1>
            <Link href={`/connections/${c.id}/edit`} className="button-primary">
              Edit<span className="sr-only"> {c.name}</span>
            </Link>
          </div>
          <p className="text-muted">
            {[formatType(c), place, catalogNo(c)].filter(Boolean).join(" · ")}
          </p>
          {/* Where things stand in time: the latest outreach and the next plan.
              Details are in Next action and Outreach log below. */}
          <DateLines lastOutreach={detail.outreach[0]} nextAction={nextAction} today={today} />
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
        </div>
      </header>

      {/* Status, plans, and outreach are about other people, not us. */}
      {c.is_us ? null : (
      <>
      <Section title="Where things stand">
        <QuickStatus
          id={c.id}
          initial={{ status: c.status, playedTogether: c.played_together }}
          initialOffer={playedOffer}
        />
        {statusHistory.length > 1 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Status history</summary>
            <ol className="flex flex-col gap-1 pt-2">
              {statusHistory.map((h) => (
                <li key={h.id}>
                  {h.from_status ? `${STATUS_LABELS[h.from_status]} to ${STATUS_LABELS[h.to_status]}` : `Added as ${STATUS_LABELS[h.to_status]}`}
                  <span className="text-muted">
                    {" · "}
                    {[formatDate(h.changed_at, tz), h.by].filter(Boolean).join(" · ")}
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
                    {p.closed_at ? ` ${formatDate(p.closed_at, tz)}` : ""}
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

      <LinksPanel {...linksPanelProps(detail)} />

      {c.group_type === "band" && labelMates.length ? (
        <Section title="Label mates">
          <ul className="flex flex-col gap-1">
            {labelMates.map((m) => (
              <li key={m.id}>
                <Link href={`/connections/${m.id}`} className="link">
                  {m.name}
                </Link>
                {m.is_us ? <span className="text-muted"> (us)</span> : null}
                {m.catalog ? <span className="text-xs text-muted whitespace-nowrap"> {m.catalog}</span> : null}
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
          Added {formatDate(c.created_at, tz)} · Updated {formatDate(c.updated_at, tz)}
        </p>
        <ArchiveControl id={c.id} name={c.name} archived={archived} />
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="display-s">{title}</h2>
      {children}
    </section>
  );
}
