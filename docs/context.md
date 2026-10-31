# Seeens product context

## Current direction

Seeens is a private shared network directory for Merwulf. The October 27, 2026 restart supersedes the earlier public scene-discovery concept. See [../README.md](../README.md) for release scope and schedule.

The core questions are: Who do we know in this scene? Who are our Homies, and who do we keep saying "let's play" with? Who could we connect with next, and why? What did we last do, and who will follow up?

## Working data model

- **Workspace:** the Merwulf network; one workspace at launch.
- **Membership:** an authenticated user's access to that workspace. Joining requires authorization; signing up alone must not grant access.
- **Connection:** either a **person** or a **group**, with profile links, optional contact details, notes, and timestamps.
  - A person can do several things at once: musician, DJ, promoter, booker, manager, label owner, producer, recording engineer, live sound engineer, photographer, videographer, artist/designer, writer, radio host, other.
  - A group is exactly one thing: band, venue, label, recording studio, production studio, radio station, press (zine, blog, mag), promoter or collective, other.
- **Locality:** a verified town from the shared GeoNames place list (towns with 1,000+ people, with coordinates). Each workspace has at most one locality per town. Keep locality distinct from genre/community tags. Scenes and macro-scenes (for example Pacific Northwest) are Seeens' own records that group localities; GeoNames supplies the places, not the scenes.
- **Scene:** a local music community. A connection can belong to multiple scenes.
- **Affiliation:** a link between two connections in the same workspace, with a kind, an optional role or detail (for example "vocals, guitar"), a current/former status, and optional notes. Kinds: **member** (person plays in a band), **works with** (person books for, runs, or works at a venue, label, studio, and so on), **on label** (band is on a label), **related** (side project, split release, sister venue), and **other**. A band's members are its incoming member links.
- **Us:** one group per workspace can be marked as the band itself ("This is our band"). Seeens uses it to show label mates (bands on a label with us) and bands that share a member with us.
- **Can help with:** free-form skills or services on a person (for example music videos, DJ sets, gear, screen printing), so members can find who to ask for a need, not only who plays where.
- **Status:** one band-wide choice per connection, set in a single tap:
  - **Homies:** the ultimate band-to-band relationship. Love playing together, love each other's music, love hanging out, support each other, top tour-mate candidates.
  - **Let's play:** mutual "we should play together," not booked yet. The booking backlog of agreed admiration and opportunity.
  - **Prospect:** we'd like to connect; not mutual yet.
  - **Neutral:** we know of them, no particular plans. The default.
  - **Avoid:** the honest "nope" (cold shoulder, or played once and that was enough). Kept, not archived, and can change.
  Status is not inherited through affiliations. Changes are logged.
- **Played together:** a separate fact, what has already happened, versus how the band feels and what's next. Distinguishes warm leads from cold ones when planning a town.
- **Outreach entry:** dated history with channel, notes, and author, linked to a connection.
- **Next action:** current planned step, optional follow-up date, and responsible member. No priority; the date is enough.

Status, notes, and outreach are the band's candid, private judgments. They stay workspace-owned and must never be shared outside the workspace, even if connection identity is shared across bands later.

Keep data entry light. Adding a connection should take seconds: name, type, where they're based, and status. Everything else is optional and tucked away. Prefer quick selections over free-text fields, which rarely get filled in.

These are conceptual entities, not a finalized database schema. Give private records a workspace ownership path so Supabase policies can enforce membership across related data. Preserve history when changing a connection's current status or next action. Archive connections rather than casually removing their history.

## Scene connections

Scenes run on overlapping people: one musician might play in several bands and cover bands, DJ, and help other bands make videos through their day job. Capturing those links is core to the product, not an extra. For the MVP, show affiliations as linked lists on detail pages (a person's bands and roles; a band's members), so clicking through records traverses the network. Former affiliations stay visible because past lineups are part of how a scene connects. A graph visualization can be built later on the same data and remains outside this release.

## Prospect discovery

Start with band members adding relevant prospects and links, recording why they are a fit. Treat notes as member knowledge rather than verified industry facts. Future automated suggestions will need sources and freshness context; they are outside this release.

## Decisions and assumptions

Confirmed: Seeens name, shared Merwulf access, scenes/localities, Homies, Vercel hosting, and Supabase backend.

Decided while building the MVP:

- **Stack:** Next.js App Router with TypeScript and Tailwind. Server actions and one route handler (`/api/export`) are the only server code. Supabase does auth and Postgres, and row-level security enforces membership on every private table.
- **Access:** members are added by hand in Supabase (see the README). Signing up grants nothing, and public sign-ups stay off. A member is removed by deleting their `workspace_members` row. They keep their login but see "No workspace yet."
- **Concurrent edits:** last save wins on a connection's fields. The edit form saves all of its fields together. Outreach entries, status history, and earlier next actions are separate records, so they're never overwritten.
- **Deleting:** connections are archived, not deleted. An outreach entry can be removed only by its author, to fix mistakes. Replaced, done, and dropped next actions are kept.
- **Visual tokens:** these live in the Seeens Figma file and are mirrored in `src/app/globals.css` (see [design-system/rules.md](design-system/rules.md)).

Working assumptions: Homies are band-wide, prospects are manually curated, and the launch serves one workspace.

## History

The earlier concept is preserved in [archive/bandpath-context.md](archive/bandpath-context.md). Its public browsing, artist claims, and AI enrichment directions are superseded for this MVP. Vercel hosting and Supabase are retained in the current plan.
