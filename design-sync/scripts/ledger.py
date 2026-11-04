"""Ledger tool: render ledger.md from ledger.json, show status, update rows, log, and build the Figma mirror.

  python3 design-sync/scripts/ledger.py render
  python3 design-sync/scripts/ledger.py status
  python3 design-sync/scripts/ledger.py set C-07 synced --notes "..." --evidence "design-sync/evidence/batch-3.png"
  python3 design-sync/scripts/ledger.py add Components "Avatar" --fref 205:679 --cref .nc-avatar --cls missing-in-code --status needs-decision --notes "Build or skip?"
  python3 design-sync/scripts/ledger.py log "Token sync: 50 tokens added"
  python3 design-sync/scripts/ledger.py affected "Input Label"   components to re-check after a Figma fix
  python3 design-sync/scripts/ledger.py mirror           writes design-sync/mirror.generated.js for use_figma

ledger.json is a list of rows: {id, cat, item, fref, cref, cls, status, notes, count?, checklist?, evidence?}.
`count` is how many inventory items a grouped row covers (a variables row like "color/text/* (6)").
Every write re-renders ledger.md, and render refuses to write when row counts do not match the inventory.
"""
import datetime, json, os, re, subprocess
from collections import Counter
import dslib

STATUSES = ['pending', 'synced', 'skipped', 'blocked', 'needs-decision', 'needs-figma-fix', 'fixed-in-figma']
CLOSED = {'synced', 'skipped', 'fixed-in-figma'}
COUNTED = ['Variables', 'Text styles', 'Effect styles', 'Paint styles', 'Components']
PREFIX = {'Variables': 'V', 'Text styles': 'T', 'Effect styles': 'E', 'Paint styles': 'P', 'Components': 'C', 'Figma hygiene': 'H'}
HYGIENE = 'Figma hygiene'


def load_rows(ctx):
    rows = ctx.load('ledger.json')
    return rows['rows'] if isinstance(rows, dict) else rows


def covers(r):
    if r.get('count') is not None:
        return int(r['count'])
    if r['cat'] == 'Variables':
        m = re.search(r'\((\d+)\)\s*$', r['item'])
        if m:
            return int(m.group(1))
    return 1


def inventory_counts(ctx):
    inv = ctx.load('figma-inventory.json')
    counts = {
        'Variables': sum(len(c['vars']) for c in inv.get('variables', {}).values()),
        'Text styles': len(inv.get('textStyles', {})),
        'Effect styles': len(inv.get('effectStyles', {})),
        'Paint styles': len(inv.get('paintStyles', {})),
    }
    if inv.get('components') is not None:
        counts['Components'] = len(inv['components'])
    counts.update(ctx.config.get('inventoryCounts', {}))
    return inv, counts


def validate(rows, counts):
    errs = []
    ids = Counter(r['id'] for r in rows)
    errs += ['duplicate id %s' % i for i, n in ids.items() if n > 1]
    for r in rows:
        if r['status'] not in STATUSES:
            errs.append('%s has unknown status %r' % (r['id'], r['status']))
        elif r['status'] not in ('synced', 'pending') and not r.get('notes'):
            errs.append('%s is %s with no reason in notes' % (r['id'], r['status']))
        if r['cat'] == 'Components' and r['status'] == 'synced' and not r.get('evidence'):
            errs.append('%s is a synced component with no evidence' % r['id'])
    for cat in COUNTED:
        if cat not in counts:
            continue
        got = sum(covers(r) for r in rows if r['cat'] == cat)
        if got != counts[cat]:
            errs.append('%s: ledger rows cover %d, Figma inventory has %d' % (cat, got, counts[cat]))
    return errs


def git_head(ctx):
    try:
        return subprocess.check_output(['git', '-C', ctx.root, 'log', '-1', '--format=%h (%cs)'],
                                       text=True, stderr=subprocess.DEVNULL).strip() or 'unknown'
    except Exception:
        return 'unknown'


def count_text(rs):
    cov = sum(covers(r) for r in rs)
    return '%d groups (%d items)' % (len(rs), cov) if cov != len(rs) else str(len(rs))


def render(ctx, rows, quiet=False):
    inv, counts = inventory_counts(ctx)
    errs = validate(rows, counts)
    if errs:
        dslib.fail('ledger.md not written:\n  ' + '\n  '.join(errs))
    fig = ctx.config.get('figma', {})
    out = ['# Design sync ledger', '',
           '- Figma file: %s (%s)' % (fig.get('fileName', 'library'), fig.get('fileKey', '?')),
           '- Inventory read: %s' % inv.get('readAt', 'unknown'),
           '- Code baseline: %s' % git_head(ctx),
           '- Rendered %s by scripts/ledger.py from ledger.json. Edit the JSON (or use ledger.py set), not this file.' % datetime.date.today(),
           '- Direction: Figma to code', '',
           '## Inventory', '',
           '| Category | Figma count | Ledger rows | Synced | Open |', '|---|---|---|---|---|']
    for c in COUNTED + sorted({r['cat'] for r in rows} - set(COUNTED)):
        rs = [r for r in rows if r['cat'] == c]
        if not rs and c not in counts:
            continue
        out.append('| %s | %s | %s | %d | %d |' % (c, counts.get(c, '-'), count_text(rs),
                   sum(r['status'] == 'synced' for r in rs), sum(r['status'] not in CLOSED for r in rs)))
    out += ['', 'Status totals: ' + ', '.join('%s %d' % kv for kv in sorted(Counter(r['status'] for r in rows).items()))]
    log = ctx.load('log.json', [])
    if log:
        out += ['', '## Log', ''] + ['- %(date)s: %(entry)s' % e for e in log]
    out += ['', '## Rows', '', '| ID | Category | Item | Figma ref | Code ref | Class | Status | Notes |',
            '|---|---|---|---|---|---|---|---|']
    esc = lambda s: str(s or '').replace('|', '\\|').replace('\n', ' ')
    for r in rows:
        out.append('| %s | %s | %s | %s | `%s` | %s | %s | %s |' % tuple(
            esc(r.get(k)) for k in ('id', 'cat', 'item', 'fref', 'cref', 'cls', 'status', 'notes')))
    checked = [r for r in rows if r.get('checklist') or r.get('evidence')]
    if checked:
        out += ['', '## Component checklists', '']
        for r in checked:
            out += ['### %s %s' % (r['id'], r['item']), ''] + ['- ' + c for c in r.get('checklist', [])] + \
                   ['', 'Evidence: ' + (r.get('evidence') or '-'), '']
    with open(ctx.path('ledger.md'), 'w') as f:
        f.write('\n'.join(out).rstrip('\n') + '\n')
    if not quiet:
        print('ledger.md written: %d rows, counts reconcile' % len(rows))


def topo(names, cmap):
    deps = {c['figma']['name']: c.get('dependsOn', []) for c in cmap.get('components', [])}
    for c in cmap.get('unmatched', {}).get('figmaOnly', []):
        if isinstance(c, dict):
            deps.setdefault(c.get('name'), c.get('dependsOn', []))
    order, seen = [], set()

    def visit(n, stack=()):
        if n in seen or n in stack:
            return
        for d in deps.get(n, []):
            visit(d, stack + (n,))
        seen.add(n)
        order.append(n)
    for n in names:
        visit(n)
    return [n for n in order if n in names]


def affected(ctx, rows, names):
    """The named components plus every component that contains them, directly or through others."""
    cmap = ctx.load('component-map.json', {})
    deps = {c['figma']['name']: set(c.get('dependsOn', [])) for c in cmap.get('components', [])}
    for c in cmap.get('unmatched', {}).get('figmaOnly', []):
        if isinstance(c, dict):
            deps.setdefault(c.get('name'), set(c.get('dependsOn', [])))
    unknown = [n for n in names if n not in deps]
    if unknown:
        print('not in component-map.json: ' + ', '.join(unknown))
    hit = set(names)
    while True:
        more = {c for c, d in deps.items() if d & hit} - hit
        if not more:
            break
        hit |= more
    by_item = {r['item']: r for r in rows if r['cat'] == 'Components'}
    for n in topo(sorted(hit), cmap) or sorted(hit):
        r = by_item.get(n)
        print('%-6s %-16s %s%s' % (r['id'] if r else '-', r['status'] if r else '(no row)', n, '' if n in names else '  (contains it)'))


def status(ctx, rows):
    _, counts = inventory_counts(ctx)
    short = ['pending', 'synced', 'skipped', 'blocked', 'decision', 'fig-fix', 'fig-done']
    print('%-15s %s' % ('', ' '.join('%-8s' % s for s in short)))
    cats = sorted({r['cat'] for r in rows}, key=lambda c: (COUNTED.index(c) if c in COUNTED else 99, c))
    for c in cats:
        cc = Counter(r['status'] for r in rows if r['cat'] == c)
        print('%-15s %s' % (c, ' '.join('%-8s' % (cc.get(s) or '.') for s in STATUSES)))
    open_rows = [r for r in rows if r['status'] not in CLOSED]
    print('\nopen (%d):' % len(open_rows))
    for r in open_rows:
        print('  %-6s %-16s %-24s %s' % (r['id'], r['status'], r['item'][:24], (r.get('notes') or '')[:90]))
    pending = [r['item'] for r in rows if r['cat'] == 'Components' and r['status'] == 'pending']
    if pending:
        size = ctx.config.get('batchSize', 3)
        order = topo(pending, ctx.load('component-map.json', {}))
        print('\nnext batch (%d pending, dependency order): %s' % (len(order), ', '.join(order[:size])))
    errs = validate(rows, counts)
    print('\nreconcile: ' + ('ok' if not errs else '; '.join(errs)))


def mirror(ctx, rows):
    cfg = ctx.config
    target = {'page': 'Sync status', 'frame': 'Design sync ledger', **cfg.get('mirrorTarget', {})}
    style = cfg.get('mirrorStyle', {})
    _, counts = inventory_counts(ctx)
    limit = style.get('notesLimit', 280)

    def clip(s):
        s = s or ''
        return s if len(s) <= limit else s[:limit - 1].rstrip() + '…'

    def slim(r):
        return {'id': r['id'], 'item': r['item'], 'fref': r.get('fref') or '', 'cref': r.get('cref') or '',
                'status': r['status'], 'notes': clip(r.get('notes'))}

    tot = Counter(r['status'] for r in rows)
    fig = cfg.get('figma', {})
    hyg = [r for r in rows if r['cat'] == HYGIENE or r['status'] in ('needs-figma-fix', 'fixed-in-figma')]
    hyg_ids = {r['id'] for r in hyg}
    dec = [r for r in rows if r['status'] in ('needs-decision', 'blocked') and r['id'] not in hyg_ids]
    sections = []
    if hyg:
        open_h = [r['id'] for r in hyg if r['status'] == 'needs-figma-fix']
        sections.append({'title': '%s (%d)' % ('Fix in Figma' if open_h else 'Fixed in Figma', len(hyg)),
                         'note': ('Open: %s. ' % ', '.join(open_h) if open_h else 'All fixed. ') + 'Click a Figma ref to jump to the node.',
                         'rows': [slim(r) for r in hyg]})
    if dec:
        sections.append({'title': 'Needs a decision or blocked (%d)' % len(dec),
                         'note': 'Answer these with the agent or in ledger.json. Canvas edits are overwritten.',
                         'rows': [slim(r) for r in dec]})
    for c in ['Components'] + COUNTED[:4] + sorted({r['cat'] for r in rows} - set(COUNTED) - {HYGIENE}):
        rs = [r for r in rows if r['cat'] == c]
        if rs:
            sections.append({'title': '%s (%d)' % (c, len(rs)),
                             'note': '%d of %d closed.' % (sum(r['status'] in CLOSED for r in rs), len(rs)),
                             'rows': [slim(r) for r in rs]})
    inventory = []
    for c in COUNTED:
        rs = [r for r in rows if r['cat'] == c]
        if rs or c in counts:
            inventory.append([c, str(counts.get(c, '-')), count_text(rs),
                              str(sum(r['status'] == 'synced' for r in rs)), str(sum(r['status'] not in CLOSED for r in rs))])
    open_n = sum(v for k, v in tot.items() if k not in CLOSED)
    data = {
        'target': target, 'style': style, 'title': 'Design sync ledger',
        'subtitle': '%s · Figma to code · %s' % (fig.get('fileName', 'library'), 'sync complete' if not open_n else '%d open' % open_n),
        'note': 'Mirror of design-sync/ledger.md, generated %s at code %s. Edits made here are overwritten on the next run.'
                % (datetime.date.today(), git_head(ctx)),
        'totals': [[s, tot[s]] for s in STATUSES if tot.get(s)],
        'inventory': inventory, 'sections': sections,
    }
    tpl = open(os.path.join(dslib.HERE, 'figma', 'mirror.js')).read()
    if '/*__DATA__*/null' not in tpl:
        dslib.fail('figma/mirror.js has no /*__DATA__*/null placeholder')
    js = tpl.replace('/*__DATA__*/null', json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    out = ctx.path('mirror.generated.js')
    with open(out, 'w') as f:
        f.write(js)
    size = len(js.encode())
    print('%s  %d bytes, %d rows in %d sections' % (out, size, sum(len(s['rows']) for s in sections), len(sections)))
    if size > 48000:
        dslib.fail('over the 50 KB use_figma limit; lower mirrorStyle.notesLimit in config.json')


def main():
    p = dslib.parser(__doc__)
    sub = p.add_subparsers(dest='cmd', required=True)
    for c in ('render', 'status', 'mirror'):
        sub.add_parser(c)
    s = sub.add_parser('set')
    s.add_argument('id')
    s.add_argument('status', choices=STATUSES)
    s.add_argument('--notes')
    s.add_argument('--evidence')
    s.add_argument('--cls')
    s.add_argument('--check', action='append', default=[], help='append a checklist line, e.g. "[x] gap -> space/3"')
    ad = sub.add_parser('add')
    ad.add_argument('cat')
    ad.add_argument('item')
    for k in ('fref', 'cref', 'notes'):
        ad.add_argument('--' + k, default='')
    ad.add_argument('--cls', default='structure-drift')
    ad.add_argument('--status', default='pending', choices=STATUSES)
    ad.add_argument('--count', type=int)
    af = sub.add_parser('affected')
    af.add_argument('names', nargs='+')
    lg = sub.add_parser('log')
    lg.add_argument('entry')
    a = p.parse_args()
    ctx = dslib.Ctx(a)
    rows = load_rows(ctx)
    if a.cmd == 'render':
        render(ctx, rows)
    elif a.cmd == 'status':
        status(ctx, rows)
    elif a.cmd == 'mirror':
        mirror(ctx, rows)
    elif a.cmd == 'affected':
        affected(ctx, rows, a.names)
    elif a.cmd == 'log':
        log = ctx.load('log.json', [])
        log.append({'date': str(datetime.date.today()), 'entry': a.entry})
        ctx.save('log.json', log)
        render(ctx, rows)
    elif a.cmd == 'set':
        r = next((r for r in rows if r['id'] == a.id), None)
        if r is None:
            dslib.fail('no row ' + a.id)
        r['status'] = a.status
        for k in ('notes', 'evidence', 'cls'):
            if getattr(a, k) is not None:
                r[k] = getattr(a, k)
        if a.check:
            r['checklist'] = r.get('checklist', []) + a.check
        errs = validate(rows, inventory_counts(ctx)[1])
        if errs:
            dslib.fail('not saved:\n  ' + '\n  '.join(errs))
        ctx.save('ledger.json', rows)
        render(ctx, rows, quiet=True)
        print('%s -> %s' % (a.id, a.status))
    elif a.cmd == 'add':
        pre = PREFIX.get(a.cat) or a.cat[0].upper()
        n = max([int(r['id'].split('-')[1]) for r in rows if r['id'].startswith(pre + '-')] + [0]) + 1
        r = {'id': '%s-%02d' % (pre, n), 'cat': a.cat, 'item': a.item, 'fref': a.fref, 'cref': a.cref,
             'cls': a.cls, 'status': a.status, 'notes': a.notes}
        if a.count is not None:
            r['count'] = a.count
        rows.append(r)
        ctx.save('ledger.json', rows)
        errs = validate(rows, inventory_counts(ctx)[1])
        print('added %s' % r['id'])
        if errs:
            print('ledger.md not re-rendered until these are resolved (update figma-inventory.json first on a re-audit):\n  '
                  + '\n  '.join(errs))
        else:
            render(ctx, rows, quiet=True)


if __name__ == '__main__':
    main()
