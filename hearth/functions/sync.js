/**
 * Cross-device merge.
 *
 * Both the phone and the PC hold a full copy of the state and push it up. The
 * server merges rather than overwriting, because last-writer-wins at the
 * document level loses a whole session the moment two devices are used on the
 * same day.
 *
 * The merge is deliberately boring and append-biased: when in doubt, keep
 * both. Losing a drawing session is unacceptable; a duplicate is annoying.
 */

const CAPS = { sessions: 400, pieces: 200, talk: 200 };

function asArray(v) { return Array.isArray(v) ? v : []; }
function asObject(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

/** ISO string or number to a comparable number. */
function stamp(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return isFinite(t) ? t : 0;
  }
  return 0;
}

/** Union two lists of records by id, keeping whichever copy looks newer. */
function mergeById(a, b, newerField) {
  const out = new Map();
  const put = (rec) => {
    if (!rec || !rec.id) return;
    const prev = out.get(rec.id);
    if (!prev) { out.set(rec.id, rec); return; }
    const pv = stamp(prev[newerField]);
    const nv = stamp(rec[newerField]);
    if (nv >= pv) out.set(rec.id, rec);
  };
  asArray(a).forEach(put);
  asArray(b).forEach(put);
  return Array.from(out.values());
}

/** Talk messages have no ids, so identity is time plus role plus text. */
function mergeTalk(a, b) {
  const seen = new Map();
  const put = (m) => {
    if (!m || !m.content) return;
    const key = String(m.ts || 0) + '|' + m.role + '|' + String(m.content).slice(0, 80);
    if (!seen.has(key)) seen.set(key, m);
  };
  asArray(a).forEach(put);
  asArray(b).forEach(put);
  return Array.from(seen.values()).sort((x, y) => num(x.ts) - num(y.ts));
}

/**
 * @param {object} stored   what the server already has (may be empty)
 * @param {object} incoming what this device just sent
 * @returns {object} the merged state, to be saved and sent back
 */
function merge(stored, incoming) {
  const s = asObject(stored);
  const i = asObject(incoming);

  const sAt = stamp(s.updatedAt);
  const iAt = stamp(i.updatedAt);
  const incomingIsNewer = iAt >= sAt;

  /* Sessions are immutable once closed, so a plain union is right. */
  const sessions = mergeById(s.sessions, i.sessions, 'closedAt')
    .sort((a, b) => stamp(b.closedAt) - stamp(a.closedAt))
    .slice(0, CAPS.sessions);

  /* Pieces change (a piece gets finished), so prefer the newer copy. */
  const pieces = mergeById(s.pieces, i.pieces, 'updatedAt')
    .sort((a, b) => stamp(b.updatedAt || b.created) - stamp(a.updatedAt || a.created))
    .slice(0, CAPS.pieces);

  const talk = mergeTalk(s.talk, i.talk).slice(-CAPS.talk);

  /* Scalars: whole-object wins by recency, which is right for settings and
     for hand-edited skill levels. */
  const ledgerDelta = incomingIsNewer
    ? Object.assign({}, asObject(s.ledgerDelta), asObject(i.ledgerDelta))
    : Object.assign({}, asObject(i.ledgerDelta), asObject(s.ledgerDelta));

  const prefs = incomingIsNewer
    ? Object.assign({}, asObject(s.prefs), asObject(i.prefs))
    : Object.assign({}, asObject(i.prefs), asObject(s.prefs));

  /* Things the companion has learned. Append-only, newest last, deduped. */
  const learned = mergeTalk(
    asArray(s.learned).map((x) => ({ ts: x.ts, role: 'learned', content: x.note, raw: x })),
    asArray(i.learned).map((x) => ({ ts: x.ts, role: 'learned', content: x.note, raw: x }))
  ).map((x) => x.raw).slice(-120);

  return {
    sessions,
    pieces,
    talk,
    learned,
    ledgerDelta,
    prefs,
    updatedAt: new Date(Math.max(sAt, iAt, Date.now())).toISOString()
  };
}

/** Rough byte size, so an oversized document is caught before Firestore
 *  rejects it at 1 MiB. */
function tooBig(state) {
  try { return JSON.stringify(state).length > 800000; }
  catch (e) { return true; }
}

/** Shed the oldest history until it fits. Sessions go first; the talk thread
 *  and anything unfinished are kept longest. */
function shrink(state) {
  const s = Object.assign({}, state);
  let guard = 0;
  while (tooBig(s) && guard++ < 24) {
    if (s.sessions && s.sessions.length > 40) s.sessions = s.sessions.slice(0, Math.floor(s.sessions.length * 0.75));
    else if (s.talk && s.talk.length > 40) s.talk = s.talk.slice(-Math.floor(s.talk.length * 0.75));
    else if (s.pieces && s.pieces.length > 40) s.pieces = s.pieces.slice(0, Math.floor(s.pieces.length * 0.75));
    else break;
  }
  return s;
}

module.exports = { merge, tooBig, shrink, CAPS };
