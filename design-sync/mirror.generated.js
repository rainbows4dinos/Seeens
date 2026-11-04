// Ledger mirror for the Figma canvas. Do not run this template directly:
//   python3 design-sync/scripts/ledger.py mirror
// writes design-sync/mirror.generated.js with DATA filled in. Pass that file's contents as the use_figma code
// (skillNames "figma-use,figma-generate-design"; read both skills first).
//
// Writes only to the mirror page. Removes the old mirror frame (same name, same page) and rebuilds it in this
// one call, so a failed run is fixed by running it again. Uses the library's own variables, text styles and
// status badge, named in config.json "mirrorStyle"; anything missing falls back to a raw value and is reported.
const DATA = {"target":{"page":"Sync status","frame":"Design sync ledger"},"style":{"variables":{"surface":"color/bg/surface","headerFill":"color/bg/ground","rowStroke":"color/border/subtle","text":"color/text/primary","textSecondary":"color/text/secondary","textMuted":"color/text/secondary"},"numberVariables":{"padding":"space/2xl","sectionGap":"space/xl","stackGap":"space/sm","cellGap":"space/md","rowPad":"space/sm"},"textStyles":{"title":"Display/L","subtitle":"Mono/Body","note":"Mono/Small","section":"Display/S","head":"Mono/Caption","body":"Mono/Small","mono":"Mono/Small"},"badge":{"nodeId":"10:15","property":"Status","values":{"synced":"Crush","fixed-in-figma":"Crush","pending":"Heard of","skipped":"Heard of","needs-decision":"Let's play","blocked":"Homie","needs-figma-fix":"Homie"}},"notesLimit":280},"title":"Design sync ledger","subtitle":"Seeens · Figma to code · 26 open","note":"Mirror of design-sync/ledger.md, generated 2026-11-04 at code ae5e9ae (2026-11-04). Edits made here are overwritten on the next run.","totals":[["pending",25],["synced",22],["skipped",8],["needs-figma-fix",1],["fixed-in-figma",6]],"inventory":[["Variables","58","7 groups (58 items)","5","0"],["Text styles","13","13","13","0"],["Effect styles","5","5","3","0"],["Paint styles","0","0","0","0"],["Components","31","31","1","25"]],"sections":[{"title":"Fix in Figma (7)","note":"Open: H-04. Click a Figma ref to jump to the node.","rows":[{"id":"V-03","item":"Number0 (1)","fref":"Color","cref":"src/app/globals.css","status":"fixed-in-figma","notes":"Fixed by the designer Nov 4: Number0 deleted from Color. Re-read confirms it is gone; nothing in code."},{"id":"H-01","item":"Nav Chip / Logo text","fref":"10:7","cref":"-","status":"fixed-in-figma","notes":"Fixed by the designer Nov 4: new Logo component (128:3618, vector wordmark) placed in Nav Chip Style=Logo. Code now uses it (C-30)."},{"id":"H-02","item":"Form Field / Error text","fref":"47:177","cref":"-","status":"fixed-in-figma","notes":"Fixed by the designer Nov 4: error text bound to Mono/Label. Code error text already uses that size and weight."},{"id":"H-03","item":"Outreach Entry / Date","fref":"50:227","cref":"-","status":"fixed-in-figma","notes":"Fixed by the designer Nov 4: date bound to Mono/Label (Plex Medium 14/20). Code already matches (text-sm, font-medium)."},{"id":"H-04","item":"Search Field / Text and ENTER hint","fref":"88:305","cref":"-","status":"needs-figma-fix","notes":"Nov 4: Mono/Hint and a Keyboard Hint component (133:4158) now exist, but Search Field (88:302) still has its own unstyled Text (Plex 16/24) and Enter Hint frame. Swap in a Keyboard Hint instance and bind the placeholder (Mono/Body per C-12)."},{"id":"H-05","item":"Connection Card / Print initials","fref":"95:460","cref":"-","status":"fixed-in-figma","notes":"Fixed by the designer Nov 4: initials bound to Display/XL (52/52). Code .card-print-initials 64px -> 52px."},{"id":"H-06","item":"Directory Row / Thumb initials","fref":"109:79","cref":"-","status":"fixed-in-figma","notes":"Fixed by the designer Nov 4: initials bound to Display/S (20/24). Code .row-thumb-initials 18px -> 20/24, -3%."}]},{"title":"Components (31)","note":"6 of 31 closed.","rows":[{"id":"C-01","item":"Avatar","fref":"82:2229","cref":"-","status":"skipped","notes":"Not built in code yet; part of account settings (#67)."},{"id":"C-02","item":"Button","fref":"10:22","cref":".button-primary, .button-secondary","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-03","item":"Nav Chip","fref":"10:8","cref":".nav-chip, .logo","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-04","item":"Segment","fref":"10:27","cref":".segmented > *","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass. Phones keep 12px under 480px so four tabs fit (code-owned responsive rule)."},{"id":"C-05","item":"Segmented Control","fref":"11:2","cref":".segmented","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-06","item":"Tag","fref":"10:15","cref":".tag","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-07","item":"Date Line","fref":"10:34","cref":".date-line","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-08","item":"Window","fref":"11:9","cref":".window, .dialog-title","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-09","item":"Connection Card","fref":"11:17","cref":"src/components/connection-card.tsx","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-10","item":"Tape","fref":"10:41","cref":".tape","status":"skipped","notes":"Synced in #114 (CSS strips stand in for the Figma shader). No text; not re-audited."},{"id":"C-11","item":"Pattern/Dot Grid","fref":"33:103","cref":"body background","status":"skipped","notes":"Code draws the dot grid as a CSS gradient on body, not a component."},{"id":"C-12","item":"Field","fref":"47:170","cref":".field","status":"pending","notes":"Decided Nov 4: 14px (Mono/Body) like Figma; 16px on touch screens (pointer: coarse) so iOS doesn't zoom on focus. Fields only. Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-13","item":"Form Field","fref":"47:172","cref":"label + .field","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-14","item":"Choice","fref":"47:187","cref":".choice","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-15","item":"Disclosure","fref":"47:197","cref":"-","status":"skipped","notes":"No longer used in code: Add connection shows More details open since #76."},{"id":"C-16","item":"App Header","fref":"48:191","cref":"src/app/(app)/layout.tsx","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-17","item":"App Footer","fref":"48:197","cref":"src/app/(app)/layout.tsx footer","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-18","item":"Save Bar","fref":"48:209","cref":".save-bar","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-19","item":"Directory Row","fref":"50:189","cref":"src/components/directory-results.tsx","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-20","item":"Follow-up Row","fref":"50:207","cref":"src/app/(app)/follow-ups/page.tsx","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-21","item":"Scene Row","fref":"50:209","cref":"src/app/(app)/scenes/page.tsx","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-22","item":"Affiliation Row","fref":"50:217","cref":"src/components/links-panel.tsx","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-23","item":"Outreach Entry","fref":"50:225","cref":"src/components/outreach-panel.tsx","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-24","item":"Next Action Card","fref":"50:232","cref":"src/components/next-action-panel.tsx","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-25","item":"Search Field","fref":"88:302","cref":".search-field, .search-hint","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-26","item":"Layout Toggle","fref":"88:352","cref":"src/components/layout-toggle.tsx","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-27","item":"Show More","fref":"88:354","cref":"src/components/directory-results.tsx","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-28","item":"Directory Bar","fref":"89:634","cref":".directory-bar","status":"pending","notes":"Layout, anatomy, and variants not re-audited in this pass."},{"id":"C-29","item":"Account Nav Item","fref":"82:2255","cref":"-","status":"skipped","notes":"Not built in code yet; part of account settings (#67)."},{"id":"C-30","item":"Logo","fref":"128:3618","cref":"public/brand/seeens-logo.svg, .logo","status":"synced","notes":"New in Figma Nov 4. Exported SVG: wordmark, cyan misregister copy (+2, +1, hard-light), and the rub-down texture as an SVG filter. Used in the header and on login."},{"id":"C-31","item":"Keyboard Hint","fref":"133:4158","cref":"kbd.search-hint","status":"pending","notes":"New in Figma Nov 4. Figma has a 2px corner radius; code corners are square everywhere (radius/none). Needs a call."}]},{"title":"Variables (7)","note":"7 of 7 closed.","rows":[{"id":"V-01","item":"Primitives: ink, paper, ground, plate, stock, red (15)","fref":"Primitives","cref":"src/app/globals.css :root","status":"synced","notes":"token-diff: all match"},{"id":"V-02","item":"Color: color/* (27)","fref":"Color","cref":"src/app/globals.css :root","status":"synced","notes":"token-diff: 26 matched; color/text/error only differed by line wrapping, rewritten on one line"},{"id":"V-03","item":"Number0 (1)","fref":"Color","cref":"src/app/globals.css","status":"fixed-in-figma","notes":"Fixed by the designer Nov 4: Number0 deleted from Color. Re-read confirms it is gone; nothing in code."},{"id":"V-04","item":"Spacing: space/*, stroke/*, size/control-height (11)","fref":"Spacing","cref":"src/app/globals.css :root","status":"synced","notes":"token-diff: all match (size/control-height -> --control-height)"},{"id":"V-05","item":"radius/none (1)","fref":"Spacing","cref":"src/app/globals.css :root","status":"synced","notes":"Added --radius-none: 0px. Tailwind radius utilities are already 0 via @theme."},{"id":"V-06","item":"Style Stacks: Dot Grid BG, Display Title, Window (3)","fref":"Style Stacks","cref":"-","status":"skipped","notes":"String variables holding plugin style-stack data, not design tokens. No CSS equivalent."},{"id":"V-07","item":"space/none (1)","fref":"Spacing","cref":"src/app/globals.css :root","status":"synced","notes":"Added by the designer Nov 4; added --space-none: 0px."}]},{"title":"Text styles (13)","note":"13 of 13 closed.","rows":[{"id":"T-01","item":"Display/XXL","fref":"text style","cref":"src/app/globals.css @utility display-xxl","status":"synced","notes":"text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-02","item":"Display/XL","fref":"text style","cref":"src/app/globals.css @utility display-xl","status":"synced","notes":"text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-03","item":"Display/L","fref":"text style","cref":"src/app/globals.css @utility display-l","status":"synced","notes":"text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-04","item":"Display/M","fref":"text style","cref":"src/app/globals.css @utility display-m","status":"synced","notes":"text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-05","item":"Display/S","fref":"text style","cref":"src/app/globals.css @utility display-s","status":"synced","notes":"text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-06","item":"UI/Nav","fref":"text style","cref":"src/app/globals.css .nav-chip","status":"synced","notes":"font-size 15px -> 16px (Figma 16/20, SemiBold, -1%). Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-07","item":"Mono/Body","fref":"text style","cref":"src/app/globals.css body","status":"synced","notes":"text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-08","item":"Mono/Small","fref":"text style","cref":"src/app/globals.css .date-line + .date-line-past","status":"synced","notes":"text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-09","item":"Mono/Small Strong","fref":"text style","cref":"src/app/globals.css .date-line + .date-line-future","status":"synced","notes":"text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-10","item":"Mono/Label","fref":"text style","cref":"src/app/globals.css .label","status":"synced","notes":"text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-11","item":"Mono/Caption","fref":"text style","cref":"src/app/globals.css .caption","status":"synced","notes":"font-size 11px -> 12px (Figma 12/16, 5%, uppercase). .tag follows it.. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-12","item":"Hand/Note","fref":"text style","cref":"src/app/globals.css .hand","status":"synced","notes":"text-style-classes: match. Font loads via Fontsource in src/app/layout.tsx."},{"id":"T-13","item":"Mono/Hint","fref":"text style","cref":"src/app/globals.css .search-hint","status":"synced","notes":"New in Figma Nov 4 (Plex 10, auto, 5%, uppercase). Code .search-hint already 10px, 5%, uppercase; keeps 14px line height for the bordered key."}]},{"title":"Effect styles (5)","note":"5 of 5 closed.","rows":[{"id":"E-01","item":"Shadow/Hard","fref":"effect style","cref":"src/app/globals.css --shadow-hard","status":"synced","notes":"Matches: 5 5 0 0 ink/900"},{"id":"E-02","item":"Shadow/Photo","fref":"effect style","cref":"src/app/globals.css --shadow-photo","status":"synced","notes":"Matches: 0 3 6 0 rgb(0 0 0 / 0.22)"},{"id":"E-03","item":"Misregister/Cyan","fref":"effect style","cref":"src/app/globals.css --misregister-cyan","status":"synced","notes":"Matches: 2 1 0 plate/cyan"},{"id":"E-04","item":"Texture/Rub-down","fref":"effect style","cref":"src/app/globals.css -","status":"skipped","notes":"Texture and noise effects have no CSS equivalent; rub-down wear is planned in #62"},{"id":"E-05","item":"Texture/Rub-down on paper","fref":"effect style","cref":"src/app/globals.css -","status":"skipped","notes":"Same as Texture/Rub-down (#62)"}]}]};
if (!DATA) throw new Error('DATA is empty: run ledger.py mirror and use mirror.generated.js');
const S = DATA.style || {};
const V = Object.assign({
  surface: 'surface/default', headerFill: 'surface/sunken', rowStroke: 'border/subtle',
  text: 'text/primary', textSecondary: 'text/secondary', textMuted: 'text/muted',
}, S.variables || {});
const T = S.textStyles || {};
const WIDTH = S.width || 1600;
const COLS = [['ID', 72, 'id', 'mono'], ['Item', 280, 'item', 'body'], ['Figma ref', 140, 'fref', 'mono'],
  ['Code ref', 240, 'cref', 'mono'], ['Status', 150, 'status', null], ['Notes', 0, 'notes', 'body']];
const INV_COLS = [['Category', 240], ['Figma count', 160], ['Ledger rows', 240], ['Synced', 120], ['Open', 120]];
const TONES = Object.assign({
  synced: 'positive', 'fixed-in-figma': 'positive', pending: 'neutral', skipped: 'accent',
  'needs-decision': 'highlight', blocked: 'negative', 'needs-figma-fix': 'negative',
}, (S.badge || {}).values || {});
const RAW = {
  surface: [1, 1, 1], headerFill: [0.96, 0.96, 0.96], rowStroke: [0.87, 0.87, 0.87],
  text: [0.1, 0.1, 0.1], textSecondary: [0.33, 0.33, 0.33], textMuted: [0.5, 0.5, 0.5],
  positive: [0.13, 0.5, 0.27], negative: [0.75, 0.18, 0.18], highlight: [0.72, 0.47, 0.05],
  neutral: [0.45, 0.45, 0.45], accent: [0.36, 0.3, 0.7], active: [0.16, 0.4, 0.78],
};
const NUM = Object.assign({ padding: 48, sectionGap: 40, stackGap: 8, cellGap: 16, rowPad: 8, tableGap: 12 }, S.numbers || {});
const TEXT_COLOR = { title: 'text', subtitle: 'textSecondary', note: 'textMuted', section: 'text', head: 'textSecondary', body: 'text', mono: 'textSecondary' };
const FALLBACK_SIZE = { title: 28, subtitle: 16, note: 12, section: 16, head: 12, body: 12, mono: 12 };
const FALLBACK_FONT = { family: 'Inter', style: 'Regular' };

const missing = [];
const vars = {};
for (const v of await figma.variables.getLocalVariablesAsync()) vars[v.name] = v;
const styles = {};
for (const s of await figma.getLocalTextStylesAsync()) styles[s.name] = s;
const RS = {};
const fonts = new Map([['fallback', FALLBACK_FONT]]);
for (const r of Object.keys(FALLBACK_SIZE)) {
  const name = T[r];
  RS[r] = name ? styles[name] || null : null;
  if (name && !RS[r]) missing.push('text style ' + name);
  if (RS[r]) fonts.set(JSON.stringify(RS[r].fontName), RS[r].fontName);
}
for (const f of fonts.values()) await figma.loadFontAsync(f);

const getVar = (k) => {
  const name = V[k] || (S.numberVariables || {})[k];
  if (!name) return null;
  if (!vars[name]) { if (!missing.includes('variable ' + name)) missing.push('variable ' + name); return null; }
  return vars[name];
};
const paint = (k) => {
  const c = RAW[k] || RAW.text;
  let p = { type: 'SOLID', color: { r: c[0], g: c[1], b: c[2] } };
  const v = getVar(k);
  if (v) p = figma.variables.setBoundVariableForPaint(p, 'color', v);
  return [p];
};
const num = (node, props, k) => {
  const v = getVar(k);
  for (const prop of props) { node[prop] = NUM[k]; if (v) node.setBoundVariable(prop, v); }
};

async function text(parent, r, chars, width) {
  const t = figma.createText();
  if (RS[r]) await t.setTextStyleIdAsync(RS[r].id);
  else { t.fontName = FALLBACK_FONT; t.fontSize = FALLBACK_SIZE[r]; }
  t.characters = String(chars === '' || chars == null ? '-' : chars);
  t.name = t.characters.slice(0, 60);
  t.fills = paint(TEXT_COLOR[r]);
  parent.appendChild(t);
  if (width === 0) { t.layoutSizingHorizontal = 'FILL'; t.textAutoResize = 'HEIGHT'; }
  else if (width) { t.resize(width, t.height); t.textAutoResize = 'HEIGHT'; }
  return t;
}

function stack(parent, dir, name, gapKey, fill = true) {
  const f = figma.createAutoLayout(dir, { name });
  f.fills = [];
  parent.appendChild(f);
  if (gapKey) num(f, ['itemSpacing'], gapKey);
  if (fill) f.layoutSizingHorizontal = 'FILL';
  return f;
}

let badgeSet = null;
const B = S.badge || {};
if (B.nodeId || B.key) {
  try {
    badgeSet = B.nodeId ? await figma.getNodeByIdAsync(B.nodeId) : null;
    if (!badgeSet && B.key) badgeSet = await figma.importComponentSetByKeyAsync(B.key);
    if (badgeSet && badgeSet.type !== 'COMPONENT_SET') badgeSet = null;
  } catch (e) { badgeSet = null; }
  if (!badgeSet) missing.push('badge component ' + (B.nodeId || B.key));
}
const badgeFonts = new Set();
async function badge(parent, status, label) {
  const tone = TONES[status] || 'neutral';
  if (badgeSet) {
    const prop = B.property || 'Tone';
    const variant = badgeSet.children.find((c) => c.variantProperties && c.variantProperties[prop] === tone) || badgeSet.defaultVariant;
    const inst = variant.createInstance();
    parent.appendChild(inst);
    const t = inst.findOne((n) => n.type === 'TEXT');
    if (t) {
      for (const seg of t.getStyledTextSegments(['fontName'])) {
        const k = JSON.stringify(seg.fontName);
        if (!badgeFonts.has(k)) { await figma.loadFontAsync(seg.fontName); badgeFonts.add(k); }
      }
      t.characters = label;
    }
    return inst;
  }
  const t = await text(parent, 'head', label);
  t.fills = paint(tone);
  return t;
}

function rule(row, filled) {
  num(row, ['paddingTop', 'paddingBottom'], 'rowPad');
  num(row, ['itemSpacing'], 'cellGap');
  row.fills = filled ? paint('headerFill') : [];
  row.strokes = paint('rowStroke');
  row.strokeTopWeight = 0; row.strokeLeftWeight = 0; row.strokeRightWeight = 0; row.strokeBottomWeight = 1;
}

function spacer(parent) {
  const s = figma.createFrame();
  s.name = 'spacer'; s.fills = [];
  parent.appendChild(s);
  s.resize(1, NUM.tableGap);
}

// ---------- build
let page = figma.root.children.find((p) => p.name === DATA.target.page);
const pageCreated = !page;
if (!page) { page = figma.createPage(); page.name = DATA.target.page; }
await figma.setCurrentPageAsync(page);
const old = page.children.filter((n) => n.name === DATA.target.frame);
const x = old.length ? old[0].x : 0, y = old.length ? old[0].y : 0;
const removed = old.map((n) => n.id);
old.forEach((n) => n.remove());

const root = figma.createAutoLayout('VERTICAL', { name: DATA.target.frame });
page.appendChild(root);
root.x = x; root.y = y;
root.resize(WIDTH, 100);
root.counterAxisSizingMode = 'FIXED';
root.primaryAxisSizingMode = 'AUTO';
root.fills = paint('surface');
num(root, ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'], 'padding');
num(root, ['itemSpacing'], 'sectionGap');

const header = stack(root, 'VERTICAL', 'Header', 'stackGap');
await text(header, 'title', DATA.title);
await text(header, 'subtitle', DATA.subtitle);
await text(header, 'note', DATA.note, 0);

const totals = stack(root, 'HORIZONTAL', 'Status totals', 'stackGap', false);
for (const [status, n] of DATA.totals) await badge(totals, status, status + ' ' + n);

const inv = stack(root, 'VERTICAL', 'Inventory');
await text(inv, 'section', 'Inventory');
await text(inv, 'note', 'Ledger rows reconcile with the Figma counts. Open counts everything not synced, skipped or fixed in Figma.', 0);
spacer(inv);
const ih = stack(inv, 'HORIZONTAL', 'Header row'); rule(ih, true);
for (const [h, w] of INV_COLS) await text(ih, 'head', h, w);
for (const cells of DATA.inventory) {
  const r = stack(inv, 'HORIZONTAL', 'Row'); rule(r, false);
  for (let i = 0; i < INV_COLS.length; i++) await text(r, 'body', cells[i], INV_COLS[i][1]);
}

const ids = new Set();
let rowFrames = 0;
for (const sec of DATA.sections) {
  const s = stack(root, 'VERTICAL', sec.title);
  await text(s, 'section', sec.title);
  if (sec.note) await text(s, 'note', sec.note, 0);
  spacer(s);
  const h = stack(s, 'HORIZONTAL', 'Header row'); rule(h, true);
  for (const [label, w] of COLS) await text(h, 'head', label, w || 0);
  for (const row of sec.rows) {
    const r = stack(s, 'HORIZONTAL', row.id + ' ' + row.item); rule(r, false);
    for (const [, w, key, role] of COLS) {
      if (key === 'status') {
        const cell = figma.createAutoLayout('HORIZONTAL', { name: 'Status' });
        cell.fills = [];
        r.appendChild(cell);
        cell.resize(w, 20);
        cell.counterAxisSizingMode = 'AUTO';
        cell.primaryAxisSizingMode = 'FIXED';
        await badge(cell, row.status, row.status);
        continue;
      }
      const t = await text(r, role, row[key], w || 0);
      if (key === 'fref' && /^\d+:\d+$/.test(row.fref)) {
        // A ref to a deleted node (or one Figma won't link to) stays plain text and is reported.
        try { t.setRangeHyperlink(0, t.characters.length, { type: 'NODE', value: row.fref }); }
        catch (e) { missing.push('link ' + row.id + ' ' + row.fref); }
      }
    }
    ids.add(row.id);
    rowFrames++;
  }
}

return {
  frameId: root.id, pageId: page.id, pageCreated, removedFrames: removed,
  sections: DATA.sections.map((s) => s.title), rowFrames, uniqueRows: ids.size,
  size: [Math.round(root.width), Math.round(root.height)],
  fallbacks: missing,
};
