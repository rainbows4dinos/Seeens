// Screenshot and measure every [data-shot] element on a preview page, in every mode.
//
// Setup, once, in a scratch folder outside the repo (so the repo's node_modules are not touched):
//   npm i playwright @fontsource/<family> ...       e.g. @fontsource/inter @fontsource/ibm-plex-mono
// Serve the repo root over HTTP (file:// breaks module imports), then from the scratch folder:
//   node <repo>/design-sync/scripts/shot.mjs http://localhost:8000/design-sync/preview.html <outDir> [only-name ...]
//
// Reads design-sync/config.json "preview":
//   "modes":  { "dark": "", "light": "?theme=light" }     query suffix per mode (default: one mode, no suffix)
//   "fonts":  [["inter", "Inter", [300, 400, 500, 600]], ["ibm-plex-mono", "IBM Plex Mono", [400]]]
//             @fontsource package, CSS family, weights. Web font requests are blocked and these are injected,
//             so results do not depend on network access. List every weight the text styles use.
//   "viewport": [1200, 900]
// Writes <outDir>/<name>-<mode>.png per element and <outDir>/metrics.json with the element's and its
// children's computed size, padding, gap, radius, colors, border and font.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Resolve playwright from the folder you run in, not from this file, so the repo needs no node_modules.
const { chromium } = createRequire(resolve(process.cwd(), 'noop.js'))('playwright');

const [url, out = 'shots', ...only] = process.argv.slice(2);
if (!url) { console.error('usage: node shot.mjs <preview url> [outDir] [data-shot names...]'); process.exit(1); }
const cfgPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'config.json');
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')).preview || {} : {};
const modes = cfg.modes || { default: '' };
const [vw, vh] = cfg.viewport || [1200, 900];
mkdirSync(out, { recursive: true });

const fontFile = (pkg, w) => resolve('node_modules/@fontsource', pkg, 'files', `${pkg}-latin-${w}-normal.woff2`);
const missingFonts = [];
const fontCss = (cfg.fonts || []).flatMap(([pkg, fam, weights]) => weights.map((w) => {
  const f = fontFile(pkg, w);
  if (!existsSync(f)) { missingFonts.push(`${pkg} ${w}`); return ''; }
  // Inlined as data URIs: an http page cannot load file:// fonts.
  return `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(f).toString('base64')}) format('woff2')}`;
})).join('\n');
if (missingFonts.length) console.warn('missing @fontsource files (run npm i in this folder):', missingFonts.join(', '));

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const metrics = {};
let count = 0;
for (const [mode, suffix] of Object.entries(modes)) {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: vw, height: vh } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (fontCss) await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(url + suffix);
  await page.waitForLoadState('networkidle');
  if (fontCss) await page.addStyleTag({ content: fontCss });
  await page.addStyleTag({ content: '*{animation-play-state:paused!important;transition:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  if (errors.length) console.warn(`[${mode}] page errors:`, errors.join(' | '));
  for (const el of await page.$$('[data-shot]')) {
    const name = await el.getAttribute('data-shot');
    if (only.length && !only.includes(name)) continue;
    const target = (await el.$(':scope > *')) || el;
    await target.screenshot({ path: `${out}/${name}-${mode}.png` });
    metrics[`${name}-${mode}`] = await target.evaluate((n) => {
      const box = (e, origin) => {
        const c = getComputedStyle(e), r = e.getBoundingClientRect();
        return {
          cls: typeof e.className === 'string' ? e.className : e.className.baseVal,
          x: Math.round(r.left - origin.left), y: Math.round(r.top - origin.top), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
          padding: c.padding, gap: c.gap, radius: c.borderRadius, bg: c.backgroundColor, color: c.color,
          border: `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}`,
          font: `${c.fontWeight} ${c.fontSize}/${c.lineHeight} ${c.fontFamily.split(',')[0]}`,
        };
      };
      const origin = n.getBoundingClientRect();
      return { ...box(n, origin), kids: [...n.children].map((k) => box(k, origin)) };
    });
    count++;
  }
  await page.close();
}
await browser.close();
writeFileSync(`${out}/metrics.json`, JSON.stringify(metrics, null, 1));
console.log(`${count} shots in ${out}`);
