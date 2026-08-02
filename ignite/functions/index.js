/**
 * Ignite — backstory Cloud Function (2nd gen).
 *
 * POST /api/backstory  (via the Firebase Hosting rewrite in firebase.json)
 * Body: { task, category, primary, secondary, palette }
 * Returns: { backstory: "<2–3 sentences>" }
 *
 * The Anthropic API key is stored as a Firebase secret (ANTHROPIC_API_KEY) and
 * only ever lives server-side — it never reaches the browser.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Best-effort, per-instance rate limit (a light guard against runaway calls).
// For stronger protection, add Firebase App Check — see functions/README.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60000;
  const max = 20; // requests per minute per IP (per instance)
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > max;
}

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

exports.backstory = onRequest(
  {
    secrets: [ANTHROPIC_API_KEY],
    region: 'us-central1',
    cors: true,
    memory: '256MiB',
    maxInstances: 5,
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
    if (rateLimited(ip)) { res.status(429).json({ error: 'Too many requests — wait a moment.' }); return; }

    const body = req.body || {};
    const task = clip(body.task, 300);
    const category = clip(body.category, 40);
    const primary = clip(body.primary, 40);
    const secondary = clip(body.secondary, 40);
    const palette = clip(body.palette, 80);
    if (!task) { res.status(400).json({ error: 'Missing task.' }); return; }

    const isEnv = /environment|concept|interior|habitat|vista|scene|room|world|planet|street|landscape/i
      .test(category + ' ' + task);
    const kind = isEnv ? 'place' : 'character';

    const system =
      `You are a concise, evocative creative-writing assistant for visual artists. ` +
      `Given an art brief, write a backstory of exactly 2 to 3 sentences for the ${kind} the artist is about to create. ` +
      `Weave the two inspiration words in naturally — evoke them, don't list them. ` +
      `Be vivid and specific: hint at mood, history, and personality so the writing sparks the artwork. ` +
      `Do not mention colors, palettes, the art task itself, or the words "backstory" or "inspiration". ` +
      `Output only the prose, no preamble.`;

    const user =
      `Art task: ${task}\n` +
      `Primary word: ${primary}\n` +
      `Secondary word: ${secondary}` +
      (palette ? `\nOverall mood: ${palette}` : '') +
      `\n\nWrite the ${kind}'s backstory (2 to 3 sentences).`;

    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 220,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const text = (msg.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      if (!text) { res.status(502).json({ error: 'No text returned.' }); return; }
      res.json({ backstory: text });
    } catch (e) {
      console.error('backstory error:', e && e.message);
      res.status(502).json({ error: 'Could not generate right now. Try again.' });
    }
  }
);
