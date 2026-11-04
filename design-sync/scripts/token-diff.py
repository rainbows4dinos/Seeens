"""Compare every Figma variable in figma-inventory.json with the code's token files.

Writes token-rows.json (one row per variable) and prints a summary by collection and class.
Classes: match, alias-drift (same resolved value, different alias chain), value-drift,
missing-in-code. Code tokens with no Figma variable are listed as code-only.

  python3 design-sync/scripts/token-diff.py [--dir design-sync] [--root .]
"""
import re
from collections import Counter
import dslib


def figma_resolve(index, name, mode, depth=0):
    if name not in index or depth > 25:
        return None
    modes, vals = index[name]
    v = vals.get(mode, next(iter(vals.values())))
    if isinstance(v, str) and v.startswith('@') and not v.endswith('%'):
        return figma_resolve(index, v[1:], mode, depth + 1)
    return v


def main():
    a = dslib.parser(__doc__).parse_args()
    ctx = dslib.Ctx(a); cfg = ctx.config
    inv = ctx.load('figma-inventory.json')
    envs = dslib.mode_envs(dslib.read_css(dslib.token_files(ctx)), cfg)
    dm = dslib.default_mode(cfg)
    index = {n: (m, v) for _, m, n, v in dslib.inventory_vars(inv)}
    rows, mapped = [], set()
    for col, modes, name, vals in dslib.inventory_vars(inv):
        cn = dslib.css_name(name, cfg); mapped.add(cn)
        per_mode, cls = [], 'match'
        present = False
        for mode, fv in vals.items():
            env = envs.get(mode, envs[dm])
            raw = env.get(cn)
            want = dslib.norm_figma(fv, cfg)
            if raw is None:
                per_mode.append('%s: missing (Figma %s)' % (mode, want)); cls = 'missing-in-code' if not present else cls
                continue
            present = True
            got = dslib.norm_css(raw, cfg)
            if got == want:
                continue
            rf = figma_resolve(index, name, mode)
            rc = dslib.resolve(env, cn)
            same = rf is not None and rc is not None and dslib.norm_figma(rf, cfg) == dslib.norm_css(rc, cfg)
            this = 'alias-drift' if same else 'value-drift'
            if cls in ('match', 'missing-in-code') or this == 'value-drift':
                cls = this
            per_mode.append('%s: code %s, Figma %s' % (mode, got, want))
        if present and cls == 'missing-in-code':
            cls = 'value-drift'
        rows.append({'collection': col, 'name': name, 'css': cn, 'cls': cls, 'detail': '; '.join(per_mode)})
    ctx.save('token-rows.json', rows)

    ignore = cfg.get('tokens', {}).get('ignoreCodeOnly', [])
    ts = cfg.get('textStyles', {}).get('token', '')
    if ts:
        ignore = ignore + ['^' + re.escape(ts.split('{')[0])]
    code_only = sorted(n for env in envs.values() for n in env
                       if n not in mapped and not any(re.search(p, n) for p in ignore))
    code_only = sorted(set(code_only))

    print('variables:', len(rows), '| token files:', ', '.join(dslib.token_files(ctx)))
    for (col, cls), n in sorted(Counter((r['collection'], r['cls']) for r in rows).items()):
        print('  %-14s %-16s %d' % (col, cls, n))
    for r in rows:
        if r['cls'] != 'match':
            print('%-15s %-28s %-34s %s' % (r['cls'], r['name'], r['css'], r['detail']))
    print('code-only (%d):' % len(code_only), ' '.join(code_only) or 'none')
    for col in sorted({r['collection'] for r in rows}):
        rs = [r for r in rows if r['collection'] == col]
        if len(rs) > 2 and all(r['cls'] == 'missing-in-code' for r in rs):
            print('hint: every %s variable is missing (%s -> %s). Check tokens.rules in config.json before calling this drift.'
                  % (col, rs[0]['name'], rs[0]['css']))


if __name__ == '__main__':
    main()
