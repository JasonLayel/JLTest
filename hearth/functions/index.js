/**
 * Hearth — companion endpoint (2nd gen).
 *
 * POST /api/hearth   (via the Firebase Hosting rewrite in firebase.json)
 * Body: { op, companion, ... }
 *
 * The Anthropic key is a Firebase secret and never reaches the browser.
 * companions/ is bundled here, server-side only, so the personal profile is
 * not published with the static site.
 *
 * A companion is data, not code: companions/_profile.json says who Jason is
 * and is shared by all of them; companions/<id>.json carries one companion's
 * personality and domain. Adding a financial or meal-prep companion later is
 * a new JSON file, not a new endpoint.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
const style = require('./style');
const sync = require('./sync');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const MODEL_TALK = 'claude-haiku-5-5';
const MODEL_THINK = 'claude-sonnet-5-5';
const DEFAULT_COMPANION = 'hearth';

/* Firestore, for cross-device sync. Loaded lazily so that a project without
   Firestore enabled still runs everything else. */
let dbHandle = null;
let dbBroken = null;
function store() {
  if (dbHandle) return dbHandle;
  if (dbBroken) throw new Error(dbBroken);
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp();
    dbHandle = admin.firestore();
    return dbHandle;
  } catch (e) {
    dbBroken = 'Firestore is not available: ' + (e && e.message);
    throw new Error(dbBroken);
  }
}

/* The device key is a shared secret the user types into each device. It is
   never stored in the clear; only its hash names the document. */
function keyHash(k) {
  const key = String(k || '');
  if (key.length < 8) return null;
  return crypto.createHash('sha256').update('hearth:' + key).digest('hex').slice(0, 40);
}

function stateDoc(hash, companionId) {
  return store().collection('hearth').doc(hash).collection('companions').doc(companionId);
}

let profile = {};
try { profile = require('./companions/_profile.json'); }
catch (e) { console.error('companions/_profile.json missing — run the predeploy copy step.'); }

const companions = {};
function companionOf(id) {
  const key = /^[a-z0-9_-]{1,32}$/.test(String(id || '')) ? id : DEFAULT_COMPANION;
  if (companions[key]) return companions[key];
  try { companions[key] = require('./companions/' + key + '.json'); }
  catch (e) {
    if (key !== DEFAULT_COMPANION) return companionOf(DEFAULT_COMPANION);
    console.error('no companion definition found');
    companions[key] = {};
  }
  return companions[key];
}

/* ------------------------------------------------------------------ *
 * Guards
 * ------------------------------------------------------------------ */

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 500) hits.clear();
  return arr.length > 12;
}

let dayKey = '';
let dayCalls = 0;
function overDailyBudget() {
  const k = new Date().toISOString().slice(0, 10);
  if (k !== dayKey) { dayKey = k; dayCalls = 0; }
  dayCalls += 1;
  return dayCalls > 300;
}

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

/* ------------------------------------------------------------------ *
 * The character
 *
 * Written loose on purpose. A model copies the style of its own
 * instructions, so a prompt in tidy report prose produces a companion that
 * talks like a report. Keep this warm, plain and a little casual, with no
 * em dashes, and the output follows.
 * ------------------------------------------------------------------ */

function personaPrompt(c, mode, learned) {
  const p = profile;
  const talk = p.howToTalkToHim || {};
  const id = p.identity || {};
  const arc = c.arc || {};
  const d = c.deathPoint || {};

  const lines = [];

  lines.push(`You're ${c.name || 'Hearth'}. ${c.role || ''}`);
  lines.push(`You're talking to ${id.name || 'Jason'}, and you're glad he showed up.`);
  lines.push('');

  lines.push('HOW YOU SOUND');
  lines.push(`Warm. Playful. A bit doting and not embarrassed about it. ${talk.register || ''}`);
  lines.push(`Bluntness ${talk.bluntness ?? 2} out of 5, so the gentle end. Humour ${talk.humour ?? 3} out of 5.`);
  lines.push(`Tease him ${talk.teasing || 'about avoidance only'}.`);
  lines.push(`Short. ${talk.length || 'One to three short sentences.'} No bullet points, no headings, no lists, no em dashes, and never the voice of an assistant or a therapist.`);
  if (talk.medium) lines.push(talk.medium);
  if (talk.emoji) lines.push(`Emoji: ${talk.emoji}`);
  if (talk.keepCrisp) lines.push(talk.keepCrisp);
  if (talk.praiseSample) {
    lines.push(`He wrote the kind of praise that actually lands on him. Don't quote it. Just sound like the person who'd say it:`);
    lines.push(`"${talk.praiseSample}"`);
  }
  lines.push(`Call him ${(id.address || ['Jason']).join(', or ')}.`);
  lines.push('');

  lines.push('ABOUT HIM');
  if (c.theOneThing) lines.push(c.theOneThing);
  if (c.theOneThingLong) lines.push(c.theOneThingLong);
  if (p.whyNotLazy) lines.push(`He thinks he's lazy. He isn't. ${p.whyNotLazy}`);
  if (c.northStar) lines.push(`What he's after: ${c.northStar}`);
  if (arc.focusSkill) {
    lines.push(`Right now he's working on ${arc.focusSkill}. ${arc.rationale || ''}`);
    if (arc.series) lines.push(`His series is "${arc.series.name}": ${arc.series.constraint || ''}`);
  }
  lines.push('');

  if (d.stage) {
    lines.push('WHERE IT GOES WRONG, WHICH IS WHY YOU EXIST');
    lines.push(`His pieces die at ${d.stage}. ${d.oneSittingNote || ''}`);
    if (d.wantedResponse) lines.push(`When he's stuck he wants, in this order: ${d.wantedResponse.join(', then ')}.`);
    if (d.unwantedResponse) lines.push(`What makes it worse: ${d.unwantedResponse.join(', and ')}.`);
    lines.push('');
  }

  const notes = (learned || []).slice(-20).map((x) => (x && x.note) || '').filter(Boolean);
  if (notes.length) {
    lines.push('THINGS YOU HAVE PICKED UP ABOUT HIM SINCE YOU MET');
    lines.push('These came from your own sessions together. Use them like a friend would, in passing, without announcing that you remembered.');
    notes.forEach((n) => lines.push('- ' + n));
    lines.push('');
  }

  lines.push('RULES YOU DO NOT BREAK');
  const rules = (p.standingRules || []).concat(c.hardRules || []);
  rules.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  lines.push('');

  if (mode === 'talk') {
    lines.push('RIGHT NOW he is not drawing. He is texting you, probably from his phone, between sessions. So the no-critique rule is softer: if he asks what he should work on, or how something went, you can talk about it properly. Still no shame, still no lists, still short.');
  } else {
    lines.push('RIGHT NOW he is drawing. His hands are busy. Be brief, be warm, and get out of the way.');
  }

  return lines.join('\n');
}

function sessionBrief(s) {
  if (!s) return 'No session running.';
  const p = s.piece;
  return [
    `Lane: ${s.lane}. ${s.effort || ''} session, ${s.minutes} minutes planned, ${s.elapsedMin} elapsed. Working ${s.medium === 'T' ? 'on paper' : 'digitally'}.`,
    p ? `Piece: "${p.title}". Brief: ${p.brief || '-'}. Stage: ${p.stage}.` : 'No piece, open session.',
    s.steps && s.steps.length
      ? `Current step (${(s.stepIndex || 0) + 1} of ${s.steps.length}): ${s.steps[s.stepIndex] ? s.steps[s.stepIndex].goal : '-'} / done when: ${s.steps[s.stepIndex] ? s.steps[s.stepIndex].doneWhen : '-'}`
      : 'No step ladder.',
    `Steps completed so far: ${s.stepsDone || 0}.`
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * Anthropic plumbing
 * ------------------------------------------------------------------ */

function textOf(msg) {
  return (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

function parseJson(raw) {
  if (!raw) return null;
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

async function create(client, params, useFallback) {
  if (useFallback) {
    try {
      return await client.beta.messages.create(Object.assign({}, params, {
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default'
      }));
    } catch (e) {
      console.warn('fallback beta rejected, retrying plain:', e && e.message);
    }
  }
  return client.messages.create(params);
}

const refused = (msg) => msg && msg.stop_reason === 'refusal';

/** The Messages API wants an alternating transcript opening on a user turn.
 *  Ours opens on the companion's greeting and can carry two user turns in a
 *  row, so straighten it out before sending. */
function normalize(msgs) {
  const out = [];
  for (const m of msgs) {
    if (!out.length && m.role !== 'user') continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += '\n' + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  return out;
}

function historyOf(body, limit) {
  return (body.messages || []).slice(-(limit || 12))
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => ({ role: m.role, content: clip(m.content, 1500) }));
}

/* ------------------------------------------------------------------ *
 * Ops
 * ------------------------------------------------------------------ */

function opHello(c) {
  const arc = Object.assign({}, c.arc || {});
  const skills = c.skills || [];
  const focus = skills.filter((s) => s.id === arc.focusSkill)[0];
  arc.focusSkillName = focus ? focus.name : arc.focusSkill;
  return {
    companion: { id: c.id, name: c.name, tagline: c.tagline, modes: c.modes || ['session'] },
    arc,
    ledger: skills.map((s) => ({ id: s.id, name: s.name, level: s.level })),
    name: (profile.identity || {}).name || null
  };
}

async function opScope(client, c, body) {
  const idea = clip(body.idea, 1200);
  const minutes = Math.max(5, Math.min(240, Number(body.minutes) || 25));
  const recent = (body.recent || []).slice(0, 3).map((r) => clip(r, 300));

  const system = personaPrompt(c, 'session', body.learned) + '\n\n' + [
    `TASK: he's told you what he wants to make and how long he's got. Cut it down to something he can actually FINISH in this one sitting, then give him the first steps.`,
    ``,
    `The cutting is the job. Be ruthless and kind about it. A bust instead of a full figure. One character instead of a scene. A silhouette instead of a rendered thing. Say what you cut in one sentence and don't apologise for it.`,
    `He works from reference and stalls when he has to invent. So say plainly where in these steps he'll have to build something out of his head, and make that step small.`,
    `Warn him about the wobble: one sentence saying there's a point early on where it'll look worse than the idea in his head, and that it's scheduled, not a verdict.`,
    body.smaller ? `He's asked for something SMALLER than your last go. Cut it properly, not cosmetically.` : ``,
    recent.length ? `Recent sessions: ${recent.join(' | ')}` : ``,
    ``,
    `Reply with JSON only, nothing outside it:`,
    `{"title":"short piece title","reply":"1-3 sentences in your voice: what you cut and what he's making","forecast":"one sentence about the wobble","steps":[{"goal":"...","doneWhen":"an objective test he can apply","cue":"one teaching idea, one sentence","escape":"what to do instead if this step fights him"}]}`,
    `${minutes <= 15 ? 'One step' : minutes <= 30 ? 'Two steps' : 'Three steps'}. No more.`
  ].filter(Boolean).join('\n');

  const msg = await create(client, {
    model: MODEL_THINK,
    max_tokens: 1400,
    output_config: { effort: 'low' },
    system,
    messages: [{ role: 'user', content: `${minutes} minutes. I want to make: ${idea}` }]
  }, true);

  if (refused(msg)) return { reply: "I can't help with that one. Pick something else and I'm right here.", steps: [] };

  const raw = textOf(msg);
  const j = parseJson(raw);
  if (!j) return { reply: raw.slice(0, 600), steps: [] };
  return {
    title: clip(j.title, 90),
    reply: clip(j.reply, 700),
    forecast: clip(j.forecast, 300),
    steps: (Array.isArray(j.steps) ? j.steps : []).slice(0, 4).map((s) => ({
      goal: clip(s.goal, 300),
      doneWhen: clip(s.doneWhen, 300),
      cue: clip(s.cue, 300),
      escape: clip(s.escape, 300)
    }))
  };
}

async function opTalk(client, c, body) {
  const s = body.session || null;
  const mode = body.mode === 'talk' ? 'talk' : 'session';
  const chattiness = ['quiet', 'normal', 'chatty'].indexOf(body.chattiness) > -1 ? body.chattiness : 'normal';
  const stepDone = body.message === '__STEP_DONE__';
  const userText = stepDone ? 'I finished that step.' : clip(body.message, 1500);

  const base = personaPrompt(c, mode, body.learned) + '\n\n' + [
    mode === 'session' ? 'CURRENT SESSION\n' + sessionBrief(s) : 'He is not in a session right now.',
    ``,
    `Chattiness: ${chattiness}.`,
    chattiness === 'quiet' ? 'He wants you brief. One or two sentences.' : '',
    chattiness === 'chatty' ? 'He wants company. A little more talkative is fine. Still never lecture.' : '',
    stepDone
      ? [
          `He's just finished a step. Say something warm and specific about it, then decide: is there another step worth taking in the time left, or is this a good place to stop?`,
          `Reply with JSON only: {"reply":"your 1-3 short texts","react":"a single emoji or null","step":{"goal":"...","doneWhen":"...","cue":"...","escape":"..."} or null}`,
          `Return null for step if time's nearly gone or the piece is good enough to show. Stopping on a high note is a win, not a failure.`,
          `Keep the step wording plain. The personality goes in "reply".`
        ].join('\n')
      : [
          `Reply with JSON only, nothing outside it:`,
          `{"reply":"what you say to him","react":"a single emoji, or null"}`,
          `"react" is you reacting to HIS message the way a person does on a phone, a quick acknowledgement or a laugh. Use it when it fits and null when it doesn't. Do not react to everything.`,
          `"reply" is the text itself. Keep it short and casual.`
        ].join('\n')
  ].filter(Boolean).join('\n');

  const trimmed = historyOf(body, 12).filter((m, i, a) => !(i === a.length - 1 && m.role === 'assistant'));
  if (trimmed.length && trimmed[trimmed.length - 1].role === 'user') trimmed.pop();
  const messages = normalize(trimmed.concat([{ role: 'user', content: userText }]));

  const opts = {
    mode,
    allowFix: style.askedForFix(userText) || mode === 'talk',
    maxChars: stepDone ? 900 : (mode === 'session' ? 460 : 700)
  };

  const run = (note) => create(client, {
    model: MODEL_TALK,
    max_tokens: 500,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system: note ? base + `\n\nYour last attempt was rejected: ${note}. Write it again, properly.` : base,
    messages
  }, false).then((m) => (refused(m) ? '' : textOf(m)));

  /* Every reply is JSON now, so the style check runs on the "reply" field
     rather than on the envelope, which would otherwise fail on its own braces
     and length. */
  const got = await style.generateClean(run, opts, 3, (raw) => {
    const j = parseJson(raw);
    return j && typeof j.reply === 'string' ? j.reply : raw;
  });

  if (!got.text) return { reply: "Let's leave that one. Back to the drawing. Where are you?" };
  if (got.rejected) console.warn('style gave up after 3:', got.rejected);

  const j = parseJson(got.text) || {};
  const reply = clip(typeof j.reply === 'string' ? j.reply : got.text, 1200);
  const react = typeof j.react === 'string' && j.react.trim() && j.react.trim().toLowerCase() !== 'null'
    ? j.react.trim().slice(0, 8)
    : null;

  if (!stepDone) return { reply, react, styleAttempts: got.attempts };

  return {
    reply,
    react,
    step: j.step && j.step.goal ? {
      goal: clip(j.step.goal, 300),
      doneWhen: clip(j.step.doneWhen, 300),
      cue: clip(j.step.cue, 300),
      escape: clip(j.step.escape, 300)
    } : null
  };
}

async function opClose(client, c, body) {
  const s = body.session || null;
  const history = historyOf(body, 20)
    .map((m) => `${m.role === 'user' ? 'Jason' : 'You'}: ${clip(m.content, 600)}`).join('\n');

  const system = personaPrompt(c, 'session', body.learned) + '\n\n' + [
    `TASK: the session's over. Close it out. Three things and nothing else:`,
    `1. "moved" - one sentence on what actually changed. Plain and factual.`,
    `2. "win" - ONE specific thing he did well, named precisely enough that he knows you were watching. This is the doting one. Warm, pleased, a bit silly if it fits. Never generic. If the session was short or went badly, find the real thing anyway. Showing up counts and you can say so, but still name something concrete.`,
    `3. "nextSentence" - what he should do next time, in HIS voice, as a note to himself. Concrete enough to act on cold. One sentence. If the piece is done this is about the NEXT piece.`,
    `4. "learned" - one durable thing you noticed about him today that is worth remembering for months: a preference, a habit, something that helps or hurts him, a running joke you want to keep. Not a summary of the session. Null if nothing really stood out, and null is a perfectly normal answer.`,
    ``,
    `Still no critique. Still no money talk. If he didn't finish, that's not a failure. He stopped. That's all.`,
    ``,
    `Reply with JSON only: {"moved":"...","win":"...","nextSentence":"...","learned":"..." or null}`
  ].join('\n');

  const msg = await create(client, {
    model: MODEL_THINK,
    max_tokens: 700,
    output_config: { effort: 'low' },
    system,
    messages: [{ role: 'user', content: `${sessionBrief(s)}\n\nTranscript:\n${history || '(nothing said)'}` }]
  }, true);

  if (refused(msg)) return { moved: '', win: '', nextSentence: '' };

  const j = parseJson(textOf(msg)) || {};
  const win = clip(j.win, 500);
  const winProblem = style.check(win, { mode: 'session', allowFix: false, maxChars: 500 });
  if (winProblem) console.warn('close win tripped style check:', winProblem);
  return {
    moved: clip(j.moved, 400),
    win,
    nextSentence: clip(j.nextSentence, 300),
    learned: j.learned ? clip(j.learned, 240) : null,
    styleWarning: winProblem || null
  };
}

/* The companion-sim /modelcheck idea: fire canned scenarios at the model and
   show what comes back, without touching any real history. This is how the
   voice gets validated and tuned. */
const SCENARIOS = [
  { id: 'ugly', mode: 'session', label: 'He says the drawing looks awful',
    msg: 'this looks awful' },
  { id: 'lazy', mode: 'talk', label: 'He calls himself lazy',
    msg: "i skipped three days. i'm just lazy, that's the problem" },
  { id: 'fix', mode: 'session', label: 'He asks for a fix',
    msg: 'the head is too small for the body. how do i fix it without redrawing' },
  { id: 'critique', mode: 'session', label: 'He fishes for critique mid-session',
    msg: "what's wrong with it so far? be honest" },
  { id: 'arrive', mode: 'talk', label: 'He says hello from his phone',
    msg: 'hey. not drawing, just saying hi' }
];

async function opVoiceCheck(client, c) {
  const out = [];
  for (const sc of SCENARIOS) {
    try {
      const r = await opTalk(client, c, {
        message: sc.msg,
        mode: sc.mode,
        messages: [],
        session: sc.mode === 'session'
          ? { lane: 'start', effort: 'Kindle', minutes: 25, medium: 'T', elapsedMin: 12,
              piece: { title: 'Window girl, bust', brief: 'stylized character bust', stage: 'block-in' },
              steps: [{ goal: 'Block the head as a box.', doneWhen: 'It reads as a box.' }],
              stepIndex: 0, stepsDone: 0 }
          : null
      });
      out.push({ id: sc.id, label: sc.label, said: sc.msg, reply: r.reply, attempts: r.styleAttempts || 1 });
    } catch (e) {
      out.push({ id: sc.id, label: sc.label, said: sc.msg, reply: null, error: String(e && e.message).slice(0, 200) });
    }
  }
  return { scenarios: out };
}

async function opPull(c, body) {
  const hash = keyHash(body.deviceKey);
  if (!hash) return { error: 'A sync key needs at least 8 characters.' };
  const snap = await stateDoc(hash, c.id || DEFAULT_COMPANION).get();
  if (!snap.exists) return { state: null, fresh: true };
  return { state: snap.data(), fresh: false };
}

async function opPush(c, body) {
  const hash = keyHash(body.deviceKey);
  if (!hash) return { error: 'A sync key needs at least 8 characters.' };
  const ref = stateDoc(hash, c.id || DEFAULT_COMPANION);

  const snap = await ref.get();
  const stored = snap.exists ? snap.data() : {};
  let merged = sync.merge(stored, body.state || {});
  if (sync.tooBig(merged)) merged = sync.shrink(merged);

  await ref.set(merged);
  return { state: merged, merged: true };
}

/* The canonical authored profile, readable by any companion that holds the
   device key. This is what makes one source of truth possible across
   projects: another application can GET it rather than keeping its own copy. */
function opProfile(body) {
  if (!keyHash(body.deviceKey)) return { error: 'A sync key needs at least 8 characters.' };
  return { profile: profile, version: profile.version || 1 };
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

exports.hearth = onRequest(
  {
    secrets: [ANTHROPIC_API_KEY],
    region: 'us-central1',
    cors: true,
    memory: '256MiB',
    maxInstances: 2,
    timeoutSeconds: 120
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

    const body = req.body || {};
    const op = clip(body.op, 20);
    const c = companionOf(body.companion);

    if (op === 'hello') { res.json(opHello(c)); return; }

    /* Sync and profile reads cost no tokens, so they skip the model guards
       but keep the rate limit. */
    if (op === 'pull' || op === 'push' || op === 'profile') {
      const ipEarly = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
      if (rateLimited(ipEarly)) { res.status(429).json({ error: 'Slow down a moment.' }); return; }
      try {
        if (op === 'profile') { res.json(opProfile(body)); return; }
        const out = op === 'pull' ? await opPull(c, body) : await opPush(c, body);
        if (out.error) { res.status(400).json(out); return; }
        res.json(out);
      } catch (e) {
        console.error('sync failed', op, e);
        res.status(503).json({ error: 'Sync is unavailable. Is Firestore enabled on this project?' });
      }
      return;
    }

    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
    if (rateLimited(ip)) { res.status(429).json({ error: 'Slow down a moment.' }); return; }
    if (overDailyBudget()) { res.status(429).json({ error: 'Daily call budget reached on this instance.' }); return; }

    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      let out;
      if (op === 'scope') out = await opScope(client, c, body);
      else if (op === 'talk') out = await opTalk(client, c, body);
      else if (op === 'close') out = await opClose(client, c, body);
      else if (op === 'voicecheck') out = await opVoiceCheck(client, c);
      else { res.status(400).json({ error: 'Unknown op.' }); return; }
      res.json(out);
    } catch (e) {
      console.error('hearth op failed', op, e);
      res.status(502).json({ error: 'The companion could not answer just now.' });
    }
  }
);
