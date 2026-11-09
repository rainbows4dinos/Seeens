import Link from "next/link";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { getConnection, toFormValues } from "@/lib/connections/queries";
import { listSceneOptions } from "@/lib/scenes/queries";
import { defaultSettings, readSettings } from "@/lib/photos/settings";
import { PhotoPanel } from "@/components/photo-panel";
import { QuickPlaceEdit } from "@/components/quick-edit";
import { linksPanelProps } from "@/lib/affiliations/rows";
import { SECTION_ORDER } from "@/lib/affiliations/options";
import { catalogNo, initials } from "@/lib/connections/card";
import { formatLocality, formatType } from "@/lib/connections/labels";
import { bookLine, gearLine, mapHref, readVenueDetails, venueLine } from "@/lib/connections/venue-details";
import { CHANNEL_LABELS, formatDay, todayISO } from "@/lib/outreach/labels";
import { photoUrl } from "@/lib/photos/urls";
import { DateLines } from "@/components/date-line";
import { NextActionPanel } from "@/components/next-action-panel";
import { NoWorkspace } from "@/components/no-workspace";
import { Photo } from "@/components/photo";
import { QuickStatus } from "@/components/quick-status";
import { LogOutreachButton, QuickLog, QuickViewHeading } from "@/components/quick-view-frame";
import type { ReactNode } from "react";

// The quick view's body and footer (#126): who this is, where things stand,
// the next plan, a few facts, and the last outreach. Status and plans change
// right here; anything else is on the profile, a click away on Edit Profile.
export async function QuickView({ params }: { params: Promise<{ id: string }> }) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const { id } = await params;
  const [detail, user] = await Promise.all([getConnection(id), getCurrentUser()]);
  const { connection: c, nextAction } = detail;
  // Your band's own listing: photo, town, and scenes change right here.
  const sceneOptions = detail.mine ? await listSceneOptions() : [];
  const today = todayISO(new Date(), membership.timeZone);
  const place = formatLocality(c.localities);
  const lastEntry = detail.outreach[0];

  return (
    <>
      <div className="quick-view-body">
        <header className="flex items-start gap-4">
          {detail.mine ? (
            <PhotoPanel
              key={c.id}
              connectionId={c.id}
              workspaceId={membership.workspaceId}
              name={c.name}
              photoUrl={photoUrl(c.photo_path, 320)}
              originalUrl={photoUrl(c.photo_original_path)}
              photoPath={c.photo_path}
              originalPath={c.photo_original_path}
              settings={readSettings(c.photo_settings)}
              alt={c.photo_alt}
              defaults={defaultSettings(c.status, c.is_us)}
            />
          ) : (
            <span className="quick-view-thumb" aria-hidden="true">
              <span className="row-thumb-initials">{initials(c.name)}</span>
              {c.photo_path ? <Photo src={photoUrl(c.photo_path, 320)!} alt="" decoding="async" /> : null}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <QuickViewHeading id={c.id}>{c.name}</QuickViewHeading>
            <p className="text-sm text-muted">{[formatType(c), place, catalogNo(c)].filter(Boolean).join(" · ")}</p>
            {detail.sharedBy ? <p className="text-sm">Shared by {detail.sharedBy}</p> : null}
            <DateLines lastOutreach={lastEntry} nextAction={nextAction} today={today} />
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

        {detail.mine ? (
          <QuickPlaceEdit key={c.id} connectionId={c.id} values={toFormValues(c)} scenes={sceneOptions} />
        ) : null}

        {/* Status, plans, and outreach are about other people, not us. */}
        {c.is_us ? null : (
          <>
            <QuickStatus
              id={c.id}
              initial={{ status: c.status, playedTogether: c.played_together }}
              type={{ kind: c.kind, group_type: c.group_type, person_roles: c.person_roles }}
            />
            <NextActionPanel
              connectionId={c.id}
              current={nextAction}
              members={detail.members}
              me={user.id}
              today={today}
            />
          </>
        )}

        <Facts detail={detail} place={place} />

        {c.is_us ? null : (
          <section className="flex flex-col gap-3" aria-labelledby="qv-outreach">
            <h3 id="qv-outreach" className="display-s">
              Last outreach
            </h3>
            <QuickLog connectionId={c.id} today={today} />
            {lastEntry ? (
              <div className="panel flex flex-col gap-1 p-3">
                <p className="text-sm">
                  <span className="font-semibold">{formatDay(lastEntry.occurred_on, today)}</span>
                  <span className="text-muted">
                    {" · "}
                    {[CHANNEL_LABELS[lastEntry.channel], lastEntry.author?.display_name].filter(Boolean).join(" · ")}
                  </span>
                </p>
                <p className="whitespace-pre-wrap">{lastEntry.summary}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">No outreach logged yet.</p>
            )}
          </section>
        )}
      </div>

      <div className="quick-view-footer">
        {/* A plain link: the profile loads as its own page, not in this panel. */}
        <a href={`/connections/${c.id}`} className="button-primary">
          {detail.mine ? "Edit Profile" : "Open Profile"}
          <span className="sr-only"> of {c.name}</span>
        </a>
        {c.is_us ? null : <LogOutreachButton connectionId={c.id} />}
      </div>
    </>
  );
}

type Detail = Awaited<ReturnType<typeof getConnection>>;

// A few facts, label then value: the venue's room and booking, who's linked
// (members, labels, who books it), how to reach them, and the start of the notes.
// recordOnly leaves out this band's own contacts and notes (another band's
// record page edits those below it, #185).
export function Facts({
  detail,
  place,
  recordOnly = false,
}: {
  detail: Detail;
  place: string | null;
  recordOnly?: boolean;
}) {
  const c = detail.connection;
  const rows: [string, ReactNode][] = [];

  if (c.kind === "group" && c.group_type === "venue") {
    const d = readVenueDetails(c.attributes);
    const room = venueLine(d);
    if (room) rows.push(["Room", room]);
    const gear = gearLine(d);
    if (gear) rows.push(["Has", gear]);
    if (d.address) {
      const map = mapHref(d.address, place);
      rows.push([
        "Address",
        map ? (
          <a href={map} className="link" target="_blank" rel="noreferrer">
            {d.address}
          </a>
        ) : (
          d.address
        ),
      ]);
    }
    const book = bookLine(d, { email: c.email, links: c.connection_links });
    if (book)
      rows.push([
        "Booking",
        <>
          {book.text}
          {book.contact ? (
            <>
              {" · "}
              <a href={book.href} className="link break-all">
                {book.contact}
              </a>
            </>
          ) : null}
        </>,
      ]);
  }

  // Linked connections, grouped like the Connections block, one per line so
  // a long lineup stays readable. Each name opens in this panel; former ones
  // are left out to keep it short.
  const { rows: links } = linksPanelProps(detail);
  const bySection = new Map<string, typeof links>();
  for (const l of links) {
    if (!l.isCurrent || l.otherArchived) continue;
    bySection.set(l.section, [...(bySection.get(l.section) ?? []), l]);
  }
  const order = (s: string) => (SECTION_ORDER.indexOf(s) + SECTION_ORDER.length + 1) % (SECTION_ORDER.length + 1);
  for (const [section, items] of [...bySection].sort(([a], [b]) => order(a) - order(b))) {
    rows.push([
      section,
      <ul key={section} className="flex flex-col">
        {items.map((l) => (
          <li key={l.id}>
            <Link href={`/connections/${l.otherId}`} replace className="link">
              {l.otherName}
            </Link>
            {l.role ? <span className="text-muted"> ({l.role})</span> : null}
          </li>
        ))}
      </ul>,
    ]);
  }

  if (c.connection_links.length)
    rows.push([
      "Links",
      c.connection_links.map((l, i) => (
        <span key={l.id}>
          {i ? ", " : null}
          <a href={l.url} className="link break-all" target="_blank" rel="noopener noreferrer">
            {l.label || l.url}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </span>
      )),
    ]);
  if (c.email && !recordOnly)
    rows.push([
      "Email",
      <a key="e" href={`mailto:${c.email}`} className="link break-all">
        {c.email}
      </a>,
    ]);
  if (c.phone && !recordOnly)
    rows.push([
      "Phone",
      <a key="p" href={`tel:${c.phone}`} className="link">
        {c.phone}
      </a>,
    ]);
  if (c.can_help_with.length) rows.push(["Can help with", c.can_help_with.join(", ")]);
  if (c.notes && !recordOnly)
    rows.push([
      "Notes",
      <span key="n" className="quick-view-notes">
        {c.notes}
      </span>,
    ]);

  if (!rows.length) return null;
  return (
    <dl className="quick-view-facts">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
