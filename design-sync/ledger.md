# Design sync ledger

- Figma file: Seeens (QKSF4MTanGHlnbNvmUKDX0)
- Inventory read: 2026-11-05 evening (full re-read: variables, text/effect/paint styles, Components page 9:2 with axes and props)
- Code baseline: 3665f53 (2026-11-05)
- Rendered 2026-11-05 by scripts/ledger.py from ledger.json. Edit the JSON (or use ledger.py set), not this file.
- Direction: Figma to code

## Inventory

| Category | Figma count | Ledger rows | Synced | Open |
|---|---|---|---|---|
| Variables | 60 | 9 groups (60 items) | 6 | 1 |
| Text styles | 13 | 13 | 13 | 0 |
| Effect styles | 6 | 6 | 3 | 1 |
| Paint styles | 0 | 0 | 0 | 0 |
| Components | 34 | 34 | 6 | 23 |
| Figma hygiene | - | 6 | 0 | 0 |

Status totals: fixed-in-figma 7, needs-decision 3, needs-figma-fix 1, pending 21, skipped 8, synced 28

## Log

- 2026-11-04: Typography sync: 2 text styles fixed (UI/Nav, Mono/Caption), 10 components' type aligned to their bound styles, --radius-none added. dslib.blocks patched to ignore an @import before :root.
- 2026-11-04: Figma fixes Nov 4: Number0 removed, space/none added (synced), Form Field error bound to Mono/Label, Logo component added and synced to code.
- 2026-11-04: Nov 4 hygiene: H-03, H-05, H-06 fixed in Figma and synced; H-04 still open; added Mono/Hint and Keyboard Hint
- 2026-11-04: Search Field rebuilt in Figma (134:4549); H-04 fixed, C-25 synced with a clear button
- 2026-11-04: Off-token paddings fixed in Figma: Field 12 (md), Choice 8 (sm), Tag 8 (sm). Code follows (border + padding = token).
- 2026-11-05: Audit Nov 5 evening: full Figma re-read (60 variables, 13 text styles, 6 effect styles, 34 components with axes and props). New: color/border/inverse, Profile Pic, Photo Action, Favicon. Changed: Shadow/Hard (second drop), Field icon gap 4. Evidence: design-sync/evidence/audit-2026-11-05.md

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
| E-01 | Effect styles | Shadow/Hard | effect style | `src/app/globals.css --shadow-hard` | match | pending | Re-read Nov 5 evening: Figma Shadow/Hard is now two drops, 5 5 0 0 ink/900 plus 1 1 0 0 paper/photo (#fbfaf5). Code --shadow-hard has only the first. Value drift. |
| E-02 | Effect styles | Shadow/Photo | effect style | `src/app/globals.css --shadow-photo` | match | synced | Matches: 0 3 6 0 rgb(0 0 0 / 0.22) |
| E-03 | Effect styles | Misregister/Cyan | effect style | `src/app/globals.css --misregister-cyan` | match | synced | Matches: 2 1 0 plate/cyan |
| E-04 | Effect styles | Texture/Rub-down | effect style | `src/app/globals.css -` | missing-in-code | skipped | Texture and noise effects have no CSS equivalent; rub-down wear is planned in #62 |
| E-05 | Effect styles | Texture/Rub-down on paper | effect style | `src/app/globals.css -` | missing-in-code | skipped | Same as Texture/Rub-down (#62) |
| C-01 | Components | Avatar | 82:2229 | `-` | missing-in-code | skipped | Not built in code yet; part of account settings (#67). |
| C-02 | Components | Button | 10:22 | `.button-primary, .button-secondary` | structure-drift | pending | Re-audited Nov 5: Figma pad 8 + Label Frame pad 2, so text sits 10px in; code is 12px (0.75rem) + 1px border. Icon L at 8 and the 6px icon gap (4 + 2) match. Small drift. |
| C-03 | Components | Nav Chip | 10:8 | `.nav-chip, .logo` | structure-drift | synced | Re-audited Nov 5: pad 4/12, 1px ink border, UI/Nav (Hanken SemiBold 16/20). Matches .nav-chip. |
| C-04 | Components | Segment | 10:27 | `.segmented > *` | structure-drift | pending | Re-audited Nov 5: pad 12, Mono/Body, Icon swap prop. Icon-to-label gap is 4 in Figma; the type tabs use 1ch - 0.25ch (about 6px). Small drift. Phones keep 12px under 480px (code-owned). |
| C-05 | Components | Segmented Control | 11:2 | `.segmented` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-06 | Components | Tag | 10:15 | `.tag` | structure-drift | synced | Re-audited Nov 5: pad 2/8 incl. 1px border (code 1px 7px + border), Mono/Caption, status fills. Matches. |
| C-07 | Components | Date Line | 10:34 | `.date-line` | structure-drift | synced | Re-audited Nov 5: gap 6, arrow + label Mono/Small Strong (future) / Mono/Small (past). Matches .date-line. |
| C-08 | Components | Window | 11:9 | `.window, .dialog-title` | structure-drift | needs-figma-fix | Re-audited Nov 5. Figma Window strokes are inconsistent: Open has only a 1px left stroke, Collapsed has top/bottom/left (no right); code draws 1.5px all round. Which is intended? Also drift vs code: title 12px SemiBold (Mono/Small Strong) vs code 14px; collapse box 20px vs 24; content padding bottom 32 vs 24. Summary/Show summary props are in code (.profile-panel-summary). |
| C-09 | Components | Connection Card | 11:17 | `src/components/connection-card.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-10 | Components | Tape | 10:41 | `.tape` | structure-drift | skipped | Synced in #114 (CSS strips stand in for the Figma shader). No text; not re-audited. |
| C-11 | Components | Pattern/Dot Grid | 33:103 | `body background` | structure-drift | skipped | Code draws the dot grid as a CSS gradient on body, not a component. |
| C-12 | Components | Field | 47:170 | `.field` | structure-drift | pending | Re-audited Nov 5: Field's icon-to-text gap is now 4 (space/xs). Code uses 8: .search-field (35px text inset), .field-icon (35px), .combo-icon. Text should start at 1 + 12 + 16 + 4 = 33px. Font size decision (14, 16 on touch) stands. |
| C-13 | Components | Form Field | 47:172 | `label + .field` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-14 | Components | Choice | 47:187 | `.choice` | structure-drift | needs-decision | Re-audited Nov 5: pad 8, gap 8, Mono/Label, 18px box match. Figma checkbox has a 2px corner radius; code is square (radius/none). Same call as Keyboard Hint (C-31). |
| C-15 | Components | Disclosure | 47:197 | `-` | missing-in-code | skipped | No longer used in code: Add connection shows More details open since #76. |
| C-16 | Components | App Header | 48:191 | `src/app/(app)/layout.tsx` | structure-drift | needs-decision | Re-audited Nov 5: surface fill, 2px ink rule, 16px top/bottom match. Side padding: Figma 16px; code uses the page gutter (16 phones, 24 tablet, 32 at 1280) so the header lines up with the page content. Keep the gutter or go to 16? |
| C-17 | Components | App Footer | 48:197 | `src/app/(app)/layout.tsx footer` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-18 | Components | Save Bar | 48:209 | `.save-bar` | structure-drift | synced | Re-audited Nov 5: ground fill, pad 12/16, 1px ink top rule, gap 12. Matches .save-bar (inset rule). |
| C-19 | Components | Directory Row | 50:189 | `src/components/directory-results.tsx` | structure-drift | synced | Re-audited Nov 5: content pad 12, Default/Hover/Selected states (raised fill, Shadow/Soft, hairline; Selected 6px left bar) match .row-link incl. :hover/:focus-visible/[aria-current]. The 2px nudge is code-only motion. |
| C-20 | Components | Follow-up Row | 50:207 | `src/app/(app)/follow-ups/page.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-21 | Components | Scene Row | 50:209 | `src/app/(app)/scenes/page.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-22 | Components | Affiliation Row | 50:217 | `src/components/links-panel.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-23 | Components | Outreach Entry | 50:225 | `src/components/outreach-panel.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-24 | Components | Next Action Card | 50:232 | `src/components/next-action-panel.tsx` | structure-drift | pending | Layout, anatomy, and variants not re-audited in this pass. |
| C-25 | Components | Search Field | 134:4549 | `.search-field, .search-hint, src/components/search-clear.tsx` | structure-drift | pending | Was synced Nov 4 with 8px gaps. Its Field now has a 4px icon gap (see C-12); keycap and clear-button gaps to re-check with it. |
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
| C-31 | Components | Keyboard Hint | 133:4158 | `kbd.search-hint` | match | needs-decision | Figma Keyboard Hint has a 2px corner radius (still, re-read Nov 5); code corners are square everywhere (radius/none). Same call as the Choice checkbox (C-14). |
| V-08 | Variables | color/bg/raised (1) | Color | `src/app/globals.css --color-bg-raised` | missing-in-code | synced | New Nov 5 (#157): rows and cards lifted on hover or when open. Aliases paper/photo. Controls keep color/bg/hover. |
| E-06 | Effect styles | Shadow/Soft | effect style | `src/app/globals.css --shadow-soft` | missing-in-code | synced | New Nov 5 (#157): 4 4 0 0 ink at 30%. Code also has --shadow-soft-nudged (6 6) for rows nudged 2px up-left, so the shadow lands in the same place. |
| V-09 | Variables | color/border/inverse (1) | Color | `src/app/globals.css (missing)` | missing-in-code | pending | New in Figma (Window collapse icon border). Aliases paper/50. Add --color-border-inverse. |
| C-32 | Components | Profile Pic | 161:3824 | `src/components/photo-panel.tsx, .quick-view-thumb` | changed | pending | Moved to Components Nov 5. 108px, photo-paper fill, 1px ink border, initials Display/L in border/subtle, Photo Action bar (20px, ink, Mono/Hint + Add 12px). Not compared with PhotoPanel yet. |
| C-33 | Components | Photo Action | 161:3817 | `src/components/photo-panel.tsx` | changed | pending | Moved to Components Nov 5. Default/Hover; pad 4/12, gap 2, Add 12px + Mono/Hint label. Not compared yet. |
| C-34 | Components | Favicon | 161:3876 | `src/app/icon.*` | changed | pending | 16/32/48 variants. Check the app's icon files match. |

## Component checklists

### C-02 Button

- [x] Typography: Mono/Label = 14/20 Medium, already matched

Evidence: -

### C-03 Nav Chip

- [x] Typography: UI/Nav 15px -> 16px. Logo text is unstyled in Figma (see hygiene).
- [x] Logo variant uses the new Logo component; code .logo renders public/brand/seeens-logo.svg

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-04 Segment

- [x] Typography: Mono/Body 13px -> 14/20; current segment no longer bold (Figma On variants are Regular)

Evidence: -

### C-05 Segmented Control

- [x] Typography: none (no text)

Evidence: -

### C-06 Tag

- [x] Typography: Mono/Caption 11px -> 12px
- [x] Typography: Mono/Caption 11px -> 12px, weight pinned to 400 (it inherited 500 inside .label headings)

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-07 Date Line

- [x] Typography: Mono/Small and Mono/Small Strong, already matched

Evidence: design-sync/evidence/audit-2026-11-05.md

### C-08 Window

- [x] Typography: Window title (copier dialog) 13px -> Mono/Small 12/16

Evidence: -

### C-09 Connection Card

- [x] Typography: caption via .caption (now 12px), name via display-m. Print initials are decorative, unstyled in Figma.

Evidence: -

### C-12 Field

- [x] Typography: .field 16px -> 14/20, 16/24 under pointer: coarse (measured: desktop 14px h36, phone 16px h36)

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

Evidence: -

### C-24 Next Action Card

- [x] Typography: Mono/Body, already matched

Evidence: -

### C-25 Search Field

- [ ] Typography: both text layers unstyled in Figma (see hygiene); depends on the Field decision

Evidence: design-sync/evidence/search-field.png

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
