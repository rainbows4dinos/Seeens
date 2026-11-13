# Seeens

**Your people. Your scenes.**

Seeens helps bands keep track of their music networks and decide whom to reach out to next. Each band gets a private workspace shared by its members, organized around local scenes and real relationships.

Seeens is in closed alpha at [www.seeens.com](https://www.seeens.com). Merwulf is the first band using it.

Formerly Artist Pathway / BandPath / Seeen. The project restarted on October 27, 2026 with a smaller, personal MVP.

![Home: Merwulf's header, Up Next, then Homies and Let's play as rows of photocopied prints](docs/screenshots/home.png)

## Screenshots

All data shown is fictional sample data from `supabase/seed.sql`. The photos are AI-generated (made-up people and places), in `supabase/seed-photos`, and the screenshot script adds them through the app's photo copier.

To regenerate them, run `npm run db:reset` and `npm run dev`, then `npm run screenshots` (first time: `npx playwright install chromium`).

|                                                                                                                                                                                                                                                                                                 |                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Sign-in page with the "Your people. Your scenes." headline](docs/screenshots/login.png)                                                                                                                                                                                                       | ![A band's profile: Basic Info, Activity, Members & Connections, Contact & Links, and Notes panels](docs/screenshots/connection.png)            |
| **Sign in.** Invite-only.                                                                                                                                                                                                                                                                       | **A connection.** One page in panels that saves as you go: who they are, the next step and what's happened, who's connected, how to reach them. |
| ![Everyone marked Let's play](docs/screenshots/lets-play.png)                                                                                                                                                                                                                                   | ![Scenes nested under Pacific Northwest](docs/screenshots/scenes.png)                                                                           |
| **Let's play.** The booking backlog: All, filtered to Let's play, and by town or scene if you like.                                                                                                                                                                                             | **Scenes.** Local scenes inside bigger ones, like the Pacific Northwest.                                                                        |
| ![The Directory: type tabs, then everyone grouped by status, as photocopied snapshots](docs/screenshots/directory.png)                                                                                                                                                                          | ![The directory on a phone](docs/screenshots/mobile-directory.png)                                                                              |
| **The Directory.** Every band's shared listings beside your own, grouped by your status, Avoid at the very end.                                                                                                                                                                                 | **On a phone.** The same app, built for the merch table.                                                                                        |
| ![Follow-ups grouped by date](docs/screenshots/follow-ups.png)                                                                                                                                                                                                                                  |                                                                                                                                                 |
| **Follow-ups.** Every next step, with dates as plain facts and no overdue alarms. The first few are Up Next on Home.                                                                                                                                                                            |                                                                                                                                                 |
| ![The directory with The Tin Hollows open in the quick view panel beside it](docs/screenshots/quick-view.png)                                                                                                                                                                                   | ![The Lantern Room's quick view as a sheet on a phone](docs/screenshots/mobile-quick-view.png)                                                  |
| **Quick view.** Click a row and the connection opens beside the list: change status, handle the next step, log outreach. On your band's own listings, change the photo, town, and scenes there too. Previous and Next (or J and K) step through the list; 1 to 6 set the status; Esc closes it. | **Quick view on a phone.** The same panel as a sheet under the header.                                                                          |
| ![Band Settings: band name, members with roles, the invite form, and a pending invite](docs/screenshots/band-settings.png)                                                                                                                                                                      | ![An invite: "Alex invited you to Merwulf on Seeens" with a form to make an account and join](docs/screenshots/invite.png)                      |
| **Band Settings.** Everyone in the band, and invites by email or link. Owners manage roles.                                                                                                                                                                                                     | **An invite.** Who invited you, to which band, and that Seeens is in beta. Make an account or sign in, and you're in.                           |
| ![Send Feedback: kind, what happened, an optional screenshot, and what's sent with it](docs/screenshots/feedback.png)                                                                                                                                                                           | ![What You Share: people kept private, bands shared, with Keep Private on each](docs/screenshots/sharing.png)                                   |
| **Send Feedback.** From anywhere in the app. It's private: it goes to an inbox only app admins see, who decide what becomes a public issue.                                                                                                                                                     | **What You Share.** Choose what other bands see and what stays yours. People start private; everything else starts shared.                      |
| ![The Brine Hall, shared by Moth Signal, with Merwulf's own status, plans, and notes on it](docs/screenshots/shared-record.png)                                                                                                                                                                 | ![The Directory's Venues tab: venues from every band, with Moth Signal's under No Status](docs/screenshots/full-directory.png)                  |
| **Another band's record.** Only the band that shared it, or a moderator (shown here), can change its details. Your status, plans, outreach, notes, and contacts on it are your band's own.                                                                                                      | **Venues from every band.** What you haven't sorted sits under No Status.                                                                       |

## MVP

- **Listings:** bands, promoters, venues, DJs, playlisters, and other people or organizations in the directory. "Listing" is the word on screen; the code and database say `connections`. "Connections" on screen means the links between listings (who plays in a band, who books a venue).
- **Scenes:** organize listings by locality and scene, with multiple memberships when useful. Scenes named with a town or its nickname (LA Punk, PDX Garage, Sactown Hardcore) find their town and go inside that town's scene; older ones get suggestions to confirm on the Scenes page. Town Nicknames lists the nicknames (moderators keep it), and town search knows them too.
- **Home and the Directory:** Home (`/`) is your band's own page: its header (photo, town, scenes), Getting Started for new members, Up Next (the first few follow-ups), your Homies and Let's play as rows of prints, what other bands added near you, and, once Getting Started is done, bands you might know. Sections with nothing in them don't show. The Directory (`/directory`) is every record every band shares, yours included, grouped by your status with Avoid at the very end. Old Network links open the Directory with the same filters. Anything you haven't given a status sits under No Status, and the status filter can show just those.
- **Status:** one band-wide choice per connection, in words that fit its type: Homies, Let's play, Want to play, Heard of, or Avoid for bands, or no status yet; Favorite, Let's book, and Want to book for venues; Homie, Let's collab, and Want to collab for people. Plus whether you've played together (or played here, been booked, been covered, and so on). To set it on many at once, click listings' photos (or Cmd-click, Shift-click a range, or long-press on a phone), then use the bar at the bottom: Set Status (1 to 6 in its menu), Played Together, and Undo. Your own band's listing is skipped.
- **Affiliations:** links between connections, such as who plays in which bands, who books which venue, or who works where, shown on each connection's detail page.
- **Venue details:** type of space (any that apply: club, concert hall, amphitheater, dive bar, nice bar, brewery, restaurant, coffee shop, record store, music store, house shows, underground, art space, community space, outdoor), address, ages, capacity, PA, sound engineer, backline, how to book (pointing at the venue's email or links), accessibility, and special terms. DIY or licensed follows from the type; art spaces, community spaces and parks get a DIY checkbox. Blank means not sure. Venue rows show the types as tags and "All ages · 50–150 cap · DIY", the Venues tab filters by ages, capacity, and space (DIY, licensed, or one type), and details checked more than six months ago say so. Imports guess a type from words like "basement" or "brewery", shown in the preview before anything is saved.
- **What people play:** read from their band roles ("vocals, guitar"), current and former, on the person's page and in the People list, with a Plays filter. Someone who's only Heard of, or has no status, shows under the closest status of a band they're in, marked "via" that band; their own status wins, and an Avoid band never pulls them into Avoid.
- **By type:** the directory has a tab for Bands, People, Venues, and Labels & more, plus All, each with its count. Status is a filter: everyone (Avoid last), or one status, like Want to play (who you'd like to know) or Let's play (the booking backlog).
- **Photos:** one photo per connection, run through the copier (a xerox look you tune: lighter/darker, contrast, toner grit, an ink plate, and its offset) before it's saved. Location data is stripped in the browser, and photos stay in private storage.
- **Follow-through:** log outreach and keep one next action per connection, with a responsible member and an optional follow-up date. Follow-ups lists every open next action; the first few are Up Next on Home.
- **Shared access:** authorized band members can work with the same private data across devices.
- **Portability:** export the directory to CSV, and import a spreadsheet of bands, venues, or people. The import guesses each column, matches towns, and shows every row before saving. Rows already in the directory only get their blanks filled: a Catalog No. column (from an export) picks the exact record, otherwise the name does, and a link the record already has, or a second Instagram or Bandcamp, isn't added again. Anything unreadable or marked with a ? goes into notes, not a field, venue bookers become Booked By links, and a band's Members column links its members.
- **Where Seeens Stands on AI:** `/ai` is public: no AI in the app today, the ten rules if that ever changes, and what runs where (nothing yet). Linked from About, the FAQ's AI answer, and the footer.
- **Sign-in preview:** from 1024px wide, the sign-in page shows a slow drift of real cards beside the form: shared bands and venues with photos, shuffled hourly (`preview_cards()`, open to visitors). Name, type, town, scenes, and photo only, never people or anything from a band's own layer. Keep Private takes a listing off it. Photos come through `/api/preview-photos/[id]`, which checks the listing first.
- **About and Help:** `/about` is public, for people who just got an invite (linked from Sign In and the footer): the shared directory, your band's own layer, Keep Private, statuses, roles, and who's behind it. Help (account menu) has the statuses, a glossary, keyboard shortcuts (the quick view and selecting several), then the FAQ. The copy lives in the About and Help doc. About has a spot for one screenshot (`SCREENSHOT` in `src/app/about/page.tsx`): real data, shared parts only.
- **What's New:** `/changelog` is public too: what changed, newest first, written by hand in `content/changelog.md` as part of shipping. Signed-in members see a What's New mark in the header (a dot on the phone menu button) until they open it; it's remembered per account, and new accounts start caught up. `/roadmap` (public) shows Now, Next, and Later from `content/roadmap.md`, with no dates.
- **Duplicates:** a "possible duplicates" link lists connections with matching names, and Merge with… on a profile picks any others. The merge review puts them side by side: the one you keep wins, the rest fill its blanks, and their links, scenes, connections, outreach, and plans move over. A merge can be undone for 30 days.

Search by name and filter by status, scene (a bigger scene includes the scenes inside it), town, and what people play, or open the archived ones from the count line. Who you're eyeing is picked by hand; automated discovery is deferred.

## Architecture

| Layer          | Direction                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend       | Next.js (App Router)                                                                                                                   |
| Language       | TypeScript                                                                                                                             |
| Styling        | Tailwind CSS                                                                                                                           |
| Hosting        | Vercel                                                                                                                                 |
| Database       | Supabase Postgres                                                                                                                      |
| Authentication | Supabase Auth                                                                                                                          |
| Authorization  | Workspace membership enforced through Row Level Security                                                                               |
| Fonts          | Hanken Grotesk and IBM Plex Mono, self-hosted with Fontsource                                                                          |
| CI             | GitHub Actions: lint, formatting, typecheck, unit tests, a production build, and the pgTAP database tests on every PR and push to main |

Design tokens live in `src/app/globals.css` and mirror the [Seeens Figma file](https://www.figma.com/design/QKSF4MTanGHlnbNvmUKDX0/Seeens?node-id=9-2). See the [design system rules](docs/design-system/rules.md).

Vercel hosts the application. Contact details, notes, and outreach history live in Supabase and are accessible only to authorized members. Browser configuration may contain the Supabase project URL and publishable key; privileged secrets belong outside the frontend and repository.

Configure Supabase authentication redirects for production, approved preview environments, and local development. Keep environment configuration explicit for each deployment environment. Choose server-side functionality only where the MVP needs it.

## Delivery target

Live MVP: **launched November 1, 2026**, ahead of the November 10–17 target.

1. **October 27–November 1 (done):** fields and scene structure, sign-in, membership policies, directory and editor, scenes and filters, statuses, prospects, outreach history, follow-ups, export, mobile layouts, and phase 1 design tokens. Deployed on Vercel.
2. **November 1 (done):** verified collaboration and data access with two members, fixed workflow issues, and launched ([#13](https://github.com/rainbows4dinos/seeens/issues/13)).

Launch means two authorized band members can update the same records across devices, unauthorized users cannot read or change them, and the core add → organize → set status → follow up workflow works on mobile and desktop. CSV export must work. Launch is tracked in [#13](https://github.com/rainbows4dinos/seeens/issues/13).

## Scope boundaries

Automated scraping, automatic messaging, social integrations, and multi-band customer support stay out of scope. Seeens can suggest (scene links, carry-overs), but a person always decides: nothing is linked, messaged, or published on its own.

## Roadmap

Priorities live on the issues (`priority: now`, `next`, `later`); this is the order.

1. **Now, the directory for daily use:** type-specific fields like venue capacity and ages ([#48](https://github.com/rainbows4dinos/seeens/issues/48)); zone the connection and edit pages (Figma, [#126](https://github.com/rainbows4dinos/seeens/issues/126)).
2. **Then, scene intelligence:** town, scene, and genre ([#125](https://github.com/rainbows4dinos/seeens/issues/125), with [#21](https://github.com/rainbows4dinos/seeens/issues/21)): town as the host scene, sub-scenes as communities, genre as self-description, and suggested meta-scenes across towns for touring and labels.
3. **Growth, so suggestions can see past one band:** accounts and you versus the band ([#67](https://github.com/rainbows4dinos/seeens/issues/67), [#44](https://github.com/rainbows4dinos/seeens/issues/44)), invites ([#68](https://github.com/rainbows4dinos/seeens/issues/68)), and claimed listings ([#45](https://github.com/rainbows4dinos/seeens/issues/45), [#70](https://github.com/rainbows4dinos/seeens/issues/70)).
4. **Ongoing polish:** phase 2 design ([#58](https://github.com/rainbows4dinos/seeens/issues/58)); Boards ([#49](https://github.com/rainbows4dinos/seeens/issues/49)) once scenes settle.
5. **Later:** aliases and solo projects ([#29](https://github.com/rainbows4dinos/seeens/issues/29)), band-set focus ([#23](https://github.com/rainbows4dinos/seeens/issues/23)), show check-ins ([#26](https://github.com/rainbows4dinos/seeens/issues/26)), and public pages and feedback ([#71](https://github.com/rainbows4dinos/seeens/issues/71)–[#73](https://github.com/rainbows4dinos/seeens/issues/73)).

## Development status

The MVP launched on November 1, 2026. What it does:

- Email/password sign-in, with access limited to workspace members. Account Settings for your name, email, password, signing out other devices, and leaving a band; forgot password from Sign In.
- Directory: add, edit, view, and archive connections; tabs by type (Bands, People, Venues, Labels & more, All); search, status, scene, town, plays, ages, and capacity filters; archived ones are a link under the bar.
- Scenes, including scenes inside bigger ones, and town search from GeoNames.
- Status and "we've played together," saved as soon as you change them. Marking a band offers to mark its current members too (and a person, their bands); new members can take the band's town, scenes, and played together.
- Affiliations between connections (members, bookers, labels, related bands, venues), with quick instrument picks when adding a member.
- Venue details, and who books each room (a person or a promoter).
- What people play, from their band roles, and "via" status for people you've only heard of.
- Outreach log, next actions, and the Follow-ups page.
- Connection photos through the copier, shown on cards, list rows, and the connection page.
- CSV export, and spreadsheet import with a review step.
- Merging duplicates, with undo for 30 days.
- Error and not-found pages, and phase 1 design tokens from Figma.

Database schema, Row Level Security, and access tests are in `supabase/`. What's next is in the Roadmap above.

## Local setup

Requires Node 20.9+; `npm test` needs 22.6+ for Node's built-in TypeScript support. CI uses Node 22. Docker is needed only for local Supabase.

```bash
npm install
cp .env.example .env.local   # add the Supabase URL and publishable key
npm run dev                  # http://localhost:3000
```

| Script                         | Purpose                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                  | Dev server                                                                                                    |
| `npm run build`                | Production build                                                                                              |
| `npm run lint`                 | ESLint                                                                                                        |
| `npm run format`               | Prettier, 120 characters (`format:check` is what CI runs). Editors with Prettier format on save the same way. |
| `npm run typecheck`            | Route types + TypeScript                                                                                      |
| `npm test`                     | Unit tests (CSV export round-trip, paging past 1,000 rows)                                                    |
| `npm run db:start` / `db:stop` | Local Supabase via the CLI (Docker)                                                                           |
| `npm run db:migration <name>`  | New versioned migration in `supabase/migrations/`                                                             |
| `npm run db:reset`             | Rebuild local DB from migrations                                                                              |
| `npm run db:test`              | Run database access tests (`supabase/tests/`); CI runs them on every pull request too                         |
| `npm run db:types`             | Regenerate `src/lib/supabase/database.types.ts`                                                               |

Local Supabase loads fictional seed data from `supabase/seed.sql`. Sign in as `alex@example.com` or `sam@example.com` (members of Merwulf; Alex is also an app admin, for the feedback inbox), `robin@example.com` (Moth Signal, a second band, so the shared directory has another side), or `dana@example.com` (not a member), all with password `password123`.

## Database

The schema lives in `supabase/migrations/`. Every private table carries a `workspace_id`, and Row Level Security only lets members of that workspace read or write it. What a band keeps to itself about a record (status, played together, notes, email, phone, and whether it archived it) lives in `connection_band_details`, one row per band and record, apart from the record itself. That's the groundwork for a directory every band shares (#181). Each record also says whether its band keeps it private (`keep_private`): people start private, everything else shared, and a band reviews this in Band Settings > What You Share or on each record. Catalog numbers (BND-0042) come from one series for every band, so no two records share one. The directory lists every band's shared records alongside your own, each with your band's own layer (status, notes, contacts, plans, outreach, archive). Only the band that added a record can change it; another band's record opens read-only, marked with who shared it. Scenes and connections between records stay per band for now. Signing in does not grant access; a member has to invite you.

History is kept, not overwritten: connections are archived instead of deleted (merged duplicates are hidden for 30 days, then deleted, with everything they held moved to the one kept), status changes are logged, replacing a next action closes the old one (`set_next_action`), and outreach entries can only be changed by their author.

Saves that touch several tables run as one database function, so they either fully land or change nothing: `save_connection` (the connection, its town, links, and scenes) and `create_linked_connection` (adding someone new as a member, label, or related band).

### Pushing to the hosted project

Migrations apply to production automatically: the Migrate workflow (`.github/workflows/migrate.yml`) runs `supabase db push` whenever a change to `supabase/migrations/` lands on main. It needs the `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, and `SUPABASE_DB_PASSWORD` repository secrets. Vercel deploys the same push in parallel, so a migration the new code depends on can lag the deploy by a minute.

To push by hand (pull main first, or the CLI only sees the migrations on your machine):

```bash
git pull
npx supabase login
npx supabase link --project-ref <project-id>
npx supabase db push --linked
```

### Inviting bands and members

Seeens is invite only. App admins invite each band from **Invite Bands** in the account menu (`/admin/bands`), or with the **Invite to Seeens** button on any band listing nobody has claimed yet: pick the band's listing in the directory, or type its name if nobody's added it yet, and add its first owner's email. The owner gets an invite (emailed when email is set up, otherwise a link to send yourself), makes their account on the invite page, and their band claims the listing. A claimed listing shows "Uses Seeens"; the band that added it keeps its own notes and history on it, and the claimed band's members can fix its details (name, town, links, what they can help with), logged as theirs. It stays shared. Bands still waiting on their owner show on the Bands page, with a Refresh Link button if the first one runs out. New members get **Getting Started** at the top of Home, one step at a time: start with bands you might know (bands that already have yours in their network, then shared bands in your town, each with a status to pick right there; 3 in the network checks it off), fill in the band's page, find yourself, and invite bandmates. Each step checks itself off, Skip for Now moves to the next, and each person can put it away. App admins can preview it as a new band sees it from the account menu (`/?preview=getting-started`); nothing picked there saves. People can be in more than one band: the account menu lists their bands under Band, and picking one switches to it (remembered on that browser).

Everyone else joins from **Band Settings** (account menu > Band Settings). Any member can invite by email or copy a link; only owners can invite owners. If the bandmate is already in the directory, pick them under Who: their name (and email, if the band saved one) fills in, and joining links their login to that person, so they don't end up with a copy. The band's members come first, even ones another band kept private. Links work once, for 7 days. Someone new makes their account on the invite page, so public sign-ups stay turned off in the Supabase auth settings. Owners change roles, remove members, and rename the band there too, and a band always keeps an owner. Members leave from Account Settings. Each member can link their login to their person in the directory (Account Settings > You > Your Page): pick themselves from any band's people (another band may already have added them), or make a page that's added to the band. One person per account: linking fills in their other bands too. Linked from another band, the person stays with the band that added it, and they can fix their own details there. Linked people show "Uses Seeens" on the band's page, and Your Page appears in the account menu.

Invites and account deletion need server-only env vars in Vercel (never `NEXT_PUBLIC_`, never in the repo):

| Variable                       | Needed for                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_SECRET_KEY`          | Making an account from an invite, and deleting one (Account Settings > Delete Account). Supabase > Project Settings > API Keys > Secret keys. Without it, only people who already have an account can join, and accounts can't be deleted. |
| `SITE_URL`                     | Optional. The address email links use, like `https://seeens.app`. Without it, production uses the domain Vercel provides, and previews and local dev use their own address.                                                                |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sending invite and feedback emails through [Resend](https://resend.com). Optional: without them, Send Invite shows a link to pass on yourself, and feedback still lands in the inbox.                                                      |

### Beta feedback

Everyone in a band is a beta tester. **Send Feedback** in the header sends it to a private inbox at `/admin/feedback`, which only app admins can open. App admins run Seeens itself and are separate from band owners. Make yourself one in the SQL editor:

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'you@example.com'
returning user_id;
```

With email set up, each app admin gets an email for every new item (reply to answer the tester), and testers can be told when something they sent is done. "Draft an Issue" opens a new GitHub issue with the text filled in; nothing is posted until you post it, so check it for real names first.

### Roles

- **Members** add records, edit what their band added, and keep their band's own statuses and notes.
- **Moderators** are trusted people an app admin picks by name under **Moderators** in the account menu (`/admin/moderators`). A new moderator gets an email (when email is set up) and a one-time note in the app explaining the role. They can fix the details of any record other bands share: name, type, town, links, what someone can help with, and venue details. Every moderator edit is logged in `connection_edits`, and the record's band sees "Last fixed by a moderator" on it.
- **App admins** can do everything moderators can, make moderators, and invite bands.

Keep Private follows roles too. A venue, band, or other group can only be kept private by an owner of its band, or a moderator. A person is their own call once they've linked Your Page; until then, the band that added them decides. Changes go through `set_keep_private`, which applies these rules.

Password reset and email change links land on `/auth/callback`. Its URLs (`https://seeens.com/auth/callback`, `https://www.seeens.com/auth/callback`, and the preview and localhost ones) need to be allowed under Authentication > URL Configuration > Redirect URLs, or covered by a wildcard there.

Dates ("today" for outreach and follow-ups, and the dates in the CSV export) use the band's time zone, Pacific by default. To change it:

```sql
update public.workspaces set time_zone = 'America/New_York' where name = 'Merwulf';
```

Supabase code lives in `src/lib/supabase/`: `client.ts` for Client Components, `server.ts` for server code, and `proxy.ts` for session refresh (wired up in `src/proxy.ts`). The browser only gets the project URL and publishable key. The secret key is read only by server code in `admin.ts`, from a server-only env var.

## Place data

Town search uses the GeoNames `cities1000` list (towns with 1,000+ people), loaded into Supabase by migration. Data is © GeoNames, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), credited in the app footer. To rebuild the data migration from a newer package: `node scripts/build-places-migration.mjs <timestamp>`.

## Look up (admin script)

`scripts/look-up.ts` fills in missing band details from public pages, outside the app (#321). Export the directory, then:

```sh
npm run look-up -- ~/Downloads/seeens-export.csv --limit 10
```

For each band missing an Instagram, Bandcamp, website, or email, it makes one Claude call with web search (3 searches at most) and checks the band's own website (robots.txt respected, 4 pages at most). It never fetches Bandcamp or Instagram pages. Every value must cite a page the search returned, or it's left out, and the band's own website wins when the two disagree. It writes `<export>.look-up.csv` next to the export, with sources in the notes column and a `photo_to_upload` column to set by hand. Check that sheet, delete anything wrong, then bring it in with Import as Bands.

It needs `ANTHROPIC_API_KEY` in the environment or `.env.local`; `LOOK_UP_MODEL` overrides the model. Results are cached for 30 days in `<export>.look-up-cache.json` (`--fresh` ignores it, `--only BND-0042` runs one band, `--dry-run` prints the prompts). Both files hold real contacts and are gitignored; keep them out of the repo. Seeens itself runs no AI: see [docs/ai-constitution.md](docs/ai-constitution.md).

## Project documentation

- [Product context and data model](docs/context.md)
- [Design system rules](docs/design-system/rules.md)
- [AI Constitution (draft)](docs/ai-constitution.md)
- [Funding and ownership](docs/funding.md)
- [Discovery and ingestion options](docs/discovery.md)
- [Seeens Figma file](https://www.figma.com/design/QKSF4MTanGHlnbNvmUKDX0/Seeens?node-id=9-2) (source of truth for tokens)
- [Agent instructions](AGENTS.md)
- [Historical BandPath context](docs/archive/bandpath-context.md) (superseded; reference only)
