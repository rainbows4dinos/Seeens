# Design sync ledger

- Figma file: Seeens (QKSF4MTanGHlnbNvmUKDX0)
- Inventory read: 2026-11-08 (components and variables re-read; no token, text, or effect drift)
- Code baseline: f085c94 (2026-11-08)
- Rendered 2026-11-08 by scripts/ledger.py from ledger.json. Edit the JSON (or use ledger.py set), not this file.
- Direction: Figma to code

## Inventory

| Category | Figma count | Ledger rows | Synced | Open |
|---|---|---|---|---|
| Variables | 60 | 9 groups (60 items) | 7 | 0 |
| Text styles | 13 | 13 | 13 | 0 |
| Effect styles | 6 | 6 | 4 | 0 |
| Paint styles | 0 | 0 | 0 | 0 |
| Components | 37 | 37 | 20 | 12 |
| Figma hygiene | - | 9 | 0 | 2 |

Status totals: fixed-in-figma 8, needs-figma-fix 2, pending 12, skipped 8, synced 44

## Log

- 2026-11-04: Typography sync: 2 text styles fixed (UI/Nav, Mono/Caption), 10 components' type aligned to their bound styles, --radius-none added. dslib.blocks patched to ignore an @import before :root.
- 2026-11-04: Figma fixes Nov 4: Number0 removed, space/none added (synced), Form Field error bound to Mono/Label, Logo component added and synced to code.
- 2026-11-04: Nov 4 hygiene: H-03, H-05, H-06 fixed in Figma and synced; H-04 still open; added Mono/Hint and Keyboard Hint
- 2026-11-04: Search Field rebuilt in Figma (134:4549); H-04 fixed, C-25 synced with a clear button
- 2026-11-04: Off-token paddings fixed in Figma: Field 12 (md), Choice 8 (sm), Tag 8 (sm). Code follows (border + padding = token).
- 2026-11-05: Audit Nov 5 evening: full Figma re-read (60 variables, 13 text styles, 6 effect styles, 34 components with axes and props). New: color/border/inverse, Profile Pic, Photo Action, Favicon. Changed: Shadow/Hard (second drop), Field icon gap 4. Evidence: design-sync/evidence/audit-2026-11-05.md
- 2026-11-05: Nov 5: all Figma auto layouts set to exclude borders; rule in rules.md; re-audited resized components; code fixes for Keyboard Hint, Window title bar, Next Action Card, Choice checkbox.
- 2026-11-08: Nov 8 borders audit: 198 bordered auto-layout frames include borders, 68 exclude (mostly inside instances). Code switched to plain border + padding for Button, Field, Choice, Search Field, combobox, Window, Panel. Still excluded in Figma, code unchanged: Tag, Keyboard Hint, BETA, Segmented Control outer, Checkbox, Window Collapse, Date Line underline, Connection Card Meta/Dates, Directory Bar pinned, mobile menu frames.

## Rows

| ID | Category | Item | Figma ref | Code ref | Class | Status | Notes |
|---|---|---|---|---|---|---|---|
| V-01 | Variables | Primitives: ink, paper, ground, plate, stock, red (15) | Primitives | `src/app/globals.css :root` | match | synced | token-diff: all match |
| V-02 | Variables | Color: color/* (27) | Color | `src/app/globals.css :root` | value-drift | synced | token-diff: 26 matched; color/text/error only differed by line wrapping, rewritten on one line |
| V-03 | Variables | Number0 (1) | Color | `src/app/globals.css` | missing-in-code | fixed-in-figma | Fixed by the designer Nov 4: Number0 deleted from Color. Re-read confirms it is gone; nothing in code. |
| V-04 | Variables | Spacing: space/*, stroke/*, size/control-height (11) | Spacing | `src/app/globals.css :root` | match | synced | token-diff: all match (size/control-height -> --control-height) |
| V-05 | Variables | radius/none (1) | Spacing | `src/app/globals.css :root` | missing-in-code | synced | Added --radius-none: 0px. Tailwind radius utilities are already 0 via @theme. |
| V-06 | Variables | Style Stacks: Dot Grid BG, Display Title, Window (3) | Style Stacks | `-` | missing-in-code | skipped | String variables holding plugin style-stack data, not design tokens. No CSS equivalent. |
| V-07 | Variables | space/none (1) | Spacing | `src/app/globals.css :root` | missing-in-code | synced | Added by the designer Nov 4; added --space-none: 0px. |
| T-01 | Text styles | Display/XXL | text style | `src/app/globals.css @utility display-xxl` | match | synced | text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx. |
| T-02 | Text styles | Display/XL | text style | `src/app/globals.css @utility display-xl` | match | synced | text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx. |
| T-03 | Text styles | Display/L | text style | `src/app/globals.css @utility display-l` | match | synced | text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx. |
| T-04 | Text styles | Display/M | text style | `src/app/globals.css @utility display-m` | match | synced | text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx. |
| T-05 | Text styles | Display/S | text style | `src/app/globals.css @utility display-s` | match | synced | text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx. |
| T-06 | Text styles | UI/Nav | text style | `src/app/globals.css .nav-chip` | value-drift | synced | font-size 15px -> 16px (Figma 16/20, SemiBold, -1%). Font loads via Fontsource in src/app/layout.tsx. |
| T-07 | Text styles | Mono/Body | text style | `src/app/globals.css body` | match | synced | text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx. |
| T-08 | Text styles | Mono/Small | text style | `src/app/globals.css .date-line + .date-line-past` | match | synced | text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx. |
| T-09 | Text styles | Mono/Small Strong | text style | `src/app/globals.css .date-line + .date-line-future` | match | synced | text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx. |
| T-10 | Text styles | Mono/Label | text style | `src/app/globals.css .label` | match | synced | text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx. |
| T-11 | Text styles | Mono/Caption | text style | `src/app/globals.css .caption` | value-drift | synced | font-size 11px -> 12px (Figma 12/16, 5%, uppercase). .tag follows it.. Font loads via Fontsource in src/app/layout.tsx. |
| T-12 | Text styles | Hand/Note | text style | `src/app/globals.css .hand` | match | synced | text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx. |
| E-01 | Effect styles | Shadow/Hard | effect style | `src/app/globals.css --shadow-hard` | match | synced | Nov 5: Figma's second drop (1 1 0 0 paper/photo) is a sliver of paper between the box and its ink shadow. Code: --shadow-hard is now 1px 1px 0 0 paper-photo, 5px 5px 0 0 ink-900. |
| E-02 | Effect styles | Shadow/Photo | effect style | `src/app/globals.css --shadow-photo` | match | synced | Matches: 0 3 6 0 rgb(0 0 0 / 0.22) |
| E-03 | Effect styles | Misregister/Cyan | effect style | `src/app/globals.css --misregister-cyan` | match | synced | Matches: 2 1 0 plate/cyan |
| E-04 | Effect styles | Texture/Rub-down | effect style | `src/app/globals.css -` | missing-in-code | skipped | Texture and noise effects have no CSS equivalent; rub-down wear is planned in #62 |
| E-05 | Effect styles | Texture/Rub-down on paper | effect style | `src/app/globals.css -` | missing-in-code | skipped | Same as Texture/Rub-down (#62) |
| C-01 | Components | Avatar | 82:2229 | `-` | missing-in-code | skipped | Not built in code yet; part of account settings (#67). |
| C-02 | Components | Button | 10:22 | `.button-primary, .button-secondary` | structure-drift | synced | Nov 5: Figma padding 8 + Label Frame 2 = text 10px from the outer edge; code 1px border + 9px. Icon L 8px in (border + 7), 6px to the label. Matches. |
| C-03 | Components | Nav Chip | 10:8 | `.nav-chip, .logo` | structure-drift | synced | Nov 8: BETA includes its border, 16 tall, 4px sides. Code: height 16, padding 0 4px (was 3/5). |
| C-04 | Components | Segment | 10:27 | `.segmented > *` | structure-drift | synced | Nov 5: pad 12, Mono/Body, 4px icon-to-label (type tabs: margin-right calc(4px - 1ch)). Phones keep 12px under 480px (code-owned). |
| C-05 | Components | Segmented Control | 11:2 | `.segmented` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-06 | Components | Tag | 10:15 | `.tag` | structure-drift | synced | Nov 8: Tag now includes its border in Figma, fixed 20 tall. Code: height 20, padding 0 8px (was 1px 7px). |
| C-07 | Components | Date Line | 10:34 | `.date-line` | structure-drift | synced | Re-audited Nov 5: gap 6, arrow + label Mono/Small Strong (future) / Mono/Small (past). Matches .date-line. |
| C-08 | Components | Window | 11:9 | `.window, .dialog-title` | structure-drift | synced | Nov 5: Shadow/Hard back to two drops (ink 5,5 under paper 1,1); 1.5px stroke on all sides; title bar 44, 20px fold box, Mono/Small Strong; content pad 24/16/32. Code edge is an inset shadow. |
| C-09 | Components | Connection Card | 11:17 | `src/components/connection-card.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-10 | Components | Tape | 10:41 | `.tape` | structure-drift | skipped | Synced in #114 (CSS strips stand in for the Figma shader). No text; not re-audited. |
| C-11 | Components | Pattern/Dot Grid | 33:103 | `body background` | structure-drift | skipped | Code draws the dot grid as a CSS gradient on body, not a component. |
| C-12 | Components | Field | 47:170 | `.field` | structure-drift | synced | Nov 5: 4px icon gap (space/xs); text 32px in beside an icon (.field-icon 31 + border, .combo-icon). Font size decision (14, 16 on touch) stands. |
| C-13 | Components | Form Field | 47:172 | `label + .field` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-14 | Components | Choice | 47:187 | `.choice` | structure-drift | synced | Nov 8: Choice includes its border (padding 8). Checkbox now 16 square in Figma (was 18). Measured: box 9 in, 16 x 16. |
| C-15 | Components | Disclosure | 47:197 | `-` | missing-in-code | skipped | No longer used in code: Add connection shows More details open since #76. |
| C-16 | Components | App Header | 48:191 | `src/app/(app)/layout.tsx` | structure-drift | synced | Decided Nov 5: code keeps the page gutter for side padding (16/24/32) so the header lines up with the content; Figma's 16 stays as the component default. Fill, 2px rule, 16px top/bottom match. |
| C-17 | Components | App Footer | 48:197 | `src/app/(app)/layout.tsx footer` | structure-drift | synced | Nov 5 (borders excluded): pad 16/32, 48 tall, top rule. Matches the footer (py-4, overlay rule). |
| C-18 | Components | Save Bar | 48:209 | `.save-bar` | structure-drift | synced | Re-audited Nov 5: ground fill, pad 12/16, 1px ink top rule, gap 12. Matches .save-bar (inset rule). |
| C-19 | Components | Directory Row | 50:189 | `src/components/directory-results.tsx` | structure-drift | synced | Re-audited Nov 5: content pad 12, Default/Hover/Selected states (raised fill, Shadow/Soft, hairline; Selected 6px left bar) match .row-link incl. :hover/:focus-visible/[aria-current]. The 2px nudge is code-only motion. |
| C-20 | Components | Follow-up Row | 50:207 | `src/app/(app)/follow-ups/page.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-21 | Components | Scene Row | 50:209 | `src/app/(app)/scenes/page.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-22 | Components | Affiliation Row | 50:217 | `src/components/links-panel.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-23 | Components | Outreach Entry | 50:225 | `src/components/outreach-panel.tsx` | structure-drift | synced | Nov 5 (borders excluded): pad 12, gap 4, 92 tall. Matches EntryRow (px-3 py-3 gap-1, overlay border). |
| C-24 | Components | Next Action Card | 50:232 | `src/components/next-action-panel.tsx` | structure-drift | synced | Nov 5 (borders excluded): pad 16, gap 8, 124 tall. Code gap 12 -> 8. |
| C-25 | Components | Search Field | 134:4549 | `.search-field, .search-hint, src/components/search-clear.tsx` | structure-drift | synced | Nov 5: 4px gaps. Text 32px in, keycap 4px after the text (padding-right 57; 81 with the clear button). Keycap 2px radius. |
| C-26 | Components | Layout Toggle | 88:352 | `src/components/layout-toggle.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-27 | Components | Show More | 88:354 | `src/components/directory-results.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-28 | Components | Directory Bar | 89:634 | `.directory-bar` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-29 | Components | Account Nav Item | 82:2255 | `-` | missing-in-code | skipped | Not built in code yet; part of account settings (#67). |
| C-30 | Components | Logo | 128:3618 | `public/brand/seeens-logo.svg, .logo` | missing-in-code | synced | New in Figma Nov 4. Exported SVG: wordmark, cyan misregister copy (+2, +1, hard-light), and the rub-down texture as an SVG filter. Used in the header and on login. |
| H-01 | Figma hygiene | Nav Chip / Logo text | 10:7 | `-` | hygiene | fixed-in-figma | Fixed by the designer Nov 4: new Logo component (128:3618, vector wordmark) placed in Nav Chip Style=Logo. Code now uses it (C-30). |
| H-02 | Figma hygiene | Form Field / Error text | 47:177 | `-` | hygiene | fixed-in-figma | Fixed by the designer Nov 4: error text bound to Mono/Label. Code error text already uses that size and weight. |
| H-03 | Figma hygiene | Outreach Entry / Date | 50:227 | `-` | hygiene | fixed-in-figma | Fixed by the designer Nov 4: date bound to Mono/Label (Plex Medium 14/20). Code already matches (text-sm, font-medium). |
| H-04 | Figma hygiene | Search Field / Text and ENTER hint | 134:4549 | `-` | hygiene | fixed-in-figma | Fixed by the designer Nov 4: Search Field rebuilt (134:4549) from Form Field > Field with Show Icon L, Show Key Hint, Show Clear. Value is Mono/Body 14; hint is the Keyboard Hint component. Old 88:302 removed. |
| H-05 | Figma hygiene | Connection Card / Print initials | 95:460 | `-` | hygiene | fixed-in-figma | Fixed by the designer Nov 4: initials bound to Display/XL (52/52). Code .card-print-initials 64px -> 52px. |
| H-06 | Figma hygiene | Directory Row / Thumb initials | 109:79 | `-` | hygiene | fixed-in-figma | Fixed by the designer Nov 4: initials bound to Display/S (20/24). Code .row-thumb-initials 18px -> 20/24, -3%. |
| T-13 | Text styles | Mono/Hint | text style | `src/app/globals.css .search-hint` | match | synced | New in Figma Nov 4 (Plex 10, auto, 5%, uppercase). Code .search-hint already 10px, 5%, uppercase; keeps 14px line height for the bordered key. |
| C-31 | Components | Keyboard Hint | 133:4158 | `kbd.search-hint` | match | synced | Nov 5: 2px radius kept (the one rounded element). Borders excluded: 40 x 15, pad 4, text trimmed to cap height. Code padding 3 + text-box trim. |
| V-08 | Variables | color/bg/raised (1) | Color | `src/app/globals.css --color-bg-raised` | missing-in-code | synced | New Nov 5 (#157): rows and cards lifted on hover or when open. Aliases paper/photo. Controls keep color/bg/hover. |
| E-06 | Effect styles | Shadow/Soft | effect style | `src/app/globals.css --shadow-soft` | missing-in-code | synced | New Nov 5 (#157): 4 4 0 0 ink at 30%. Code also has --shadow-soft-nudged (6 6) for rows nudged 2px up-left, so the shadow lands in the same place. |
| V-09 | Variables | color/border/inverse (1) | Color | `src/app/globals.css (missing)` | missing-in-code | synced | Added --color-border-inverse (paper/50); used by .profile-panel-icon and .quick-view-close borders. |
| C-32 | Components | Profile Pic | 161:3824 | `src/components/photo-panel.tsx, .quick-view-thumb` | changed | pending | Nov 5: resized 108 -> 112 to match .photo-thumb (80 on mobile). Initials size and color not compared yet. |
| C-33 | Components | Photo Action | 161:3817 | `src/components/photo-panel.tsx` | changed | synced | Nov 5: Add icon 12 + Mono/Hint label, pad 4/12, gap 2, 110 x 20 inside the Profile Pic edge, ink fill, yellow hover. Code and Figma both on existing styles. |
| C-34 | Components | Favicon | 161:3876 | `src/app/icon.*` | changed | pending | 16/32/48 variants. Check the app's icon files match. |
| C-35 | Components | Page Loader | 220:24087 | `src/components/metronome.tsx PageLoader, .page-loader` | new | synced | Built Nov 8 (#200-#202): metronome, label, dots in time (1s). Busy pointer carries the metronome with a mouse. |
| C-36 | Components | Metronome Loader | 220:23885 | `src/components/metronome.tsx Metronome` | new | synced | Built Nov 8 (#200): SVG from Figma, dial swings 45deg each way at 120 BPM (Figma motion). |
| C-37 | Components | App Header Menu | 211:21700 | `src/components/account-menu.tsx .account-menu-panel` | new | pending | Not re-audited this pass. |
| H-07 | Figma hygiene | Save Bar: fixed 60 tall with an included top border | 48:209 | `.save-bar` | hygiene | needs-figma-fix | With the 1px top border included, 1 + 12 + 36 + 12 = 61, but the frame is fixed at 60, so the Button is squeezed. Either 61 tall, or 11 top padding. Code keeps 60 with an inset line. |
| H-08 | Figma hygiene | App Header: fixed 68 tall with an included 2px bottom border | 48:191 | `src/app/(app)/layout.tsx header` | hygiene | needs-figma-fix | 16 + 36 + 16 + 2 = 70, fixed at 68. Either 70 tall or 14 bottom padding. Code unchanged. |
| H-09 | Figma hygiene | Frames that still exclude borders | 9:2 | `-` | hygiene | fixed-in-figma | Larry switched Tag, BETA, Segmented Control, Checkbox, Collapse, Date Line, Card Dates, Directory Bar pinned, mobile menu to included (Nov 8). Still excluded: Keyboard Hint, Connection Card Meta, App Header Account (mobile) and an Account Nav Chip frame; code matches those as excluded. Directory Bar pinned keeps an inset line in code so pinning doesn't shift the bar by 1px. |

## Component checklists

### C-02 Button

- [x] Typography: Mono/Label = 14/20 Medium, already matched

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-03 Nav Chip

- [x] Typography: UI/Nav 15px -> 16px. Logo text is unstyled in Figma (see hygiene).
- [x] Logo variant uses the new Logo component; code .logo renders public/brand/seeens-logo.svg

Evidence: design-sync/evidence/borders-2026-11-08.md

### C-04 Segment

- [x] Typography: Mono/Body 13px -> 14/20; current segment no longer bold (Figma On variants are Regular)

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-05 Segmented Control

- [x] Typography: none (no text)

Evidence: -

### C-06 Tag

- [x] Typography: Mono/Caption 11px -> 12px
- [x] Typography: Mono/Caption 11px -> 12px, weight pinned to 400 (it inherited 500 inside .label headings)

Evidence: design-sync/evidence/borders-2026-11-08.md

### C-07 Date Line

- [x] Typography: Mono/Small and Mono/Small Strong, already matched

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-08 Window

- [x] Typography: Window title (copier dialog) 13px -> Mono/Small 12/16

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-09 Connection Card

- [x] Typography: caption via .caption (now 12px), name via display-m. Print initials are decorative, unstyled in Figma.

Evidence: -

### C-12 Field

- [x] Typography: .field 16px -> 14/20, 16/24 under pointer: coarse (measured: desktop 14px h36, phone 16px h36)

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-13 Form Field

- [x] Typography: label Mono/Label matches .label. Error text is unstyled in Figma (see hygiene).

Evidence: -

### C-14 Choice

- [x] Typography: 13px -> Mono/Body 14/20; checked weight 600 -> 500 (Mono/Label)

Evidence: design-sync/evidence/borders-2026-11-08.md

### C-16 App Header

- [x] Typography: member name Mono/Body via body text, already matched

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-17 App Footer

- [x] Typography: .caption normal-case -> text-xs text-muted (Mono/Small 12/16, no tracking)

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-18 Save Bar

- [x] Typography: none (button only)

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-19 Directory Row

- [x] Typography: name font-semibold 20/24 -> display-s (Bold); caption .caption now 12px; place Mono/Body. Thumb initials decorative, unstyled in Figma.

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-20 Follow-up Row

- [x] Typography: name -> display-s (Bold); caption .caption now 12px

Evidence: -

### C-21 Scene Row

- [x] Typography: name font-semibold -> font-medium (Mono/Label)

Evidence: -

### C-22 Affiliation Row

- [x] Typography: catalog .caption -> text-xs text-muted (Mono/Small); label mates on the connection page too

Evidence: -

### C-23 Outreach Entry

- [x] Typography: Mono/Body. Date is unstyled in Figma (see hygiene).

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-24 Next Action Card

- [x] Typography: Mono/Body, already matched

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-25 Search Field

- [ ] Typography: both text layers unstyled in Figma (see hygiene); depends on the Field decision

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-26 Layout Toggle

- [x] Typography: via Segment and Button

Evidence: -

### C-27 Show More

- [x] Typography: count Mono/Body (text-sm), already matched

Evidence: -

### C-28 Directory Bar

- [x] Typography: via nested components

Evidence: -

### C-30 Logo

- [x] Anatomy: shadow and wordmark from the Figma export
- [x] Size: 75 x 18 in a 4px 12px chip (101 x 36 vs Figma 100 x 36)

Evidence: design-sync/evidence/logo-header-login.png

### C-31 Keyboard Hint


Evidence: design-sync/evidence/audit-2026-11-05.md

### C-33 Photo Action


Evidence: design-sync/evidence/audit-2026-11-05.md

### C-35 Page Loader


Evidence: design-sync/evidence/metronome-2026-11-08.md

### C-36 Metronome Loader


Evidence: design-sync/evidence/metronome-2026-11-08.md
