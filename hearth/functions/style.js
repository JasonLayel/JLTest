/**
 * Style filter.
 *
 * Borrowed from the companion-sim project, where the lesson was that a prompt
 * alone does not hold a voice. Hearth needs it more, because almost all of its
 * rules are negative ones: never nitpick, no critique mid-session, never agree
 * he is lazy. A model follows "do this" far better than "never do that", so we
 * check the output too and regenerate when it drifts.
 *
 * check() returns null when the text is fine, or a short string naming what
 * went wrong, which is fed back into the retry.
 */

/* Phrasing that makes it sound like software instead of a friend. */
const ASSISTANT = [
  /\bas an ai\b/i,
  /\bi'?m here to help\b/i,
  /\blet me know if you\b/i,
  /\bfeel free to\b/i,
  /\bi'?d be happy to\b/i,
  /\bi hope (?:this|that) helps\b/i,
  /\bgreat question\b/i,
  /\bis there anything else\b/i,
  /\bhere (?:are|is) (?:a few|some) (?:tips|suggestions|ideas|things)\b/i
];

/* Therapist voice. He asked for a friend, not a counsellor. */
const THERAPIST = [
  /\bit sounds like you(?:'re| are)\b/i,
  /\bi hear you\b/i,
  /\bthat must (?:be|feel)\b/i,
  /\bi understand (?:that|how) you\b/i,
  /\bwhat i'?m hearing\b/i,
  /\byour feelings are valid\b/i,
  /\bbe kind to yourself\b/i
];

/* The laziness and discipline framing. Standing rule: never endorse it. */
const SHAME = [
  /\b(?:you'?re|you are|being) (?:lazy|undisciplined)\b/i,
  /\bwillpower\b/i,
  /\bbe more consistent\b/i,
  /\bbuild (?:a|the) habit\b/i,
  /\bstay disciplined\b/i,
  /\bhold yourself accountable\b/i,
  /\byou should have\b/i,
  /\bif you(?:'d| had) just\b/i
];

/* Prescribing a redraw. Explicitly forbidden unless he asks. */
const REDRAW = [
  /\bstart (?:it )?over\b/i,
  /\bredraw (?:it|this|the)\b/i,
  /\bfrom scratch\b/i,
  /\bscrap (?:it|this|that)\b/i,
  /\bwipe it and\b/i
];

/* Unasked critique. Only rejected while he is actually drawing. */
const CRITIQUE = [
  /\byou (?:might|may|could) want to\b/i,
  /\bone thing (?:i'?d|to) (?:suggest|note|fix|change)\b/i,
  /\bneeds? (?:some )?work\b/i,
  /\b(?:the )?(?:proportions?|anatomy|perspective|values?|edges?|composition) (?:is|are|look|looks|seem|seems) (?:a bit |slightly |quite )?(?:off|wrong|flat|muddy)\b/i,
  /\bi'?d (?:suggest|recommend|advise)\b/i,
  /\btry (?:to )?(?:fix|correct|adjust)\b/i
];

/* Money talk. Forbidden mid-session. */
const MONEY = [
  /\bcommission(?:s|ed)?\b/i,
  /\bportfolio\b/i,
  /\bclients?\b/i,
  /\bmonetiz/i,
  /\bfollowers?\b/i,
  /\baudience\b/i,
  /\bsell(?:ing)?\b/i,
  /\bprints?\b/i
];

/* Returns the offending phrase as it actually appeared, not the pattern, so
   the retry instruction reads as something a model can act on. */
function hits(list, text) {
  for (const re of list) {
    const m = text.match(re);
    if (m) return '"' + String(m[0]).trim().slice(0, 60) + '"';
  }
  return null;
}

/**
 * @param {string} text        the model's reply
 * @param {object} opts
 *   mode      'session' while he is drawing, 'talk' between sessions
 *   allowFix  true when he explicitly asked how to fix something
 *   maxChars  length ceiling
 * @returns {string|null} reason to regenerate, or null if the text passes
 */
function check(text, opts) {
  const o = opts || {};
  const t = String(text || '').trim();
  if (!t) return 'empty reply';

  const max = o.maxChars || (o.mode === 'session' ? 460 : 700);
  if (t.length > max) return 'too long, he is busy. Two or three sentences.';

  if (/^\s*(?:[-*•]|\d+[.)])\s/m.test(t)) return 'no lists, just talk to him';
  if (/^#{1,6}\s/m.test(t)) return 'no headings';
  if (/\*\*/.test(t)) return 'no markdown formatting';
  if (/—/.test(t)) return 'no em dashes, plain punctuation';

  let r;
  if ((r = hits(ASSISTANT, t))) return 'sounds like an assistant: ' + r;
  if ((r = hits(THERAPIST, t))) return 'sounds like a therapist: ' + r;
  if ((r = hits(SHAME, t))) return 'discipline or shame framing: ' + r;
  if (!o.allowFix && (r = hits(REDRAW, t))) return 'suggested starting over, which is forbidden: ' + r;

  if (o.mode === 'session') {
    if (!o.allowFix && (r = hits(CRITIQUE, t))) return 'unasked critique while he is drawing: ' + r;
    if ((r = hits(MONEY, t))) return 'money or goals talk mid-session: ' + r;
  }
  return null;
}

/** Did he ask for a fix or a critique? Then the critique rules relax. */
function askedForFix(message) {
  return /\b(?:how (?:do|can) i|what'?s wrong|what is wrong|fix|critique|criticis|criticiz|analy[sz]e|feedback|is (?:this|it) (?:working|right|ok))\b/i
    .test(String(message || ''));
}

/**
 * Generate, check, regenerate. Up to `tries` attempts, then give up and
 * return the last attempt rather than failing the request.
 */
async function generateClean(runOnce, opts, tries) {
  const n = tries || 3;
  let last = '';
  let note = null;
  for (let i = 0; i < n; i++) {
    last = await runOnce(note);
    note = check(last, opts);
    if (!note) return { text: last, attempts: i + 1, rejected: null };
    console.warn('style reject (attempt ' + (i + 1) + '):', note);
  }
  return { text: last, attempts: n, rejected: note };
}

module.exports = { check, askedForFix, generateClean };
