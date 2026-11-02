# Seeens: Discovery and Ingestion Options

Status: exploration, October 30, 2026; AI stance added November 1, 2026. Post-MVP. Tracked in rainbows4dinos/seeens issue #21.

## Why

The MVP relies on members adding every connection and prospect by hand. That works for launch but won't scale, and it isn't scene intelligence. Discovery should surface people and bands Merwulf doesn't track yet, links between the ones it does, and potential connections in places the band has never been.

## AI stance

Much of the DIY punk scene is strongly anti-AI, and posting AI-generated content gets people called out fast. Seeens has to earn trust as a useful directory first, and treat AI as an optional helper that is never the pitch.

- **Launch with no AI.** The MVP has none. AI features ship later, after people trust the directory.
- **Opt-in per workspace, off by default.** A band that never turns it on never sees it.
- **Name the task, not the tech.** Use labels like "Read flyer," "Look up," and "Find." No "AI-powered" badges or sparkle icons.
- **Disclose it plainly, don't bury it.** One public page covers what runs, which provider, what's sent, what's kept, and no training. Getting caught hiding it would be worse than any backlash.
- **Plain tools first.** On-device OCR for flyers, and prepared search links a member opens themselves. LLMs only where those fall short.
- **Never metered to users.** No tokens or credits. AI runs on demand, is capped per workspace, and is paid from the shared pot.

The user-facing commitments live in the [AI Constitution (draft)](ai-constitution.md). Everything below has to follow it.

## Use cases

1. **Research a known connection.** Fill in members, other projects, links, and recent shows for someone already in the directory.
2. **Discover within a scene.** Find new bands, DJs, venues, promoters, and others in a scene or locality, optionally related to an existing connection. Example: bands in Portland DIY that have played with Soda, or promoters who book Static Basement.
3. **Plan a town (touring).** Every touring band Merwulf shares a bill with in Portland is a potential bill mate in their hometown (Reno, SF, Walla Walla, Boise). For a town the band wants to play, Seeens shows who could help, in tiers:
   - **Warm:** connections based there.
   - **One hop:** connections with ties there who could refer or vouch, such as a college radio DJ, a band that played there, or a promoter who books there.
   - **Cold:** search candidates in that town (bands, venues, promoters) that fit the band's genre and scene, ranked by fit and by any link to the network. Uses AI search only if the workspace has it on.
   - **Later:** availability, meaning who has shows around the target dates and which venues book similar bills.

   This needs connection home localities (in the schema), shows as a record, affiliations, and genre tags (issue #16). Touring routes stay out of the MVP per the README. Warm and one-hop tiers work with no AI at all.

## Key findings

**Platform data is thin for DIY punk.** Merwulf is listed on MusicBrainz but the data is very incomplete. Catalog sources depend on someone choosing to document a band, so cassette-and-basement bands are underrepresented. Streaming and social APIs have closed most discovery data.

**AI search reaches the long tail, but only when scoped.** Larry tested Google AI Mode on Merwulf and five homie bands:

| Band | Result |
|---|---|
| Merwulf | Lineup and roles, cited to a label blog and Bandcamp. |
| Sad Boy Union | Accurate: Portland queercore trio, lineup, Bandcamp and official site. |
| The Shitfits | Accurate: lineup, debut album, Maximum Rocknroll review, links. |
| Teeth For Eyes | Found the Portland band, mixed with a comic character and a medical term. |
| Soda | Mixed: summary said Portland punk, but cited sources were a different cover band. Similar-name bands also listed. |
| Hutchie | Found the Seattle band, mixed with slang and surname meanings. |

Common names need anchors. A citation alone isn't enough: Soda's summary and sources disagreed.

So there are **two primary approaches**: member-captured flyers and posts, and scoped, on-demand search. Structured APIs are **secondary enrichment**. Both primary approaches have a non-AI baseline, and AI is an opt-in upgrade on top.

## Principles

- **Capture what the scene already publishes.** Flyers and show posts are how DIY shows get announced. Every flyer is a small graph: who played together, where, and when.
- **Relationships over popularity.** Who plays with whom matters more than follower counts.
- **Suggestions, never silent writes.** Captured or discovered data lands in a review inbox. A member accepts, edits, or dismisses it.
- **Every fact carries its source and date.** The BandPath confidence model: AI-derived or scraped, then member-confirmed, then verified or claimed, with staleness tracked separately from accuracy.
- **Scoped and anchored, never bare names.** Every AI query carries an entity type, a scene or locality, and any known anchors.
- **On demand, not bulk.** Research runs when a member asks, which keeps cost and energy use low and data fresh when it matters.
- **Opt-in and plain.** AI is off by default, named by task, and disclosed. See the [AI Constitution](ai-constitution.md).
- **Follow each platform's rules.** No credential sharing, no scraping where terms forbid it.
- **Long term, members are the dataset.** If other bands use Seeens, their combined connections, affiliations, and shows become scene data that exists nowhere else. The connection identity split from issue #1 was designed for this.

## Approaches, in priority order

1. **Suggestions inbox (foundation).** Suggested connections, affiliations, and shows, each with source, source URL or ID, source date, captured date, confidence tier, and which anchors matched. Accepted items become normal records with provenance kept.
2. **Flyer and post capture (primary).** A member uploads a flyer or a screenshot of a show post. Seeens extracts the lineup, venue, and date, matches names to existing connections, proposes new ones, and proposes shared-bill links.
   - **Baseline:** on-device text recognition (Apple Vision, Tesseract), with the member confirming which text is a band, venue, or date. Nothing leaves the device.
   - **Opt-in:** an LLM reads the image when OCR struggles with hand-drawn or stylized flyers. Needs a privacy note, since images go to a provider.
3. **Search, two modes (primary).**
   - **Baseline:** prepared searches that open Bandcamp, Instagram, MusicBrainz, and a web search for the connection, scoped by name and locality. The member reads and adds what they find.
   - **Research (opt-in AI):** a "Look up" action on a connection. The query is scoped by type and locality and anchored with stored facts: links, Instagram handle, known members, venues played.
   - **Discover (opt-in AI):** filters for type, scene or locality, and optionally "related to" a connection. The filter set matches the directory's own filters. Results are deduped against existing connections. Plan-a-town's cold tier uses this mode with a target locality.
   - **Same entity check:** every finding names which anchor matched ("Bandcamp lists Portland, OR, and the Instagram handle matches"). Findings whose sources don't match the anchors are dropped or flagged, not shown as fact.
   - **Structured output only:** results come back as data that fits the schema (connection types, scenes, localities, affiliations, shows). Anything that doesn't fit is discarded.
   - Providers include the Claude API web search tool, Perplexity, Exa, Tavily, and Brave. The provider does the crawling, which is cleaner than Seeens scraping sites itself. Only providers with written no-training terms qualify.
4. **Shows as a record.** Captured shows (date, venue, lineup) become their own record, so "played with," venue history, and touring bill mates build up over time. Likely a schema addition, and a prerequisite for plan-a-town.
5. **Venue calendars.** Low-volume fetching of local DIY spaces' and small rooms' own event pages, checking each site's terms and robots rules.
6. **Secondary enrichment.** Where a band has coverage, MusicBrainz and setlist.fm fill gaps and confirm identities. Spotify is for matching IDs only.
7. **Freshness checks.** Instagram Business Discovery counts, recent captured shows, and dated search sources feed "last seen active," addressing the staleness problem Joe Black raised.

## AI search risks and mitigations

| Risk | Mitigation |
|---|---|
| Scene backlash against AI | No AI at launch; opt-in per workspace; task labels, not AI branding; public AI Constitution; non-AI baseline for every feature. |
| Same-name confusion | Scope by type and locality; anchor with known facts; same entity check. |
| Summary disagrees with its sources (the Soda case) | Check each finding against its cited source, not the summary. |
| Confident errors, mixed-up or past lineups | Citations on every item; member review before anything is saved. |
| Stale info presented as current | Require a source date per item and show it in the inbox. |
| Cost | On demand only; cache results per connection; cap per workspace; paid from the shared pot, never metered to users. |

Test plan: run 10 bands where members know the truth, Merwulf included, through at least two providers. Score accuracy, invented details, same-name mix-ups, stale info, citation usefulness, and cost per lookup. Then walk through plan-a-town for two real towns: one with known bill mates (Boise or Reno) and one with none. Also test on-device OCR against a stack of real flyers to see how often the LLM fallback is needed.

## Source assessment (checked October 2026)

| Source | Access today | Signal for Seeens | Verdict |
|---|---|---|---|
| Show flyers and posts | Shared by members. | Lineups, venues, dates, shared bills. | Primary. |
| AI search | Paid APIs from several providers; results cite web sources. | Long-tail web coverage: Bandcamp pages, label blogs, venue sites, local press. | Primary, opt-in, scoped and reviewed. |
| Venue calendars | Public pages on venues' own sites; terms vary. | Bills at local DIY spaces and small rooms. | Strong, per venue. |
| MusicBrainz | Open API, about 1 request per second, descriptive User-Agent required. | Band membership and artist links. | Enrichment. Thin coverage for DIY bands. |
| setlist.fm | Open API; free for non-commercial use only. | Shows by venue and artist. | Enrichment. Thin for basement shows; commercial deal needed if public. |
| Spotify Web API | Since February 2026: no followers, popularity, top tracks, or batch lookups in dev mode; search capped at 10 results; owner needs Premium; new apps start at 5 users. Related artists cut in 2024. | Spotify IDs and links. | Identity only. |
| Instagram Graph API | Business Discovery gives follower, media, and per-post counts for other professional accounts via your own professional account. No follower lists, tags, or personal accounts. | Activity signal. | Freshness only. |
| Bandsintown | Keys tied to one artist; other artists' data needs approval; scraping and commercial use prohibited. | Merwulf's own shows. | Own data only. |
| Bandcamp | No public API for discovery; January 2026 policy forbids scraping. | None directly. AI search may cite public Bandcamp pages. | Out as a direct source. |
| Last.fm | Similar-artist endpoints appear to still exist; not verified. | Sound-alike suggestions. | Test before relying on it. |

Not legal advice. Re-check each platform's and provider's terms before building against it.

## Small change worth considering before launch

Let connections store external identifiers (MusicBrainz ID, Spotify artist ID, Instagram handle) separately from display links. They anchor search, AI or not, and make matching exact.

## Open questions

- Which AI search provider gives the best accuracy and citations for DIY bands, at what cost per lookup, with written no-training terms?
- How good is on-device OCR on real DIY flyers, and how often does the LLM fallback earn its keep?
- Who can turn AI on for a workspace: any member, or the whole band?
- Should shows become a first-class record before or alongside flyer capture?
- How is genre fit judged for cold plan-a-town matches: member-set tags (#16), AI-inferred, or both?
- Where does availability data come from for touring: captured shows, venue calendars, or asking bill mates directly?
- Which AI provider for flyer extraction, and what's the retention policy on uploaded images?
- Confidence as one field, or split into source recency and relationship strength? (Carried over from BandPath.)
- Where do any background jobs run: Supabase scheduled functions, Vercel cron, or a separate worker?
- If Seeens goes public, which sources need commercial agreements (setlist.fm, Bandsintown)?

## Sources

- Spotify February 2026 migration guide: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- Spotify quota updates, July 2026: https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates
- Instagram Business Discovery: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery
- Bandsintown API access: https://help.artists.bandsintown.com/en/articles/7053475-api-and-app-id
- Bandsintown data application terms: https://corp.bandsintown.com/data-applications-terms
- Bandcamp 2026 AI and scraping policy (Hypebot): https://www.hypebot.com/hypebot/2026/01/bandcamp-bans-ai-music.html
- setlist.fm API: https://api.setlist.fm/
- MusicBrainz rate limiting: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
