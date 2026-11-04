"""Compare each Figma text style with the CSS rule that implements it, for codebases that keep
typography as classes or utilities instead of per-property tokens.

config textStyles.classes maps a style name to a selector as written in the CSS, for example
{"Display/S": "@utility display-s", "Mono/Label": ".label"}. A selector may list several rules
joined by " + " (later ones win), e.g. ".date-line + .date-line-future".

  python3 design-sync/scripts/text-style-classes.py      exit 1 on any mismatch
"""
import re
import dslib

WEIGHTS = {'thin': 100, 'extralight': 200, 'light': 300, 'regular': 400, 'medium': 500,
           'semibold': 600, 'bold': 700, 'extrabold': 800, 'black': 900}


def rules(css):
    """{selector: {prop: value}} for every rule, nested at-rules flattened, selectors normalized."""
    css = dslib.strip_comments(css)
    out, stack, start = {}, [], 0
    for i, c in enumerate(css):
        if c == '{':
            stack.append(css[start:i].split(';')[-1].strip()); start = i + 1
        elif c == '}':
            sel = stack.pop() if stack else ''
            decls = dict((k.strip(), v.strip()) for k, v in re.findall(r'([a-z-]+)\s*:\s*([^;{}]+?)\s*(?:;|$)', css[start:i]))
            if decls:
                key = re.sub(r'\s+', ' ', sel)
                out.setdefault(key, {}).update(decls)
            start = i + 1
    return out


def num(v):
    m = re.fullmatch(r'(-?[\d.]+)(px|em|rem)?', v or '')
    return (float(m.group(1)), m.group(2)) if m else (None, None)


def main():
    a = dslib.parser(__doc__).parse_args()
    ctx = dslib.Ctx(a)
    mapping = ctx.config.get('textStyles', {}).get('classes', {})
    css = rules(dslib.read_css(dslib.token_files(ctx)))
    styles = dslib.text_styles(ctx.load('figma-inventory.json'))
    bad = 0
    for name, s in styles.items():
        sel = mapping.get(name)
        if not sel:
            print('MISS %s  no class mapped in config textStyles.classes' % name); bad += 1; continue
        got = {}
        for part in sel.split(' + '):
            if part.strip() not in css:
                print('MISS %s  selector %r not found' % (name, part)); bad += 1; got = None; break
            got.update(css[part.strip()])
        if got is None:
            continue
        size = float(s['size'])
        want_w = WEIGHTS[re.sub(r'[\s-]', '', s['style'].lower().replace('italic', '')) or 'regular']
        problems = []
        n, u = num(got.get('font-size'))
        if n is None or (n * (16 if u == 'rem' else 1)) != size:
            problems.append('size %s, Figma %spx' % (got.get('font-size'), dslib.fmt_num(size)))
        lh = got.get('line-height')
        n, u = num(lh)
        lh_px = None if n is None else (n if u == 'px' else n * size)
        if s['lineHeight'] != 'auto' and lh_px != float(s['lineHeight']):
            problems.append('line-height %s, Figma %spx' % (lh, s['lineHeight']))
        w = got.get('font-weight', '400')
        if int(re.sub(r'\D', '', w) or 400) != want_w:
            problems.append('weight %s, Figma %s (%d)' % (w, s['style'], want_w))
        ls = s.get('letterSpacing') or 0
        want_em = float(ls[:-1]) / 100 if isinstance(ls, str) and ls.endswith('%') else 0.0
        n, u = num(got.get('letter-spacing', '0'))
        have_em = 0.0 if n is None or n == 0 else (n if u == 'em' else n / size)
        if abs(have_em - want_em) > 0.0005:
            problems.append('letter-spacing %s, Figma %s' % (got.get('letter-spacing', '0'), ls))
        want_case = {'UPPER': 'uppercase', 'LOWER': 'lowercase', 'TITLE': 'capitalize'}.get(s.get('textCase'), 'none')
        if got.get('text-transform', 'none') != want_case:
            problems.append('text-transform %s, Figma %s' % (got.get('text-transform', 'none'), want_case))
        bad += bool(problems)
        print(('ok   ' if not problems else 'BAD  ') + '%-18s %-36s %s' % (name, sel, '; '.join(problems)))
    print('%d styles, %d failing' % (len(styles), bad))
    raise SystemExit(1 if bad else 0)


if __name__ == '__main__':
    main()
