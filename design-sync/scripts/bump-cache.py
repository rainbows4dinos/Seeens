"""Bump ?v= cache revisions for changed assets, following import chains.

When ui.js changes, the reference to it in app.js gets a new revision. That changes app.js, so the
reference to app.js in bootstrap.js is bumped too, and so on up to the HTML entry pages. Missing a link
in that chain is how a fix ships but never reaches the browser.

  python3 design-sync/scripts/bump-cache.py 20261025-batch-3 tools/shared/components.css tools/app/ui.js
  python3 design-sync/scripts/bump-cache.py 20261025-batch-3 --git          every file changed since HEAD
  add --dry-run to list the edits without writing

config.json:
  "cacheRevisions": { "files": ["tools/**/*.html", "tools/**/*.js", "tools/**/*.mjs", "tools/**/*.css"] }
"files" are the files that may contain ?v= references. Paths are relative to the repo root.
"""
import os, re, subprocess
import dslib

REF = re.compile(r'''(["'(])([^"'()\s?]+?\.(?:css|js|mjs))\?v=([\w.-]+)''')


def main():
    p = dslib.parser(__doc__)
    p.add_argument('revision')
    p.add_argument('changed', nargs='*')
    p.add_argument('--git', action='store_true', help='add files changed in the working tree')
    p.add_argument('--dry-run', action='store_true')
    a = p.parse_args()
    ctx = dslib.Ctx(a)
    cfg = ctx.config.get('cacheRevisions', {})
    files = [f for f in ctx.repo_glob(cfg.get('files', [])) if os.path.isfile(f)]
    if not files:
        dslib.fail('config cacheRevisions.files matches nothing')
    changed = {os.path.realpath(ctx.repo(c)) for c in a.changed}
    if a.git:
        out = subprocess.check_output(['git', '-C', ctx.root, 'status', '--porcelain'], text=True)
        changed |= {os.path.realpath(os.path.join(ctx.root, l[3:].split(' -> ')[-1])) for l in out.splitlines()}
    if not changed:
        dslib.fail('nothing changed: pass paths or --git')
    texts = {f: open(f).read() for f in files}
    initial, hit = set(changed), set()
    edits = []
    queue = list(changed)
    while queue:
        target = queue.pop()
        for f in files:
            base = os.path.dirname(f)

            def sub(m):
                ref = m.group(2)
                path = os.path.join(ctx.root, ref.lstrip('/')) if ref.startswith('/') else os.path.join(base, ref)
                if os.path.realpath(path) != target:
                    return m.group(0)
                hit.add(target)
                if m.group(3) == a.revision:
                    return m.group(0)
                edits.append('%s: %s %s -> %s' % (os.path.relpath(f, ctx.root), ref, m.group(3), a.revision))
                return '%s%s?v=%s' % (m.group(1), ref, a.revision)
            new = REF.sub(sub, texts[f])
            if new != texts[f]:
                texts[f] = new
                rf = os.path.realpath(f)
                if rf not in changed:
                    changed.add(rf)
                    queue.append(rf)
    for e in edits:
        print(e)
    if not a.dry_run:
        for f, t in texts.items():
            if open(f).read() != t:
                open(f, 'w').write(t)
    print('%d references %s' % (len(edits), 'would change' if a.dry_run else 'bumped'))
    for c in sorted(initial):
        if c.endswith(('.css', '.js', '.mjs')) and c not in hit:
            print('note: no ?v= reference to %s found in cacheRevisions.files' % os.path.relpath(c, ctx.root))


if __name__ == '__main__':
    main()
