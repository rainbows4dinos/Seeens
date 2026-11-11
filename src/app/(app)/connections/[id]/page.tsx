import Link from "next/link";
import { catalogNo } from "@/lib/connections/card";
import { Suspense } from "react";
import { getCurrentUser, getLinkedPeople, getMembership, isModerator } from "@/lib/auth/dal";
import { getListingClaim, isAppAdmin } from "@/lib/connections/claim";
import { InviteBandLink } from "@/components/invite-band-link";
import { keepPrivateLock } from "@/lib/connections/sharing";
import { todayISO } from "@/lib/outreach/labels";
import { NextActionPanel } from "@/components/next-action-panel";
import { BackButton } from "@/components/back-button";
import { AutosaveForm, AutosaveProvider, SaveStatus } from "@/components/profile/autosave";
import { ProfilePanel } from "@/components/profile/panel";
import { BasicInfoFields } from "@/components/profile/basic-info";
import { ContactFields, FormError, VenueDetailFields } from "@/components/profile/fields";
import { Field } from "@/components/form-field";
import { noAutofill } from "@/lib/no-autofill";
import { listSceneOptions } from "@/lib/scenes/queries";
import { OutreachPanel } from "@/components/outreach-panel";
import { DateLines } from "@/components/date-line";
import { getConnection, toFormValues } from "@/lib/connections/queries";
import { directoryHrefFor } from "@/lib/connections/directory";
import { loadPlayedOffer } from "@/lib/connections/played-together";
import { INSTRUMENTS, playsAll } from "@/lib/affiliations/instruments";
import { isStale, readVenueDetails, venueLine, venueTypeLabels } from "@/lib/connections/venue-details";
import { createClient } from "@/lib/supabase/server";
import { statusLabel, historyLine, formatDate, formatLocality, formatType } from "@/lib/connections/labels";
import { linksPanelProps } from "@/lib/affiliations/rows";
import { SECTION_ORDER } from "@/lib/affiliations/options";
import { ArchiveControl } from "@/components/archive-control";
import { KeepPrivate } from "@/components/keep-private";
import { SharedRecord } from "./shared-record";
import { MergeWith } from "@/components/merge-with";
import { MergedNotice, UnmergedNotice } from "@/components/merged-notice";
import { loadUndoableMerge, loadUndoneMerge } from "@/lib/connections/merge";
import { namesMatch } from "@/lib/connections/duplicates";
import { LinksPanel } from "@/components/links-panel";
import { NoWorkspace } from "@/components/no-workspace";
import { QuickStatus } from "@/components/quick-status";
import { PhotoPanel } from "@/components/photo-panel";
import { photoUrl } from "@/lib/photos/urls";
import { defaultSettings, readSettings } from "@/lib/photos/settings";
import { PageLoader } from "@/components/metronome";

export default function ConnectionPage({ params, searchParams }: PageProps<"/connections/[id]">) {
  return (
    <Suspense fallback={<PageLoader label="loading listing" />}>
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

  const [{ id }, { saved, offer, missed_photo, missed_links, merged, unmerged, mine }] = await Promise.all([
    params,
    searchParams,
  ]);
  const tz = membership.timeZone;
  const [detail, user, sceneOptions, lastMerge, undone, linkedPeople, moderator, claim, admin] = await Promise.all([
    getConnection(id),
    getCurrentUser(),
    listSceneOptions(),
    loadUndoableMerge(id, tz),
    typeof unmerged === "string" ? loadUndoneMerge(id, unmerged) : null,
    getLinkedPeople(),
    isModerator(),
    getListingClaim(id),
    isAppAdmin(),
  ]);
  const today = todayISO(new Date(), tz);
  // Another band's record (#185): theirs to change, ours to keep notes on.
  if (!detail.mine) {
    return (
      <SharedRecord
        detail={detail}
        band={membership.workspaceName}
        me={user.id}
        today={today}
        tz={tz}
        moderator={moderator}
        claim={claim}
        admin={admin}
        you={membership.connectionId === id}
      />
    );
  }
  const { ours, connection: c, nextAction, labelMates, sharedWithUs, isLabelMateWithUs, statusHistory } = detail;
  // A label we're on is "our label": from our band's label link, not a checkbox.
  const ourLabel = detail.affiliations.incoming.some((a) => a.kind === "on_label" && a.other?.is_us && a.is_current);
  const place = formatLocality(c.localities);
  const archived = Boolean(c.archived_at);
  // What they play, from their band roles, current and former (#140).
  const plays =
    c.kind === "person"
      ? playsAll(
          detail.affiliations.outgoing
            .filter((a) => a.kind === "member" && a.other)
            .map((a) => ({
              band: a.other!.name,
              role: a.role,
              current: a.is_current,
            })),
        )
      : [];
  // Just saved from the edit form with "played together" newly on (#124).
  const playedOffer =
    offer === "played" && c.played_together && !ours
      ? await loadPlayedOffer(await createClient(), membership.workspaceId, c.id)
      : null;

  // Who has a login (#44): you, a bandmate, or on the band's page, its members.
  const account = linkedPeople.get(c.id);
  const isYou = account?.userId === user.id;
  const usesSeeens = ours ? [...linkedPeople.keys()] : undefined;
  const values = toFormValues(c);
  const venue = c.kind === "group" && c.group_type === "venue";
  const band = c.kind === "group" && c.group_type === "band";
  const links = linksPanelProps(detail);
  const venueDetails = readVenueDetails(c.attributes);

  // One profile page that saves as you go (#126): who they are and where
  // things stand up top, then panels, each folding away to a one-line
  // summary. Status, plans, outreach, connections, and the photo save on
  // their own as before; the rest saves through AutosaveForm.
  return (
    // A merge or undo changes this one's fields from the server: start the
    // forms fresh rather than have them notice the change and save it back.
    <AutosaveProvider key={`${lastMerge?.id ?? ""}:${typeof unmerged === "string" ? unmerged : ""}`}>
      <article className="page-measure flex flex-col gap-8">
        <BackButton
          href={directoryHrefFor(c.kind, c.group_type, archived)}
          name={{ text: c.name, headingId: "profile-name" }}
          end={
            <>
              {admin && !claim ? <InviteBandLink connection={c} /> : null}
              {ours ? null : (
                <KeepPrivate
                  key={String(c.keep_private)}
                  id={c.id}
                  band={membership.workspaceName}
                  initial={c.keep_private}
                  // Groups: band owners; linked people: themselves (#195).
                  locked={keepPrivateLock(c, {
                    owner: membership.role === "owner",
                    moderator,
                    me: user.id,
                    linked: linkedPeople.get(c.id) ?? null,
                  })}
                />
              )}
            </>
          }
        />

        <p role="status" className="text-sm font-medium empty:hidden">
          {saved
            ? savedNote(missed_photo === "1", Number(missed_links) || 0)
            : mine && isYou
              ? "This is your page now. Bandmates can see you use Seeens."
              : ""}
        </p>

        {/* Just merged (#169): say what came in, with Undo. Later visits get a quiet line at the bottom. */}
        {undone ? <UnmergedNotice merged={undone} /> : null}
        {lastMerge && merged === "1" ? (
          <MergedNotice
            key={lastMerge.id}
            mergeId={lastMerge.id}
            keepName={c.name}
            merged={lastMerge.merged}
            until={lastMerge.until}
          />
        ) : null}

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
            photoUrl={photoUrl(c.photo_path, 320)}
            originalUrl={photoUrl(c.photo_original_path)}
            photoPath={c.photo_path}
            originalPath={c.photo_original_path}
            settings={readSettings(c.photo_settings)}
            alt={c.photo_alt}
            defaults={defaultSettings(c.status, ours)}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* The name, and how saving is going where Edit Profile used to be. */}
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h1 id="profile-name" className="min-w-0 display-l sm:display-xl break-words">
                {c.name}
              </h1>
              <SaveStatus />
            </div>
            <p className="text-muted">{[formatType(c), place, catalogNo(c)].filter(Boolean).join(" · ")}</p>
            {/* Where things stand in time: the latest outreach and the next plan. */}
            <DateLines lastOutreach={detail.outreach[0]} nextAction={nextAction} today={today} />
            <div className="flex flex-wrap gap-2 pt-1 empty:hidden">
              {ours ? <span className="tag font-semibold">This is us</span> : null}
              {isYou ? (
                <span className="tag font-semibold">This is you</span>
              ) : account ? (
                <span className="tag">Uses Seeens</span>
              ) : null}
              {claim?.joined && !claim.mine ? <span className="tag">Uses Seeens</span> : null}
              {isLabelMateWithUs ? <span className="tag">Label mate</span> : null}
              {ourLabel ? <span className="tag font-semibold">Our label</span> : null}
              {sharedWithUs.length ? (
                <span className="tag">Shares a member with us: {sharedWithUs.join(", ")}</span>
              ) : null}
            </div>
            {plays.length ? (
              <p className="text-sm">
                <span className="text-muted">Plays: </span>
                {plays.map((i, n) => (
                  <span key={i}>
                    {n ? ", " : null}
                    <Link href={`/?type=people&plays=${i}`} className="link">
                      {INSTRUMENTS[i]}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
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

        <ProfilePanel
          id="basic"
          title="Basic Info"
          summary={[formatType(c), place, ours ? null : statusLabel(c.status, c)].filter(Boolean).join(" · ")}
        >
          <AutosaveForm connectionId={c.id}>
            <BasicInfoFields values={values} scenes={sceneOptions} />
            <FormError />
          </AutosaveForm>
          {/* Status is how we relate to others; it doesn't apply to us. */}
          {ours ? null : (
            <div className="flex flex-col gap-2 pt-5">
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
                initialOffer={playedOffer}
              />
              {statusHistory.length > 1 ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted">Status history</summary>
                  <ol className="flex flex-col gap-1 pt-2">
                    {statusHistory.map((h, i) => (
                      <li key={h.id}>
                        {historyLine(h, c, i === statusHistory.length - 1 ? "Added as" : "Set to")}
                        <span className="text-muted">
                          {" · "}
                          {[formatDate(h.changed_at, tz), h.by].filter(Boolean).join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </div>
          )}
        </ProfilePanel>

        {venue ? (
          <ProfilePanel
            id="venue"
            title="Venue Details"
            summary={[venueTypeLabels(venueDetails).join(", "), venueLine(venueDetails)].filter(Boolean).join(" · ")}
          >
            <AutosaveForm connectionId={c.id}>
              <VenueDetailFields values={values.venue} />
              <FormError />
            </AutosaveForm>
            {isStale(venueDetails.checked_on, today) ? (
              <p className="pt-4 text-sm text-muted">
                Details checked {formatMonth(venueDetails.checked_on!, tz)}. Worth a look.
              </p>
            ) : null}
          </ProfilePanel>
        ) : null}

        {/* Plans and outreach are about other people, not us. */}
        {ours ? null : (
          <ProfilePanel
            id="activity"
            title="Activity"
            summary={nextAction ? nextAction.description : "Nothing planned"}
          >
            <div className="flex flex-col gap-6">
              <section aria-labelledby="next-heading" className="flex flex-col gap-2">
                <h2 id="next-heading" className="label text-muted">
                  Next action
                </h2>
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
              </section>
              <section aria-labelledby="log-heading" className="flex flex-col gap-2">
                <h2 id="log-heading" className="label text-muted">
                  Outreach log
                </h2>
                <OutreachPanel connectionId={c.id} entries={detail.outreach} me={user.id} today={today} />
              </section>
            </div>
          </ProfilePanel>
        )}

        <ProfilePanel
          id="connections"
          title={band ? "Members & Connections" : "Connections"}
          summary={connectionsSummary(links.rows) || "None yet"}
        >
          <div className="flex flex-col gap-6">
            <LinksPanel {...links} heading={false} usesSeeens={usesSeeens} />
            {band && labelMates.length ? (
              <section aria-labelledby="mates-heading" className="flex flex-col gap-1">
                <h2 id="mates-heading" className="label text-muted">
                  Label mates
                </h2>
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
              </section>
            ) : null}
          </div>
        </ProfilePanel>

        <ProfilePanel
          id="contact"
          title="Contact & Links"
          summary={[c.email ?? "No email", c.connection_links.map((l) => l.label || "Link").join(", ") || null]
            .filter(Boolean)
            .join(" · ")}
        >
          <AutosaveForm connectionId={c.id} className="flex flex-col gap-5">
            <ContactFields values={values} />
            <FormError />
          </AutosaveForm>
        </ProfilePanel>

        <ProfilePanel id="notes" title="Notes" summary={c.notes ? c.notes.split("\n")[0] : null}>
          <AutosaveForm connectionId={c.id} className="flex flex-col gap-5">
            <Field
              id="p-can_help_with"
              label="Can Help With"
              hint="Separate with commas, like: music videos, DJ sets, gear."
            >
              <input
                {...noAutofill}
                id="p-can_help_with"
                name="can_help_with"
                defaultValue={values.canHelpWith}
                className="field"
                aria-describedby="p-can_help_with-hint"
              />
            </Field>
            <Field id="p-notes" label="Notes">
              <textarea
                {...noAutofill}
                id="p-notes"
                name="notes"
                rows={5}
                maxLength={10000}
                defaultValue={values.notes}
                className="field"
              />
            </Field>
            <FormError />
          </AutosaveForm>
        </ProfilePanel>

        <footer className="flex flex-col gap-4 rule-top pt-6">
          <p className="text-sm text-muted">
            Added {formatDate(c.created_at, tz)} · Updated {formatDate(c.updated_at, tz)}
            {detail.moderatedAt
              ? ` · Last fixed by ${detail.moderatedBy ?? "a moderator"} ${formatDate(detail.moderatedAt, tz)}`
              : null}
          </p>
          {lastMerge && merged !== "1" ? (
            <MergedNotice
              key={lastMerge.id}
              mergeId={lastMerge.id}
              keepName={c.name}
              merged={lastMerge.merged}
              until={lastMerge.until}
              quiet
            />
          ) : null}
          <div className="flex flex-wrap items-start gap-3">
            <MergeWith id={c.id} name={c.name} options={mergeOptions(c, detail.candidates)} />
            <ArchiveControl id={c.id} name={c.name} archived={archived} />
          </div>
        </footer>
      </article>
    </AutosaveProvider>
  );
}

// Others to merge with, those with a matching name first (#169).
function mergeOptions(
  c: { name: string },
  candidates: {
    id: string;
    name: string;
    kind: string;
    group_type: string | null;
    person_roles: string[];
    catalog: string;
  }[],
) {
  const matches = (name: string) => namesMatch(c.name, name);
  return [...candidates]
    .sort((a, b) => Number(matches(b.name)) - Number(matches(a.name)))
    .map((o) => ({ value: o.id, label: o.name, hint: o.catalog }));
}

// "Members (2) · Labels (1)": what's linked, for a folded Connections panel.
function connectionsSummary(rows: { section: string; isCurrent: boolean }[]) {
  const counts = new Map<string, number>();
  for (const r of rows) if (r.isCurrent) counts.set(r.section, (counts.get(r.section) ?? 0) + 1);
  return SECTION_ORDER.filter((s) => counts.has(s))
    .map((s) => `${s} (${counts.get(s)})`)
    .join(" · ");
}

function formatMonth(day: string, tz: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: tz,
  });
}

// After Add: say if the photo or any links didn't make it, so they can be added here.
function savedNote(missedPhoto: boolean, missedLinks: number) {
  const missed = [
    missedPhoto ? "the photo" : null,
    missedLinks ? `${missedLinks} ${missedLinks === 1 ? "link" : "links"}` : null,
  ].filter(Boolean);
  return missed.length ? `Saved, but couldn't add ${missed.join(" or ")}. Add them again below.` : "Saved.";
}
