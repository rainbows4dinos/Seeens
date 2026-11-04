"""Shared helpers for the design-sync scripts. Standard library only.

Every script takes the same location flags:
  --dir PATH    the design-sync folder (default: the folder that contains scripts/)
  --root PATH   the repo root that config paths are relative to (default: parent of --dir)
"""
import argparse, glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def parser(desc):
    p = argparse.ArgumentParser(description=desc)
    p.add_argument('--dir', default=os.path.dirname(HERE))
    p.add_argument('--root')
    return p


class Ctx:
    def __init__(self, args):
        self.dir = os.path.abspath(args.dir)
        self.root = os.path.abspath(args.root or os.path.join(self.dir, '..'))
        self.config = self.load('config.json', {})

    def path(self, name):
        return os.path.join(self.dir, name)

    def repo(self, rel):
        return rel if os.path.isabs(rel) else os.path.join(self.root, rel)

    def repo_glob(self, pats):
        out = []
        for pat in ([pats] if isinstance(pats, str) else pats or []):
            out += sorted(glob.glob(self.repo(pat), recursive=True))
        return out

    def load(self, name, default=None):
        p = self.path(name)
        if not os.path.exists(p):
            if default is not None:
                return default
            sys.exit('missing %s' % p)
        with open(p) as f:
            return json.load(f)

    def save(self, name, data):
        with open(self.path(name), 'w') as f:
            json.dump(data, f, indent=1, ensure_ascii=False)
            f.write('\n')


def fail(msg):
    print('ERROR: ' + msg, file=sys.stderr)
    sys.exit(1)


# ---------- naming

def apply_rules(name, rules):
    """Rules are [{"figma": regex, "css": template}], first match wins. {1}, {2} are regex groups as
    written; {1:slug} lowercases the group and turns / _ spaces and dots into dashes."""
    for r in rules or []:
        m = re.search(r['figma'], name)
        if m:
            out = r['css']
            for i, g in enumerate(m.groups(), 1):
                out = out.replace('{%d:slug}' % i, slugify(g or '')).replace('{%d}' % i, g or '')
            return out
    return None


def slugify(s):
    s = re.sub(r'[/_\s.]+', '-', s.strip().lower())
    return re.sub(r'-+', '-', s).strip('-')


def css_name(figma_name, cfg):
    t = cfg.get('tokens', {})
    hit = apply_rules(figma_name, t.get('rules'))
    if hit:
        return hit
    return t.get('prefix', '--') + slugify(figma_name)


# ---------- CSS

def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def blocks(css, include_media=False):
    """Yield (selector, {custom property: value}) for every rule, in source order.
    Rules inside @media are skipped unless include_media."""
    css = strip_comments(css)
    out, i, depth, start, sel_stack = [], 0, 0, 0, []
    while i < len(css):
        c = css[i]
        if c == '{':
            # Drop statements before the selector (an @import ending in ';').
            sel_stack.append(css[start:i].split(';')[-1].strip()); start = i + 1
        elif c == '}':
            body = css[start:i]
            sel = sel_stack.pop() if sel_stack else ''
            in_media = any(s.startswith('@') for s in sel_stack)
            if not sel.startswith('@') and (include_media or not in_media):
                decls = dict(re.findall(r'(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)', body))
                if decls:
                    out.append((norm_sel(sel), decls))
            start = i + 1
        i += 1
    return out


def norm_sel(sel):
    return ', '.join(s.strip() for s in re.sub(r'\s+', ' ', sel).split(','))


def token_files(ctx):
    t = ctx.config.get('code', {}).get('tokens')
    files = ctx.repo_glob(t)
    if not files:
        fail('config code.tokens matches no files: %r' % t)
    return files


def read_css(paths):
    return '\n'.join(open(p).read() for p in paths)


def mode_envs(css, cfg):
    """Return {mode: {token: raw value}}. config tokens.modes maps each Figma mode to the selectors
    that apply in it, in cascade order. tokens.base selectors apply to every mode."""
    t = cfg.get('tokens', {})
    modes = t.get('modes') or {'Default': [':root']}
    base = [norm_sel(s) for s in t.get('base', [':root'])]
    bl = blocks(css)
    envs = {}
    for mode, sels in modes.items():
        sels = [norm_sel(s) for s in ([sels] if isinstance(sels, str) else sels)]
        env = {}
        for sel, d in bl:
            if sel in base:
                env.update(d)
        for want in sels:
            for sel, d in bl:
                if sel == want and want not in base:
                    env.update(d)
        envs[mode] = env
    return envs


def default_mode(cfg):
    t = cfg.get('tokens', {})
    return t.get('defaultMode') or next(iter(t.get('modes') or {'Default': 0}))


def resolve(env, name, depth=0):
    v = env.get(name)
    if v is None or depth > 25:
        return None
    return re.sub(r'var\((--[\w-]+)(?:\s*,\s*[^)]*)?\)',
                  lambda m: resolve(env, m.group(1), depth + 1) or m.group(0), v).strip()


# ---------- values

def hex_of(v):
    v = v.strip().lower()
    m = re.fullmatch(r'#([0-9a-f]{3,8})', v)
    if m:
        h = m.group(1)
        if len(h) in (3, 4):
            h = ''.join(c * 2 for c in h)
        return '#' + (h[:6] if h[6:] in ('', 'ff') else h)
    m = re.fullmatch(r'rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)', v)
    if m:
        r, g, b, a = m.groups()
        h = '#' + ''.join('%02x' % round(float(x)) for x in (r, g, b))
        if a is not None:
            af = float(a[:-1]) / 100 if a.endswith('%') else float(a)
            if af < 1:
                h += '%02x' % round(af * 255)
        return h
    return None


def norm_css(v, cfg):
    """Normalize a raw CSS value to the inventory notation: @--token, @--token 80%, #hex, number, or text."""
    v = v.strip()
    m = re.fullmatch(r'var\((--[\w-]+)\)', v)
    if m:
        return '@' + m.group(1)
    m = re.fullmatch(r'color-mix\(in srgb,\s*var\((--[\w-]+)\)\s+([\d.]+)%,\s*transparent\)', v)
    if m:
        return '@%s %s%%' % (m.group(1), fmt_num(m.group(2)))
    h = hex_of(v)
    if h:
        return h
    m = re.fullmatch(r'(-?[\d.]+)(px)?', v)
    if m:
        return fmt_num(m.group(1))
    m = re.fullmatch(r'(-?[\d.]+)rem', v)
    if m:
        return fmt_num(float(m.group(1)) * cfg.get('tokens', {}).get('remBase', 16))
    return first_family(v)


def first_family(v):
    return v.split(',')[0].strip().strip('\'"').lower()


def fmt_num(x):
    f = float(x)
    return str(int(f)) if f == int(f) else ('%.4f' % f).rstrip('0')


def norm_figma(v, cfg):
    """Inventory value to the same notation, mapping alias names to CSS names."""
    if isinstance(v, bool):
        return str(v).lower()
    if isinstance(v, (int, float)):
        return fmt_num(v)
    v = str(v)
    if v.startswith('@'):
        parts = v[1:].rsplit(' ', 1)
        if len(parts) == 2 and parts[1].endswith('%'):
            return '@%s %s%%' % (css_name(parts[0], cfg), fmt_num(parts[1][:-1]))
        return '@' + css_name(v[1:], cfg)
    return hex_of(v) or first_family(v)


# ---------- inventory

def inventory_vars(inv):
    """Yield (collection, modes, name, {mode: value})."""
    for col, d in inv.get('variables', {}).items():
        modes = d.get('modes') or ['Default']
        for name, val in d['vars'].items():
            vals = val if isinstance(val, list) and len(modes) > 1 else [val]
            yield col, modes, name, dict(zip(modes, vals))


def text_styles(inv):
    """Normalize text styles to dicts. Accepts [family, style, size, lineHeight] lists too."""
    out = {}
    for name, s in inv.get('textStyles', {}).items():
        if isinstance(s, list):
            s = dict(zip(['family', 'style', 'size', 'lineHeight'], s))
        out[name] = s
    return out


WEIGHTS = {'thin': 100, 'hairline': 100, 'extralight': 200, 'ultralight': 200, 'light': 300,
           'regular': 400, 'normal': 400, 'book': 400, 'roman': 400, 'medium': 500,
           'semibold': 600, 'demibold': 600, 'bold': 700, 'extrabold': 800, 'ultrabold': 800,
           'black': 900, 'heavy': 900}


def weight_of(style):
    s = style.lower().replace(' ', '').replace('-', '').replace('italic', '') or 'regular'
    return WEIGHTS.get(s), 'italic' in style.lower()
