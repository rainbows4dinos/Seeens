# Seeens design rules

Status: phase 1 tokens are in. The source of truth is the [Seeens Figma file](https://www.figma.com/design/QKSF4MTanGHlnbNvmUKDX0/Seeens?node-id=9-2) ("Components" page: variables, text styles, effect styles, and components). Code mirrors it in `src/app/globals.css` with the same names.

## Tokens (phase 1)

- **Color:** ink `#141414` on paper `#f8f7f3`, over a dotted ground `#e4e4df`. The secondary text is `#5d5d58`. Process plates are for status and accents. Ink is the primary accent (`color/accent/primary`), used for primary buttons and checked controls. Hover is a quiet ground tint (`color/bg/hover`) or an inversion. Color is saved for highlights and tags. Status plates: magenta (Homies), cyan (Prospect), and yellow (Let's play).
- **Type:** Hanken Grotesk for headings and nav. IBM Plex Mono for body, labels, and controls. Reenie Beanie for rare handwritten notes. Fonts are self-hosted with Fontsource. Headings use the `display-*` utilities, which mirror the Figma Display styles (XXL 96, XL 52, L 36, M 28, S 20); page titles are `display-l sm:display-xl`. Form labels, section labels, and button text use Mono/Label (`.label`, 14/20 Medium, no caps).
- **Label case:** write button, form, and section labels in APA title case ("Add Connection", "Search by Name", "Scenes (Optional)"). Keep sentence case when a label reads as a sentence or question ("Who's on it", "What is it?", "We've played together"). Headings and body copy stay in sentence case.
- **Size and rhythm:** every height sits on a 4px grid. Fields, buttons, choices, and segments are 36px (`--control-height`, Figma `size/control-height`), tags are 20, and nav chips are 36. Line heights are 16 for captions and tags, 20 for body, labels, buttons, and nav, 24 for Display/S, and 1:1 for larger display sizes. Spacing tokens are 2, 4, 8, 12, 16, 24, 32, and 72. Panel, window, and row-divider edges are drawn as overlays, so they add no height.
- **Shape:** square corners everywhere, 1px ink borders, and a 1.5px border on windows. Windows get a hard offset shadow; buttons have none for now.
- **Tilt:** only small decorative pieces lean, like tape and handwritten script notes, by a few degrees seeded per record so they look the same on every visit. Containers stay straight: cards, photo and image frames, panels, windows, and anything you tap or type in. Nothing tilts on hover or focus.
- **Icons:** Carbon (`@carbon/icons-react`), the IBM set that matches Plex Mono. Import each icon by name. Use 16 by default, both next to text (buttons, labels, rows, nav chips) and alone in a 36px icon-only button (`.button-icon`). Use the size an icon was drawn for, never CSS scaling. Icons inherit `currentColor`, so they stay ink and invert with their control; never color an icon on its own. Leave 8px between an icon and its label, and put the icon before the text. Give an icon `aria-hidden="true"` when a label sits beside it; an icon-only button needs an `aria-label`. Icons support a label and never replace one, except for familiar actions in tight spots (close, more, back). Don't use icons as decoration in headings or body copy.
- **Choosing from options:** no rows of chips. Pick one is a select menu; pick any is a combobox. A single yes/no stays a checkbox. Directory filters apply on change; only the name search waits for Enter.
- **Components:** `.panel`, `.window`, `.field`, `.button-primary` (ink), `.button-secondary` (paper; both invert on hover), `.choice` (a single checkbox that inverts when on), `.combo` (combobox: picked tags plus a filtering list, from `components/combobox.tsx`), `.save-bar` (pinned form actions), `.segmented`, `.tag` with `.tag-{status}`, `.nav-chip`, `.logo` (all caps, SemiBold, cyan misregister), `.label`, and `.caption`.
- **Status and state colors:** Let's play is the yellow plate and Avoid/"Us" is an ink tag. Error red is `#b0002a`. Focus is a 2px ink outline plus a magenta glow. All are Figma variables (`color/status/*`, `color/text/error`, `color/border/error`, `color/focus/*`), and their code syntax matches the CSS names.
- **Later phases:** xerox shader on photos, cut-out edges, tape, and rub-down type texture.

## Character

Build a useful DIY music directory: editorial, personable, and scene-aware. Let names, places, links, and relationship context lead. Use plain language such as Connections, Scenes, Homies, and Next action.

## No pressure

Seeens is not a sales tool. Bands work on their own time, and urgency comes and goes with real events like a release or a tour.

- Never tell a band something is urgent. No overdue alarms, red badges, streaks, or counts of what they're behind on.
- Show dates as plain facts ("planned for Oct 12") rather than warnings.
- Don't score or rank people. Use the band's own words: Homies, Let's play, Prospect, Neutral, Avoid.
- Recommendations are offers, not tasks. A band can ignore them without consequence.
- Any heightened urgency is something the band turns on, such as a focus on an upcoming release or tour.

## Layout and hierarchy

- Make browsing, search, and scene filters easy to reach on desktop and mobile.
- Show connection name, type, scene, and status before secondary metadata.
- Keep primary actions clear: add a connection, favorite it, or record outreach.
- **Page width:** the app has no max width. Gutters are 16px, 24px from `md`, and 32px from `xl` (`.page-gutter`). The directory and Boards use the full width. Reading and form pages (connection detail, edit forms, scenes, follow-ups, export) and long text such as the search row and view intros hold a 56rem measure (`.page-measure`), left-aligned with the logo.
- Card grids fill the row with as many 280px-minimum columns as fit (`.card-grid`).
- **Directory bar:** every directory control sits in one bar pinned to the top of the window (`.directory-bar`): views and Add Connection on the first row; then a full-width row: the search field (icon inside, Enter searches), Filters, a short rule, and List/Cards; then the filter fields. Filters is paper until the fields are open or a filter is set, then ink, so ink means something is in play. On phones, Filters shows its icon and count, and List/Cards becomes one button showing the other layout. It runs edge to edge on solid ground with a hairline underneath. Phones pin only the search row and any open filters. Field labels are visually hidden and the placeholder names the field.
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
