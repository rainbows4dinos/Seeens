// Read-only inventory of a Figma library, one category per call (figma-use rule 20).
// Set CATEGORY (and PAGE_IDS for components), pass the file as use_figma code, and merge each result
// into design-sync/figma-inventory.json under the same key. Run it in the file that defines the library.
//
//   variables     { Collection: { modes: [..], vars: { name: value | [value per mode] } } }
//   textStyles    { name: { family, style, size, lineHeight, letterSpacing, textCase, textDecoration, bound } }
//   effectStyles  { name: "drop 1 1 0 0 #00000026 | ..." }
//   paintStyles   { name: "#hex" | "linear-gradient(...)" | "@variable" }
//   components    { name: { key, nodeId, page, axes: { axis: [values] }, props: { name: type }, nested: [names] } }
//
// Values: "#rrggbb" or "#rrggbbaa", numbers in px, strings, "@other/variable" for an alias, and
// "@other/variable 80%" for an alias with opacity. lineHeight is px, "N%", or "auto".
const CATEGORY = 'variables';
const PAGE_IDS = []; // components only: the library pages to scan, e.g. ['92:5175']. One page per call is fastest.
const COLLECTIONS = []; // variables only: limit to these collection names when one call would be too large
const MAX_BYTES = 45000;

const hex = (c, a = 1) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
  + (a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0') : '');
const round = (n) => Math.round(n * 1000) / 1000;
const varNames = {};
const nameOf = async (id) => {
  if (!(id in varNames)) { const v = await figma.variables.getVariableByIdAsync(id); varNames[id] = v ? v.name : '?' + id; }
  return varNames[id];
};
async function value(v) {
  if (v && v.type === 'VARIABLE_ALIAS') return '@' + await nameOf(v.id);
  if (v && v.color && v.color.type === 'VARIABLE_ALIAS') return '@' + await nameOf(v.color.id) + ' ' + Math.round((v.opacity ?? 1) * 100) + '%';
  if (v && typeof v === 'object' && 'r' in v) return hex(v, v.a ?? 1);
  return typeof v === 'number' ? round(v) : v;
}

let out = {};
if (CATEGORY === 'variables') {
  for (const col of await figma.variables.getLocalVariableCollectionsAsync()) {
    if (COLLECTIONS.length && !COLLECTIONS.includes(col.name)) continue;
    const modes = col.modes.map((m) => m.name);
    const vars = {};
    for (const id of col.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(id);
      const vals = [];
      for (const m of col.modes) vals.push(await value(v.valuesByMode[m.modeId]));
      vars[v.name] = modes.length === 1 ? vals[0] : vals;
    }
    out[col.name] = { modes, vars };
  }
} else if (CATEGORY === 'textStyles') {
  for (const s of await figma.getLocalTextStylesAsync()) {
    const lh = s.lineHeight.unit === 'AUTO' ? 'auto' : s.lineHeight.unit === 'PERCENT' ? round(s.lineHeight.value) + '%' : round(s.lineHeight.value);
    const ls = s.letterSpacing.value === 0 ? 0 : s.letterSpacing.unit === 'PERCENT' ? round(s.letterSpacing.value) + '%' : round(s.letterSpacing.value) + 'px';
    const bound = {};
    for (const [k, b] of Object.entries(s.boundVariables || {})) if (b && b.id) bound[k] = '@' + await nameOf(b.id);
    out[s.name] = { family: s.fontName.family, style: s.fontName.style, size: round(s.fontSize), lineHeight: lh, letterSpacing: ls };
    if (s.textCase !== 'ORIGINAL') out[s.name].textCase = s.textCase;
    if (s.textDecoration !== 'NONE') out[s.name].textDecoration = s.textDecoration;
    if (s.paragraphSpacing) out[s.name].paragraphSpacing = s.paragraphSpacing;
    if (Object.keys(bound).length) out[s.name].bound = bound;
  }
} else if (CATEGORY === 'effectStyles') {
  for (const s of await figma.getLocalEffectStylesAsync()) {
    const parts = [];
    for (const e of s.effects) {
      if (!e.visible) continue;
      const bv = e.boundVariables || {};
      const color = bv.color ? '@' + await nameOf(bv.color.id) : e.color ? hex(e.color, e.color.a) : '';
      if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
        parts.push([e.type === 'DROP_SHADOW' ? 'drop' : 'inner', e.offset.x, e.offset.y, e.radius, e.spread || 0, color].join(' '));
      } else parts.push((e.type === 'LAYER_BLUR' ? 'blur ' : 'backdrop-blur ') + e.radius);
    }
    out[s.name] = parts.join(' | ');
  }
} else if (CATEGORY === 'paintStyles') {
  for (const s of await figma.getLocalPaintStylesAsync()) {
    const p = s.paints[0];
    if (!p) { out[s.name] = null; continue; }
    if (p.type === 'SOLID') out[s.name] = p.boundVariables && p.boundVariables.color ? '@' + await nameOf(p.boundVariables.color.id) : hex(p.color, p.opacity ?? 1);
    else if (p.type.startsWith('GRADIENT')) out[s.name] = p.type.toLowerCase() + '(' + p.gradientStops.map((g) => hex(g.color, g.color.a) + ' ' + Math.round(g.position * 100) + '%').join(', ') + ')';
    else out[s.name] = p.type;
    if (s.paints.length > 1) out[s.name] += ' (+' + (s.paints.length - 1) + ' layers)';
  }
} else if (CATEGORY === 'components') {
  if (!PAGE_IDS.length) throw new Error('Set PAGE_IDS to the library page(s) that hold components');
  const page = await figma.getNodeByIdAsync(PAGE_IDS[0]);
  await figma.setCurrentPageAsync(page);
  const nodes = page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })
    .filter((n) => n.type === 'COMPONENT_SET' || !n.parent || n.parent.type !== 'COMPONENT_SET');
  for (const n of nodes) {
    const defs = n.componentPropertyDefinitions;
    const axes = {}, props = {};
    for (const [k, d] of Object.entries(defs)) {
      if (d.type === 'VARIANT') axes[k] = d.variantOptions;
      else props[k.replace(/#\d+:\d+$/, '')] = d.type;
    }
    const nested = new Set();
    const variants = n.type === 'COMPONENT_SET' ? n.children : [n];
    for (const v of variants) {
      for (const i of v.findAllWithCriteria({ types: ['INSTANCE'] })) {
        const m = await i.getMainComponentAsync();
        if (m) nested.add(m.parent && m.parent.type === 'COMPONENT_SET' ? m.parent.name : m.name);
      }
    }
    out[n.name] = { key: n.key, nodeId: n.id, page: page.name, axes, props, nested: [...nested].sort() };
  }
  if (PAGE_IDS.length > 1) out.__note = 'Only the first page was read. Run once per page, in parallel calls.';
}

const json = JSON.stringify(out);
if (json.length > MAX_BYTES) {
  const keys = Object.keys(out);
  throw new Error(`${CATEGORY}: ${json.length} bytes for ${keys.length} entries is over the return budget. Split it (one collection or page per call) instead of truncating.`);
}
return { category: CATEGORY, count: Object.keys(out).filter((k) => k !== '__note').length, data: out };
