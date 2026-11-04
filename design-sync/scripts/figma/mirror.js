// Ledger mirror for the Figma canvas. Do not run this template directly:
//   python3 design-sync/scripts/ledger.py mirror
// writes design-sync/mirror.generated.js with DATA filled in. Pass that file's contents as the use_figma code
// (skillNames "figma-use,figma-generate-design"; read both skills first).
//
// Writes only to the mirror page. Removes the old mirror frame (same name, same page) and rebuilds it in this
// one call, so a failed run is fixed by running it again. Uses the library's own variables, text styles and
// status badge, named in config.json "mirrorStyle"; anything missing falls back to a raw value and is reported.
const DATA = /*__DATA__*/null;
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
      if (key === 'fref' && /^\d+:\d+$/.test(row.fref)) t.setRangeHyperlink(0, t.characters.length, { type: 'NODE', value: row.fref });
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
