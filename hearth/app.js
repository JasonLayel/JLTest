/* ==========================================================================
   Hearth — art advisor companion. Phase 1 (text only).

   Plain functions, no modules, no build step, no dependencies — same
   invariants as Ignite and Spark. All state is local; the only network call
   is /api/hearth, which holds the Anthropic key server-side.

   Sections: constants -> state -> api -> router -> beats 1..5 -> arc ->
             settings -> boot
   ========================================================================== */

/* ---------- constants ---------- */

var LS = 'hearth.v1';

/* Ignite's fire tiers, deliberately — one shared vocabulary across the apps. */
var EFFORTS = [
  { id: 1, name: 'Ember',   min: 12, sub: '5–15 min' },
  { id: 2, name: 'Kindle',  min: 25, sub: '15–30 min' },
  { id: 3, name: 'Blaze',   min: 45, sub: '30–60 min' },
  { id: 4, name: 'Inferno', min: 75, sub: '60+ min' }
];

var MEDIUMS = [
  { id: 'T', name: 'On paper', sub: 'traditional' },
  { id: 'D', name: 'Clip Studio', sub: 'digital' }
];

var LANES = [
  { id: 'start',    name: 'Start something',  sub: 'One piece, scoped to fit this sitting.' },
  { id: 'continue', name: 'Carry on',         sub: 'Pick up a piece still in flight.' },
  { id: 'drill',    name: 'Drill construction', sub: 'Arc-one practice. Short, no stakes.' },
  { id: 'hangout',  name: 'Just hang out',    sub: 'Doodle and talk. No goal, and that counts.' }
];

/* Greetings are local and free — opening the app costs nothing. */
var GREETS = [
  'There you are.', 'Hello you.', 'Look who it is.', 'Afternoon.',
  'Right then.', 'Hello, trouble.', 'Good. You came back.'
];

var QUICKS = ['How do I fix this?', 'Is this working?', "I'm lost", 'Talk to me', 'Shush'];

/* Local fallbacks so the app still runs with no backend deployed. */
var FALLBACK_STEPS = [
  { goal: 'Block in the big shape, one value, no detail.',
    doneWhen: 'You can tell what it is from across the room.',
    cue: 'Big shapes first. Detail is a reward you have not earned yet.',
    escape: 'If the shape fights you, draw the negative space around it instead.' },
  { goal: 'Find the gesture or the main line of the pose.',
    doneWhen: 'One line carries the whole movement.',
    cue: 'Draw the action, not the outline.',
    escape: 'Redraw it three times fast and keep the best one.' },
  { goal: 'Commit: pick the one thing that makes this piece worth finishing, and push it.',
    doneWhen: 'That one thing reads clearly. Everything else can stay rough.',
    cue: 'Finished does not mean correct. It means you would show it.',
    escape: 'If it is fighting you, stop here and call it done. That is a win, not a retreat.' }
];

/* ---------- state ---------- */

var state = null;
var meta = null;       /* arc + ledger from the server (compass-derived) */
var session = null;    /* the live session, null when not in one */
var backendOk = null;  /* null unknown, true, false */

function blank() {
  return {
    pieces: [],
    sessions: [],
    ledgerDelta: {},   /* skill id -> level, overrides the compass seed */
    prefs: { chattiness: 'normal', theme: 'system' }
  };
}

function load() {
  try {
    var raw = localStorage.getItem(LS);
    state = raw ? JSON.parse(raw) : blank();
  } catch (e) { state = blank(); }
  if (!state.pieces) state.pieces = [];
  if (!state.sessions) state.sessions = [];
  if (!state.ledgerDelta) state.ledgerDelta = {};
  if (!state.prefs) state.prefs = { chattiness: 'normal', theme: 'system' };
}

function save() {
  try { localStorage.setItem(LS, JSON.stringify(state)); }
  catch (e) { toast('Could not save — storage is full or blocked.'); }
}

function uid(p) { return (p || 'x') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function el(id) { return document.getElementById(id); }
function today() { return new Date().toISOString().slice(0, 10); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

var toastTimer = null;
function toast(msg) {
  var t = el('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('on'); }, 3200);
}

/* ---------- api ---------- */

function callApi(op, payload, timeoutMs) {
  var ctrl = new AbortController();
  var to = setTimeout(function () { ctrl.abort(); }, timeoutMs || 45000);
  var body = payload || {};
  body.op = op;
  return fetch('/api/hearth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: ctrl.signal
  }).then(function (r) {
    clearTimeout(to);
    if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) {
      throw new Error(j.error || ('HTTP ' + r.status));
    });
    backendOk = true;
    return r.json();
  }).catch(function (e) {
    clearTimeout(to);
    if (backendOk !== true) backendOk = false;
    throw e;
  });
}

/* Everything the companion needs about the moment, kept small on purpose. */
function sessionContext() {
  if (!session) return null;
  return {
    lane: session.lane,
    effort: session.effort,
    minutes: session.minutes,
    medium: session.medium,
    elapsedMin: Math.round((Date.now() - session.startedAt) / 60000),
    piece: session.piece ? { title: session.piece.title, brief: session.piece.brief, stage: session.piece.stage } : null,
    steps: session.steps,
    stepIndex: session.stepIndex,
    stepsDone: session.steps.filter(function (s) { return s.done; }).length
  };
}

function recentMessages(n) {
  return session.messages.filter(function (m) { return m.role !== 'sys'; }).slice(-(n || 12));
}

/* ---------- router ---------- */

var VIEWS = ['arrive', 'lane', 'scope', 'work', 'close', 'arc', 'settings'];
var current = 'arrive';

function show(v) {
  current = v;
  VIEWS.forEach(function (name) {
    var node = el('view-' + name);
    if (node) node.hidden = (name !== v);
  });
  window.scrollTo(0, 0);
  railUpdate();
}

function railUpdate() {
  var m = el('railmid');
  if (session && (current === 'work' || current === 'close')) {
    var e = EFFORTS.filter(function (x) { return x.id === session.effort; })[0];
    m.textContent = (session.piece ? session.piece.title : LANES.filter(function (l) { return l.id === session.lane; })[0].name)
      + ' · ' + (e ? e.name : '') ;
  } else if (backendOk === false) {
    m.textContent = 'companion offline';
  } else {
    m.textContent = '';
  }
}

/* ======================================================================
   Beat 1 — Arrive
   ====================================================================== */

var choice = { effort: 2, medium: 'T' };

function renderArrive() {
  var last = state.sessions[0];
  var pu = el('pickup');
  if (last && last.nextSentence) {
    pu.hidden = false;
    el('pickupText').textContent = last.nextSentence;
  } else {
    pu.hidden = true;
  }

  el('greet').textContent = pick(GREETS);
  el('greetSub').textContent = state.sessions.length
    ? 'What have you got today?'
    : 'First one. Nothing to prove today — just show me what you can do in the time you have.';

  chips('effortOpts', EFFORTS.map(function (e) {
    return { val: String(e.id), label: e.name, sub: e.sub };
  }), String(choice.effort), function (v) { choice.effort = Number(v); });

  chips('mediumOpts', MEDIUMS.map(function (m) {
    return { val: m.id, label: m.name, sub: m.sub };
  }), choice.medium, function (v) { choice.medium = v; });

  show('arrive');
}

function chips(hostId, items, selected, onPick) {
  var host = el(hostId);
  host.innerHTML = '';
  items.forEach(function (it) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.setAttribute('aria-pressed', String(it.val) === String(selected) ? 'true' : 'false');
    b.innerHTML = it.sub ? (it.label + '<small>' + it.sub + '</small>') : it.label;
    b.addEventListener('click', function () {
      host.querySelectorAll('.opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      onPick(it.val);
    });
    host.appendChild(b);
  });
}

/* ======================================================================
   Beat 2 — Lane
   ====================================================================== */

function renderLane() {
  var e = EFFORTS.filter(function (x) { return x.id === choice.effort; })[0];
  el('laneSub').textContent = e.name + ', about ' + e.min + ' minutes, '
    + (choice.medium === 'T' ? 'on paper' : 'in Clip Studio') + '.';

  var inflight = state.pieces.filter(function (p) { return p.status === 'in-flight'; });
  var host = el('lanes');
  host.innerHTML = '';

  LANES.forEach(function (l) {
    if (l.id === 'continue' && !inflight.length) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lane' + (l.id === (inflight.length ? 'continue' : 'start') ? ' rec' : '');
    b.innerHTML = '<b>' + l.name + '</b><span>' + l.sub + '</span>';
    b.addEventListener('click', function () { chooseLane(l.id); });
    host.appendChild(b);
  });

  var ih = el('inflight');
  ih.innerHTML = '';
  if (inflight.length) {
    var h = document.createElement('div');
    h.className = 'flabel';
    h.textContent = 'In flight';
    ih.appendChild(h);
    inflight.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'piece-row';
      b.innerHTML = '<span>' + escapeHtml(p.title) + '</span><em>' + p.stage + '</em>';
      b.addEventListener('click', function () { startSession('continue', p); });
      ih.appendChild(b);
    });
  }
  show('lane');
}

function chooseLane(id) {
  if (id === 'start') { el('scopeIdea').value = ''; el('scopeOut').hidden = true; el('scopeOut').innerHTML = ''; show('scope'); return; }
  if (id === 'continue') {
    var p = state.pieces.filter(function (x) { return x.status === 'in-flight'; })[0];
    startSession('continue', p);
    return;
  }
  startSession(id, null);
}

/* ======================================================================
   Beat 3 — Scope
   ====================================================================== */

function renderScopeResult(data, idea) {
  var out = el('scopeOut');
  out.hidden = false;
  var steps = data.steps || [];
  out.innerHTML =
    '<div class="scope-card">' +
      '<h3>' + escapeHtml(data.title || idea.slice(0, 60)) + '</h3>' +
      (data.reply ? '<p>' + escapeHtml(data.reply) + '</p>' : '') +
      (data.forecast ? '<p><em>' + escapeHtml(data.forecast) + '</em></p>' : '') +
      '<ul class="ladder">' + steps.map(function (s, i) {
        return '<li><b>' + (i + 1) + '. ' + escapeHtml(s.goal) + '</b><br>' +
          'Done when ' + escapeHtml(s.doneWhen) + '</li>';
      }).join('') + '</ul>' +
    '</div>';

  var go = document.createElement('button');
  go.className = 'btn big';
  go.type = 'button';
  go.textContent = 'Start drawing';
  go.addEventListener('click', function () {
    var piece = {
      id: uid('p'),
      title: data.title || idea.slice(0, 60),
      brief: idea,
      series: (meta && meta.arc && meta.arc.series) ? meta.arc.series.name : null,
      stage: 'block-in',
      status: 'in-flight',
      created: today()
    };
    state.pieces.unshift(piece);
    save();
    startSession('start', piece, steps, data.forecast);
  });
  out.appendChild(go);

  var again = document.createElement('button');
  again.className = 'btn ghost wide';
  again.type = 'button';
  again.textContent = 'Smaller, please';
  again.addEventListener('click', function () { doScope(idea, true); });
  out.appendChild(again);
}

function doScope(idea, smaller) {
  var btn = el('scopeGo');
  btn.disabled = true;
  btn.textContent = smaller ? 'Shrinking…' : 'Thinking…';

  var e = EFFORTS.filter(function (x) { return x.id === choice.effort; })[0];
  callApi('scope', {
    idea: idea,
    minutes: e.min,
    effort: e.name,
    medium: choice.medium,
    smaller: !!smaller,
    recent: state.sessions.slice(0, 3).map(function (s) { return s.distilled; }).filter(Boolean)
  }).then(function (data) {
    renderScopeResult(data, idea);
  }).catch(function () {
    renderScopeResult({
      title: idea.slice(0, 60),
      reply: 'The companion is offline, so here is the standing shape instead: one '
           + e.min + '-minute sitting, three steps, finish it today.',
      steps: FALLBACK_STEPS
    }, idea);
  }).then(function () {
    btn.disabled = false;
    btn.textContent = 'Scope it';
  });
}

/* ======================================================================
   Beat 4 — Work
   ====================================================================== */

function startSession(lane, piece, steps, forecast) {
  var e = EFFORTS.filter(function (x) { return x.id === choice.effort; })[0];
  session = {
    id: uid('s'),
    date: today(),
    lane: lane,
    piece: piece || null,
    effort: choice.effort,
    minutes: e.min,
    medium: choice.medium,
    steps: steps || [],
    stepIndex: 0,
    messages: [],
    startedAt: Date.now(),
    paused: false,
    pausedMs: 0,
    marks: {}
  };

  if (!session.steps.length && lane !== 'hangout') {
    session.steps = (lane === 'drill')
      ? [{ goal: 'Construction drill: build three heads from boxes and spheres before any line.',
           doneWhen: 'Three of them exist. Quality is not the point today.',
           cue: 'Boxes first. The likeness can wait; the structure cannot.',
           escape: 'If a head collapses, leave it and start the next one. Do not repair drills.' }]
      : FALLBACK_STEPS.slice(0, 1);
  }

  renderWork();
  show('work');
  startTimer();

  if (forecast) sys(forecast);
  openingLine();
}

function openingLine() {
  if (session.lane === 'hangout') {
    them('No plan, no step, no done-when. Draw whatever. I am just here.');
    return;
  }
  if (session.lane === 'continue' && session.piece) {
    them('Back to ' + session.piece.title + '. I will stay out of your way — say something if you want me.');
    return;
  }
  them('Timer is running. I will be quiet unless you want me. Go.');
}

function renderWork() {
  var s = session.steps[session.stepIndex];
  var card = el('stepCard');
  if (!s) {
    card.hidden = true;
  } else {
    card.hidden = false;
    el('stepK').textContent = 'Step ' + (session.stepIndex + 1) + ' of ' + session.steps.length;
    el('stepGoal').textContent = s.goal;
    el('stepDone').textContent = s.doneWhen || '—';
    el('stepCue').textContent = s.cue || '';
    el('stepEscape').textContent = s.escape || 'Stop, breathe, and do the simplest version of the step.';
    el('escapeWrap').hidden = !s.escape;
  }
  renderLog();
  renderQuick();
  railUpdate();
}

function renderQuick() {
  var host = el('quick');
  host.innerHTML = '';
  QUICKS.forEach(function (q) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = q;
    b.addEventListener('click', function () {
      if (q === 'Shush') { sys('Quiet mode. Say anything to bring me back.'); session.shush = true; return; }
      say(q);
    });
    host.appendChild(b);
  });
}

function renderLog() {
  var host = el('log');
  host.innerHTML = '';
  session.messages.forEach(function (m) {
    var d = document.createElement('div');
    d.className = 'msg ' + (m.role === 'assistant' ? 'them' : m.role === 'user' ? 'you' : 'sys');
    d.innerHTML = '<p>' + escapeHtml(m.content).replace(/\n/g, '<br>') + '</p>';
    host.appendChild(d);
  });
  host.scrollIntoView({ block: 'end' });
}

function them(text) { session.messages.push({ role: 'assistant', content: text }); renderLog(); }
function you(text)  { session.messages.push({ role: 'user', content: text }); renderLog(); }
function sys(text)  { session.messages.push({ role: 'sys', content: text }); renderLog(); }

function say(text) {
  if (!text.trim()) return;
  session.shush = false;
  you(text);
  var holder = { role: 'assistant', content: '…' };
  session.messages.push(holder);
  renderLog();

  callApi('talk', {
    message: text,
    session: sessionContext(),
    messages: recentMessages(12),
    chattiness: state.prefs.chattiness
  }).then(function (d) {
    holder.content = d.reply || '…';
    renderLog();
  }).catch(function () {
    var i = session.messages.indexOf(holder);
    if (i > -1) session.messages.splice(i, 1);
    sys('Companion offline. The step card and the timer still work.');
  });
}

function nextStep() {
  var s = session.steps[session.stepIndex];
  if (s) s.done = true;

  if (session.stepIndex + 1 < session.steps.length) {
    session.stepIndex++;
    renderWork();
    them('Good. Next: ' + session.steps[session.stepIndex].goal);
    return;
  }

  /* Out of ladder — ask for the next rung rather than inventing a plan. */
  sys('Step done.');
  callApi('talk', {
    message: '__STEP_DONE__',
    session: sessionContext(),
    messages: recentMessages(8),
    wantStep: true,
    chattiness: state.prefs.chattiness
  }).then(function (d) {
    if (d.reply) them(d.reply);
    if (d.step && d.step.goal) {
      session.steps.push(d.step);
      session.stepIndex = session.steps.length - 1;
      renderWork();
    } else {
      offerClose();
    }
  }).catch(function () { offerClose(); });
}

function offerClose() {
  them('That might be the natural end of it. Want to wrap up, or keep going?');
}

/* ---------- timer ---------- */

var tick = null;

function startTimer() {
  clearInterval(tick);
  tick = setInterval(tickTimer, 1000);
  tickTimer();
}

function elapsedMs() {
  return Date.now() - session.startedAt - session.pausedMs;
}

function tickTimer() {
  if (!session) return;
  var total = session.minutes * 60000;
  var left = total - elapsedMs();
  var over = left < 0;
  var abs = Math.abs(left);
  var mm = Math.floor(abs / 60000);
  var ss = Math.floor((abs % 60000) / 1000);
  el('tLeft').textContent = (over ? '+' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
  el('tSub').textContent = session.paused ? 'paused' : over ? 'over' : 'left';
  el('timer').classList.toggle('over', over);

  /* Time markers are local and free — no API call to say "halfway". */
  var frac = elapsedMs() / total;
  if (!session.paused && session.lane !== 'hangout') {
    if (frac >= 0.5 && !session.marks.half) { session.marks.half = 1; if (!session.shush) sys('Halfway.'); }
    if (left <= 600000 && left > 0 && !session.marks.ten && session.minutes > 20) {
      session.marks.ten = 1; if (!session.shush) sys('Ten minutes left. Start thinking about where to stop.');
    }
    if (over && !session.marks.over) {
      session.marks.over = 1;
      them('Time. Stop where you are — that is the deal. Wrap up when you are ready.');
    }
  }
}

function togglePause() {
  if (!session) return;
  if (session.paused) {
    session.pausedMs += Date.now() - session.pausedAt;
    session.paused = false;
  } else {
    session.pausedAt = Date.now();
    session.paused = true;
  }
  tickTimer();
}

/* ======================================================================
   Beat 5 — Close
   ====================================================================== */

var closeData = { finished: null };

function renderClose() {
  clearInterval(tick);
  closeData = { finished: null };
  var host = el('closing');
  host.innerHTML = '<div class="close-card"><h3>Working it out</h3><p>One moment…</p></div>';
  el('nextSentence').value = '';
  show('close');

  chips('doneOpts', [
    { val: 'finished', label: 'Yes — I would show it' },
    { val: 'parked',   label: 'Not yet, but it lives' },
    { val: 'nope',     label: 'No, and that is fine' }
  ], null, function (v) { closeData.finished = v; });

  callApi('close', {
    session: sessionContext(),
    messages: recentMessages(20)
  }).then(function (d) {
    host.innerHTML =
      (d.moved ? '<div class="close-card"><h3>What moved</h3><p>' + escapeHtml(d.moved) + '</p></div>' : '') +
      (d.win ? '<div class="close-card win"><h3>The thing I owe you</h3><p>' + escapeHtml(d.win) + '</p></div>' : '');
    if (d.nextSentence) el('nextSentence').value = d.nextSentence;
    closeData.ai = d;
  }).catch(function () {
    host.innerHTML = '<div class="close-card"><h3>Companion offline</h3><p>' +
      'Write the next sentence yourself — it is the bit that makes tomorrow start in ten seconds.</p></div>';
  });
}

function saveClose() {
  var ctx = sessionContext();
  var rec = {
    id: session.id,
    date: session.date,
    lane: session.lane,
    pieceId: session.piece ? session.piece.id : null,
    pieceTitle: session.piece ? session.piece.title : null,
    minutes: Math.round(elapsedMs() / 60000),
    planned: session.minutes,
    effort: session.effort,
    medium: session.medium,
    stepsDone: ctx.stepsDone,
    stepsTotal: session.steps.length,
    outcome: closeData.finished || 'parked',
    distilled: (closeData.ai && closeData.ai.moved) || '',
    win: (closeData.ai && closeData.ai.win) || '',
    nextSentence: el('nextSentence').value.trim(),
    closedAt: new Date().toISOString()
  };
  state.sessions.unshift(rec);
  if (state.sessions.length > 400) state.sessions.length = 400;

  if (session.piece) {
    var p = state.pieces.filter(function (x) { return x.id === session.piece.id; })[0];
    if (p) {
      if (closeData.finished === 'finished') { p.status = 'finished'; p.finishedAt = today(); }
      else if (closeData.finished === 'nope') { p.status = 'abandoned'; p.why = 'called it at close'; }
      p.stage = session.steps.length && session.steps[session.steps.length - 1].done ? 'advanced' : p.stage;
    }
  }

  save();
  session = null;
  toast(rec.outcome === 'finished' ? 'Finished. That is the whole point.' : 'Saved. See you next time.');
  renderArrive();
}

/* ======================================================================
   Arc & ledger
   ====================================================================== */

function renderArc() {
  var box = el('arcbox');
  if (!meta || !meta.arc) {
    box.innerHTML = '<p class="empty">Arc details live with the companion, which is offline right now.</p>';
  } else {
    var a = meta.arc;
    box.innerHTML = '<dl>' +
      '<dt>Focus</dt><dd>' + escapeHtml(a.focusSkillName || a.focusSkill) + '</dd>' +
      '<dt>Series</dt><dd>' + escapeHtml(a.series ? a.series.name : '—') +
        (a.series && a.series.constraint ? '<br><span class="empty">' + escapeHtml(a.series.constraint) + '</span>' : '') + '</dd>' +
      '<dt>Cadence</dt><dd>' + escapeHtml(a.cadence ? (a.cadence.daysPerWeek + ' days a week, ' + a.cadence.timeOfDay) : '—') + '</dd>' +
      '<dt>Done</dt><dd>' + escapeHtml(a.doneMeans || '—') + '</dd>' +
      '</dl>';
  }

  var done = state.pieces.filter(function (p) { return p.status === 'finished'; }).length;
  var started = state.pieces.length;
  var ph = el('piecesList');
  ph.innerHTML = '';
  if (!started) {
    ph.innerHTML = '<p class="empty">No pieces yet.</p>';
  } else {
    var head = document.createElement('p');
    head.className = 'empty';
    head.textContent = done + ' finished of ' + started + ' started'
      + (started >= 3 ? ' — finish rate ' + Math.round((done / started) * 100) + '%' : '');
    ph.appendChild(head);
    state.pieces.slice(0, 20).forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'piece-row';
      d.innerHTML = '<span>' + escapeHtml(p.title) + '</span><em>' + p.status + '</em>';
      ph.appendChild(d);
    });
  }

  var lh = el('ledgerList');
  lh.innerHTML = '';
  var skills = (meta && meta.ledger) || [];
  if (!skills.length) {
    lh.innerHTML = '<p class="empty">Ledger lives with the companion, which is offline right now.</p>';
  } else {
    skills.forEach(function (s) {
      var lvl = state.ledgerDelta[s.id] !== undefined ? state.ledgerDelta[s.id] : s.level;
      var row = document.createElement('div');
      row.className = 'lrow';
      row.innerHTML =
        '<span class="lname">' + escapeHtml(s.name) +
          (meta.arc && meta.arc.focusSkill === s.id ? '<em>focus</em>' : '') + '</span>' +
        '<span class="lbar"><i style="width:' + (lvl / 5 * 100) + '%"></i></span>' +
        '<span class="lnum">' + lvl + '</span>';
      lh.appendChild(row);
    });
  }
  show('arc');
}

/* ======================================================================
   Settings
   ====================================================================== */

function renderSettings() {
  chips('chatOpts', [
    { val: 'quiet',  label: 'Quiet',  sub: 'only when asked' },
    { val: 'normal', label: 'Normal', sub: 'the default' },
    { val: 'chatty', label: 'Chatty', sub: 'more company' }
  ], state.prefs.chattiness, function (v) { state.prefs.chattiness = v; save(); });

  chips('themeOpts', [
    { val: 'system', label: 'System' },
    { val: 'dark',   label: 'Dark' },
    { val: 'light',  label: 'Light' }
  ], state.prefs.theme, function (v) { state.prefs.theme = v; applyTheme(); save(); });

  el('backendNote').textContent = backendOk === false
    ? 'The companion endpoint is not answering. The session structure, timer and history all still work — see README for deploying /api/hearth.'
    : 'Your drawing data never leaves this device. Only the text of a session reaches the companion.';

  show('settings');
}

function applyTheme() {
  var t = state.prefs.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

function exportData() {
  var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hearth-' + today() + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function importData(file) {
  var fr = new FileReader();
  fr.onload = function () {
    try {
      var d = JSON.parse(fr.result);
      if (!d || typeof d !== 'object') throw new Error('bad');
      state = d;
      load();
      save();
      toast('Imported.');
      renderArrive();
    } catch (e) { toast('That file did not look like Hearth data.'); }
  };
  fr.readAsText(file);
}

/* ---------- util ---------- */

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ======================================================================
   Boot
   ====================================================================== */

function wire() {
  el('home').addEventListener('click', function () {
    if (session && current === 'work') { toast('Session running — wrap up first.'); return; }
    renderArrive();
  });
  el('openArc').addEventListener('click', renderArc);
  el('openSettings').addEventListener('click', renderSettings);

  document.querySelectorAll('[data-back]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.dataset.back;
      if (t === 'arrive') renderArrive();
      else if (t === 'lane') renderLane();
      else show(t);
    });
  });

  el('toLane').addEventListener('click', renderLane);
  el('scopeGo').addEventListener('click', function () {
    var idea = el('scopeIdea').value.trim();
    if (!idea) { toast('Tell me roughly what you want to make.'); return; }
    doScope(idea, false);
  });

  el('stepDoneBtn').addEventListener('click', nextStep);
  el('stuckBtn').addEventListener('click', function () { say("I'm stuck"); });
  el('tToggle').addEventListener('click', togglePause);
  el('toClose').addEventListener('click', renderClose);
  el('saveClose').addEventListener('click', saveClose);

  el('sayForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = el('sayInput').value;
    el('sayInput').value = '';
    say(v);
  });

  el('exportBtn').addEventListener('click', exportData);
  el('importBtn').addEventListener('click', function () { el('importFile').click(); });
  el('importFile').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  el('clearBtn').addEventListener('click', function () {
    if (el('clearBtn').dataset.armed) {
      localStorage.removeItem(LS);
      load(); save(); toast('Cleared.'); renderArrive();
    } else {
      el('clearBtn').dataset.armed = '1';
      el('clearBtn').textContent = 'Really clear everything?';
      setTimeout(function () {
        delete el('clearBtn').dataset.armed;
        el('clearBtn').textContent = 'Clear everything';
      }, 4000);
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (session && current === 'work') { e.preventDefault(); e.returnValue = ''; }
  });
}

function hello() {
  callApi('hello', {}, 12000).then(function (d) {
    meta = d;
  }).catch(function () { /* offline is a supported state */ })
    .then(railUpdate);
}

load();
applyTheme();
wire();
renderArrive();
hello();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}
