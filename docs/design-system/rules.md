# Seeens design rules

Status: phase 1 tokens are in. The source of truth is the Seeens Figma file ("Components" page: variables, text styles, effect styles). Code mirrors it in `src/app/globals.css` with the same names.

## Tokens (phase 1)

- **Color:** ink `#141414` on paper `#f8f7f3`, over a dotted ground `#e4e4df`. The secondary text is `#5d5d58`. Process plates are for status and accents. Ink is the primary accent (`color/accent/primary`), used for primary buttons and checked controls. Hover is a quiet ground tint (`color/bg/hover`) or an inversion. Color is saved for highlights and tags. Status plates: magenta (Homies), cyan (Prospect), and yellow (Let's play).
- **Type:** Hanken Grotesk for headings and nav. IBM Plex Mono for body, labels, and controls. Reenie Beanie for rare handwritten notes. Fonts are self-hosted with Fontsource.
- **Size and rhythm:** every height sits on a 4px grid. Fields, buttons, choices, and segments are 36px (`--control-height`, Figma `size/control-height`), tags are 20, and nav chips are 28. Line heights are 16 for captions and labels, 20 for body and nav, 24 for Display/S, and 1:1 for larger display sizes. Spacing tokens are 2, 4, 8, 12, 16, 24, 32, and 72. Panel, window, and row-divider edges are drawn as overlays, so they add no height.
- **Shape:** square corners everywhere, 1px ink borders, and a 1.5px border on windows. Windows get a hard offset shadow; buttons have none for now.
- **Components:** `.panel`, `.window`, `.field`, `.button-primary` (ink), `.button-secondary` (paper; both invert on hover), `.choice` (segment that inverts when on), `.segmented`, `.tag` with `.tag-{status}`, `.nav-chip`, `.logo` (cyan misregister), `.label`, and `.caption`.
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
- Use comfortable reading widths and a consistent spacing scale. Define shared tokens when styling begins.
- Keep the first release focused on directory and detail views; prioritize useful relationship context over metrics.

## Components and states

- Reuse controls for buttons, fields, filters, tags, connection rows/cards, and status messages.
- Make status controls identifiable by both label and state; give icon buttons accessible names.
- Keep entry light: required fields first, optional ones behind "More details." Prefer quick selections to free text.
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
