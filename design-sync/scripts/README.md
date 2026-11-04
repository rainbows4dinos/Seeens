# Design sync scripts

Helpers for `sync-design-system`. Copy this folder into the target repo as `design-sync/scripts/` at setup, then run everything from the repo root. Python scripts use the standard library only. Every script reads `design-sync/config.json` and accepts `--dir` (the design-sync folder) and `--root` (the repo root) to override the defaults.

| Script | Phase | What it does |
|---|---|---|
| `figma/read-inventory.js` | Audit | `use_figma` code that reads one category (variables, text styles, effect styles, paint styles, components) into the `figma-inventory.json` format. Read only. |
| `figma/hygiene-scan.js` | Audit | `use_figma` code that counts unbound padding, gap, radius, paints, and unstyled text per component, with an example node ID per issue, and lists nested components. Read only. |
| `token-diff.py` | Audit, token sync | Compares every Figma variable with the token CSS in every mode. Classes: match, alias-drift, value-drift, missing-in-code, plus code-only tokens. Writes `token-rows.json`. |
| `text-style-check.py` | Audit, token sync | Checks every text style against the typography tokens and that its family and weight load on every entry page. Exit 1 on failure. |
| `resolve-tokens.py` | Token sync | Before/after diff of final resolved values, to prove a token refactor changed only what it meant to. |
| `ledger.py` | All | `render` (with count reconciliation), `status`, `set`, `add`, `log`, `affected`, `mirror`. |
| `bump-cache.py` | Component sync | Bumps `?v=` revisions for changed assets and follows the import chain up to the entry pages. |
| `shot.mjs` | Component sync | Screenshots and computed metrics for every `[data-shot]` element in the preview page, per mode. |
| `figma/mirror.js` | Mirror | Template for the ledger mirror. `ledger.py mirror` fills it in. |

## Typical run

```bash
# Audit: run figma/read-inventory.js once per category with use_figma, merge into figma-inventory.json, then
python3 design-sync/scripts/token-diff.py
python3 design-sync/scripts/text-style-check.py
# write ledger.json rows from the results (one per variable group, text style, effect, paint style, component)
python3 design-sync/scripts/ledger.py render         # fails if row counts do not match the inventory

# Token sync: edit the token CSS, then
git show HEAD:tools/shared/tokens.css > /tmp/tokens-before.css
python3 design-sync/scripts/resolve-tokens.py /tmp/tokens-before.css tools/shared/tokens.css
python3 design-sync/scripts/token-diff.py && python3 design-sync/scripts/text-style-check.py

# Component sync, per batch
python3 design-sync/scripts/ledger.py status         # open rows and the next batch in dependency order
node design-sync/scripts/shot.mjs http://localhost:8000/design-sync/preview.html design-sync/evidence/batch-3
python3 design-sync/scripts/bump-cache.py 20261025-batch-3 --git
python3 design-sync/scripts/ledger.py set C-07 synced --evidence "design-sync/evidence/batch-3" --check "[x] gap -> space/3"

# Mirror
python3 design-sync/scripts/ledger.py mirror         # then pass design-sync/mirror.generated.js to use_figma
```

## config.json keys the scripts read

```json
{
  "figma": { "fileKey": "abc123", "fileName": "nextchapter", "libraryPages": { "components": "92:5175" } },
  "code": { "tokens": ["tools/shared/tokens.css"] },
  "tokens": {
    "prefix": "--nc-",
    "rules": [
      { "figma": "^status/(.+)$", "css": "--ds-badge-{1}" },
      { "figma": "^font-family/(.+)$", "css": "--nc-font-{1}" },
      { "figma": "^spacing/(.+)$", "css": "--nc-space-{1:slug}" }
    ],
    "base": [":root"],
    "modes": { "Dark": [":root, body"], "Light": [":root, body", "body.light"] },
    "defaultMode": "Dark",
    "ignoreCodeOnly": ["^--nc-shadow-"]
  },
  "textStyles": {
    "token": "--nc-type-{slug}-{prop}",
    "slugReplace": [["Type/", ""], ["Heading/", ""], ["Button Sm", "button-small"]],
    "props": { "family": "family", "size": "size", "lineHeight": "line-height", "weight": "weight" }
  },
  "fonts": {
    "entryPages": ["tools/*.html", "tools/prospect-tracker/index.html"],
    "fontFaceCss": [],
    "system": []
  },
  "inventoryCounts": { "Components": 24 },
  "batchSize": 3,
  "cacheRevisions": { "files": ["tools/**/*.html", "tools/**/*.js", "tools/**/*.mjs"] },
  "preview": {
    "modes": { "dark": "", "light": "?theme=light" },
    "fonts": [["inter", "Inter", [300, 400, 500, 600]], ["dm-serif-display", "DM Serif Display", [400]]]
  },
  "mirror": true,
  "mirrorTarget": { "page": "Sync status", "frame": "Design sync ledger" },
  "mirrorStyle": {
    "variables": { "surface": "surface/default", "headerFill": "surface/sunken", "rowStroke": "border/subtle",
                   "text": "text/primary", "textSecondary": "text/secondary", "textMuted": "text/muted" },
    "numberVariables": { "padding": "spacing/12", "sectionGap": "spacing/10", "stackGap": "spacing/2",
                         "cellGap": "spacing/4", "rowPad": "spacing/2" },
    "textStyles": { "title": "Type/Heading/H2", "subtitle": "Type/Body/Default", "note": "Type/Body/Small",
                    "section": "Type/Heading/H4", "head": "Type/UI/Label Sm", "body": "Type/Body/Small", "mono": "Type/Meta" },
    "badge": { "nodeId": "134:13529", "property": "Tone",
               "values": { "synced": "positive", "pending": "neutral", "needs-decision": "highlight", "blocked": "negative" } },
    "notesLimit": 280
  }
}
```

- `tokens.rules` are regexes tried in order; `{1}` is the first group as written and `{1:slug}` is the same group slugified (`0_5` becomes `0-5`). Names that match no rule become `prefix` plus the Figma path with `/`, `_`, spaces and dots turned into `-`.
- `tokens.modes` lists, per Figma mode name, the selectors whose declarations apply in that mode, in cascade order. `base` selectors apply to every mode. Collections with one mode are compared against `defaultMode`.
- Missing `inventoryCounts.Components` is fine when `figma-inventory.json` has a `components` object.
- `mirrorStyle` names must exist in the library. Anything missing falls back to a raw value and is listed in the mirror call's `fallbacks` return, so the agent can report it.

## Inventory format

`figma-inventory.json`, produced by `figma/read-inventory.js`:

```json
{
  "fileKey": "abc123",
  "readAt": "2026-10-24, code 66eac22",
  "variables": {
    "Primitives": { "modes": ["Base"], "vars": { "neutral/50": "#ffffff" } },
    "Theme": { "modes": ["Light", "Dark"], "vars": { "surface/default": ["@neutral/50", "@neutral/900"],
                                                     "overlay/scrim": ["@neutral/950 60%", "@neutral/950 80%"] } }
  },
  "textStyles": { "Type/Body/Default": { "family": "Inter", "style": "Light", "size": 16, "lineHeight": 24, "letterSpacing": 0 } },
  "effectStyles": { "shadow/sm": "drop 1 1 0 0 @border/control" },
  "paintStyles": {},
  "components": { "Button": { "key": "2b06...", "nodeId": "53:220", "axes": { "Size": ["Lg", "Sm"] }, "props": {}, "nested": ["Icon"] } }
}
```

Text styles may also be stored as `[family, style, size, lineHeight]` lists.
