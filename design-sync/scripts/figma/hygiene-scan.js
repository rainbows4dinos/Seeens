// Read-only hygiene scan of library components (drift-audit.md, step 3). One page per call.
// For each component set or standalone component: unbound padding, gap, radius, fills and strokes,
// text without a text style, and nested instance names (for dependsOn in the component map).
// Run it again after fixes; the totals should drop to the items left on purpose.
//
// Not checked: values inside nested instances (they belong to the nested component, and the API may not
// expose them). Report those as unverified, never as unbound.
// Text styles are checked separately: read-inventory.js (textStyles) lists the properties bound per style,
// and a style with fewer bindings than its siblings is usually a missed variable.
const PAGE_ID = '';           // the library components page, e.g. '92:5175'
const ONLY = [];              // optional: component or set names to scan, e.g. after a fix (ledger.py affected)
const CHECK_PAINTS = true;    // fills and strokes without a variable or paint style
const MAX_BYTES = 45000;

if (!PAGE_ID) throw new Error('Set PAGE_ID');
const page = await figma.getNodeByIdAsync(PAGE_ID);
await figma.setCurrentPageAsync(page);
const owners = page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })
  .filter((n) => n.type === 'COMPONENT_SET' || !n.parent || n.parent.type !== 'COMPONENT_SET')
  .filter((n) => !ONLY.length || ONLY.includes(n.name));
const notFound = ONLY.filter((name) => !owners.some((n) => n.name === name));

const LAYOUT = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'itemSpacing', 'counterAxisSpacing'];
const RADII = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
const insideInstance = (n, root) => { for (let p = n.parent; p && p !== root; p = p.parent) if (p.type === 'INSTANCE') return true; return false; };

const result = {};
let total = 0;
for (const owner of owners) {
  const issues = {};
  const add = (kind, node, detail) => {
    const i = issues[kind] || (issues[kind] = { count: 0, example: null });
    i.count++;
    if (!i.example) i.example = node.id + (detail ? ' ' + detail : '');
  };
  const nested = new Set();
  const variants = owner.type === 'COMPONENT_SET' ? owner.children : [owner];
  for (const v of variants) {
    const nodes = [v, ...v.findAll(() => true)];
    for (const n of nodes) {
      if (n !== v && insideInstance(n, v)) continue;
      const bv = n.boundVariables || {};
      if (n.type === 'INSTANCE') {
        const m = await n.getMainComponentAsync();
        if (m) nested.add(m.parent && m.parent.type === 'COMPONENT_SET' ? m.parent.name : m.name);
        continue; // its values belong to the nested component and are scanned there
      }
      if ('layoutMode' in n && n.layoutMode && n.layoutMode !== 'NONE') {
        for (const p of LAYOUT) {
          if (p === 'counterAxisSpacing' && n.layoutWrap !== 'WRAP') continue;
          if (p === 'itemSpacing' && (n.primaryAxisAlignItems === 'SPACE_BETWEEN' || n.children.length < 2)) continue; // a gap with one child does nothing
          if (n[p] && !bv[p]) add(p.startsWith('padding') ? 'padding' : 'gap', n, p + '=' + n[p]);
        }
      }
      if ('topLeftRadius' in n && n.type !== 'TEXT') {
        for (const p of RADII) if (n[p] && !bv[p]) { add('radius', n, p + '=' + n[p]); break; }
      }
      if (CHECK_PAINTS) {
        for (const prop of ['fills', 'strokes']) {
          if (!(prop in n) || n[prop] === figma.mixed) continue;
          const styleId = prop === 'fills' ? n.fillStyleId : n.strokeStyleId;
          if (styleId && styleId !== figma.mixed) continue;
          const bad = n[prop].some((p) => p.visible !== false && p.type === 'SOLID' && !(p.boundVariables && p.boundVariables.color));
          if (bad) add(prop, n);
        }
      }
      if (n.type === 'TEXT' && (!n.textStyleId || n.textStyleId === figma.mixed)) add('textStyle', n, JSON.stringify(n.characters.slice(0, 20)));
    }
  }
  const count = Object.values(issues).reduce((a, i) => a + i.count, 0);
  total += count;
  result[owner.name] = { nodeId: owner.id, variants: variants.length, unbound: count, issues, nested: [...nested].sort() };
}
const out = { page: page.name, components: owners.length, totalUnbound: total, notFound, result };
const size = JSON.stringify(out).length;
if (size > MAX_BYTES) throw new Error('Return is ' + size + ' bytes. Scan fewer components per call (filter owners by name).');
return out;
