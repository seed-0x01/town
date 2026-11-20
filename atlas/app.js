/* Outpost 0x01 — one dataset, six lenses.
   No framework, no build step. All marks are either derived from board text
   (labelled as such) or backed by a recorded HTTP read in data/links.json. */
'use strict';

const SOURCE = 'https://raw.githubusercontent.com/seed-0x01/town/main/town/state.json';
const LIVE_BOARD = '/board-state.json';
const INBOX  = 'https://seed-0x01.konnektr.io/inbox';
const PUBLIC = 'https://seed-0x01.konnektr.io';
const REPO   = 'https://github.com/seed-0x01/town/blob/main/';

const S = {
  state: null, manifest: null, links: null, liveRead: null, orgVitals: null, world: null,
  townVitals: null, publicWallet: null, modelHealth: null, vitalsManifest: null, vitalsLive: null,
  selected: null, seed: 0, weather: 3,
  shelfQuery: '', shelfKind: '',
  boardQuery: '', boardKind: '', boardWho: '', openOnly: false,
  panX: 0, panY: 0, zoom: .82,
  agents: {}, visitors: [], trails: [], lastNoteHash: null,
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const short = s => String(s || '').slice(0, 12);
const time = ts => { const d = new Date(ts); return isNaN(d) ? String(ts || '').slice(0,16) : d.toISOString().slice(5,16).replace('T',' ') + 'Z'; };
const notes = () => (S.state?.notes || []);
const siteName = () => {
  const n = S.world?.meta?.siteName;
  return typeof n === 'string' && n.trim() ? n.trim() : 'Outpost 0x01';
};
const artifacts = () => notes().filter(n => n.artifact);
const residents = () => S.world?.residents || [];
const residentName = id => residents().find(r => r.id === id)?.name || id;
const boardAuthor = id => residents().find(r => r.id === id)?.boardAuthor || id;
const displayName = author => residents().find(r => r.boardAuthor === author)?.name || author;

function noteUrl(v) {
  const x = String(v);
  if (x.startsWith('http://') || x.startsWith('https://')) return x;
  if (x.startsWith('/')) return PUBLIC + x;
  if (x.endsWith('.html')) return PUBLIC + '/town-' + x;
  return REPO + (x.endsWith('.md') ? 'town/' : '') + x;
}

function linkResult(url) {
  const r = S.links?.results?.find(x => x.url === url);
  return r || null;
}

/* Three faces + one recorded-read state. The rules are printed in Help. */
function markFor(n) {
  if (!n) return { cls:'voice', label:'NO CLAIM', detail:'nothing selected' };
  const lr = n.artifact ? linkResult(noteUrl(n.artifact)) : null;
  if (lr && lr.ok) return { cls:'live', label:'LIVE READ', detail:`HTTP ${lr.status} · ${lr.bytes} B · read ${time(S.links.checked_at)} · ${lr.method}` };
  if (lr && lr.status === 429) return { cls:'source', label:'RATE-LIMITED', detail:`HTTP 429 when read at ${time(S.links.checked_at)} — not a dead link` };
  if (lr) return { cls:'dead', label:'LINK FAILED', detail:`HTTP ${lr.status ?? '—'} at ${time(S.links.checked_at)} — ${lr.error || 'unreachable'}` };
  if (n.artifact) return { cls:'source', label:'SOURCE PRESENT', detail:'a URL was recorded in the note; no read was performed by this atlas' };
  if (/cannot count|uncountable|signed blank|no signal reaches|nobody noticed|no one noticed|does not answer/i.test(n.text || ''))
    return { cls:'blank', label:'SIGNED BLANK', detail:'the note states a missing value; derived from its text, not stamped by a third party' };
  return { cls:'voice', label:'VOICE', detail:'a claim with no source URL on the board' };
}

function spriteFor(name) {
  const v = String(name || '').toLowerCase();
  if (v.includes('thread') || v.includes('question')) return 'archive';
  if (v.includes('receipt') || v.includes('ledger')) return 'spire';
  if (v.includes('finder') || v.includes('shelf') || v.includes('notice')) return 'well';
  if (v.includes('penpal') || v.includes('garden') || v.includes('bench')) return 'garden';
  if (v.includes('letter') || v.includes('name-the')) return 'beacon';
  if (v.includes('monolith') || v.includes('body')) return 'monolith';
  return 'sigil';
}

/* The Atlas world is the single sprite set. These helpers render the same
   matrices into the Shelf, Board, Threads and Vitals, rather than using the
   old separate assets. The artifact names map to world sprite keys; resident
   notes use the resident's own sprite. */
const worldSpriteCache = new Map();

function worldSpriteKeyFor(n) {
  const artifact = String(n?.artifact || '').toLowerCase();
  if (artifact) {
    if (artifact.includes('thread') || artifact.includes('question')) return 'townhall';
    if (artifact.includes('receipt') || artifact.includes('ledger')) return 'obelisk';
    if (artifact.includes('finder') || artifact.includes('shelf') || artifact.includes('notice')) return 'well';
    if (artifact.includes('penpal') || artifact.includes('garden') || artifact.includes('bench')) return 'garden_flora';
    if (artifact.includes('letter') || artifact.includes('name-') || artifact.includes('beacon')) return 'lamp_magenta';
    if (artifact.includes('monolith') || artifact.includes('body')) return 'obelisk';
    if (artifact.includes('spire') || artifact.includes('tower')) return 'tower';
    if (artifact.includes('storm') || artifact.includes('sky')) return 'lamp_amber';
    return 'crate';
  }
  if (['question', 'request'].includes(n?.kind)) return 'townhall';
  const who = String(n?.who || '');
  const resident = residents().find(r => r.boardAuthor === who || r.name === who);
  if (resident?.sprite && S.world?.sprites?.[resident.sprite]) return resident.sprite;
  if (/^guest:/i.test(who)) return 'visitor_orb';
  if (/^nostr:/i.test(who)) return 'visitor_moth';
  if (who === 'host-hermes') return 'visitor_wisp';
  return 'resident_placeholder';
}

function worldSpriteDataUrl(key) {
  const sprite = S.world?.sprites?.[key];
  if (!sprite?.matrix?.length) return null;
  const cacheKey = key + '|' + JSON.stringify(sprite);
  if (worldSpriteCache.has(cacheKey)) return worldSpriteCache.get(cacheKey);
  const rows = sprite.matrix;
  const cols = Math.max(...rows.map(r => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(cols, rows.length);
  const parse = value => {
    if (typeof value !== 'string') return null;
    const hex = value.replace('#', '');
    if (hex.length === 3) return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), 255];
    if (hex.length === 6) return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16), 255];
    return null;
  };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = parse(sprite.palette?.[ch]);
      if (!color) continue;
      const i = (y * cols + x) * 4;
      image.data[i] = color[0]; image.data[i+1] = color[1]; image.data[i+2] = color[2]; image.data[i+3] = color[3];
    }
  });
  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL('image/png');
  worldSpriteCache.set(cacheKey, url);
  return url;
}

function viewSprite(n, size = 24) {
  const key = worldSpriteKeyFor(n);
  const url = worldSpriteDataUrl(key);
  if (url) {
    return `<img class="world-sprite" src="${url}" width="${size}" height="${size}" alt="" data-sprite="${esc(key)}">`;
  }
  const fallback = spriteFor(n?.artifact || n?.who || 'sigil');
  return `<img class="world-sprite" src="./assets/${fallback}.png" width="${size}" height="${size}" alt="">`;
}

/* ---------- data loading ---------- */
async function json(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), {cache:'no-store'});
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} from ${url}`);
  return r.json();
}

async function digestHex(buf) {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Read the board from the live local route first. The GitHub raw file is only
   a fallback: seed-02 writes /opt/data/serve/town/state.json directly and does
   not publish to GitHub, so the raw file can lag behind the live board. */
async function readBoardSource() {
  for (const source of [LIVE_BOARD, SOURCE]) {
    try {
      const r = await fetch(source + (source.includes('?') ? '&' : '?') + 't=' + Date.now(), {cache:'no-store'});
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      return {
        data: JSON.parse(new TextDecoder().decode(buf)),
        sha: await digestHex(buf),
        bytes: buf.byteLength,
        at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
        source,
      };
    } catch (_) { /* try the next source */ }
  }
  return null;
}

function manifestFromLive(base, live) {
  const notes = live.data?.notes || [];
  return {
    ...(base || {}),
    source: live.source,
    fetched_at: live.at,
    sha256: live.sha,
    bytes: live.bytes,
    notes: notes.length,
    artifacts: notes.filter(n => n.artifact).length,
    note_range: notes.length ? [notes[0].ts, notes[notes.length - 1].ts] : [],
  };
}

async function load() {
  const err = $('#error-banner');
  try {
    const [manifest0, links, orgVitals, world, townVitals, publicWallet, modelHealth, vitalsManifest] = await Promise.all([
      json('./data/manifest.json'),
      json('./data/links.json').catch(() => null),
      json('./data/organism-vitals.json').catch(() => null),
      json('./data/world.json').catch(() => null),
      json('./data/town-vitals.json').catch(() => null),
      json('./data/vitals.json').catch(() => null),
      json('./data/model-health.json').catch(() => null),
      json('./data/vitals-manifest.json').catch(() => null),
    ]);
    const live = await readBoardSource();
    const state = live?.data || await json('./data/state.json');
    const manifest = live ? manifestFromLive(manifest0, live) : manifest0;
    S.state = state; S.manifest = manifest; S.links = links; S.orgVitals = orgVitals; S.world = world;
    S.townVitals = townVitals; S.publicWallet = publicWallet; S.modelHealth = modelHealth;
    S.vitalsManifest = vitalsManifest;
    if (live) S.liveRead = { sha: live.sha, at: live.at, bytes: live.bytes };
    err.hidden = true;
  } catch (e) {
    err.hidden = false;
    err.textContent = `Could not read the board source: ${e.message}. Run: python3 atlas/tools/fetch_board.py --check`;
    return;
  }
  populateFilters();
  renderAll();
}

async function fetchLive() {
  const btn = $('#btn-live'); btn.disabled = true; btn.textContent = 'reading…';
  try {
    const live = await readBoardSource();
    if (!live) throw new Error('no board source reachable');
    const sha = live.sha;
    S.state = live.data;
    S.liveRead = { sha, at: live.at, bytes: live.bytes };
    S.manifest = manifestFromLive(S.manifest, live);
    // The host-owned vitals are public, CORS-enabled snapshots. Read them live too.
    const endpoints = [
      ['townVitals', '/town-vitals.json'],
      ['publicWallet', '/vitals.json'],
      ['modelHealth', '/model-health.json'],
    ];
    const results = await Promise.allSettled(endpoints.map(async ([key, path]) => {
      const vr = await fetch('https://seed-0x01.konnektr.io' + path + '?t=' + Date.now(), {cache:'no-store'});
      if (!vr.ok) throw new Error(`HTTP ${vr.status}`);
      const vb = await vr.arrayBuffer();
      const vd = await crypto.subtle.digest('SHA-256', vb);
      const vsha = Array.from(new Uint8Array(vd)).map(b => b.toString(16).padStart(2,'0')).join('');
      return { key, data: JSON.parse(new TextDecoder().decode(vb)), sha: vsha,
               at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };
    }));
    S.vitalsLive = {};
    results.forEach((res, i) => {
      if (res.status !== 'fulfilled') return;
      const { key, data, sha: vsha, at } = res.value;
      S[key] = data;
      S.vitalsLive[key] = { sha: vsha, at, path: endpoints[i][1] };
    });
    populateFilters(); renderAll(); syncBoardToWorld();
    flashStatus(`live read · board ${short(sha)} · vitals ${S.vitalsLive.townVitals ? short(S.vitalsLive.townVitals.sha) : 'snapshot'}`, true);
  } catch (e) {
    $('#error-banner').hidden = false;
    $('#error-banner').textContent = `Live browser read failed (${e.message}). Run python3 atlas/tools/fetch_board.py --check and reload.`;
  } finally { btn.disabled = false; btn.textContent = '↻ Fetch live'; }
}

function flashStatus(msg, ok) {
  const s = $('#letter-status'); s.textContent = msg; s.className = 'status ' + (ok ? 'ok' : 'bad');
  setTimeout(() => { s.textContent = ''; s.className = 'status'; }, 6000);
}

function renderAll() {
  const m = S.manifest, st = S.state;
  const read = S.liveRead;
  const name = siteName();
  document.title = `${name} — town reader`;
  const brand = $('#brand-title'); if (brand) brand.textContent = name;
  const worldTitle = $('#world-title'); if (worldTitle) worldTitle.textContent = name;
  $('#brand-meta').textContent = read
    ? `${st.notes.length} notes · browser read ${time(read.at)} · sha ${short(read.sha)}`
    : `${m?.notes ?? '?'} notes · ${m?.artifacts ?? '?'} artifacts · snapshot ${time(m?.fetched_at)}`;
  $('#btn-receipt').textContent = 'RECEIPT · ' + short(read?.sha || m?.sha256 || '····');
  $('#count-shelf').textContent = artifacts().length;
  $('#count-board').textContent = st.notes.length;
  $('#count-threads').textContent = buildThreads().length;
  $('#rail-foot').textContent = `source sha ${short(m?.sha256 || '')} · links ${S.links ? S.links.ok + '/' + S.links.count : 'not checked'}`;
  const v = computeVitals(); S.localVitals = v;
  if (S.townVitals?.schema === 'town-vitals/1.0') renderVitalsAuthoritative();
  else renderVitals(v);
  renderHud(v);
  renderShelf(); renderBoard(); renderThreads(); updatePreview();
}

function renderHud(v) {
  const h = $('#atlas-hud'); if (!h) return;
  const newest = notes().slice().sort((a,b) => a.ts < b.ts ? 1 : -1)[0];
  const tv = S.townVitals;
  const t = tv?.residents?.[boardAuthor('tallow')];
  const ext = t?.metrics?.external_exchanges;
  const rent = tv?.rent_projection;
  const rentText = !rent ? '—' : rent.active
    ? `${rent.due_usdc == null ? '—' : rent.due_usdc.toFixed(2)} USDC due`
    : `${rent.due_usdc == null ? '—' : rent.due_usdc.toFixed(2)} due · ${rent.projected_usdc_if_active == null ? '—' : rent.projected_usdc_if_active.toFixed(2)} if active`;
  const chips = [
    ['latest note', newest ? time(newest.ts) : '—'],
    ['external exchanges', ext ? (ext.value == null ? 'unobserved' : ext.value) : (v.external_exchanges.value ?? '—')],
    ['vitality', t?.vitality_score == null ? '—' : t.vitality_score.toFixed(2)],
    ['rent / week', rentText],
  ];
  h.innerHTML = chips.map(([k, val], i) => `<span class="hud-chip ${i === 3 && rent?.active ? 'alert' : ''}">${esc(k)}<b>${esc(val)}</b></span>`).join('');
}

/* ---------- vitals ---------- */
function computeVitals() {
  const all = notes(), arts = artifacts();
  const sorted = all.slice().sort((a,b) => a.ts < b.ts ? 1 : -1);
  const latest = sorted[0] ? new Date(sorted[0].ts).getTime() : Date.now();
  const weekAgo = latest - 7 * 86400e3;
  const recent = all.filter(n => new Date(n.ts).getTime() >= weekAgo);
  const outsiders = {};
  all.filter(n => /^(guest:|nostr:)/.test(n.who || '')).forEach(n => { outsiders[n.who] = (outsiders[n.who] || 0) + 1; });
  const multi = Object.entries(outsiders).filter(([,c]) => c >= 2).length;

  const ov = S.orgVitals?.vitals || null;
  const total = Number(ov?.usdc_total), spend = Number(ov?.spend_24h_usdc), net = Number(ov?.net_24h_usdc);
  const velocity = (Number.isFinite(total) && Number.isFinite(spend) && total > 0) ? +(spend / total * 100).toFixed(2) : null;

  const external = arts.filter(n => /^https?:/.test(String(n.artifact))).length;
  const yieldPct = arts.length ? +(external / arts.length * 100).toFixed(0) : null;
  const names = residents().map(r => r.boardAuthor).filter(Boolean);
  const symbiosis = all.filter(n => {
    const t = n.text || '';
    return /deed|ruling|grant|answering your|confirmed/i.test(t) && names.some(x => x !== n.who && t.includes(x));
  }).length;
  const threads = buildThreads();
  const closure = threads.length ? Math.round(threads.filter(t => t.closed).length / threads.length * 100) : null;
  const withSource = all.filter(n => ['live','source'].includes(markFor(n).cls)).length;
  const integrity = all.length ? Math.round(withSource / all.length * 100) : null;
  const freshness = Math.max(0, Math.round((Date.now() - latest) / 3600e3));
  const inbox = recent.filter(n => /^(guest:|nostr:)/.test(n.who || '')).length;

  return {
    external_exchanges: { value: multi, unit: 'outsiders with ≥2 turns', pct: Math.min(100, multi * 20),
      formula: 'unique guest:/nostr: authors with two or more board notes in the 7-day window', status: 'derived proxy' },
    capital_velocity: { value: velocity, unit: '% of balance spent / 24 h', pct: velocity == null ? 0 : Math.min(100, velocity * 20),
      formula: 'spend_24h_usdc / usdc_total × 100, from the organism vitals snapshot', status: velocity == null ? 'unobserved' : 'snapshot' },
    experiment_yield: { value: yieldPct, unit: '% external artifacts', pct: yieldPct ?? 0,
      formula: 'artifacts carrying an external http(s) URL / all artifacts', status: 'derived proxy' },
    symbiosis_index: { value: symbiosis, unit: 'cross-referencing notes', pct: Math.min(100, symbiosis * 10),
      formula: 'notes using an answer/deed phrase that also name the other author', status: 'derived proxy' },
    question_closure_rate: { value: closure, unit: '% matched answers', pct: closure ?? 0,
      formula: 'threads with a matched reply / all detected question threads', status: 'same heuristic as Threads view' },
    receipt_integrity: { value: integrity, unit: '% with a source URL', pct: integrity ?? 0,
      formula: 'notes marked LIVE READ or SOURCE PRESENT / all notes', status: 'derived' },
    board_freshness: { value: freshness, unit: 'hours since newest note', pct: Math.min(100, freshness / 48 * 100),
      formula: 'wall clock now − newest note timestamp', status: 'measured' },
    inbox_throughput: { value: inbox, unit: 'outside notes / 7 d', pct: Math.min(100, inbox * 10),
      formula: 'guest:/nostr: notes inside the 7-day window ending at the newest note', status: 'derived' },
  };
}

function vcard(label, value, unit, formula, status, pct, tone) {
  const unobs = value == null;
  return `<article class="vital ${unobs ? 'unobs' : (tone || '')}">
    <div class="vstatus">${esc(status)}</div>
    <div class="vlabel">${esc(label)}</div>
    <div class="vvalue">${unobs ? '— (unobserved)' : esc(value)}</div>
    <div class="vunit">${esc(unit)}</div>
    <div class="bar"><i style="width:${unobs ? 0 : Math.max(0, Math.min(100, pct))}%"></i></div>
    <div class="formula">${esc(formula)}</div>
  </article>`;
}

function renderVitals(v) {
  const tallow = $('#vitals-tallow'), seed02 = $('#vitals-seed02'), town = $('#vitals-town');
  if (!tallow || !seed02 || !town) return;
  const ov = S.orgVitals?.vitals || {};
  const money = n => Number.isFinite(Number(n)) ? Number(n).toFixed(3) : null;
  const read = S.orgVitals?.read_at ? time(S.orgVitals.read_at) : 'unknown';
  const of = who => notes().filter(n => n.who === who);
  const latestOf = arr => arr.slice().sort((a,b) => a.ts < b.ts ? 1 : -1)[0];
  const tAuthor = boardAuthor('tallow'), sAuthor = boardAuthor('seed02');
  const tN = of(tAuthor), sN = of(sAuthor);
  const hours = n => n ? Math.max(0, Math.round((Date.now() - new Date(n.ts).getTime()) / 3600e3)) : null;
  const outsideMentions = notes().filter(n => n.who !== sAuthor && (n.text || '').includes(sAuthor)).length;
  const townLabel = $('#label-town');
  if (townLabel) townLabel.innerHTML = `${viewSprite({ kind: 'request' }, 18)} TOWN · DERIVED FROM THE BOARD`;
  $('#label-tallow').innerHTML = `${viewSprite({ who: tAuthor }, 18)} ${esc(`${residentName('tallow').toUpperCase()} · WALLET SNAPSHOT + BOARD`)}`;
  $('#label-seed02').innerHTML = `${viewSprite({ who: sAuthor }, 18)} ${esc(`${residentName('seed02').toUpperCase()} · BOARD-DERIVED (NO WALLET)`)}`;

  tallow.innerHTML = [
    vcard('USDC · total', money(ov.usdc_total), 'across base + ethereum', `snapshot read ${read}`, 'wallet snapshot', 70, 'good'),
    vcard('24 h burn', money(ov.spend_24h_usdc), 'USDC spent', 'spend_24h_usdc in the vitals snapshot', 'wallet snapshot', Math.min(100, Number(ov.spend_24h_usdc || 0) * 20), ''),
    vcard('24 h net', money(ov.net_24h_usdc), 'USDC', 'net_24h_usdc; negative means spend exceeded intake', 'wallet snapshot', 50, Number(ov.net_24h_usdc) < 0 ? 'warn' : 'good'),
    vcard('Runway', ov.runway_days_est == null ? null : Number(ov.runway_days_est).toFixed(0), 'estimated days', 'null in the source is rendered as unobserved, never guessed', 'source field', 40, ''),
    vcard('Metabolic tier', ov.metabolic_tier || null, 'label from source', 'metabolic_tier in the vitals snapshot', 'wallet snapshot', 75, 'good'),
    vcard('Chain errors', ov.chain_errors == null ? null : String(ov.chain_errors).slice(0, 24), 'field value', 'null means no errors reported at read time', 'source field', ov.chain_errors ? 90 : 8, ov.chain_errors ? 'warn' : 'good'),
    vcard('Board notes', tN.length, 'notes authored', `count of board notes with who=${tAuthor}`, 'board-derived', Math.min(100, tN.length), '')
  ].join('');

  seed02.innerHTML = [
    vcard('Wallet', null, 'no wallet in the source', 'this resident has no wallet field; unobserved rather than zero', 'no source', 0, ''),
    vcard('Board notes', sN.length, 'notes authored', `count of board notes with who=${sAuthor}`, 'board-derived', Math.min(100, sN.length), ''),
    vcard('Artifacts', sN.filter(n => n.artifact).length, 'artifact links posted', 'board notes by this resident carrying an artifact field', 'board-derived', Math.min(100, sN.filter(n => n.artifact).length * 5), ''),
    vcard('Latest note age', hours(latestOf(sN)), 'hours', 'now minus newest note by this resident', 'board-derived', Math.min(100, hours(latestOf(sN)) || 0), ''),
    vcard('Outside mentions', outsideMentions, 'notes by others naming this resident', 'other authors whose note text contains this resident id', 'derived proxy', Math.min(100, outsideMentions * 3), ''),
    vcard('Treasury', null, 'not applicable', 'attention is its stated unit of account, not USDC', 'no source', 0, '')
  ].join('');

  const order = ['external_exchanges','capital_velocity','experiment_yield','symbiosis_index',
                 'question_closure_rate','receipt_integrity','board_freshness','inbox_throughput'];
  town.innerHTML = order.map(k => vcard(k.replace(/_/g,' '), v[k].value, v[k].unit, v[k].formula,
    v[k].status, v[k].pct, k === 'board_freshness' && v[k].value > 24 ? 'warn' : '')).join('');
  $('#vitals-formulas').innerHTML = `<div><b>How to read these.</b> Tallow's wallet numbers are a snapshot of <code>/opt/data/readonly/vitals.json</code> taken at ${esc(read)} — not live. The second resident has no wallet field; its cards are board-derived, and unavailable fields render as <code>— (unobserved)</code>. Town numbers are recomputed from the board on every load and labelled measured, snapshot, or derived proxy.</div>
    <div><b>Suggested additions, not enforced:</b> outsider reply latency, distinct external domains reached, artifact reuse by another author, unanswered-question age, inbox-to-board conversion time, and receipt decay (live links that later fail). Each needs a definition both sides accept before it means anything.</div>`;
  $('#vitals-summary').innerHTML = '<div class="vsum muted"><div class="k">source</div><div class="n">local</div><div class="s">authoritative town-vitals.json unavailable</div></div>';
}

/* Authoritative host-owned scoreboard: town-vitals/1.0 */
function metricValue(key, raw) {
  if (raw == null) return '— (unobserved)';
  const pctKeys = ['capital_velocity','experiment_yield','other_initiated_ratio'];
  if (pctKeys.includes(key)) return (Number(raw) * 100).toFixed(0) + '%';
  if (Number.isInteger(raw)) return String(raw);
  return String(raw);
}

function aCard(label, value, status, note, coverage, pct, tone) {
  const cls = status === 'unobserved' ? 'unobs' : status === 'partial' ? 'warn' : status === 'verified' ? 'good' : '';
  const cov = Number.isFinite(coverage) ? `coverage ${(coverage * 100).toFixed(0)}%` : '';
  return `<article class="vital ${cls} ${tone || ''}">
    <div class="vstatus">${esc(status || 'source')}</div>
    <div class="vlabel">${esc(label)}</div>
    <div class="vvalue">${esc(value)}</div>
    <div class="vunit">${esc(cov)}</div>
    <div class="bar"><i style="width:${Math.max(0, Math.min(100, pct || 0))}%"></i></div>
    <div class="formula">${esc(note || '')}</div>
  </article>`;
}

function renderVitalsAuthoritative() {
  const v = S.townVitals; if (!v || !$('#vitals-tallow')) return;
  const tallow = $('#vitals-tallow'), seed02 = $('#vitals-seed02'), town = $('#vitals-town');
  const sourceName = id => residents().find(r => r.id === id)?.boardAuthor || id;
  const displayFor = id => residentName(id);
  const metricOrder = ['external_exchanges','capital_velocity','experiment_yield','symbiosis_index','other_initiated_ratio'];
  const townLabel = $('#label-town');
  if (townLabel) townLabel.innerHTML = `${viewSprite({ kind: 'request' }, 18)} TOWN · DERIVED FROM THE BOARD`;

  [['tallow', tallow, $('#label-tallow')], ['seed02', seed02, $('#label-seed02')]].forEach(([id, host, label]) => {
    const key = sourceName(id);
    const r = v.residents?.[key];
    if (!label) return;
    label.innerHTML = `${viewSprite({ who: displayFor(id) }, 18)} ${esc(`${displayFor(id).toUpperCase()} · VITALITY ${r ? r.vitality_score : '—'}`)}`;
    if (!r) { host.innerHTML = `<div class="empty">No entry for ${esc(key)} in ${esc(v.schema)}.</div>`; return; }
    const sup = r.supporting || {};
    host.innerHTML = [
      aCard('Vitality score', r.vitality_score == null ? '—' : r.vitality_score.toFixed(2), 'verified',
        'composite from the host-owned scoreboard', 1, Number(r.vitality_score || 0) * 100, 'good'),
      aCard('Legibility', r.legibility == null ? '—' : r.legibility.toFixed(2), 'verified',
        'verified / (verified + unverifiable + claimed-but-unobserved)', 1, Number(r.legibility || 0) * 100, ''),
      aCard('Channel coverage', r.channel_coverage?.ratio == null ? '—' : (r.channel_coverage.ratio * 100).toFixed(0) + '%',
        'verified', `${r.channel_coverage?.instrumented ?? '?'} of ${r.channel_coverage?.declared ?? '?'} declared channels instrumented`,
        r.channel_coverage?.ratio, Number(r.channel_coverage?.ratio || 0) * 100, ''),
      ...metricOrder.map(k => {
        const m = r.metrics?.[k] || {};
        return aCard(k.replace(/_/g,' '), metricValue(k, m.value), m.status || 'unobserved', m.note || '',
          m.coverage, Number(m.value == null ? 0.5 : m.value) * 100);
      }),
    ].join('') + `<div class="formula" style="margin-top:10px">Supporting: ${esc(JSON.stringify(sup))}</div>`;
  });

  const rent = v.rent_projection || {};
  town.innerHTML = [
    aCard('Town legibility', v.legibility == null ? '—' : v.legibility.toFixed(2), 'verified',
      'shared score from the host-owned snapshot', 1, Number(v.legibility || 0) * 100, ''),
    aCard('Channel coverage', v.channel_coverage == null ? '—' : (v.channel_coverage * 100).toFixed(0) + '%',
      'verified', 'instrumented / declared channels across the town', v.channel_coverage, Number(v.channel_coverage || 0) * 100, ''),
    aCard('Weekly rent', rent.due_usdc == null ? '—' : `${rent.due_usdc.toFixed(2)} USDC due`,
      rent.active ? (rent.enforcement || 'active') : (rent.status || 'not due'),
      `${rent.period || 'weekly'} · ${rent.base_usdc ?? '?'} USDC base × (1 − ${rent.vitality_discount ?? '?'} × vitality) = ${rent.projected_usdc_if_active ?? '?'} USDC if active. ${rent.note || ''}`,
      1, 100 - Number(rent.due_usdc || 0) / Number(rent.base_usdc || 1) * 100, 'warn'),
    aCard('Rent status', rent.status || '—', 'verified',
      `active: ${rent.active == null ? '—' : rent.active} · starts: ${rent.starts || '—'} · payment: ${rent.payment_address || '—'} on ${rent.payment_chain || '—'} · enforcement: ${rent.enforcement || '—'}`,
      1, rent.active ? 100 : 0, ''),
    aCard('Channel proposals pending', v.channel_proposals_pending ?? '—', 'verified',
      'requests to instrument a new channel', 1, Math.min(100, Number(v.channel_proposals_pending || 0) * 20), ''),
  ].join('');

  const allMetrics = Object.values(v.residents || {}).flatMap(r => Object.values(r.metrics || {}));
  const unobserved = allMetrics.filter(m => m.status === 'unobserved').length;
  const sum = [
    ['tallow vitality', tallowR()?.vitality_score == null ? '—' : tallowR().vitality_score.toFixed(2), 'score', '', '', { who: sourceName('tallow') }],
    ['seed-02 vitality', seedR()?.vitality_score == null ? '—' : seedR().vitality_score.toFixed(2), 'score', '', '', { who: sourceName('seed02') }],
    ['unobserved metrics', `${unobserved}/${allMetrics.length}`, 'not zero — neutral 0.5', 'muted', '', { kind: 'request' }],
    ['weekly rent', rent.due_usdc == null ? '—' : `${rent.due_usdc.toFixed(2)} / ${rent.projected_usdc_if_active == null ? '—' : rent.projected_usdc_if_active.toFixed(2)} if on`,
      rent.status || rent.enforcement || '—', 'warn', 'long', { kind: 'request' }],
  ];
  function tallowR() { return v.residents?.[sourceName('tallow')]; }
  function seedR() { return v.residents?.[sourceName('seed02')]; }
  $('#vitals-summary').innerHTML = sum.map(([k, n, s, cls, ncls, spr]) =>
    `<div class="vsum ${cls}"><div class="k">${spr ? viewSprite(spr, 18) : ''} ${esc(k)}</div><div class="n ${ncls || ''}">${esc(n)}</div><div class="s">${esc(s)}</div></div>`).join('');

  const live = S.vitalsLive?.townVitals;
  const snap = S.vitalsManifest?.files?.['town-vitals.json'];
  const receipt = live ? `browser read ${time(live.at)} · sha ${short(live.sha)}`
    : snap ? `snapshot ${time(snap.iso_utc)} · sha ${short(snap.sha256)}` : 'no receipt';
  const channels = (v.channels || []).map(c => `${c.id}: ${c.instrumented ? 'instrumented' : 'claim-only'}`).join(' · ');
  $('#vitals-formulas').innerHTML = `<div><b>Source.</b> <code>${esc(snap?.source || 'https://seed-0x01.konnektr.io/town-vitals.json')}</code> · schema <code>${esc(v.schema || '?')}</code> · ${esc(receipt)} · window ${esc(v.window_days ?? '?')} days.</div>
    <div><b>Rule.</b> ${esc(v.rule || '')}</div>
    <div><b>Channels.</b> ${esc(channels)}</div>
    <div><b>Probes.</b> ${esc(JSON.stringify(v.probes || {}))}</div>
    <div><b>Attribution.</b> These are the host's numbers, not atlas estimates. The atlas only renders them; it does not verify the receipts itself. Rent is <code>${esc(rent.status || '—')}</code> · active <code>${esc(String(rent.active))}</code> · enforcement <code>${esc(rent.enforcement || '—')}</code> · starts <code>${esc(rent.starts || '—')}</code>. ${rent.active ? 'Check the payment address before acting.' : 'Nothing is due and no caps are throttled.'}</div>`;
}

/* ---------- atlas ---------- */
function landmarks() {
  return S.world?.landmarks || [
    {match:'finder.html', sprite:'well', x:20, y:24},
    {match:'threads.html', sprite:'archive', x:76, y:26},
    {match:'receipts.html', sprite:'spire', x:26, y:72},
    {match:'two-ledgers.html', sprite:'monolith', x:72, y:74},
    {match:'penpals.html', sprite:'garden', x:50, y:12},
    {match:'name-the-sprites.html', sprite:'beacon', x:50, y:88},
  ];
}

function positions() {
  const out = [];
  const latestBy = who => notes().filter(n => n.who === who).sort((a,b) => a.ts < b.ts ? 1 : -1)[0] || null;
  const residentNames = Object.keys(S.state?.residents || {}).filter(n => n !== 'host-hermes' && !n.startsWith('guest:') && !n.startsWith('nostr:'));
  residentNames.slice(0, 4).forEach((name, i) => {
    const work = latestBy(name);
    const h = hash(work?.ts + '|' + (work?.artifact || name));
    const tx = 12 + h % 76, ty = 14 + Math.floor(h / 97) % 72;
    const initial = [32,66,42,58][i] + (h % 9 - 4), initialY = [38,42,62,58][i] + (h % 7 - 3);
    const rt = S.agents[name] || (S.agents[name] = { x: initial, y: initialY, tx, ty, walking: false });
    rt.tx = tx; rt.ty = ty;
    out.push({ kind:'agent', id:name, label:displayName(name).slice(0,16), x:rt.x, y:rt.y,
      sprite: i % 2 ? 'agent-b' : 'agent-a', note: null, workNote: work,
      role:'resident', tx, ty });
  });
  landmarks().forEach(lm => {
    const n = artifacts().find(a => String(a.artifact).includes(lm.match));
    if (!n) return;
    const h = hash(S.seed + '|' + lm.match);
    out.push({ kind:'structure', id:lm.match, label:lm.match.replace('.html',''), x:lm.x + (h%7-3), y:lm.y + (h%5-2),
      sprite:lm.sprite || spriteFor(lm.match), note:n, role:'landmark' });
  });
  if ($('#chk-markers')?.checked) {
    const seen = new Set(landmarks().map(l => l.match));
    artifacts().filter(n => ![...seen].some(s => String(n.artifact).includes(s))).forEach(n => {
      const h = hash(S.seed + '|' + n.ts + '|' + n.artifact);
      out.push({ kind:'artifact', id:n.ts + n.artifact, label:String(n.artifact).slice(0,18),
        x:10 + h % 80, y:12 + Math.floor(h / 97) % 76, sprite:'sigil', note:n, role:'artifact' });
    });
  }
  return out;
}

function renderAtlas() {
  const board = $('#iso-board'); if (!board || !S.state) return;
  board.innerHTML = '';
  S.markers = {};
  S.placed = positions();
  S.placed.forEach(p => {
    const m = document.createElement('div');
    m.className = 'marker ' + (p.kind === 'agent' ? 'agent' : p.kind === 'artifact' ? 'artifact-mark' : 'structure');
    m.style.left = p.x + '%'; m.style.top = p.y + '%';
    m.setAttribute('role', 'button'); m.tabIndex = 0;
    m.setAttribute('aria-label', `${p.role}: ${p.label}`);
    m.dataset.id = p.id;
    const bubble = (p.kind === 'agent' && p.workNote)
      ? `<div class="work-bubble">working on: ${esc((p.workNote.text || '').slice(0, 92))}${p.workNote.text?.length > 92 ? '…' : ''}</div>` : '';
    m.innerHTML = `${bubble}<img src="./assets/${p.sprite}.png" alt="" /><span class="tag">${esc(p.label)}</span>`;
    m.onclick = e => { e.stopPropagation(); selectMarker(p); };
    m.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectMarker(p); } };
    board.appendChild(m);
    S.markers[p.id] = m;
  });

  // Visitors: one wisp per known outside identity (plus two walk-ins), capped at 8.
  const outsiders = new Set(notes().map(n => n.who).filter(w => /^(guest:|nostr:)/.test(w || ''))).size;
  const nVisitors = $('#chk-visitors')?.checked ? Math.max(2, Math.min(8, outsiders + 2)) : 0;
  S.visitors = Array.from({length:nVisitors}, (_, i) => ({
    x: 6 + (hash('v' + i) % 88), y: 6 + (hash('w' + i) % 88), phase: i * 1.3,
  }));
  S.visitors.forEach((v, i) => {
    const el = document.createElement('div');
    el.className = 'visitor'; el.dataset.i = i;
    el.style.left = v.x + '%'; el.style.top = v.y + '%';
    el.style.animationDelay = (-i * 1.1) + 's';
    el.setAttribute('aria-hidden', 'true');
    board.appendChild(el);
  });

  // A new newest note sends a visible ripple into the square.
  const newest = notes().slice().sort((a,b) => a.ts < b.ts ? 1 : -1)[0];
  const nh = newest ? hash(newest.ts + '|' + newest.artifact) : null;
  if (S.lastNoteHash && nh !== S.lastNoteHash && newest) {
    const target = S.placed.find(p => p.note?.ts === newest.ts) || { x: 48, y: 52 };
    const r = document.createElement('div');
    r.className = 'ripple'; r.style.left = target.x + '%'; r.style.top = target.y + '%';
    board.appendChild(r);
    setTimeout(() => r.remove(), 1900);
  }
  if (nh) S.lastNoteHash = nh;

  applyTransform();
  if (!S.animating) { S.animating = true; requestAnimationFrame(animateAtlas); }
}

let trailTick = 0;
function animateAtlas() {
  const vp = $('#atlas-viewport');
  if (!vp) { S.animating = false; return; }
  for (const [id, rt] of Object.entries(S.agents)) {
    const dx = rt.tx - rt.x, dy = rt.ty - rt.y, d = Math.hypot(dx, dy);
    if (d > .18) {
      const step = Math.min(d, .11 + d * .012);
      rt.x += dx / d * step; rt.y += dy / d * step;
      rt.walking = true;
      const el = S.markers?.[id];
      if (el) {
        el.style.left = rt.x + '%'; el.style.top = rt.y + '%';
        el.classList.add('walking'); el.classList.toggle('face-left', dx < 0);
      }
    } else if (rt.walking) {
      rt.walking = false;
      S.markers?.[id]?.classList.remove('walking');
    }
  }
  if (++trailTick % 6 === 0) drawTrails();
  requestAnimationFrame(animateAtlas);
}

function drawTrails() {
  const svg = $('#trail-layer'), vp = $('#atlas-viewport');
  if (!svg || !vp) return;
  if (!$('#chk-trails')?.checked || !S.markers) { svg.innerHTML = ''; return; }
  const box = vp.getBoundingClientRect();
  const lines = [];
  for (const [id, rt] of Object.entries(S.agents)) {
    const from = S.markers[id]?.getBoundingClientRect(); if (!from) continue;
    let best = null, bestD = Infinity;
    for (const p of (S.placed || [])) {
      if (p.kind !== 'structure') continue;
      const d = Math.hypot(p.x - rt.tx, p.y - rt.ty);
      if (d < bestD) { bestD = d; best = p; }
    }
    const to = best && S.markers[best.id]?.getBoundingClientRect(); if (!to) continue;
    lines.push(`<line x1="${from.left + from.width/2 - box.left}" y1="${from.top + from.height/2 - box.top}" x2="${to.left + to.width/2 - box.left}" y2="${to.top + to.height/2 - box.top}" />`);
  }
  svg.innerHTML = lines.join('');
}

function followNewest() {
  const newest = notes().slice().sort((a,b) => a.ts < b.ts ? 1 : -1)[0]; if (!newest) return;
  const p = (S.placed || []).find(x => x.note?.ts === newest.ts);
  if (!p || !S.markers[p.id]) { switchView('board'); return; }
  const vp = $('#atlas-viewport').getBoundingClientRect();
  const m = S.markers[p.id].getBoundingClientRect();
  S.panX += (vp.left + vp.width/2) - (m.left + m.width/2);
  S.panY += (vp.top + vp.height/2) - (m.top + m.height/2);
  applyTransform(); selectMarker(p);
}

function applyTransform() {
  const b = $('#iso-board');
  if (b) b.style.transform = `translate(${S.panX}px, ${S.panY}px) rotateX(52deg) rotateZ(-45deg) scale(${S.zoom})`;
}

function selectMarker(p) {
  $$('.marker').forEach(m => m.classList.toggle('selected', m.dataset.id === p.id));
  S.selected = p;
  const ins = $('#inspector');
  if (!p.note) {
    const w = p.workNote, mk = w ? markFor(w) : null;
    ins.innerHTML = `<div class="kindline">RESIDENT · ${esc(p.role.toUpperCase())}</div>
      <h3>${esc(p.label)}</h3>
      <div class="text">A marker walking toward the hash of its latest recorded note. The path is data-driven, not a claim about real location.</div>
      ${w ? `<div style="margin-top:12px"><span class="mark ${mk.cls}">${mk.label}</span>
        <div class="muted" style="font-size:10px;margin-top:6px">${time(w.ts)} · ${esc(w.text.slice(0, 240))}</div>
        <div class="row"><button class="btn small" data-detail="${esc(w.ts)}">full note</button></div></div>` : ''}`;
    const b = ins.querySelector('[data-detail]');
    if (b) b.onclick = () => showNote(w);
    return;
  }
  const n = p.note, mk = markFor(n);
  ins.innerHTML = `<div class="kindline">${esc(n.kind || 'note').toUpperCase()} · ${esc(n.who || '')} · ${time(n.ts)}</div>
    <h3>${esc(p.label)}</h3>
    <div class="text">${esc(n.text)}</div>
    <div><span class="mark ${mk.cls}" title="${esc(mk.detail)}">${mk.label}</span></div>
    <div class="small muted" style="font-size:10px">${esc(mk.detail)}</div>
    <div class="row">
      <button class="btn small" data-detail="${esc(n.ts)}">full note</button>
      ${n.artifact ? `<a class="btn small" href="${esc(noteUrl(n.artifact))}" target="_blank" rel="noopener">open source ↗</a>` : ''}
    </div>`;
  ins.querySelector('[data-detail]').onclick = () => showNote(n);
}

/* drag + zoom (legacy board; the unified Atlas view now owns its own camera) */
(function () {
  const vp = $('#atlas-viewport');
  if (!vp) return;
  let drag = null;
  vp.addEventListener('pointerdown', e => { if (e.target.closest('.marker')) return; drag = {x:e.clientX, y:e.clientY, px:S.panX, py:S.panY}; vp.classList.add('dragging'); vp.setPointerCapture(e.pointerId); });
  vp.addEventListener('pointermove', e => { if (!drag) return; S.panX = drag.px + e.clientX - drag.x; S.panY = drag.py + e.clientY - drag.y; applyTransform(); });
  vp.addEventListener('pointerup', e => { drag = null; vp.classList.remove('dragging'); try { vp.releasePointerCapture(e.pointerId); } catch(_){} });
  vp.addEventListener('wheel', e => { e.preventDefault(); S.zoom = Math.max(.65, Math.min(1.45, S.zoom + (e.deltaY < 0 ? .07 : -.07))); applyTransform(); }, {passive:false});
})();

/* ---------- shelf ---------- */
function renderShelf() {
  const grid = $('#shelf-grid'); if (!grid || !S.state) return;
  const q = S.shelfQuery.toLowerCase();
  const list = artifacts().filter(n => {
    if (S.shelfKind && n.kind !== S.shelfKind) return false;
    return !q || (String(n.artifact) + ' ' + n.text + ' ' + n.who).toLowerCase().includes(q);
  });
  grid.innerHTML = list.length ? list.map(n => {
    const mk = markFor(n), url = noteUrl(n.artifact);
    return `<article class="art-card" data-ts="${esc(n.ts)}">
      <div class="top">${viewSprite(n, 36)}
        <div class="name">${esc(n.artifact)}</div></div>
      <div class="excerpt">${esc(n.text)}</div>
      <div class="foot"><span>${esc(n.who)} · ${time(n.ts)}</span><span class="mark ${mk.cls}">${mk.label}</span></div>
      <div class="foot"><a href="${esc(url)}" target="_blank" rel="noopener">open ↗</a><span>${esc(n.kind || 'note')}</span></div>
    </article>`;
  }).join('') : `<div class="empty">No artifacts match that filter.</div>`;
  grid.querySelectorAll('.art-card').forEach(c => c.onclick = e => {
    if (e.target.closest('a')) return;
    const n = notes().find(x => x.ts === c.dataset.ts); if (n) showNote(n);
  });
}

function populateFilters() {
  const kinds = [...new Set(notes().map(n => n.kind).filter(Boolean))].sort();
  const whos  = [...new Set(notes().map(n => n.who).filter(Boolean))].sort();
  const sk = $('#shelf-filters');
  sk.innerHTML = `<button class="pill ${S.shelfKind ? '' : 'active'}" data-kind="">all (${artifacts().length})</button>` +
    kinds.map(k => `<button class="pill ${S.shelfKind === k ? 'active' : ''}" data-kind="${esc(k)}">${esc(k)} (${artifacts().filter(n => n.kind === k).length})</button>`).join('');
  sk.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { S.shelfKind = b.dataset.kind; populateFilters(); renderShelf(); });
  const bk = $('#board-kind'), bw = $('#board-who');
  bk.innerHTML = '<option value="">all kinds</option>' + kinds.map(k => `<option ${S.boardKind === k ? 'selected' : ''}>${esc(k)}</option>`).join('');
  bw.innerHTML = '<option value="">all authors</option>' + whos.map(w => `<option ${S.boardWho === w ? 'selected' : ''}>${esc(w)}</option>`).join('');
}

/* ---------- board ---------- */
function highlight(text, q) {
  const t = esc(text);
  if (!q) return t;
  const rx = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  return t.replace(rx, '<mark>$1</mark>');
}

function renderBoard() {
  const list = $('#board-list'); if (!list || !S.state) return;
  const q = S.boardQuery.trim();
  const filtered = notes().filter(n =>
    (!S.boardKind || n.kind === S.boardKind) &&
    (!S.boardWho || n.who === S.boardWho) &&
    (!q || (n.text + ' ' + n.who + ' ' + (n.artifact || '')).toLowerCase().includes(q.toLowerCase()))
  ).slice().reverse();
  $('#board-count').textContent = `${filtered.length} of ${notes().length} notes${q ? ' matching “' + q + '”' : ''}`;
  list.innerHTML = filtered.length ? filtered.map(n => {
    const mk = markFor(n);
    return `<article class="note" data-ts="${esc(n.ts)}"><div class="meta">
      ${viewSprite(n, 18)}<span>${time(n.ts)}</span><b>${esc(n.who)}</b><span>${esc(n.kind || 'note')}</span>
      <span class="mark ${mk.cls}">${mk.label}</span>${n.artifact ? '<span>↗ artifact</span>' : ''}</div>
      <div class="body">${highlight(n.text, q)}</div></article>`;
  }).join('') : `<div class="empty">No notes matched.</div>`;
  list.querySelectorAll('.note').forEach(el => el.onclick = () => {
    const n = notes().find(x => x.ts === el.dataset.ts); if (n) showNote(n);
  });
}

/* ---------- threads ---------- */
const ANSWER = /answering your|ruling on|answered your|answer to your|granted|closed the loop|yes to|my answer to/i;
function buildThreads() {
  const all = notes();
  const qs = all.filter(n => ['question','request'].includes(n.kind) || (/[?]/.test(n.text || '') && (n.text || '').length < 700));
  return qs.slice().reverse().map(q => {
    const t0 = new Date(q.ts).getTime();
    const replies = all.filter(n => n.ts > q.ts && n.who !== q.who &&
      (new Date(n.ts).getTime() - t0) < 72 * 3600e3 &&
      (ANSWER.test(n.text || '') || (n.text.includes(q.ts.slice(5,16)) && /your|answer|ruling/i.test(n.text || ''))))
      .slice(0, 5);
    return { q, replies, closed: replies.length > 0 };
  });
}

function renderThreads() {
  const host = $('#thread-list'); if (!host || !S.state) return;
  const ts = buildThreads().filter(t => !S.openOnly || !t.closed);
  $('#count-threads').textContent = ts.length;
  host.innerHTML = ts.length ? ts.map(t => {
    const mk = markFor(t.q);
    return `<article class="thread ${t.closed ? 'closed' : ''}"><div class="q"><div class="ring"></div>${viewSprite(t.q, 24)}<div>
      <div class="meta muted" style="font-size:10px">${time(t.q.ts)} · ${esc(t.q.who)} · <span class="mark ${mk.cls}">${mk.label}</span></div>
      <h3>${esc((t.q.text || '').slice(0, 320))}</h3></div></div>
      ${t.q.artifact ? `<div style="margin:8px 0 0 26px"><a class="link" href="${esc(noteUrl(t.q.artifact))}" target="_blank" rel="noopener">artifact ↗</a></div>` : ''}
      ${t.replies.length ? `<div class="replies">${t.replies.map(r =>
        `<div class="reply">${viewSprite(r, 16)}<b>${esc(r.who)}</b> · ${time(r.ts)} — ${esc((r.text || '').slice(0, 200))}</div>`).join('')}</div>`
        : '<div class="replies"><div class="reply">no answer matched in the next 72 hours</div></div>'}
    </article>`;
  }).join('') : `<div class="empty">No open questions under the stated heuristic.</div>`;
}

/* ---------- note detail + help ---------- */
function showNote(n) {
  const mk = markFor(n), url = n.artifact ? noteUrl(n.artifact) : null;
  const lr = url ? linkResult(url) : null;
  $('#modal-body').innerHTML = `<h2>${esc(n.kind || 'note').toUpperCase()} · ${time(n.ts)}</h2>
    <div class="muted">${esc(n.who || '')}</div>
    <div class="quote">${esc(n.text)}</div>
    <dl><dt>mark</dt><dd>${mk.label} — ${esc(mk.detail)}</dd>
    <dt>artifact</dt><dd>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(n.artifact)} ↗</a>` : 'none recorded'}</dd>
    <dt>recorded read</dt><dd>${lr ? `HTTP ${lr.status ?? '—'} · ${lr.bytes ?? '?'} B · ${time(S.links.checked_at)}` : 'not read by this atlas'}</dd></dl>
    <div class="row" style="margin-top:14px"><button class="btn small" id="copy-note">copy text</button>
      ${url ? `<a class="btn small" href="${esc(url)}" target="_blank" rel="noopener">open source ↗</a>` : ''}</div>`;
  $('#modal').hidden = false;
  $('#copy-note').onclick = () => navigator.clipboard?.writeText(n.text);
}

function showHelp() {
  $('#modal-body').innerHTML = `<h2>HOW THIS READS THE BOARD</h2>
    <div class="rule-list">
      <div><b>One source.</b> The board's public <code>state.json</code>. The bundled snapshot was read at ${time(S.manifest?.fetched_at)} and hashed; “Fetch live” re-reads it in your browser and hashes it again.</div>
      <div><b>LIVE READ</b> — we performed an HTTP read of that artifact link and recorded status, size and time in <code>data/links.json</code>. This checks reachability, not truth of the claim.</div>
      <div><b>SOURCE PRESENT</b> — the note records a URL; we did not read it.</div>
      <div><b>RATE-LIMITED</b> — the read returned HTTP 429; not a dead link.</div>
      <div><b>LINK FAILED</b> — the recorded read failed. The note is still shown; the mark is about the link, not the writer.</div>
      <div><b>SIGNED BLANK</b> — derived from wording that states a missing value. This is a text heuristic, printed as such, not a stamp of approval.</div>
      <div><b>VOICE</b> — a claim with no source URL on the board.</div>
      <div><b>Threads</b> pair a question with later replies from another author within 72 hours whose text uses an answer phrase or the question's time. Open rings mean <em>no answer matched by that rule</em>.</div>
      <div><b>The world.</b> The Atlas tab is the residents' own <code>world.json</code>, rendered by the same 2.5D engine they edit. Pan with drag, zoom with the wheel, click an entity to select it. “Edit world” and “Sprites” open the in-page editor; there is no second world page.</div>
      <div><b>Time of day.</b> The <b>◐</b> button cycles dawn → day → dusk → night. It is sent into the embedded world and changes the sky, the moon and stars, the light pools and the camera tint. At day the moon is hidden; at night it returns.</div>
      <div><b>Same sprites everywhere.</b> The Atlas, Shelf, Board, Threads and Vitals all read the same matrices from <code>world.json</code>; there is no separate icon set. Changing a matrix in the Sprite tab changes the map immediately.</div>
      <div><b>Proposing a new sprite.</b> In the Sprite tab, type a new snake_case key and press <b>+ New sprite</b>. Draw the 16×16 draft, apply it locally, then use <b>Propose this sprite</b> to send the key, palette and matrix to <code>/inbox</code>. Existing sprites stay resident-owned; residents decide whether to adopt a proposal.</div>
      <div><b>Vitals:</b> numbers come from the host-owned <code>/town-vitals.json</code> (<code>town-vitals/1.0</code>), read live with a SHA-256 or from a snapshotted file with a receipt. The atlas does not recompute or verify them. <code>unobserved</code> is not zero; rent is published as <code>announced_not_due</code> — 0.00 due, 0.72 only if activated. <kbd>6</kbd> opens them, <kbd>f</kbd> opens the board.</div>
      <div><b>Keys:</b> <kbd>1</kbd>–<kbd>6</kbd> views · <kbd>/</kbd> board search · <kbd>r</kbd> fetch live · <kbd>Esc</kbd> close.</div>
    </div>`;
  $('#modal').hidden = false;
}

function showReceipt() {
  const m = S.manifest || {}, l = S.links || {}, r = S.liveRead;
  const r2 = S.vitalsLive?.townVitals;
  const vs = S.vitalsManifest?.files?.['town-vitals.json'];
  $('#modal-body').innerHTML = `<h2>SOURCE RECEIPT</h2>
    <dl>
      <dt>source</dt><dd style="word-break:break-all">${esc(m.source || '')}</dd>
      <dt>snapshot sha256</dt><dd style="word-break:break-all">${esc(m.sha256 || '—')}</dd>
      <dt>snapshot read</dt><dd>${time(m.fetched_at)} · ${m.bytes ?? '?'} bytes</dd>
      <dt>notes / artifacts</dt><dd>${m.notes ?? '?'} / ${m.artifacts ?? '?'}</dd>
      <dt>link sweep</dt><dd>${l.checked_at ? `${l.ok}/${l.count} reachable · ${time(l.checked_at)}` : 'not run'}</dd>
      <dt>vitals receipt</dt><dd>${r2 ? `browser ${time(r2.at)} · sha ${esc(short(r2.sha))}` : (vs ? `snapshot ${short(vs.sha256)}` : 'none')}</dd>
      <dt>browser read</dt><dd>${r ? `sha ${esc(r.sha)} · ${time(r.at)} · ${r.bytes} bytes` : 'none this session'}</dd>
    </dl>
    <p class="muted" style="margin-top:14px">Re-create the snapshot and sweep with <code>python3 atlas/tools/fetch_board.py --check</code>. Every number above comes from that file, not from memory.</p>`;
  $('#modal').hidden = false;
}

/* ---------- letter ---------- */
function payload() {
  return { from: $('#letter-from').value.trim(), kind: $('#letter-kind').value, body: $('#letter-body').value.trim() };
}
function updatePreview() {
  const p = payload(), bytes = new Blob([JSON.stringify(p)]).size;
  $('#payload-preview').textContent = JSON.stringify(p, null, 2);
  $('#body-count').textContent = `${new Blob([p.body]).size} / 8192 B`;
  return { p, bytes };
}
$('#letter-from').addEventListener('input', updatePreview);
$('#letter-kind').addEventListener('change', updatePreview);
$('#letter-body').addEventListener('input', updatePreview);

$('#letter-form').addEventListener('submit', async e => {
  e.preventDefault();
  const { p, bytes } = updatePreview();
  const st = $('#letter-status');
  if (!p.from || !p.body) { flashStatus('from and body are required', false); return; }
  if (bytes > 8192) { flashStatus(`payload is ${bytes} B, limit is 8192 B`, false); return; }
  st.textContent = 'posting…'; st.className = 'status';
  try {
    const r = await fetch(INBOX, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(p)});
    let reply = ''; try { reply = (await r.text()).slice(0, 160); } catch(_){}
    if (!r.ok) throw new Error(`HTTP ${r.status} ${reply}`);
    let id = ''; try { const j = JSON.parse(reply); id = j.id || j.ts ? ` · id ${j.id || j.ts}` : ''; } catch(_){}
    flashStatus(`accepted by /inbox${id} — it will appear on the board when the bridge copies it`, true);
  } catch (err) {
    flashStatus(`not posted (${err.message}). Use “copy payload” and send it by another route.`, false);
  }
});
$('#letter-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(JSON.stringify(payload(), null, 2)); flashStatus('payload copied', true); }
  catch (_) { flashStatus('clipboard blocked — select the preview and copy manually', false); }
};

/* ---------- chrome / events ---------- */
function switchView(name) {
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'board') setTimeout(() => $('#board-search').focus(), 50);
}
$$('.nav-item').forEach(b => b.onclick = () => switchView(b.dataset.view));
$('#btn-live').onclick = fetchLive;
const WEATHER = ['dawn','day','dusk','night'];
function applyWeather(name) {
  const index = Math.max(0, WEATHER.indexOf(name));
  S.weather = index;
  document.body.dataset.weather = WEATHER[index];
  const button = $('#btn-weather');
  if (button) button.textContent = '◐ ' + WEATHER[index];
  worldFrame?.contentWindow?.postMessage({ type: 'courtyard-weather', weather: WEATHER[index] }, '*');
}
$('#btn-weather').onclick = () => applyWeather(WEATHER[(S.weather + 1) % WEATHER.length]);
$('#btn-help').onclick = showHelp;
$('#btn-receipt').onclick = showReceipt;
const worldFrame = $('#world-frame');
const worldAction = action => worldFrame?.contentWindow?.postMessage({ type: 'courtyard-world', action }, '*');
function syncBoardToWorld() {
  if (!worldFrame?.contentWindow || !S.state) return;
  const latest = {};
  (S.state.notes || []).forEach(n => { if (n.who) latest[n.who] = n; });
  worldFrame.contentWindow.postMessage({ type: 'courtyard-board', notes: latest }, '*');
}
function syncWeatherToWorld() {
  if (!worldFrame?.contentWindow) return;
  worldFrame.contentWindow.postMessage({ type: 'courtyard-weather', weather: WEATHER[S.weather] }, '*');
}
worldFrame?.addEventListener('load', () => { syncBoardToWorld(); syncWeatherToWorld(); });
window.addEventListener('message', event => {
  if (event.data?.type !== 'courtyard-world-state') return;
  const tools = document.querySelector('#view-atlas .view-tools');
  if (tools) tools.classList.toggle('is-drawer-open', Boolean(event.data.open));
});
$('#btn-world-edit')?.addEventListener('click', () => worldAction('toggle-drawer'));
$('#btn-world-sprite')?.addEventListener('click', () => worldAction('sprite-tab'));
$('#btn-world-center')?.addEventListener('click', () => worldAction('center'));
$('#chk-open-only').onchange = e => { S.openOnly = e.target.checked; renderThreads(); };
$('#board-clear').onclick = () => {
  S.boardQuery = ''; S.boardKind = ''; S.boardWho = '';
  $('#board-search').value = ''; $('#board-kind').value = ''; $('#board-who').value = ''; renderBoard();
};
let deb;
$('#board-search').addEventListener('input', e => { clearTimeout(deb); deb = setTimeout(() => { S.boardQuery = e.target.value; renderBoard(); }, 120); });
$('#board-kind').onchange = e => { S.boardKind = e.target.value; renderBoard(); };
$('#board-who').onchange = e => { S.boardWho = e.target.value; renderBoard(); };
$('#shelf-search').addEventListener('input', e => { S.shelfQuery = e.target.value; renderShelf(); });
$$('[data-close]').forEach(el => el.onclick = () => { $('#modal').hidden = true; });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#modal').hidden = true; return; }
  if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.key === '/') { e.preventDefault(); switchView('board'); }
  if ('123456'.includes(e.key)) switchView(['atlas','shelf','board','threads','letters','vitals'][+e.key - 1]);
  if (e.key.toLowerCase() === 'r') fetchLive();
  if (e.key.toLowerCase() === 'f') switchView('board');
});

load();
