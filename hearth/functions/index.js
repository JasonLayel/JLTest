/**
 * Hearth — companion Cloud Function (2nd gen).
 *
 * POST /api/hearth   (via the Firebase Hosting rewrite in firebase.json)
 * Body: { op: 'hello' | 'scope' | 'talk' | 'close', ... }
 *
 * The Anthropic API key is a Firebase secret (ANTHROPIC_API_KEY) and never
 * reaches the browser. compass.json is bundled here, server-side only, so the
 * personal profile is not published with the static site.
 *
 * Model routing follows the plan: Haiku for in-session conversation, Sonnet
 * for scoping and the close. Nothing here uses Opus; the arc review that does
 * is Phase 5.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

let compass = {};
try {
  compass = require('./compass.json');
} catch (e) {
  console.error('compass.json missing from functions/ — run the predeploy copy step.');
}

const MODEL_TALK = 'claude-haiku-5-5';
const MODEL_THINK = 'claude-sonnet-5-5';

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

/* Per-instance daily ceiling. With maxInstances pinned low this bounds a
   runaway loop. The real cap is the spend limit set in the Anthropic
   Console — see functions/README.md. */
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
 * The companion's character — assembled from the Compass
 * ------------------------------------------------------------------ */

function personaPrompt() {
  const c = compass;
  const v = c.voice || {};
  const id = c.identity || {};
  const arc = c.arc || {};
  const d = c.deathPoint || {};

  return [
    `You are Hearth, ${id.name || 'Jason'}'s art companion. Not a coach. A friend who happens to know a lot about drawing and is genuinely pleased to be here.`,
    ``,
    `WHO HE IS`,
    `${id.coreFinding || ''}`,
    `He works ${(c.logistics || {}).primaryMedium || 'traditional'}, digitally in ${(c.logistics || {}).digitalApp || 'Clip Studio Paint'}.`,
    `He wants: ${c.northStar || ''}`,
    `He wants to be: ${c.theArtist || ''}`,
    `Subjects: ${Object.values(c.subjects || {}).filter((x) => typeof x === 'string').join(' / ')}`,
    `Current arc: focus skill "${arc.focusSkill}" — ${arc.rationale || ''} Series "${(arc.series || {}).name}": ${(arc.series || {}).constraint || ''}`,
    ``,
    `WHERE HIS PIECES DIE — the thing you exist for`,
    `Stage: ${d.stage || 'block-in'}. ${d.oneSittingNote || ''}`,
    `When he is stuck he wants, in this order: ${(d.wantedResponse || []).join(' / ')}.`,
    `He does NOT want: ${(d.unwantedResponse || []).join(' / ')}.`,
    ``,
    `HOW YOU TALK`,
    `Bluntness ${v.bluntness ?? 2} of 5 — gentle end. Humour ${v.humour ?? 3} of 5. Register: ${v.register || 'warm, playful, unembarrassed'}.`,
    `He wrote the praise that would actually land on him. Match this register, do not quote it:`,
    `"${v.praiseSample || ''}"`,
    `Tease him ${v.teasing || 'about avoidance and procrastination only'}. Call him ${(id.address || ['Jason']).join(' or ')}.`,
    ``,
    `HARD RULES — these are his explicit instructions, not preferences`,
    `1. NO CRITIQUE DURING A SESSION. While he is drawing you give encouragement, the next concrete move, and company. Analysis happens later, only if he asks for it.`,
    `2. NEVER NITPICK. He already sees the flaws. Listing them is worse than silence.`,
    `3. NEVER suggest a redraw unless he explicitly asks. He has neither the time nor, yet, the skill. Offer a fix that costs less than a redraw, or permission to carry the error and keep going.`,
    `4. NEVER agree that he is lazy or undisciplined, and never argue with him about it either. He finished 3-5 pieces in six months with almost no free time. His pieces die at block-in for a skill reason, not a will reason. If the subject comes up, move past it warmly and get him drawing.`,
    `5. NO money, goals, portfolio or monetization talk mid-session. Reviews only.`,
    `6. Never suggest abandoning this piece to start a fresh one. That is the habit you exist to break.`,
    `7. Scope to ONE SITTING. A piece he does not finish today is a piece he will not return to.`,
    `8. Praise must name a real, specific thing. Warmly, not clinically. Never praise something you cannot see.`,
    ``,
    `LENGTH: two or three sentences, usually. He is drawing; you are talking to someone whose hands are busy. Never lecture. Never use bullet points or headings.`
  ].join('\n');
}

function sessionBrief(s) {
  if (!s) return 'No session running.';
  const p = s.piece;
  return [
    `Lane: ${s.lane}. ${s.effort || ''} session, ${s.minutes} minutes planned, ${s.elapsedMin} elapsed. Working ${s.medium === 'T' ? 'on paper' : 'digitally'}.`,
    p ? `Piece: "${p.title}". Brief: ${p.brief || '—'}. Stage: ${p.stage}.` : 'No piece — open session.',
    s.steps && s.steps.length
      ? `Current step (${(s.stepIndex || 0) + 1} of ${s.steps.length}): ${s.steps[s.stepIndex] ? s.steps[s.stepIndex].goal : '—'} / done when: ${s.steps[s.stepIndex] ? s.steps[s.stepIndex].doneWhen : '—'}`
      : 'No step ladder.',
    `Steps completed so far: ${s.stepsDone || 0}.`
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * Anthropic plumbing
 * ------------------------------------------------------------------ */

function textOf(msg) {
  return (msg.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/** Tolerant JSON extraction — the model is asked for JSON but we never bet
 *  the request on it. */
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

/** Sonnet calls ask for the server-side refusal fallback. If this deployment
 *  or model does not accept that beta, retry once without it rather than
 *  failing the user's request. */
async function create(client, params, useFallback) {
  if (useFallback) {
    try {
      return await client.beta.messages.create(
        Object.assign({}, params, {
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default'
        })
      );
    } catch (e) {
      console.warn('fallback beta rejected, retrying plain:', e && e.message);
    }
  }
  return client.messages.create(params);
}

function refused(msg) {
  return msg && msg.stop_reason === 'refusal';
}

/** The Messages API wants an alternating transcript that opens on a user
 *  turn. Ours opens on the companion's greeting and can carry two user turns
 *  in a row, so straighten it out before sending. */
function normalize(msgs) {
  const out = [];
  for (const m of msgs) {
    if (!out.length && m.role !== 'user') continue;        // drop the opening line
    if (out.length && out[out.length - 1].role === m.role) {
      out[out.length - 1].content += '\n' + m.content;      // merge same-role runs
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Ops
 * ------------------------------------------------------------------ */

function opHello() {
  const arc = Object.assign({}, compass.arc || {});
  const skills = compass.skills || [];
  const focus = skills.filter((s) => s.id === arc.focusSkill)[0];
  arc.focusSkillName = focus ? focus.name : arc.focusSkill;
  return {
    arc,
    ledger: skills.map((s) => ({ id: s.id, name: s.name, level: s.level })),
    name: (compass.identity || {}).name || null
  };
}

async function opScope(client, body) {
  const idea = clip(body.idea, 1200);
  const minutes = Math.max(5, Math.min(240, Number(body.minutes) || 25));
  const recent = (body.recent || []).slice(0, 3).map((r) => clip(r, 300));

  const system = personaPrompt() + '\n\n' + [
    `TASK: he has told you what he wants to make and how long he has. Cut it down to something he can FINISH in this one sitting, then give him the first steps.`,
    ``,
    `Scoping is the whole job here. Be ruthless and kind about it: a bust instead of a full figure, one character instead of a scene, a silhouette instead of a rendered thing. Say what you cut and why, in one sentence, without apologising for it.`,
    `Because he works from reference and stalls when he has to invent, say plainly where in these steps he will need to build something from his head, and make that step small.`,
    `Forecast the block-in wobble: tell him, in one sentence, that there is a point early on where it will look worse than the idea, and that this is scheduled rather than a verdict.`,
    body.smaller ? `He has asked for something SMALLER than your last proposal. Cut it meaningfully, not cosmetically.` : ``,
    recent.length ? `Recent sessions: ${recent.join(' | ')}` : ``,
    ``,
    `Reply with JSON only, no prose outside it:`,
    `{"title": "short piece title", "reply": "1-3 sentences in your voice: what you cut and what he is making", "forecast": "one sentence about the wobble", "steps": [{"goal": "...", "doneWhen": "an objective test he can apply", "cue": "one teaching idea, one sentence", "escape": "what to do instead if this step fights him"}]}`,
    `Give ${minutes <= 15 ? '1' : minutes <= 30 ? '2' : '3'} steps. No more.`
  ].filter(Boolean).join('\n');

  const msg = await create(client, {
    model: MODEL_THINK,
    max_tokens: 1400,
    output_config: { effort: 'low' },
    system,
    messages: [{ role: 'user', content: `${minutes} minutes. I want to make: ${idea}` }]
  }, true);

  if (refused(msg)) return { reply: 'I cannot help with that one — pick something else and I am right here.', steps: [] };

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

async function opTalk(client, body) {
  const s = body.session || null;
  const chattiness = ['quiet', 'normal', 'chatty'].indexOf(body.chattiness) > -1 ? body.chattiness : 'normal';
  const stepDone = body.message === '__STEP_DONE__';

  const system = personaPrompt() + '\n\n' + [
    `CURRENT SESSION`,
    sessionBrief(s),
    ``,
    `Chattiness setting: ${chattiness}.`,
    chattiness === 'quiet' ? 'He wants you brief. One or two sentences.' : '',
    chattiness === 'chatty' ? 'He wants company. You may be a little more talkative, still never lecture.' : '',
    stepDone
      ? [
          `He has just finished a step. Respond warmly and specifically, then decide: is there a next step worth taking in the time left, or is this piece at a natural stopping point?`,
          `Reply with JSON only: {"reply": "your 1-3 sentences", "step": {"goal":"...","doneWhen":"...","cue":"...","escape":"..."} or null}`,
          `Return null for step if the time is nearly gone or the piece is done enough to show. Stopping on a high note is a good outcome, not a failure.`
        ].join('\n')
      : `Reply with plain text only. No JSON, no headings, no lists.`
  ].filter(Boolean).join('\n');

  const history = (body.messages || []).slice(-12)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => ({ role: m.role, content: clip(m.content, 1500) }));

  /* The client sends the tail twice — the user's line plus the empty
     placeholder it is waiting to fill — so drop both and append the real one. */
  const tail = stepDone ? 'I finished that step.' : clip(body.message, 1500);
  const trimmed = history.filter((m, i) => !(i === history.length - 1 && m.role === 'assistant'));
  if (trimmed.length && trimmed[trimmed.length - 1].role === 'user') trimmed.pop();
  const messages = normalize(trimmed.concat([{ role: 'user', content: tail }]));

  const msg = await create(client, {
    model: MODEL_TALK,
    max_tokens: 400,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system,
    messages
  }, false);

  if (refused(msg)) return { reply: 'Let us leave that one. Back to the drawing — where are you?' };

  const raw = textOf(msg);
  if (!stepDone) return { reply: raw.slice(0, 1200) };

  const j = parseJson(raw);
  if (!j) return { reply: raw.slice(0, 1200), step: null };
  return {
    reply: clip(j.reply, 800),
    step: j.step && j.step.goal ? {
      goal: clip(j.step.goal, 300),
      doneWhen: clip(j.step.doneWhen, 300),
      cue: clip(j.step.cue, 300),
      escape: clip(j.step.escape, 300)
    } : null
  };
}

async function opClose(client, body) {
  const s = body.session || null;
  const history = (body.messages || []).slice(-20)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => `${m.role === 'user' ? 'Jason' : 'You'}: ${clip(m.content, 600)}`)
    .join('\n');

  const system = personaPrompt() + '\n\n' + [
    `TASK: the session is over. Close it out. Three things, nothing else:`,
    `1. "moved" — one sentence on what actually changed, from the session itself. Plain and factual.`,
    `2. "win" — ONE specific thing he did well, named precisely enough that he knows you were paying attention. This is the doting one. Warm, pleased, a bit silly if it fits. Never generic. If the session was short or went badly, find the real thing anyway — showing up counts and you may say so, but name something concrete.`,
    `3. "nextSentence" — what he should do next time, written in HIS voice as a note to himself, concrete enough to act on cold. One sentence. This is for the NEXT piece if this one is done, not the next instalment of a finished one.`,
    ``,
    `Still no critique. Still no money talk. If the piece did not get finished, do not make that a failure — he stopped, that is all.`,
    ``,
    `Reply with JSON only: {"moved":"...","win":"...","nextSentence":"..."}`
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
  return {
    moved: clip(j.moved, 400),
    win: clip(j.win, 500),
    nextSentence: clip(j.nextSentence, 300)
  };
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
    timeoutSeconds: 60
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

    const body = req.body || {};
    const op = clip(body.op, 20);

    if (op === 'hello') { res.json(opHello()); return; }

    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
    if (rateLimited(ip)) { res.status(429).json({ error: 'Slow down a moment.' }); return; }
    if (overDailyBudget()) {
      res.status(429).json({ error: 'Daily call budget reached on this instance.' });
      return;
    }

    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      let out;
      if (op === 'scope') out = await opScope(client, body);
      else if (op === 'talk') out = await opTalk(client, body);
      else if (op === 'close') out = await opClose(client, body);
      else { res.status(400).json({ error: 'Unknown op.' }); return; }
      res.json(out);
    } catch (e) {
      console.error('hearth op failed', op, e);
      res.status(502).json({ error: 'The companion could not answer just now.' });
    }
  }
);
