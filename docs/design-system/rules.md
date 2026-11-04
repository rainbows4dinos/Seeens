# Seeens design rules

Status: phase 1 tokens are in. The source of truth is the [Seeens Figma file](https://www.figma.com/design/QKSF4MTanGHlnbNvmUKDX0/Seeens?node-id=9-2) ("Components" page: variables, text styles, effect styles, and components). Code mirrors it in `src/app/globals.css` with the same names.

## Tokens (phase 1)

- **Color:** ink `#141414` on paper `#f8f7f3`, over a dotted ground `#e4e4df`. The secondary text is `#5d5d58`. Process plates are for status and accents. Ink is the primary accent (`color/accent/primary`), used for primary buttons and checked controls. Hover is a quiet ground tint (`color/bg/hover`) or an inversion. Color is saved for highlights and tags. Status plates: magenta (Homies), cyan (Crush), and yellow (Let's play).
- **Type:** Hanken Grotesk for headings and nav. IBM Plex Mono for body, labels, and controls. Reenie Beanie for rare handwritten notes. Fonts are self-hosted with Fontsource. Headings use the `display-*` utilities, which mirror the Figma Display styles (XXL 96, XL 52, L 36, M 28, S 20); page titles are `display-l sm:display-xl`. Form labels, section labels, and button text use Mono/Label (`.label`, 14/20 Medium, no caps).
- **Label case:** write button, form, and section labels in APA title case ("Add Connection", "Search by Name", "Scenes (Optional)"). Keep sentence case when a label reads as a sentence or question ("Who's on it", "What is it?", "We've played together"). Headings and body copy stay in sentence case.
- **Size and rhythm:** every height sits on a 4px grid. Fields, buttons, choices, and segments are 36px (`--control-height`, Figma `size/control-height`), tags are 20, and nav chips are 36. Line heights are 16 for captions and tags, 20 for body, labels, buttons, and nav, 24 for Display/S, and 1:1 for larger display sizes. Spacing tokens are 2, 4, 8, 12, 16, 24, 32, and 72. Panel, window, and row-divider edges are drawn as overlays, so they add no height.
- **Shape:** square corners everywhere, 1px ink borders, and a 1.5px border on windows. Windows get a hard offset shadow; buttons have none for now.
- **Tilt:** only small decorative pieces lean, like tape and handwritten script notes, by a few degrees seeded per record so they look the same on every visit. Containers stay straight: cards, photo and image frames, panels, windows, and anything you tap or type in. Nothing tilts on hover or focus.
- **Icons:** Carbon (`@carbon/icons-react`), the IBM set that matches Plex Mono. Import each icon by name. Use 16 by default, both next to text (buttons, labels, rows, nav chips) and alone in a 36px icon-only button (`.button-icon`). Use the size an icon was drawn for, never CSS scaling. Icons inherit `currentColor`, so they stay ink and invert with their control; never color an icon on its own. Leave 8px between an icon and its label, and put the icon before the text. Give an icon `aria-hidden="true"` when a label sits beside it; an icon-only button needs an `aria-label`. Icons support a label and never replace one, except for familiar actions in tight spots (close, more, back). Don't use icons as decoration in headings or body copy.
- **Choosing from options:** no rows of chips. Pick one is a select menu; pick any is a combobox. A single yes/no stays a checkbox. Directory filters apply on change; only the name search waits for Enter.
- **Components:** `.panel`, `.window`, `.field`, `.button-primary` (ink), `.button-secondary` (paper; both invert on hover), `.choice` (a single checkbox that inverts when on), `.combo` (combobox: picked tags plus a filtering list, from `components/combobox.tsx`), `.save-bar` (pinned form actions), `.segmented`, `.tag` with `.tag-{status}`, `.nav-chip`, `.logo` (all caps, SemiBold, cyan misregister), `.label`, and `.caption`.
- **Status and state colors:** Let's play is the yellow plate and Avoid/"Us" is an ink tag. Error red is `#b0002a`. Focus is a 2px ink outline plus a magenta glow. All are Figma variables (`color/status/*`, `color/text/error`, `color/border/error`, `color/focus/*`), and their code syntax matches the CSS names.
- **Tape:** a strip with notched ends, multiplied over what it holds (`.tape` plus `.tape-clear`, `.tape-yellow`, `.tape-magenta`, or `.tape-cyan`). On a connection card it holds the print's top-right corner, 16px over the top and 10px past the edge, tilted up to 2° either way, seeded from the id. Its color matches the status tag: Homies magenta, Let's play yellow, Prospect cyan; Neutral, Avoid, and Us clear. Tape is decoration: `aria-hidden`, and never over text or a control.
- **Photos:** every connection photo goes through the copier (xerox shader) once, in the browser, when it's added: a lighter/darker dial (logos and colored artwork usually want it lighter), contrast, toner grit, an ink plate (None, C, M, Y), and how far the plate slips, plus New Grain. The plate starts on the status color, like the tape. The copy is a flat image; the resized original (no EXIF) is kept so it can be re-copied. Prints stay straight and fill their frame (`object-fit: cover`). Photos show as the card print, a 48px thumbnail in list rows, and the connection header. Without a photo, each shows initials on photo paper.
- **Later phases:** cut-out edges and rub-down type texture.

## Character

Build a useful DIY music directory: editorial, personable, and scene-aware. Let names, places, links, and relationship context lead. Use plain language such as Connections, Scenes, Homies, and Next action.

## No pressure

Seeens is not a sales tool. Bands work on their own time, and urgency comes and goes with real events like a release or a tour.

- Never tell a band something is urgent. No overdue alarms, red badges, streaks, or counts of what they're behind on.
- Show dates as plain facts ("planned for Oct 12") rather than warnings.
- Don't score or rank people. Use the band's own words: Homies, Let's play, Crush, Heard of, Avoid.
- Recommendations are offers, not tasks. A band can ignore them without consequence.
- Any heightened urgency is something the band turns on, such as a focus on an upcoming release or tour.

## Layout and hierarchy

- Make browsing, search, and scene filters easy to reach on desktop and mobile.
- Show connection name, type, scene, and status before secondary metadata.
- Keep primary actions clear: add a connection, favorite it, or record outreach.
- **Page width:** the app has no max width. Gutters are 16px, 24px from `md`, and 32px from `xl` (`.page-gutter`). The directory and Boards use the full width. Reading and form pages (connection detail, edit forms, scenes, follow-ups, export) and long text such as the search row and view intros hold a 56rem measure (`.page-measure`), left-aligned with the logo.
- Card grids fill the row with as many 280px-minimum columns as fit (`.card-grid`).
- **Directory bar:** every directory control sits in one bar pinned to the top of the window (`.directory-bar`). From 1280px it's one row: views, then the search field (up to 320px, icon inside on the left, an ENTER keycap hint inside on the right) and Filters, then List/Cards and Add Connection on the right; the filter fields open under the middle. Below 1280, views and Add sit on top with search, Filters, and List/Cards under them. Filters is paper until the fields are open or a filter is set, then ink, so ink means something is in play. At rest the bar sits on the dot grid; once it pins it gets solid ground and a hairline underneath (`data-pinned`, set by `PinWatch`). Phones stack views, Add, and the search row, and pin only the search row and any open filters; there Filters shows its icon and count, and List/Cards becomes one button showing the other layout. Field labels are visually hidden and the placeholder names the field.
- **Paging:** long lists load 48 at a time (rows of 2, 3, 4, or 6 cards fill evenly). A paper **Show More** sits under the results with "48 of 122 loaded" beside it (the count above the list says how many match, never how many are loaded); it appends in place, moves focus to the first new item, and announces how many loaded. Group headings count the whole group, not just what has loaded.
- **Catalog numbers:** every connection shows its catalog number (`BND-0042`) in caption type wherever it appears: list rows (caption line, after the type), cards (top-right of the meta box), the connection page (after type and town), link rows, label mates, Follow-ups rows (caption line, after the type), connection pickers (in the hint, and typing it finds the connection), and lineup matches ("Link to Jo Example (MUS-0002)"). It is read aloud like any text. The prefix comes from the current type or first role (`catalogNo()` in `lib/connections/card.ts`); only the number is stored.
- **Icon-only buttons** are locked to 36 x 36, border included (`.button-icon`, or `.button-icon-phone` for buttons that drop their label below 640px). They never stretch or shrink in a row. A button showing a count next to its icon is no longer icon-only and sizes to its content.
- **Segmented Control tones:** Primary (ink fill on the pick) is for the main choice on a page, like the directory views. Secondary (`.segmented-secondary`: paper stays paper, the pick gets ink text and a 2px ink underline, the rest go muted) is for settings beside it, like List/Cards.
- Use a consistent spacing scale.
- Keep the first release focused on directory and detail views; prioritize useful relationship context over metrics.

## Components and states

- Reuse controls for buttons, fields, filters, tags, connection rows/cards, and status messages.
- Make status controls identifiable by both label and state; give icon buttons accessible names.
- Selects use `.field`: `appearance: none` with a custom ink chevron inset to match the left padding (10px). Never use the native arrow.
- Keep entry light: required fields first, optional ones after them under "More details." Prefer quick selections to free text.
- Include loading, empty, no-results, error, saving, and success states. Preserve user input after failed saves.
- Show dates with enough context to distinguish past outreach from a future follow-up.
- Confirm destructive actions and prefer archiving when history is attached.

## Accessibility

- Use semantic HTML, associated input labels, visible keyboard focus, and logical focus order.
- Target WCAG AA contrast. Pair color with text or icons for meaning.
- Keep touch controls comfortable and layouts usable without horizontal page scrolling.
- Respect reduced-motion preferences; animation should support feedback.

## Content and privacy

Use fictional examples in public previews. Keep contact details and relationship notes inside authenticated views backed by database authorization. Clearly distinguish saved history from current plans and uncertain notes from confirmed details.

## Before shipping UI

Check the main workflow on desktop and mobile, keyboard navigation, contrast, long names, multiple scene tags, missing contact fields, and every async state affected by the change.
