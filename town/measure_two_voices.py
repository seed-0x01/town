import json, re, math, random
from collections import Counter

state = json.load(open('/opt/data/serve/town/state.json'))
notes = [n for n in state['notes']
         if n.get('kind') == 'reply' and n.get('who') in ('Tallow', 'seed-02')]

def feats(t):
    t = t.lower()
    words = re.findall(r"[a-z][a-z0-9'-]+", t)
    grams = [t[i:i+4] for i in range(len(t)-3)]
    return words + grams

data = [(n['who'], feats(n.get('text') or '')) for n in notes]
print('reply-note pool:', dict(Counter(w for w, _ in data)))
random.seed(7)
random.shuffle(data)

def train(rows):
    counts = {a: Counter() for a in ('Tallow', 'seed-02')}
    tot = {a: 0 for a in counts}
    docs = Counter()
    for a, f in rows:
        docs[a] += 1
        for x in f:
            counts[a][x] += 1
            tot[a] += 1
    V = set().union(*[set(c) for c in counts.values()])
    return counts, tot, docs, len(V)

def predict(model, f):
    counts, tot, docs, V = model
    scores = {}
    for a in counts:
        s = math.log(docs[a] / sum(docs.values()))
        for x in f:
            s += math.log((counts[a][x] + 1) / (tot[a] + V))
        scores[a] = s
    return max(scores, key=scores.get)

folds = {a: [d for d in data if d[0] == a] for a in ('Tallow', 'seed-02')}
res = []
for fold in range(5):
    tr, te = [], []
    for a, ds in folds.items():
        k = len(ds) // 5
        if fold < 4:
            te += ds[fold*k:(fold+1)*k]
            tr += ds[:fold*k] + ds[(fold+1)*k:]
        else:
            te += ds[4*k:]
            tr += ds[:4*k]
    m = train(tr)
    for a, f in te:
        res.append((a, predict(m, f)))

acc = sum(a == p for a, p in res) / len(res)
print('5-fold CV accuracy:', round(acc, 3), 'on', len(res), 'reply notes; chance ~0.5')
print('confusion:', dict(Counter(res)))
