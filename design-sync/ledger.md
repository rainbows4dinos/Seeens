# Design sync ledger

- Figma file: Seeens (QKSF4MTanGHlnbNvmUKDX0)
- Inventory read: 2026-11-04, code 494e347
- Code baseline: 494e347 (2026-11-04)
- Rendered 2026-11-04 by scripts/ledger.py from ledger.json. Edit the JSON (or use ledger.py set), not this file.
- Direction: Figma to code

## Inventory

| Category | Figma count | Ledger rows | Synced | Open |
|---|---|---|---|---|
| Variables | 58 | 6 groups (58 items) | 4 | 1 |
| Text styles | 12 | 12 | 12 | 0 |
| Effect styles | 5 | 5 | 3 | 0 |
| Paint styles | 0 | 0 | 0 | 0 |
| Components | 29 | 29 | 0 | 24 |
| Figma hygiene | - | 6 | 0 | 6 |

Status totals: needs-decision 1, needs-figma-fix 7, pending 23, skipped 8, synced 19

## Log

- 2026-11-04: Typography sync: 2 text styles fixed (UI/Nav, Mono/Caption), 10 components' type aligned to their bound styles, --radius-none added. dslib.blocks patched to ignore an @import before :root.

## Rows

| ID | Category | Item | Figma ref | Code ref | Class | Status | Notes |
|---|---|---|---|---|---|---|---|
| V-01 | Variables | Primitives: ink, paper, ground, plate, stock, red (15) | Primitives | `src/app/globals.css :root` | match | synced | token-diff: all match |
| V-02 | Variables | Color: color/* (27) | Color | `src/app/globals.css :root` | value-drift | synced | token-diff: 26 matched; color/text/error only differed by line wrapping, rewritten on one line |
| V-03 | Variables | Number0 (1) | Color | `src/app/globals.css` | missing-in-code | needs-figma-fix | A stray variable named "Number0" in the Color collection, aliasing space/2xs. Delete it, or move and rename it in Spacing. |
| V-04 | Variables | Spacing: space/*, stroke/*, size/control-height (11) | Spacing | `src/app/globals.css :root` | match | synced | token-diff: all match (size/control-height -> --control-height) |
| V-05 | Variables | radius/none (1) | Spacing | `src/app/globals.css :root` | missing-in-code | synced | Added --radius-none: 0px. Tailwind radius utilities are already 0 via @theme. |
| V-06 | Variables | Style Stacks: Dot Grid BG, Display Title, Window (3) | Style Stacks | `-` | missing-in-code | skipped | String variables holding plugin style-stack data, not design tokens. No CSS equivalent. |
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
| E-01 | Effect styles | Shadow/Hard | effect style | `src/app/globals.css --shadow-hard` | match | synced | Matches: 5 5 0 0 ink/900 |
| E-02 | Effect styles | Shadow/Photo | effect style | `src/app/globals.css --shadow-photo` | match | synced | Matches: 0 3 6 0 rgb(0 0 0 / 0.22) |
| E-03 | Effect styles | Misregister/Cyan | effect style | `src/app/globals.css --misregister-cyan` | match | synced | Matches: 2 1 0 plate/cyan |
| E-04 | Effect styles | Texture/Rub-down | effect style | `src/app/globals.css -` | missing-in-code | skipped | Texture and noise effects have no CSS equivalent; rub-down wear is planned in #62 |
| E-05 | Effect styles | Texture/Rub-down on paper | effect style | `src/app/globals.css -` | missing-in-code | skipped | Same as Texture/Rub-down (#62) |
| C-01 | Components | Avatar | 82:2229 | `-` | missing-in-code | skipped | Not built in code yet; part of account settings (#67). |
| C-02 | Components | Button | 10:22 | `.button-primary, .button-secondary` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-03 | Components | Nav Chip | 10:8 | `.nav-chip, .logo` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-04 | Components | Segment | 10:27 | `.segmented > *` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. Phones keep 12px under 480px so four tabs fit (code-owned responsive rule). |
| C-05 | Components | Segmented Control | 11:2 | `.segmented` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-06 | Components | Tag | 10:15 | `.tag` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-07 | Components | Date Line | 10:34 | `.date-line` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-08 | Components | Window | 11:9 | `.window, .dialog-title` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-09 | Components | Connection Card | 11:17 | `src/components/connection-card.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-10 | Components | Tape | 10:41 | `.tape` | structure-drift | skipped | Synced in #114 (CSS strips stand in for the Figma shader). No text; not re-audited. |
| C-11 | Components | Pattern/Dot Grid | 33:103 | `body background` | structure-drift | skipped | Code draws the dot grid as a CSS gradient on body, not a component. |
| C-12 | Components | Field | 47:170 | `.field` | structure-drift | needs-decision | Figma Field text is Mono/Body (14px); code uses 16px so iOS doesn't zoom on focus (accessibility, code-owned). Options: keep 16px everywhere, or 14px on fine pointers and 16px on touch. |
| C-13 | Components | Form Field | 47:172 | `label + .field` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-14 | Components | Choice | 47:187 | `.choice` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-15 | Components | Disclosure | 47:197 | `-` | missing-in-code | skipped | No longer used in code: Add connection shows More details open since #76. |
| C-16 | Components | App Header | 48:191 | `src/app/(app)/layout.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-17 | Components | App Footer | 48:197 | `src/app/(app)/layout.tsx footer` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-18 | Components | Save Bar | 48:209 | `.save-bar` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-19 | Components | Directory Row | 50:189 | `src/components/directory-results.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-20 | Components | Follow-up Row | 50:207 | `src/app/(app)/follow-ups/page.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-21 | Components | Scene Row | 50:209 | `src/app/(app)/scenes/page.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-22 | Components | Affiliation Row | 50:217 | `src/components/links-panel.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-23 | Components | Outreach Entry | 50:225 | `src/components/outreach-panel.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-24 | Components | Next Action Card | 50:232 | `src/components/next-action-panel.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-25 | Components | Search Field | 88:302 | `.search-field, .search-hint` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-26 | Components | Layout Toggle | 88:352 | `src/components/layout-toggle.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-27 | Components | Show More | 88:354 | `src/components/directory-results.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-28 | Components | Directory Bar | 89:634 | `.directory-bar` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-29 | Components | Account Nav Item | 82:2255 | `-` | missing-in-code | skipped | Not built in code yet; part of account settings (#67). |
| H-01 | Figma hygiene | Nav Chip / Logo text | 10:7 | `-` | hygiene | needs-figma-fix | SEEENS logo text has no text style (Hanken SemiBold 22/28, uppercase). Code .logo matches it; add a style or bind one. |
| H-02 | Figma hygiene | Form Field / Error text | 47:177 | `-` | hygiene | needs-figma-fix | Error text has no text style; its values (Plex Medium 14/20) equal Mono/Label. Bind to Mono/Label. |
| H-03 | Figma hygiene | Outreach Entry / Date | 50:227 | `-` | hygiene | needs-figma-fix | Date text has no text style (Plex SemiBold 14/20). No matching style; add Mono/Body Strong or reuse one. |
| H-04 | Figma hygiene | Search Field / Text and ENTER hint | 88:305 | `-` | hygiene | needs-figma-fix | Placeholder (Plex 16/24) and the ENTER hint have no text style. Placeholder ties to the Field decision (C-12). |
| H-05 | Figma hygiene | Connection Card / Print initials | 95:460 | `-` | hygiene | needs-figma-fix | Placeholder initials (Hanken Bold 64) have no text style. Decorative; fine to leave, or add a Display style for prints. |
| H-06 | Figma hygiene | Directory Row / Thumb initials | 109:79 | `-` | hygiene | needs-figma-fix | Thumb initials (Hanken Bold 18) have no text style. Added by Claude on Nov 3; decorative. |

## Component checklists

### C-02 Button

- [x] Typography: Mono/Label = 14/20 Medium, already matched

Evidence: -

### C-03 Nav Chip

- [x] Typography: UI/Nav 15px -> 16px. Logo text is unstyled in Figma (see hygiene).

Evidence: -

### C-04 Segment

- [x] Typography: Mono/Body 13px -> 14/20; current segment no longer bold (Figma On variants are Regular)

Evidence: -

### C-05 Segmented Control

- [x] Typography: none (no text)

Evidence: -

### C-06 Tag

- [x] Typography: Mono/Caption 11px -> 12px
- [x] Typography: Mono/Caption 11px -> 12px, weight pinned to 400 (it inherited 500 inside .label headings)

Evidence: -

### C-07 Date Line

- [x] Typography: Mono/Small and Mono/Small Strong, already matched

Evidence: -

### C-08 Window

- [x] Typography: Window title (copier dialog) 13px -> Mono/Small 12/16

Evidence: -

### C-09 Connection Card

- [x] Typography: caption via .caption (now 12px), name via display-m. Print initials are decorative, unstyled in Figma.

Evidence: -

### C-13 Form Field

- [x] Typography: label Mono/Label matches .label. Error text is unstyled in Figma (see hygiene).

Evidence: -

### C-14 Choice

- [x] Typography: 13px -> Mono/Body 14/20; checked weight 600 -> 500 (Mono/Label)

Evidence: -

### C-16 App Header

- [x] Typography: member name Mono/Body via body text, already matched

Evidence: -

### C-17 App Footer

- [x] Typography: .caption normal-case -> text-xs text-muted (Mono/Small 12/16, no tracking)

Evidence: -

### C-18 Save Bar

- [x] Typography: none (button only)

Evidence: -

### C-19 Directory Row

- [x] Typography: name font-semibold 20/24 -> display-s (Bold); caption .caption now 12px; place Mono/Body. Thumb initials decorative, unstyled in Figma.

Evidence: -

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

Evidence: -

### C-24 Next Action Card

- [x] Typography: Mono/Body, already matched

Evidence: -

### C-25 Search Field

- [ ] Typography: both text layers unstyled in Figma (see hygiene); depends on the Field decision

Evidence: -

### C-26 Layout Toggle

- [x] Typography: via Segment and Button

Evidence: -

### C-27 Show More

- [x] Typography: count Mono/Body (text-sm), already matched

Evidence: -

### C-28 Directory Bar

- [x] Typography: via nested components

Evidence: -
