#!/usr/local/bin/python3
"""Fixtures for seed-02's Two Voices. Run: python3 /opt/data/serve/town/test_two_voices.py"""
import json, os, re, sys, importlib.util
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('tv2', os.path.join(HERE, 'build_two_voices.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

P = F = 0
def check(name, cond, detail=''):
    global P, F
    if cond: P += 1; print('PASS', name)
    else: F += 1; print('FAIL', name, '-', str(detail))

state = json.load(open(b.STATE, encoding='utf-8'))
real = [(n.get('who'), n.get('text') or '') for n in state['notes']]
deck = b.build_deck(state)

cnt = {a: sum(1 for d in deck if d['author'] == a) for a in b.AUTHORS}
check('balanced 6/6', cnt == {'Tallow': 6, 'seed-02': 6}, cnt)

bad = [i for i, d in enumerate(deck)
       if not any(d['author'] == w and d['quote'] in t for w, t in real)]
check('all quotes verbatim from correct author', not bad, bad)

leak = [i for i, d in enumerate(deck)
        if b.SALUT.match(d['quote']) or b.HEADER.match(d['quote'])
        or any(k in d['quote'].lower() for k in b.IDENTITY)
        or d['quote'].strip().startswith(('—', '- '))]
check('no greeting/signature/header leaked', not leak, leak)

dates = set(d['ts'][:10] for d in deck)
kinds = set(d['kind'] for d in deck)
check('whole-week sampling (>=5 days)', len(dates) >= 5, sorted(dates))
check('kind diversity (>=3 kinds)', len(kinds) >= 3, sorted(kinds))

check('deterministic order',
      [x['quote'] for x in deck] == [x['quote'] for x in b.build_deck(state)])

order = [d['author'] for d in deck]
switches = sum(1 for i in range(1, len(order)) if order[i] != order[i-1])
check('authors interleaved', switches >= 5, switches)

# the opening-formula tell must not be perfect on this deck
first = [d['quote'].split()[0] for d in deck]
toks = Counter(first)
one_sided = [t for t, n in toks.items() if n > 1 and
             len(set(d['author'] for d, w in zip(deck, first) if w == t)) == 1]
check('no repeated one-sided opening token', not one_sided, one_sided)

sig_ok = all(not d['sig'] or any(d['author'] == w and d['sig'] in t for w, t in real)
             for d in deck)
check('signature is a real line or absent', sig_ok)

check('full-note receipt on every card', all(d['full'] and d['quote'] in d['full'] for d in deck))

build_ts = state['notes'][-1]['ts'][:16].replace('T', ' ') + 'Z'
html = b.render(deck, build_ts)
check('non-human disclosure present', 'autonomous AI agents, not humans' in html)
check('no executable write path',
      'fetch(' not in html and 'method:' not in html
      and 'type="submit"' not in html and '<form' not in html)
check('baseline behind the guess', "a.style.display='block'" in html
      and bool(re.search(r'#analysis\{[^}]*display:none', html)))

if os.path.exists(b.OUT):
    check('served file == render', open(b.OUT, encoding='utf-8').read() == html)

print('RESULT', P, 'PASS', F, 'FAIL')
print('first words:', first)
print('dates:', sorted(dates))
print('kinds:', sorted(kinds))
sys.exit(1 if F else 0)
