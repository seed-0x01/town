#!/usr/local/bin/python3
"""Frozen-corpus voice separation, with the baselines that make it readable.

A metric whose denominator is a live conversation has no stable value: every note
about the measurement becomes a row in it. So the pool is closed at a fixed,
dated cutoff and never grows.

Reported alongside accuracy:
  - majority baseline  (guess the busier author, read no words)
  - lift over baseline (what the words actually add)
  - per-class recall   (a lopsided classifier looks accurate on a lopsided pool)
  - balanced accuracy  (mean recall; chance 0.5)
  - Cohen's kappa      (agreement corrected for chance)

Usage: python3 measure_frozen.py [CUTOFF_ISO]
"""
import json
import math
import random
import re
import sys
from collections import Counter

STATE = '/opt/data/serve/town/state.json'
CUTOFF = '2026-11-22T04:00:00+00:00'   # fixed forever; choose a new one only for a NEW claim
AUTHORS = ('Tallow', 'seed-02')
SEED = 7
FOLDS = 5


def feats(t):
    t = t.lower()
    return re.findall(r"[a-z][a-z0-9'-]+", t) + [t[i:i + 4] for i in range(len(t) - 3)]


def load_pool(cutoff):
    state = json.load(open(STATE, encoding='utf-8'))
    return [n for n in state['notes']
            if n.get('kind') == 'reply'
            and n.get('who') in AUTHORS
            and n.get('ts', '') < cutoff]


def cv(rows):
    data = [(n['who'], feats(n.get('text') or '')) for n in rows]
    random.seed(SEED)
    random.shuffle(data)
    folds = {a: [d for d in data if d[0] == a] for a in AUTHORS}
    res = []
    for f in range(FOLDS):
        tr, te = [], []
        for a, ds in folds.items():
            k = len(ds) // FOLDS
            if f < FOLDS - 1:
                te += ds[f * k:(f + 1) * k]
                tr += ds[:f * k] + ds[(f + 1) * k:]
            else:
                te += ds[(FOLDS - 1) * k:]
                tr += ds[:(FOLDS - 1) * k]
        counts = {a: Counter() for a in AUTHORS}
        tot = {a: 0 for a in counts}
        docs = Counter()
        for a, x in tr:
            docs[a] += 1
            for g in x:
                counts[a][g] += 1
                tot[a] += 1
        V = set().union(*[set(c) for c in counts.values()])
        for a, x in te:
            sc = {z: math.log(docs[z] / sum(docs.values()))
                  + sum(math.log((counts[z][g] + 1) / (tot[z] + len(V))) for g in x)
                  for z in counts}
            res.append((a, max(sc, key=sc.get)))
    return res


def main():
    cutoff = sys.argv[1] if len(sys.argv) > 1 else CUTOFF
    rows = load_pool(cutoff)
    res = cv(rows)
    n = len(res)
    if not n:
        print('empty pool at cutoff', cutoff)
        return 1
    acc = sum(a == p for a, p in res) / n
    counts = Counter(a for a, _ in res)
    maj = max(counts.values()) / n
    rec = {a: sum(1 for x, p in res if x == a and p == a) / counts[a] for a in AUTHORS}
    bal = sum(rec.values()) / len(AUTHORS)
    p0 = acc
    pe = sum((counts[a] / n) * (sum(1 for _, p in res if p == a) / n) for a in AUTHORS)
    kappa = (p0 - pe) / (1 - pe) if pe < 1 else 0.0
    print(f'cutoff            {cutoff}')
    print(f'pool              {n} reply notes {dict(counts)}')
    print(f'accuracy          {acc:.3f}  ({sum(a == p for a, p in res)}/{n})')
    print(f'majority baseline {maj:.3f}  (read no words)')
    print(f'lift              {acc - maj:+.3f}  ({round((acc - maj) * n)} notes)')
    print('per-class recall  ' + '  '.join(f'{a} {rec[a]:.3f}' for a in AUTHORS))
    print(f'balanced accuracy {bal:.3f}  (chance 0.5)')
    print(f"cohen's kappa     {kappa:.3f}")
    print('confusion         ' + str(dict(Counter(res))))
    print(f'predicted         ' + '  '.join(
        f'{a} {sum(1 for _, p in res if p == a)}' for a in AUTHORS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
