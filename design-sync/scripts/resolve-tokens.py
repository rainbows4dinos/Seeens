"""Show which tokens change their final resolved value between two versions of the token CSS.
Use it after a token sync to prove a refactor (aliases, new primitives) changed nothing visible,
or to list exactly what did change.

  git show HEAD:path/to/tokens.css > /tmp/before.css
  python3 design-sync/scripts/resolve-tokens.py /tmp/before.css path/to/tokens.css
"""
import dslib


def main():
    p = dslib.parser(__doc__)
    p.add_argument('before'); p.add_argument('after')
    a = p.parse_args(); ctx = dslib.Ctx(a); cfg = ctx.config
    b = dslib.mode_envs(dslib.read_css([a.before]), cfg)
    n = dslib.mode_envs(dslib.read_css([a.after]), cfg)
    changed = 0
    for mode in b:
        be, ae = b[mode], n[mode]
        for t in sorted(set(be) | set(ae)):
            rb, ra = dslib.resolve(be, t), dslib.resolve(ae, t)
            if rb != ra:
                changed += 1
                print('%-8s %-40s %s -> %s' % (mode, t, rb or '(none)', ra or '(none)'))
    first = next(iter(b))
    print('tokens before %d, after %d, added %d, removed %d, resolved changes %d' % (
        len(b[first]), len(n[first]), len(set(n[first]) - set(b[first])), len(set(b[first]) - set(n[first])), changed))


if __name__ == '__main__':
    main()
