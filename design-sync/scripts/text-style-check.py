"""Check every Figma text style against the code's typography tokens, and check that each
style's font family and weight are actually loaded by every entry page.

Values are compared after resolving var() chains in the default mode, so a token that points
at the right primitive passes. A style whose weight is not loaded is reported even when its
tokens are right: the browser falls back to another weight.

  python3 design-sync/scripts/text-style-check.py      exit 1 on any failure
"""
import re
import dslib

PROPS = {'family': 'family', 'size': 'size', 'lineHeight': 'line-height', 'weight': 'weight'}


def px(v, size):
    """Code value to px (or 'auto'). Unitless line heights are ratios of the font size."""
    if v is None:
        return None
    v = v.strip()
    if v == 'normal':
        return 'auto'
    m = re.fullmatch(r'(-?[\d.]+)(px|em|rem|%)?', v)
    if not m:
        return v
    n, u = float(m.group(1)), m.group(2)
    if u in (None, 'em'):
        n *= size if u == 'em' or n < 4 else 1
    elif u == '%':
        n = n / 100 * size
    elif u == 'rem':
        n *= 16
    return round(n, 2)


def figma_px(v, size):
    if v in (None, 'auto', 'AUTO'):
        return 'auto'
    if isinstance(v, str) and v.endswith('%'):
        return round(float(v[:-1]) / 100 * size, 2)
    if isinstance(v, str) and v.endswith('px'):
        v = v[:-2]
    return round(float(v), 2)


def loaded_fonts(ctx):
    """{page: set((family_lower, weight, italic))}, plus a 'global' entry from @font-face CSS."""
    f = ctx.config.get('fonts', {})
    out = {}

    def faces(text, acc):
        for body in re.findall(r'@font-face\s*\{([^}]*)\}', text):
            fam = re.search(r'font-family\s*:\s*([^;]+)', body)
            if not fam:
                continue
            w = re.search(r'font-weight\s*:\s*([^;]+)', body)
            ws = [int(x) for x in re.findall(r'\d+', w.group(1))] if w else [400]
            it = bool(re.search(r'font-style\s*:\s*italic', body))
            lo, hi = (ws[0], ws[-1]) if len(ws) > 1 else (ws[0], ws[0])
            for wt in range(100, 1000, 100):
                if lo <= wt <= hi:
                    acc.add((dslib.first_family(fam.group(1)), wt, it))

    def google(text, acc):
        for url in re.findall(r'fonts\.googleapis\.com/css2?\?([^"\'\s>]+)', text):
            for spec in re.findall(r'family=([^&]+)', url.replace('&amp;', '&')):
                fam, _, axes = spec.partition(':')
                fam = fam.replace('+', ' ').lower()
                if not axes:
                    acc.add((fam, 400, False)); continue
                if '@' not in axes:  # css v1 style: Inter:300,400,700italic
                    for t in axes.split(','):
                        m = re.match(r'(\d+)(i|italic)?', t)
                        if m:
                            acc.add((fam, int(m.group(1)), bool(m.group(2))))
                    continue
                names, vals = axes.split('@', 1)
                names = names.split(',')
                for tup in vals.split(';'):
                    parts = dict(zip(names, tup.split(',')))
                    it = parts.get('ital', '0') == '1'
                    w = parts.get('wght', '400')
                    if '..' in w:
                        lo, hi = (int(x) for x in w.split('..'))
                        for wt in range(100, 1000, 100):
                            if lo <= wt <= hi:
                                acc.add((fam, wt, it))
                    else:
                        acc.add((fam, int(float(w)), it))

    glob_set = set()
    for p in ctx.repo_glob(f.get('fontFaceCss', [])):
        faces(open(p).read(), glob_set)
    out['global'] = glob_set
    for p in ctx.repo_glob(f.get('entryPages', [])):
        s = set(); t = open(p).read()
        google(t, s); faces(t, s)
        out[p] = s
    return out


def main():
    a = dslib.parser(__doc__).parse_args()
    ctx = dslib.Ctx(a); cfg = ctx.config
    tcfg = cfg.get('textStyles', {})
    pattern = tcfg.get('token')
    if not pattern:
        dslib.fail('config textStyles.token is missing, e.g. "--nc-type-{slug}-{prop}"')
    props = {**PROPS, **tcfg.get('props', {})}
    envs = dslib.mode_envs(dslib.read_css(dslib.token_files(ctx)), cfg)
    env = envs[dslib.default_mode(cfg)]
    fonts = loaded_fonts(ctx)
    system = {s.lower() for s in cfg.get('fonts', {}).get('system', [])}
    pages = [p for p in fonts if p != 'global']
    bad = 0
    for name, s in dslib.text_styles(ctx.load('figma-inventory.json')).items():
        slug = name
        for old, new in tcfg.get('slugReplace', []):
            slug = slug.replace(old, new)
        slug = dslib.slugify(slug)
        tok = lambda prop: pattern.replace('{slug}', slug).replace('{prop}', props[prop])
        size = float(s['size'])
        weight, italic = dslib.weight_of(s.get('style', 'Regular'))
        problems = []
        got = {k: dslib.resolve(env, tok(k)) for k in props}
        if got['size'] is None:
            problems.append('no token %s' % tok('size'))
        else:
            if px(got['size'], size) != round(size, 2):
                problems.append('size code %s, Figma %spx' % (got['size'], dslib.fmt_num(size)))
            if px(got['lineHeight'], size) != figma_px(s.get('lineHeight'), size):
                problems.append('line-height code %s, Figma %s' % (got['lineHeight'], s.get('lineHeight')))
            if got['weight'] is None or dslib.fmt_num(re.sub(r'[^\d.]', '', got['weight']) or 0) != str(weight):
                problems.append('weight code %s, Figma %s (%s)' % (got['weight'], s.get('style'), weight))
            if got['family'] is not None and dslib.first_family(got['family']) != s['family'].lower():
                problems.append('family code %s, Figma %s' % (got['family'], s['family']))
            if 'letterSpacing' in props and s.get('letterSpacing') not in (None, 0, '0%', '0px'):
                ls = dslib.resolve(env, tok('letterSpacing'))
                if ls is None or px(ls if ls.endswith(('px', 'em', '%')) else ls + 'px', size) != figma_px(s['letterSpacing'], size):
                    problems.append('letter-spacing code %s, Figma %s' % (ls, s['letterSpacing']))
        fam = s['family'].lower()
        key = (fam, weight, italic)
        if pages and fam not in system:
            missing = [p for p in pages if key not in fonts[p] and key not in fonts['global']]
            if missing:
                problems.append('%s %s%s not loaded on: %s' % (s['family'], weight, ' italic' if italic else '',
                                ', '.join(ctx.repo(p).replace(ctx.root + '/', '') for p in missing)))
        bad += bool(problems)
        print(('ok   ' if not problems else 'BAD  ') + name + ('' if not problems else '  ' + '; '.join(problems)))
    # Bindings: a style bound to fewer variables than most of its siblings usually missed one in Figma.
    styles_all = dslib.text_styles(ctx.load('figma-inventory.json'))
    bound = {n: set(s['bound']) for n, s in styles_all.items() if isinstance(s.get('bound'), (dict, list))}
    if bound:
        from collections import Counter
        common = {k for k, c in Counter(k for b in bound.values() for k in b).items() if c > len(bound) / 2}
        for n, b in bound.items():
            if common - b:
                print('note %s is not bound to a variable for: %s (most styles are). Likely a needs-figma-fix row.'
                      % (n, ', '.join(sorted(common - b))))
    if not pages:
        print('note: config fonts.entryPages is empty, so font loading was not checked')
    print('%d styles, %d failing' % (len(dslib.text_styles(ctx.load("figma-inventory.json"))), bad))
    raise SystemExit(1 if bad else 0)


if __name__ == '__main__':
    main()
