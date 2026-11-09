import { catalogNo, initials } from "@/lib/connections/card";
import { directoryHrefFor } from "@/lib/connections/directory";
import {
  formatDate,
  formatLocality,
  formatType,
  historyLine,
  statusLabel,
} from "@/lib/connections/labels";
import type { ConnectionDetail } from "@/lib/connections/queries";
import { toFormValues } from "@/lib/connections/queries";
import { photoUrl } from "@/lib/photos/urls";
import { ArchiveControl } from "@/components/archive-control";
import { BackButton } from "@/components/back-button";
import { DateLines } from "@/components/date-line";
import { NextActionPanel } from "@/components/next-action-panel";
import { OutreachPanel } from "@/components/outreach-panel";
import { Photo } from "@/components/photo";
import {
  AutosaveForm,
  AutosaveProvider,
  SaveStatus,
} from "@/components/profile/autosave";
import {
  BandNoteFields,
  FormError,
  ModeratorFields,
} from "@/components/profile/fields";
import { KeepPrivate } from "@/components/keep-private";
import { ProfilePanel } from "@/components/profile/panel";
import { QuickStatus } from "@/components/quick-status";
import { Facts } from "@/components/quick-view";

// Another band's record (#185). The record itself is theirs: shown, not
// edited. What this band thinks and plans is its own, here as anywhere:
// status, played together, plans, outreach, notes, contacts, and archive.
// A moderator (#195) can also fix its details and keep it private. The band
// that claimed it (#68) can fix its details too: it's their listing.
export function SharedRecord({
  detail,
  band,
  me,
  today,
  tz,
  moderator = false,
  claim = null,
}: {
  detail: ConnectionDetail;
  band: string;
  me: string;
  today: string;
  tz: string;
  moderator?: boolean;
  claim?: { band: string; mine: boolean } | null;
}) {
  const ours = Boolean(claim?.mine);
  const canFix = moderator || ours;
  const { connection: c, nextAction, statusHistory } = detail;
  const place = formatLocality(c.localities);
  const archived = Boolean(c.archived_at);
  const values = toFormValues(c);

  return (
    <AutosaveProvider>
      <article className="page-measure flex flex-col gap-8">
        <BackButton
          href={directoryHrefFor(c.kind, c.group_type, archived)}
          name={{ text: c.name, headingId: "profile-name" }}
          end={
            moderator && !c.is_us ? (
              <KeepPrivate
                key={String(c.keep_private)}
                id={c.id}
                band={detail.sharedBy ?? "their band"}
                initial={c.keep_private}
              />
            ) : null
          }
        />

        {archived ? (
          <p className="window p-3 text-sm font-medium">
            Archived {formatDate(c.archived_at!, tz)}. Hidden from {band}
            &rsquo;s directory; everything below is kept.
          </p>
        ) : null}

        <header className="flex items-start gap-4">
          <span className="quick-view-thumb" aria-hidden="true">
            <span className="row-thumb-initials">{initials(c.name)}</span>
            {c.photo_path ? (
              <Photo
                src={photoUrl(c.photo_path, 320)!}
                alt=""
                decoding="async"
              />
            ) : null}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h1
                id="profile-name"
                className="min-w-0 display-l sm:display-xl break-words"
              >
                {c.name}
              </h1>
              <SaveStatus />
            </div>
            <p className="text-muted">
              {[formatType(c), place, catalogNo(c)].filter(Boolean).join(" · ")}
            </p>
            <DateLines
              lastOutreach={detail.outreach[0]}
              nextAction={nextAction}
              today={today}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {ours ? (
                <span className="tag font-semibold">This is us</span>
              ) : null}
              {claim && !ours ? <span className="tag">Uses Seeens</span> : null}
              <span className="tag">From {detail.sharedBy}</span>
            </div>
          </div>
        </header>

        <p className="text-sm text-muted">
          {ours
            ? `This is ${band}'s listing. ${detail.sharedBy} added it, and you keep its details up to date; changes are logged.`
            : moderator
              ? `${detail.sharedBy} shared this. As a moderator you can fix its details; your changes are logged.`
              : `${detail.sharedBy} shared this, so only they can change its details.`}{" "}
          Status, plans, outreach, notes, and contacts here are {band}&rsquo;s
          own. Nobody else sees them.
        </p>

        {/* Your own band: no status or outreach with yourself. */}
        {ours ? null : (
          <>
            <ProfilePanel
              id="shared-status"
              title="Status"
              summary={statusLabel(c.status, c)}
            >
              <div className="flex flex-col gap-2">
                <QuickStatus
                  id={c.id}
                  initial={{
                    status: c.status,
                    playedTogether: c.played_together,
                  }}
                  type={{
                    kind: c.kind,
                    group_type: c.group_type,
                    person_roles: c.person_roles,
                  }}
                />
                {statusHistory.length > 1 ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted">
                      Status history
                    </summary>
                    <ol className="flex flex-col gap-1 pt-2">
                      {statusHistory.map((h) => (
                        <li key={h.id}>
                          {historyLine(h, c)}
                          <span className="text-muted">
                            {" · "}
                            {[formatDate(h.changed_at, tz), h.by]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </div>
            </ProfilePanel>

            <ProfilePanel
              id="shared-activity"
              title="Activity"
              summary={nextAction ? nextAction.description : "Nothing planned"}
            >
              <div className="flex flex-col gap-6">
                <section
                  aria-labelledby="next-heading"
                  className="flex flex-col gap-2"
                >
                  <h2 id="next-heading" className="label text-muted">
                    Next action
                  </h2>
                  <NextActionPanel
                    connectionId={c.id}
                    current={nextAction}
                    members={detail.members}
                    me={me}
                    today={today}
                  />
                </section>
                <section
                  aria-labelledby="log-heading"
                  className="flex flex-col gap-2"
                >
                  <h2 id="log-heading" className="label text-muted">
                    Outreach log
                  </h2>
                  <OutreachPanel
                    connectionId={c.id}
                    entries={detail.outreach}
                    me={me}
                    today={today}
                  />
                </section>
              </div>
            </ProfilePanel>
          </>
        )}

        <ProfilePanel
          id="shared-details"
          title="Details"
          summary={`From ${detail.sharedBy}`}
        >
          {canFix ? (
            // Its shared details, saved to the record and logged (#195, #68).
            <AutosaveForm connectionId={c.id} className="flex flex-col gap-5">
              <ModeratorFields
                values={values}
                venue={c.kind === "group" && c.group_type === "venue"}
              />
              <FormError />
            </AutosaveForm>
          ) : (
            <>
              <Facts detail={detail} place={place} recordOnly />
              {!c.connection_links.length &&
              !c.can_help_with.length &&
              !(c.kind === "group" && c.group_type === "venue") ? (
                <p className="text-sm text-muted">No details yet.</p>
              ) : null}
            </>
          )}
        </ProfilePanel>

        <ProfilePanel
          id="shared-notes"
          title={`${band}'s Notes`}
          summary={c.notes ? c.notes.split("\n")[0] : null}
        >
          <AutosaveForm connectionId={c.id} className="flex flex-col gap-5">
            <BandNoteFields values={values} />
            <FormError />
          </AutosaveForm>
        </ProfilePanel>

        <footer className="flex flex-col gap-4 rule-top pt-6">
          <p className="text-sm text-muted">
            Shared by {detail.sharedBy}. Added {formatDate(c.created_at, tz)} ·
            Updated {formatDate(c.updated_at, tz)}
            {detail.moderatedAt
              ? ` · Last fixed by ${detail.moderatedBy ?? "a moderator"} ${formatDate(detail.moderatedAt, tz)}`
              : null}
          </p>
          <div className="flex flex-wrap items-start gap-3">
            <ArchiveControl id={c.id} name={c.name} archived={archived} />
          </div>
        </footer>
      </article>
    </AutosaveProvider>
  );
}
