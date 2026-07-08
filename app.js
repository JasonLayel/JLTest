/* Random Task Picker — a to-do list with randomization.
 * All data lives in localStorage; no server required.
 * companion.js (COMPANION global) provides the princess sprite + dialogue.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "randomTaskPicker.v1";
  const GOAL_TASKS = 3; // daily goal: 3 tasks across 3 categories
  const OVER_TASKS = 6; // second-tier "Overachiever": double the goal in one day
  const OVER_BONUS = 100;
  const OVERTIME_MULT = 1.5; // tasks beyond a met goal earn royal-favor points
  const STREAK_MILESTONES = [3, 5, 7, 14, 21, 30, 50, 100];

  // Umbrella categories; each task additionally carries a mode: "active" | "reset".
  const DEFAULT_CATEGORIES = [
    { id: "mind", name: "Mind", color: "#5b5bd6" },
    { id: "body", name: "Body", color: "#d68a2e" },
    { id: "space", name: "Environment", color: "#2e9e5b" },
    { id: "play", name: "Play", color: "#d65b9a" },
    { id: "purpose", name: "Purpose", color: "#2e8ad6" },
  ];

  // v1 categories → [new umbrella, default mode] (Contemplation was Mind's reset side).
  const V1_MIGRATION = {
    mental: ["mind", "active"],
    contemplation: ["mind", "reset"],
    bodily: ["body", "active"],
    environmental: ["space", "active"],
    recreation: ["play", "active"],
    pursuits: ["purpose", "active"],
  };

  const DEFAULT_STATE = {
    version: 3,
    categories: DEFAULT_CATEGORIES,
    tasks: [], // {id, title, categoryId, mode, estimateMin, recurring, done, createdAt, completedAt}
    history: [], // picks: {id, taskId, title, categoryId, at, source, status}
    settings: {
      scheduleEnabled: false,
      scheduleTimes: ["10:00", "13:00", "15:00"],
      firedToday: {}, // { "10:00": "2026-07-07" } last date each slot fired
      timeFilter: 0, // max minutes for picks; 0 = any
      energyFilter: "", // "" = any, "active" | "reset"
      theme: "light", // "light" | "dark" | "auto"
      soundEnabled: true, // princess voice blips
      rules: {
        distinctCategories: true,
        distinctWindow: 3,
        excludedCategoryIds: [],
      },
    },
    stats: {
      totalPoints: 0,
      bestStreak: 0,
      dailyLog: {}, // { "2026-07-07": [{taskId, categoryId, points}] }
      goalAwarded: {}, // { "2026-07-07": true } goal bonus already granted
      overAwarded: {}, // { "2026-07-07": true } overachiever bonus already granted
    },
    companion: {
      name: "Princess Elara",
      affection: 0,
      tier: 0,
      recentLines: [],
      lastOpenDate: null,
    },
    currentPick: null, // history entry id of the active pick
  };

  // ---------- State ----------

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      // Merge over defaults so new fields added in future versions get sane values.
      const merged = structuredClone(DEFAULT_STATE);
      Object.assign(merged, parsed);
      // The default version must not mask old data: absent means v1.
      merged.version = parsed.version || 1;
      for (const key of ["settings", "stats", "companion"]) {
        merged[key] = Object.assign(structuredClone(DEFAULT_STATE[key]), parsed[key] || {});
      }
      merged.settings.rules = Object.assign(
        structuredClone(DEFAULT_STATE.settings.rules),
        (parsed.settings && parsed.settings.rules) || {}
      );
      return migrate(merged);
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  // v1 → v2: six flat categories become five umbrellas + per-task active/reset mode.
  function migrate(s) {
    if ((s.version || 1) < 2) {
      s.categories = structuredClone(DEFAULT_CATEGORIES);
      for (const t of s.tasks || []) {
        const m = V1_MIGRATION[t.categoryId];
        if (m) {
          t.categoryId = m[0];
          if (!t.mode) t.mode = m[1];
        }
        if (!t.mode) t.mode = "active";
      }
      for (const h of s.history || []) {
        const m = V1_MIGRATION[h.categoryId];
        if (m) h.categoryId = m[0];
      }
      const ex = s.settings?.rules?.excludedCategoryIds;
      if (ex) {
        s.settings.rules.excludedCategoryIds = [
          ...new Set(ex.map((id) => V1_MIGRATION[id]?.[0] || id)),
        ];
      }
      for (const day of Object.values(s.stats?.dailyLog || {})) {
        for (const e of day) {
          const m = V1_MIGRATION[e.categoryId];
          if (m) e.categoryId = m[0];
        }
      }
      s.version = 2;
    }
    // v2 → v3: "Space" reads better as "Environment" (skip if user renamed it).
    if (s.version < 3) {
      const space = (s.categories || []).find((c) => c.id === "space");
      if (space && space.name === "Space") space.name = "Environment";
      s.version = 3;
    }
    return s;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const catById = (id) => state.categories.find((c) => c.id === id);
  const estimateOf = (t) => t.estimateMin || 15;
  const modeOf = (t) => t.mode || "active";
  const modeIcon = (m) => (m === "reset" ? "🌊" : "⚡");

  // Local (not UTC) YYYY-MM-DD, so "today" matches the user's clock.
  function localDate(d = new Date()) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }
  const todayStr = () => localDate();

  function shiftDate(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d + days);
    return localDate(dt);
  }

  function daysBetween(a, b) {
    const [ay, am, ad] = a.split("-").map(Number);
    const [by, bm, bd] = b.split("-").map(Number);
    return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
  }

  // ---------- Points / goal / streak ----------

  function todaysLog() {
    return state.stats.dailyLog[todayStr()] || [];
  }

  function goalMetOn(dateStr) {
    const log = state.stats.dailyLog[dateStr] || [];
    return log.length >= GOAL_TASKS && new Set(log.map((e) => e.categoryId)).size >= GOAL_TASKS;
  }

  function currentStreak() {
    let d = todayStr();
    if (!goalMetOn(d)) d = shiftDate(d, -1); // today isn't over yet; don't break the streak
    let n = 0;
    while (goalMetOn(d)) {
      n++;
      d = shiftDate(d, -1);
    }
    return n;
  }

  function pointsFor(task) {
    return 10 + estimateOf(task); // harder tasks are worth more
  }

  function recordCompletion(task) {
    const today = todayStr();
    const goalBefore = goalMetOn(today);
    // Royal favor: once the goal is met, every extra task pays 1.5×.
    const pts = goalBefore ? Math.round(pointsFor(task) * OVERTIME_MULT) : pointsFor(task);
    if (!state.stats.dailyLog[today]) state.stats.dailyLog[today] = [];
    state.stats.dailyLog[today].push({
      taskId: task.id,
      title: task.title, // kept so Chronicles survives task deletion
      categoryId: task.categoryId,
      points: pts,
    });
    state.stats.totalPoints += pts;
    addAffection(2);

    let reacted = false;
    if (!goalBefore && goalMetOn(today)) {
      const streak = currentStreak();
      state.stats.bestStreak = Math.max(state.stats.bestStreak, streak);
      if (!state.stats.goalAwarded[today]) {
        state.stats.goalAwarded[today] = true;
        state.stats.totalPoints += 50;
        addAffection(8);
      }
      confetti();
      if (STREAK_MILESTONES.includes(streak)) {
        addAffection(streak); // milestone bonus scales with the streak
        speak("streak", { n: String(streak) });
      } else {
        speak("goal");
      }
      reacted = true;
    }
    // Second tier: double the goal in one day.
    if (!reacted && todaysLog().length >= OVER_TASKS && !state.stats.overAwarded[today]) {
      state.stats.overAwarded[today] = true;
      state.stats.totalPoints += OVER_BONUS;
      addAffection(12);
      confetti();
      speak("overachieve", null, true);
      reacted = true;
    }
    if (!reacted) {
      speak("complete");
      if (goalBefore) toast(`✨ Royal favor: +${pts} pts (1.5× beyond the quest)`);
    }
    save();
  }

  // Un-checking a task completed today takes its entry (and points) back.
  function revokeCompletion(taskId) {
    const today = todayStr();
    const log = state.stats.dailyLog[today];
    if (!log) return;
    const i = log.findIndex((e) => e.taskId === taskId);
    if (i === -1) return;
    state.stats.totalPoints = Math.max(0, state.stats.totalPoints - log[i].points);
    log.splice(i, 1);
    if (log.length === 0) delete state.stats.dailyLog[today];
    addAffection(-2);
  }

  // ---------- Theme ----------

  function applyTheme() {
    const pref = state.settings.theme;
    const dark =
      pref === "dark" ||
      (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  function renderThemePicker() {
    const row = $("#theme-picker");
    row.innerHTML = "";
    for (const [value, label] of [["light", "☀️ Light"], ["dark", "🌙 Dark"], ["auto", "🖥️ System"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (state.settings.theme === value ? " active" : "");
      if (state.settings.theme === value) b.style.background = "var(--primary)";
      b.textContent = label;
      b.addEventListener("click", () => {
        state.settings.theme = value;
        save();
        applyTheme();
        renderThemePicker();
      });
      row.appendChild(b);
    }
    $("#sound-enabled").checked = state.settings.soundEnabled;
  }

  // ---------- Princess voice (Animal Crossing-style "mimimimi") ----------

  let audioCtx = null;
  function sfxSpeak(textLength) {
    if (!state.settings.soundEnabled) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const syllables = Math.max(3, Math.min(9, Math.round(textLength / 12)));
      const t0 = audioCtx.currentTime;
      let base = 640 + Math.random() * 120; // her register: high and a bit haughty
      for (let i = 0; i < syllables; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        base += (Math.random() - 0.45) * 90; // wandering pitch, "mi-mi-mi"
        const f = Math.max(480, Math.min(980, base));
        const start = t0 + i * 0.085;
        osc.frequency.setValueAtTime(f, start);
        osc.frequency.exponentialRampToValueAtTime(f * 1.18, start + 0.05);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.09, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.07);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.08);
      }
    } catch {
      /* audio unavailable or blocked before first gesture — she speaks silently */
    }
  }

  function getAudio() {
    if (!state.settings.soundEnabled) return null;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch {
      return null;
    }
  }

  // Royal Decree fanfare: "doot doo DOOO" 🎺
  function sfxTrumpet() {
    const ctx = getAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // [freq, start, duration] — G4, G4, C5 like a herald's call.
    const notes = [
      [392, 0, 0.16],
      [392, 0.2, 0.16],
      [523.25, 0.42, 0.55],
    ];
    for (const [f, at, dur] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth"; // brassy
      osc.frequency.setValueAtTime(f, t0 + at);
      gain.gain.setValueAtTime(0, t0 + at);
      gain.gain.linearRampToValueAtTime(0.12, t0 + at + 0.02);
      gain.gain.setValueAtTime(0.12, t0 + at + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + at + dur);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2200; // soften the saw into something trumpet-ish
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + dur + 0.05);
    }
  }

  // Soft "pop" blip for button taps; a brighter sparkle for checking tasks off.
  function sfxClick(kind) {
    const ctx = getAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    if (kind === "check") {
      osc.frequency.setValueAtTime(660, t0);
      osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.09); // upward "ding!"
    } else {
      const f = 500 + Math.random() * 80;
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + 0.06);
    }
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(kind === "check" ? 0.08 : 0.05, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + (kind === "check" ? 0.12 : 0.07));
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  }

  // One delegated listener covers every button/chip/checkbox, present or future.
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = e.target;
      if (el.closest?.("button, .chip")) sfxClick();
    },
    { capture: true, passive: true }
  );
  document.addEventListener(
    "change",
    (e) => {
      if (e.target.matches?.('input[type="checkbox"]')) {
        sfxClick(e.target.checked ? "check" : "click");
      }
    },
    true
  );

  // ---------- Companion ----------

  function addAffection(delta) {
    const c = state.companion;
    c.affection = Math.max(0, c.affection + delta);
    const newTier = COMPANION.tierOf(c.affection);
    if (newTier > c.tier) {
      c.tier = newTier;
      speak("levelup", null, true);
    } else if (newTier < c.tier) {
      c.tier = newTier; // she cools off quietly
    }
  }

  // Show a companion line: in the big bubble if the Princess tab is open,
  // otherwise from the floating mini-princess in the corner.
  let bubbleTimer = null;
  let miniBubbleTimer = null;
  function speak(kind, vars, force) {
    const c = state.companion;
    // Scene/pose context lets her comment on where she is / what she's doing.
    const ctx = { sceneId: COMPANION.sceneForDate(todayStr()).id, poseId: currentPose.id };
    const text = COMPANION.line(kind, c.tier, c.recentLines, vars, ctx);
    if (!text) return;
    save();
    sfxSpeak(text.length);
    const excited = kind === "goal" || kind === "streak";
    const onPrincessTab = !$("#tab-princess").classList.contains("hidden");
    if (onPrincessTab) {
      const bubble = $("#speech-bubble");
      bubble.textContent = text;
      bubble.classList.remove("hidden");
      renderPrincess(excited ? "proud" : null);
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => renderPrincess(), 6000);
    } else {
      const bubble = $("#mini-bubble");
      bubble.textContent = text;
      bubble.classList.remove("hidden");
      renderMiniPrincess(excited ? "proud" : null);
      clearTimeout(miniBubbleTimer);
      miniBubbleTimer = setTimeout(() => {
        bubble.classList.add("hidden");
        renderMiniPrincess();
      }, 8000);
    }
  }

  // She prods on her own occasionally (not often) while the app is open.
  const PROD_INTERVAL = 300000; // check every 5 min
  setInterval(() => {
    if (document.hidden) return;
    if (!$("#mini-bubble").classList.contains("hidden")) return;
    if (Math.random() < 0.35) speak("tap");
  }, PROD_INTERVAL);

  // Her idle pose changes now and then (per render batch + this timer).
  let currentPose = COMPANION.randomPose();
  setInterval(() => {
    if (document.hidden) return;
    currentPose = COMPANION.randomPose();
    renderPrincess();
    renderMiniPrincess();
  }, 210000);

  let toastTimer = null;
  function toast(text, force) {
    const el = $("#toast");
    if (!el.classList.contains("hidden") && !force && el.dataset.force === "1") return;
    el.textContent = text;
    el.dataset.force = force ? "1" : "";
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 5000);
  }

  function confetti() {
    const colors = ["#5b5bd6", "#9a5bd6", "#d65b9a", "#d68a2e", "#2e9e5b", "#2e8ad6", "#f6c945"];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement("div");
      p.className = "confetti";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 1.6 + Math.random() * 1.6 + "s";
      p.style.animationDelay = Math.random() * 0.4 + "s";
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  }

  function floatHearts(count) {
    const wrap = $("#princess-hearts");
    for (let i = 0; i < count; i++) {
      const h = document.createElement("span");
      h.className = "float-heart";
      h.textContent = ["💗", "💖", "✨"][i % 3];
      h.style.left = 20 + Math.random() * 60 + "%";
      h.style.animationDelay = Math.random() * 0.8 + "s";
      wrap.appendChild(h);
      setTimeout(() => h.remove(), 3400);
    }
  }

  // ---------- Day rollover (recurring tasks, affection decay, welcome-back) ----------

  // Returns true when a new day was processed so callers can re-render.
  function dayRollover() {
    const today = todayStr();
    const last = state.companion.lastOpenDate;
    if (last === today) return false;

    // Recurring tasks completed on a previous day come back.
    for (const t of state.tasks) {
      if (t.recurring && t.done && t.completedAt && localDate(new Date(t.completedAt)) < today) {
        t.done = false;
        t.completedAt = null;
      }
    }

    if (last) {
      const gap = daysBetween(last, today);
      // Affection decays for each full day with no completions at all.
      let missed = 0;
      for (let i = 1; i < gap; i++) {
        const d = shiftDate(last, i);
        if (!(state.stats.dailyLog[d] || []).length) missed++;
      }
      if (missed > 0) {
        const c = state.companion;
        c.affection = Math.max(0, c.affection - missed * 4);
        c.tier = COMPANION.tierOf(c.affection);
      }
      if (gap >= 2) setTimeout(() => speak("back", null, true), 800);
    }

    state.companion.lastOpenDate = today;
    save();
    return true;
  }

  // ---------- Picking logic ----------

  function eligibleTasks() {
    const { rules, timeFilter, energyFilter } = state.settings;
    let pool = state.tasks.filter(
      (t) =>
        !t.done &&
        !rules.excludedCategoryIds.includes(t.categoryId) &&
        (!timeFilter || estimateOf(t) <= timeFilter) &&
        (!energyFilter || modeOf(t) === energyFilter)
    );

    if (rules.distinctCategories) {
      // The last (window - 1) picks block their categories, so a run of
      // `window` consecutive picks always spans different categories.
      const recent = state.history
        .filter((h) => h.status !== "dismissed")
        .slice(0, Math.max(0, rules.distinctWindow - 1));
      const blocked = new Set(recent.map((h) => h.categoryId));
      const filtered = pool.filter((t) => !blocked.has(t.categoryId));
      // Only apply the rule if it leaves something to pick from; otherwise
      // fall back to the unrestricted pool rather than picking nothing.
      if (filtered.length > 0) pool = filtered;
    }
    return pool;
  }

  function pickRandom(source) {
    const pool = eligibleTasks();
    if (pool.length === 0) return null;
    const task = pool[Math.floor(Math.random() * pool.length)];
    const entry = {
      id: uid(),
      taskId: task.id,
      title: task.title,
      categoryId: task.categoryId,
      at: new Date().toISOString(),
      source,
      status: "picked",
    };
    state.history.unshift(entry);
    if (state.history.length > 200) state.history.length = 200;
    state.currentPick = entry.id;
    save();
    return entry;
  }

  function currentPickEntry() {
    return state.history.find((h) => h.id === state.currentPick) || null;
  }

  // ---------- Scheduled picks ----------

  function checkSchedule() {
    // If midnight passed while the app was open, recurring tasks just came
    // back and goal/streak reset — refresh the UI so the list shows it.
    if (dayRollover()) renderAll();
    const s = state.settings;
    if (!s.scheduleEnabled) return;
    const now = new Date();
    const hhmm =
      String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    const today = todayStr();
    for (const t of s.scheduleTimes) {
      if (t === hhmm && s.firedToday[t] !== today) {
        s.firedToday[t] = today;
        const entry = pickRandom("scheduled");
        save();
        if (entry) {
          sfxTrumpet();
          notify("📯 A Royal Decree!", `${entry.title} — ${catById(entry.categoryId)?.name ?? ""}`);
          renderAll();
        }
        break; // at most one auto-pick per check
      }
    }
  }

  function notify(title, body) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "icon.svg" });
      } catch {
        // Some mobile browsers require notifications via the service worker.
        navigator.serviceWorker?.ready.then((reg) =>
          reg.showNotification(title, { body, icon: "icon.svg" })
        );
      }
    }
  }

  // ---------- Rendering ----------

  const $ = (sel) => document.querySelector(sel);

  let activeFilter = "all";
  let editingTaskId = null;

  function renderAll() {
    renderPickBanner();
    renderGoalBar();
    renderCategoryOptions();
    renderFilters();
    renderTimeFilter();
    renderEnergyFilter();
    renderTasks();
    renderSchedule();
    renderRules();
    renderCategoryManager();
    renderChronicles();
    renderHistory();
    renderThemePicker();
    renderPrincess();
    renderMiniPrincess();
  }

  function renderPickBanner() {
    const banner = $("#pick-banner");
    const entry = currentPickEntry();
    if (!entry || entry.status !== "picked") {
      banner.classList.add("hidden");
      return;
    }
    banner.classList.remove("hidden");
    $("#pick-banner-label").textContent =
      entry.source === "scheduled" ? "📯 Royal Decree" : "Your task right now";
    $("#pick-banner-task").textContent = entry.title;
    const task = state.tasks.find((t) => t.id === entry.taskId);
    const est = task ? ` · ⏱ ${estimateOf(task)} min` : "";
    $("#pick-banner-category").textContent = (catById(entry.categoryId)?.name ?? "") + est;
  }

  function renderGoalBar() {
    const log = todaysLog();
    const distinctCats = [...new Set(log.map((e) => e.categoryId))];
    const cats = distinctCats.slice(0, GOAL_TASKS);
    const met = goalMetOn(todayStr());
    const slots = document.querySelectorAll(".goal-slot");
    slots.forEach((slot, i) => {
      const cat = cats[i] ? catById(cats[i]) : null;
      slot.classList.toggle("filled", !!cat);
      slot.style.background = cat ? cat.color : "";
      slot.title = cat ? `Category done: ${cat.name}` : "Complete a task in a new category";
    });

    // Extra tasks beyond the goal show up as gems.
    const extras = $("#goal-extras");
    extras.innerHTML = "";
    const extraCount = Math.max(0, log.length - GOAL_TASKS);
    for (let i = 0; i < Math.min(extraCount, 6); i++) {
      const g = document.createElement("span");
      g.className = "goal-gem";
      g.textContent = "💎";
      extras.appendChild(g);
    }
    if (extraCount > 6) {
      const more = document.createElement("span");
      more.className = "goal-gem-more";
      more.textContent = "+" + (extraCount - 6);
      extras.appendChild(more);
    }

    // Caption explains exactly what the circles want from you right now.
    const caption = $("#goal-caption");
    if (log.length >= OVER_TASKS) {
      caption.textContent = "⚜️ OVERACHIEVER! The bards will sing of this day";
    } else if (met) {
      caption.textContent = `👑 Quest complete! Extras earn 1.5× pts — ${OVER_TASKS - log.length} more to Overachiever (+${OVER_BONUS})`;
    } else {
      caption.textContent = `Today's quest: ${log.length}/${GOAL_TASKS} tasks · ${Math.min(distinctCats.length, GOAL_TASKS)}/${GOAL_TASKS} categories`;
    }

    $("#goal-bar").classList.toggle("goal-met", met);
    $("#goal-bar").classList.toggle("goal-over", log.length >= OVER_TASKS);
    $("#points-label").textContent = "⭐ " + state.stats.totalPoints;
    $("#streak-label").textContent = "🔥 " + currentStreak();
  }

  function renderCategoryOptions() {
    const sel = $("#category-select");
    sel.innerHTML = "";
    for (const c of state.categories) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    }
  }

  function renderFilters() {
    const row = $("#category-filters");
    row.innerHTML = "";
    const mk = (id, label, color) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (activeFilter === id ? " active" : "");
      b.textContent = label;
      if (activeFilter === id) b.style.background = color || "var(--primary)";
      b.addEventListener("click", () => {
        activeFilter = id;
        renderFilters();
        renderTasks();
      });
      row.appendChild(b);
    };
    mk("all", "All");
    for (const c of state.categories) mk(c.id, c.name, c.color);
  }

  function renderTimeFilter() {
    const row = $("#time-filter");
    row.innerHTML = "";
    const options = [
      [0, "Any time"],
      [15, "≤ 15 min"],
      [30, "≤ 30 min"],
      [45, "≤ 45 min"],
    ];
    for (const [mins, label] of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (state.settings.timeFilter === mins ? " active" : "");
      if (state.settings.timeFilter === mins) b.style.background = "var(--primary)";
      b.textContent = label;
      b.addEventListener("click", () => {
        state.settings.timeFilter = mins;
        save();
        renderTimeFilter();
      });
      row.appendChild(b);
    }
  }

  // Energy filter: pick only ⚡ active or 🌊 reset tasks.
  function renderEnergyFilter() {
    const row = $("#energy-filter");
    row.innerHTML = "";
    const options = [
      ["", "Any energy"],
      ["active", "⚡ Active"],
      ["reset", "🌊 Reset"],
    ];
    for (const [mode, label] of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (state.settings.energyFilter === mode ? " active" : "");
      if (state.settings.energyFilter === mode) b.style.background = "var(--primary)";
      b.textContent = label;
      b.addEventListener("click", () => {
        state.settings.energyFilter = mode;
        save();
        renderEnergyFilter();
      });
      row.appendChild(b);
    }
  }

  function renderTasks() {
    const list = $("#task-list");
    list.innerHTML = "";
    const tasks = state.tasks.filter(
      (t) => activeFilter === "all" || t.categoryId === activeFilter
    );
    // Open tasks first, newest first within each group.
    tasks.sort((a, b) => a.done - b.done || b.createdAt.localeCompare(a.createdAt));

    $("#empty-tasks").classList.toggle("hidden", tasks.length > 0);

    for (const t of tasks) {
      if (t.id === editingTaskId) {
        list.appendChild(buildTaskEditor(t));
        continue;
      }
      const cat = catById(t.categoryId);
      const item = document.createElement("div");
      item.className = "task-item" + (t.done ? " done" : "");

      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "task-check";
      check.checked = t.done;
      check.setAttribute("aria-label", "Mark done");
      check.addEventListener("change", () => toggleDone(t.id));

      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = t.title;

      const meta = document.createElement("span");
      meta.className = "task-meta";

      const est = document.createElement("span");
      est.className = "task-est";
      est.textContent =
        (t.recurring ? "🔁 " : "") + modeIcon(modeOf(t)) + " ⏱" + estimateOf(t) + "m";

      const badge = document.createElement("span");
      badge.className = "task-cat-badge";
      badge.textContent = cat?.name ?? "?";
      badge.style.background = cat?.color ?? "#888";

      meta.append(est, badge);

      const edit = document.createElement("button");
      edit.className = "task-edit";
      edit.textContent = "✏️";
      edit.setAttribute("aria-label", "Edit task");
      edit.addEventListener("click", () => {
        editingTaskId = t.id;
        renderTasks();
      });

      const del = document.createElement("button");
      del.className = "task-delete";
      del.textContent = "🗑";
      del.setAttribute("aria-label", "Delete task");
      del.addEventListener("click", () => deleteTask(t.id));

      item.append(check, title, meta, edit, del);
      list.appendChild(item);
    }
  }

  // Inline editor for an existing task: title, category, effort, every-day.
  function buildTaskEditor(t) {
    const box = document.createElement("form");
    box.className = "task-item task-editor";

    const title = document.createElement("input");
    title.type = "text";
    title.className = "edit-title";
    title.value = t.title;
    title.maxLength = 200;
    title.required = true;
    title.setAttribute("aria-label", "Task title");

    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "Category");
    for (const c of state.categories) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      opt.selected = c.id === t.categoryId;
      sel.appendChild(opt);
    }

    const estField = document.createElement("div");
    estField.className = "estimate-field";
    const estCaption = document.createElement("label");
    estCaption.className = "estimate-caption";
    const estLabel = document.createElement("strong");
    estCaption.append("Effort: ", estLabel);
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "5";
    slider.max = "60";
    slider.step = "5";
    slider.value = String(estimateOf(t));
    slider.setAttribute("aria-label", "Time estimate in minutes");
    const updateEstLabel = () =>
      (estLabel.textContent = `${estimateWord(Number(slider.value))} · ${slider.value} min`);
    slider.addEventListener("input", updateEstLabel);
    updateEstLabel();
    const scale = document.createElement("div");
    scale.className = "estimate-scale";
    scale.innerHTML = "<span>Easy · 5m</span><span>Hard · 1h</span>";
    estField.append(estCaption, slider, scale);

    let editMode = modeOf(t);
    const modeWrap = document.createElement("div");
    modeWrap.className = "mode-toggle";
    for (const [mode, label] of [["active", "⚡ Active"], ["reset", "🌊 Reset"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = label;
      const paint = () => {
        const on = editMode === mode;
        b.classList.toggle("active", on);
        b.style.background = on ? "var(--primary)" : "";
      };
      paint();
      b.addEventListener("click", () => {
        editMode = mode;
        modeWrap.querySelectorAll(".chip").forEach((x) => {
          x.classList.remove("active");
          x.style.background = "";
        });
        paint();
      });
      modeWrap.appendChild(b);
    }

    const daily = document.createElement("label");
    daily.className = "daily-toggle";
    const dailyCb = document.createElement("input");
    dailyCb.type = "checkbox";
    dailyCb.checked = !!t.recurring;
    daily.append(dailyCb, " 🔁 Every day");

    const actions = document.createElement("div");
    actions.className = "editor-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "btn btn-primary";
    saveBtn.textContent = "Save";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-ghost";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      editingTaskId = null;
      renderTasks();
    });
    actions.append(saveBtn, cancelBtn);

    box.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = title.value.trim();
      if (!v) return;
      t.title = v;
      t.categoryId = sel.value;
      t.mode = editMode;
      t.estimateMin = Number(slider.value);
      t.recurring = dailyCb.checked;
      editingTaskId = null;
      save();
      renderTasks();
    });

    const topRow = document.createElement("div");
    topRow.className = "editor-row";
    topRow.append(title, sel);
    const midRow = document.createElement("div");
    midRow.className = "editor-row";
    midRow.append(modeWrap, daily);
    const bottomRow = document.createElement("div");
    bottomRow.className = "editor-row";
    bottomRow.append(estField, actions);
    box.append(topRow, midRow, bottomRow);
    return box;
  }

  function renderSchedule() {
    $("#schedule-enabled").checked = state.settings.scheduleEnabled;

    const wrap = $("#schedule-times");
    wrap.innerHTML = "";
    for (const t of [...state.settings.scheduleTimes].sort()) {
      const row = document.createElement("div");
      row.className = "schedule-time-item";
      const label = document.createElement("span");
      label.className = "time-label";
      label.textContent = formatTime(t);
      const rm = document.createElement("button");
      rm.className = "btn btn-ghost";
      rm.textContent = "Remove";
      rm.addEventListener("click", () => {
        state.settings.scheduleTimes = state.settings.scheduleTimes.filter((x) => x !== t);
        save();
        renderSchedule();
      });
      row.append(label, rm);
      wrap.appendChild(row);
    }

    const status = $("#notif-status");
    const btn = $("#notif-btn");
    if (!("Notification" in window)) {
      status.textContent = "Notifications not supported in this browser.";
      btn.disabled = true;
    } else if (Notification.permission === "granted") {
      status.textContent = "Notifications enabled ✓";
      btn.disabled = true;
    } else if (Notification.permission === "denied") {
      status.textContent = "Notifications blocked — allow them in browser settings.";
      btn.disabled = true;
    } else {
      status.textContent = "";
      btn.disabled = false;
    }
  }

  function renderRules() {
    const { rules } = state.settings;
    $("#rule-distinct").checked = rules.distinctCategories;
    $("#rule-distinct-window").value = String(rules.distinctWindow);
    $("#distinct-window-row").classList.toggle("hidden", !rules.distinctCategories);

    const wrap = $("#rule-categories");
    wrap.innerHTML = "";
    for (const c of state.categories) {
      const row = document.createElement("label");
      row.className = "toggle-row";
      const name = document.createElement("span");
      name.textContent = c.name;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !rules.excludedCategoryIds.includes(c.id);
      cb.addEventListener("change", () => {
        if (cb.checked) {
          rules.excludedCategoryIds = rules.excludedCategoryIds.filter((id) => id !== c.id);
        } else if (!rules.excludedCategoryIds.includes(c.id)) {
          rules.excludedCategoryIds.push(c.id);
        }
        save();
      });
      row.append(name, cb);
      wrap.appendChild(row);
    }
  }

  // Category manager on the Schedule tab: rename, recolor, add, delete.
  function renderCategoryManager() {
    const wrap = $("#category-manager");
    wrap.innerHTML = "";
    for (const c of state.categories) {
      const row = document.createElement("div");
      row.className = "category-row";

      const color = document.createElement("input");
      color.type = "color";
      color.value = c.color;
      color.setAttribute("aria-label", "Category color");
      color.addEventListener("change", () => {
        c.color = color.value;
        save();
        renderAll();
      });

      const name = document.createElement("input");
      name.type = "text";
      name.className = "edit-title";
      name.value = c.name;
      name.maxLength = 40;
      name.setAttribute("aria-label", "Category name");
      name.addEventListener("change", () => {
        const v = name.value.trim();
        if (!v) {
          name.value = c.name;
          return;
        }
        c.name = v;
        save();
        renderAll();
      });

      const count = state.tasks.filter((t) => t.categoryId === c.id).length;
      const info = document.createElement("span");
      info.className = "help-text category-count";
      info.textContent = count + (count === 1 ? " task" : " tasks");

      const del = document.createElement("button");
      del.className = "task-delete";
      del.textContent = "🗑";
      del.setAttribute("aria-label", "Delete category");
      del.addEventListener("click", () => {
        if (count > 0) {
          alert(`"${c.name}" still has ${count} task(s). Move or delete them first.`);
          return;
        }
        if (state.categories.length <= 3) {
          alert("Keep at least 3 categories — the daily goal needs 3 different ones.");
          return;
        }
        if (!confirm(`Delete category "${c.name}"?`)) return;
        state.categories = state.categories.filter((x) => x.id !== c.id);
        state.settings.rules.excludedCategoryIds =
          state.settings.rules.excludedCategoryIds.filter((id) => id !== c.id);
        if (activeFilter === c.id) activeFilter = "all";
        save();
        renderAll();
      });

      row.append(color, name, info, del);
      wrap.appendChild(row);
    }

    const add = document.createElement("button");
    add.className = "btn btn-ghost";
    add.textContent = "+ Add category";
    add.addEventListener("click", () => {
      const name = prompt("New category name:");
      if (!name || !name.trim()) return;
      const colors = ["#c2483e", "#3ea6a0", "#8a6ed6", "#b8a02e", "#d66b2e", "#4a7dbd"];
      state.categories.push({
        id: uid(),
        name: name.trim().slice(0, 40),
        color: colors[state.categories.length % colors.length],
      });
      save();
      renderAll();
    });
    wrap.appendChild(add);
  }

  // Chronicles: one card per day — completions, goal verdict, streak survival.
  function renderChronicles() {
    const list = $("#chronicle-list");
    list.innerHTML = "";
    const dates = Object.keys(state.stats.dailyLog).sort().reverse().slice(0, 60);
    $("#empty-chronicles").classList.toggle("hidden", dates.length > 0);

    for (const d of dates) {
      const entries = state.stats.dailyLog[d];
      const met = goalMetOn(d);
      const keptStreak = met && goalMetOn(shiftDate(d, -1));

      const card = document.createElement("div");
      card.className = "chronicle-card";

      const head = document.createElement("div");
      head.className = "chronicle-head";
      const when = document.createElement("strong");
      const [y, m, day] = d.split("-").map(Number);
      when.textContent = new Date(y, m - 1, day).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const verdict = document.createElement("span");
      verdict.className = "chronicle-verdict";
      if (met) {
        const parts = [];
        if (entries.length >= OVER_TASKS) parts.push("⚜️ Overachiever");
        parts.push("👑 Goal met");
        if (keptStreak) parts.push("🔥 streak alive");
        verdict.textContent = parts.join(" · ");
      } else {
        verdict.textContent = `${entries.length}/${GOAL_TASKS} — goal missed`;
      }
      verdict.style.color = met ? "var(--success)" : "var(--text-muted)";
      head.append(when, verdict);
      card.appendChild(head);

      for (const e of entries) {
        const cat = catById(e.categoryId);
        const row = document.createElement("div");
        row.className = "chronicle-task";
        const title = document.createElement("span");
        title.className = "history-task";
        const task = state.tasks.find((t) => t.id === e.taskId);
        title.textContent = "✓ " + (e.title || task?.title || "(a mysterious deed)");
        const badge = document.createElement("span");
        badge.className = "task-cat-badge";
        badge.textContent = cat?.name ?? "?";
        badge.style.background = cat?.color ?? "#888";
        row.append(title, badge);
        card.appendChild(row);
      }
      list.appendChild(card);
    }
  }

  function renderHistory() {
    const list = $("#history-list");
    list.innerHTML = "";
    $("#empty-history").classList.toggle("hidden", state.history.length > 0);
    for (const h of state.history) {
      const cat = catById(h.categoryId);
      const item = document.createElement("div");
      item.className = "history-item";

      const when = document.createElement("span");
      when.className = "history-when";
      when.textContent = formatWhen(h.at);

      const task = document.createElement("span");
      task.className = "history-task";
      task.textContent = h.title;

      const badge = document.createElement("span");
      badge.className = "task-cat-badge";
      badge.textContent = cat?.name ?? "?";
      badge.style.background = cat?.color ?? "#888";

      const src = document.createElement("span");
      src.className = "history-source";
      src.textContent =
        (h.source === "scheduled" ? "⏰" : "🎲") +
        (h.status === "done" ? " ✓" : h.status === "dismissed" ? " ✕" : "");

      item.append(when, task, badge, src);
      list.appendChild(item);
    }
  }

  // Mood priority: explicit override (celebrations) > idle pose > affection tier.
  function idleMood() {
    return currentPose.mood || COMPANION.TIERS[state.companion.tier].mood;
  }

  // The floating corner princess, hidden while her full tab is open.
  function renderMiniPrincess(moodOverride) {
    const onPrincessTab = !$("#tab-princess").classList.contains("hidden");
    const widget = $("#mini-princess");
    widget.classList.toggle("hidden", onPrincessTab);
    if (onPrincessTab) return;
    widget.title = `${state.companion.name} — ${currentPose.label}`;
    COMPANION.draw($("#mini-canvas"), moodOverride || idleMood());
  }

  function renderPrincess(moodOverride) {
    const c = state.companion;
    const tier = COMPANION.TIERS[c.tier];
    const canvas = $("#princess-canvas");
    COMPANION.draw(canvas, moodOverride || idleMood());

    // Today's scene: image art when available, placeholder gradient until then.
    const scene = COMPANION.sceneForDate(todayStr());
    const backdrop = $("#scene-backdrop");
    if (scene.image) {
      backdrop.style.background = `url("${scene.image}") center / cover`;
      $("#scene-emoji").textContent = "";
    } else {
      backdrop.style.background =
        `linear-gradient(180deg, ${scene.sky[0]}, ${scene.sky[1]} 68%, ${scene.ground} 68%)`;
      $("#scene-emoji").textContent = scene.emoji;
    }
    $("#scene-label").textContent = scene.name;
    $("#pose-caption").textContent = moodOverride ? "— celebrating! —" : `*${currentPose.label}*`;

    $("#princess-name").textContent = c.name;
    $("#princess-tier").textContent = tier.name;

    // Affection progress toward the next tier.
    const next = COMPANION.TIERS[c.tier + 1];
    const fill = $("#affection-fill");
    const label = $("#affection-label");
    if (next) {
      const span = next.min - tier.min;
      fill.style.width = Math.round(((c.affection - tier.min) / span) * 100) + "%";
      label.textContent = `${c.affection - tier.min} / ${span} to ${next.name}`;
    } else {
      fill.style.width = "100%";
      label.textContent = "Maximum devotion 💗";
    }
  }

  function formatTime(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function formatWhen(iso) {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" }) +
          " " +
          d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // Estimate slider label: minutes + difficulty word.
  function estimateWord(min) {
    if (min <= 10) return "Easy";
    if (min <= 25) return "Medium";
    if (min <= 45) return "Tough";
    return "Hard";
  }

  function renderEstimateLabel() {
    const v = Number($("#estimate-input").value);
    $("#estimate-label").textContent = `${estimateWord(v)} · ${v} min`;
  }

  // ---------- Actions ----------

  function addTask(title, categoryId, mode, estimateMin, recurring) {
    state.tasks.push({
      id: uid(),
      title,
      categoryId,
      mode,
      estimateMin,
      recurring,
      done: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    save();
    renderTasks();
  }

  function toggleDone(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.completedAt = t.done ? new Date().toISOString() : null;
    if (t.done) {
      recordCompletion(t);
    } else {
      revokeCompletion(t.id);
    }
    save();
    renderTasks();
    renderGoalBar();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    save();
    renderTasks();
  }

  function resolvePick(status) {
    const entry = currentPickEntry();
    if (!entry) return;
    entry.status = status;
    if (status === "done") {
      const t = state.tasks.find((x) => x.id === entry.taskId);
      if (t && !t.done) {
        t.done = true;
        t.completedAt = new Date().toISOString();
        recordCompletion(t);
      }
    }
    state.currentPick = null;
    save();
    renderAll();
  }

  // ---------- Wiring ----------

  // ⚡/🌊 segmented toggle in the add form.
  let addMode = "active";
  function renderAddMode() {
    document.querySelectorAll("#mode-toggle .chip").forEach((b) => {
      const on = b.dataset.mode === addMode;
      b.classList.toggle("active", on);
      b.style.background = on ? "var(--primary)" : "";
    });
  }
  document.querySelectorAll("#mode-toggle .chip").forEach((b) => {
    b.addEventListener("click", () => {
      addMode = b.dataset.mode;
      renderAddMode();
    });
  });
  renderAddMode();

  $("#add-task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#task-input");
    const title = input.value.trim();
    if (!title) return;
    addTask(
      title,
      $("#category-select").value,
      addMode,
      Number($("#estimate-input").value),
      $("#daily-input").checked
    );
    input.value = "";
    input.focus();
  });

  $("#estimate-input").addEventListener("input", renderEstimateLabel);

  // "?" hints — tooltips exist on hover, but these work on touch screens too.
  $("#mode-info").addEventListener("click", (e) => {
    e.preventDefault();
    toast("⚡ Active = do, make, exert (workout, chores, focused work). 🌊 Reset = restore & unwind (stretch, read, take a walk).", true);
  });
  $("#daily-info").addEventListener("click", (e) => {
    e.preventDefault();
    toast("🔁 Every-day tasks un-check themselves each morning, so they're back on your list daily.", true);
  });

  $("#pick-now-btn").addEventListener("click", () => {
    const entry = pickRandom("manual");
    if (!entry) {
      alert(
        "No eligible tasks to pick from. Add some tasks, or loosen your time filter / rules."
      );
      return;
    }
    speak("pick");
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("#pick-done-btn").addEventListener("click", () => resolvePick("done"));
  $("#pick-dismiss-btn").addEventListener("click", () => resolvePick("dismissed"));
  $("#pick-reroll-btn").addEventListener("click", () => {
    const entry = currentPickEntry();
    if (entry) {
      entry.status = "dismissed";
      state.currentPick = null;
    }
    const next = pickRandom("manual");
    if (!next) alert("No other eligible tasks to pick from.");
    save();
    renderAll();
  });

  $("#talk-btn").addEventListener("click", () => {
    speak("tap", null, true);
    if (state.companion.tier >= 3) floatHearts(3);
  });

  $("#princess-canvas").addEventListener("click", () => {
    speak("tap", null, true);
    if (state.companion.tier >= 3) floatHearts(3);
  });

  $("#mini-princess").addEventListener("click", () => {
    // Tap while she's talking dismisses the bubble; otherwise she talks.
    const bubble = $("#mini-bubble");
    if (!bubble.classList.contains("hidden")) {
      bubble.classList.add("hidden");
      renderMiniPrincess();
      return;
    }
    speak("tap", null, true);
  });

  $("#princess-name").addEventListener("click", () => {
    const name = prompt("Rename your companion:", state.companion.name);
    if (name && name.trim()) {
      state.companion.name = name.trim().slice(0, 40);
      save();
      renderPrincess();
    }
  });

  $("#schedule-enabled").addEventListener("change", (e) => {
    state.settings.scheduleEnabled = e.target.checked;
    save();
    if (e.target.checked && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(renderSchedule);
    }
  });

  $("#add-time-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#time-input").value;
    if (v && !state.settings.scheduleTimes.includes(v)) {
      state.settings.scheduleTimes.push(v);
      save();
      renderSchedule();
    }
  });

  $("#notif-btn").addEventListener("click", () => {
    Notification.requestPermission().then(renderSchedule);
  });

  $("#sound-enabled").addEventListener("change", (e) => {
    state.settings.soundEnabled = e.target.checked;
    save();
    if (e.target.checked) sfxSpeak(30); // let her clear her throat
  });

  $("#rule-distinct").addEventListener("change", (e) => {
    state.settings.rules.distinctCategories = e.target.checked;
    save();
    renderRules();
  });

  $("#rule-distinct-window").addEventListener("change", (e) => {
    state.settings.rules.distinctWindow = Number(e.target.value);
    save();
  });

  $("#clear-history-btn").addEventListener("click", () => {
    if (!confirm("Clear all pick history?")) return;
    state.history = [];
    state.currentPick = null;
    save();
    renderAll();
  });

  // Tab navigation
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
      const tab = btn.dataset.tab;
      for (const panel of document.querySelectorAll(".tab-panel")) {
        panel.classList.toggle("hidden", panel.id !== "tab-" + tab);
      }
      if (tab === "princess") {
        $("#speech-bubble").classList.add("hidden");
        renderPrincess();
      }
      if (tab === "history") {
        // Chronicles reflect completions made since the last full render.
        renderChronicles();
        renderHistory();
      }
      renderMiniPrincess();
    });
  });

  // Schedule checker: every 20s, plus immediately when the tab regains focus
  // (so a scheduled time isn't missed if the phone was asleep at that minute —
  // note past slots don't fire retroactively, only the current minute matches).
  setInterval(checkSchedule, 20000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkSchedule();
  });

  // Offline support
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  applyTheme();
  dayRollover();
  renderEstimateLabel();
  renderAll();
  checkSchedule();

  // She pipes up shortly after launch (unless the welcome-back line beat her to it).
  setTimeout(() => {
    if ($("#mini-bubble").classList.contains("hidden")) speak("tap");
  }, 4500);
})();
