/* Random Task Picker — a to-do list with randomization.
 * All data lives in localStorage; no server required.
 * companion.js (COMPANION global) provides the princess sprite + dialogue.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "randomTaskPicker.v1";
  const GOAL_TASKS = 3; // daily goal: 3 tasks across 3 categories
  const STREAK_MILESTONES = [3, 5, 7, 14, 21, 30, 50, 100];

  const DEFAULT_CATEGORIES = [
    { id: "mental", name: "Mental Action", color: "#5b5bd6" },
    { id: "contemplation", name: "Contemplation", color: "#9a5bd6" },
    { id: "recreation", name: "Recreation", color: "#d65b9a" },
    { id: "bodily", name: "Bodily Action", color: "#d68a2e" },
    { id: "environmental", name: "Environmental Action", color: "#2e9e5b" },
    { id: "pursuits", name: "Pursuits", color: "#2e8ad6" },
  ];

  const DEFAULT_STATE = {
    categories: DEFAULT_CATEGORIES,
    tasks: [], // {id, title, categoryId, estimateMin, recurring, done, createdAt, completedAt}
    history: [], // picks: {id, taskId, title, categoryId, at, source, status}
    settings: {
      scheduleEnabled: false,
      scheduleTimes: ["10:00", "13:00", "15:00"],
      firedToday: {}, // { "10:00": "2026-07-07" } last date each slot fired
      timeFilter: 0, // max minutes for picks; 0 = any
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
      for (const key of ["settings", "stats", "companion"]) {
        merged[key] = Object.assign(structuredClone(DEFAULT_STATE[key]), parsed[key] || {});
      }
      merged.settings.rules = Object.assign(
        structuredClone(DEFAULT_STATE.settings.rules),
        (parsed.settings && parsed.settings.rules) || {}
      );
      return merged;
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const catById = (id) => state.categories.find((c) => c.id === id);
  const estimateOf = (t) => t.estimateMin || 15;

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
    const pts = pointsFor(task);
    if (!state.stats.dailyLog[today]) state.stats.dailyLog[today] = [];
    state.stats.dailyLog[today].push({ taskId: task.id, categoryId: task.categoryId, points: pts });
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
    if (!reacted) speak("complete");
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

  // Show a companion line: in the bubble if the Princess tab is open,
  // otherwise as a toast. `force` prioritizes this line over one already showing.
  let bubbleTimer = null;
  function speak(kind, vars, force) {
    const c = state.companion;
    const text = COMPANION.line(kind, c.tier, c.recentLines, vars);
    if (!text) return;
    save();
    const onPrincessTab = !$("#tab-princess").classList.contains("hidden");
    if (onPrincessTab) {
      const bubble = $("#speech-bubble");
      bubble.textContent = text;
      bubble.classList.remove("hidden");
      renderPrincess(kind === "goal" || kind === "streak" ? "proud" : null);
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => renderPrincess(), 6000);
    } else {
      toast("👑 " + text, force);
    }
  }

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

  function dayRollover() {
    const today = todayStr();
    const last = state.companion.lastOpenDate;
    if (last === today) return;

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
  }

  // ---------- Picking logic ----------

  function eligibleTasks() {
    const { rules, timeFilter } = state.settings;
    let pool = state.tasks.filter(
      (t) =>
        !t.done &&
        !rules.excludedCategoryIds.includes(t.categoryId) &&
        (!timeFilter || estimateOf(t) <= timeFilter)
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
    dayRollover();
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
          notify("🎲 Time for a task!", `${entry.title} — ${catById(entry.categoryId)?.name ?? ""}`);
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

  function renderAll() {
    renderPickBanner();
    renderGoalBar();
    renderCategoryOptions();
    renderFilters();
    renderTimeFilter();
    renderTasks();
    renderSchedule();
    renderRules();
    renderHistory();
    renderPrincess();
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
      entry.source === "scheduled" ? "⏰ Scheduled pick" : "Your task right now";
    $("#pick-banner-task").textContent = entry.title;
    const task = state.tasks.find((t) => t.id === entry.taskId);
    const est = task ? ` · ⏱ ${estimateOf(task)} min` : "";
    $("#pick-banner-category").textContent = (catById(entry.categoryId)?.name ?? "") + est;
  }

  function renderGoalBar() {
    const log = todaysLog();
    // One slot per distinct category completed today (that's the goal that matters).
    const cats = [...new Set(log.map((e) => e.categoryId))].slice(0, GOAL_TASKS);
    const slots = document.querySelectorAll(".goal-slot");
    slots.forEach((slot, i) => {
      const cat = cats[i] ? catById(cats[i]) : null;
      slot.classList.toggle("filled", !!cat);
      slot.style.background = cat ? cat.color : "";
    });
    $("#goal-bar").classList.toggle("goal-met", goalMetOn(todayStr()));
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
      est.textContent = (t.recurring ? "🔁 " : "") + "⏱" + estimateOf(t) + "m";

      const badge = document.createElement("span");
      badge.className = "task-cat-badge";
      badge.textContent = cat?.name ?? "?";
      badge.style.background = cat?.color ?? "#888";

      meta.append(est, badge);

      const del = document.createElement("button");
      del.className = "task-delete";
      del.textContent = "🗑";
      del.setAttribute("aria-label", "Delete task");
      del.addEventListener("click", () => deleteTask(t.id));

      item.append(check, title, meta, del);
      list.appendChild(item);
    }
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

  function renderPrincess(moodOverride) {
    const c = state.companion;
    const tier = COMPANION.TIERS[c.tier];
    const canvas = $("#princess-canvas");
    COMPANION.draw(canvas, moodOverride || tier.mood);

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

  function addTask(title, categoryId, estimateMin, recurring) {
    state.tasks.push({
      id: uid(),
      title,
      categoryId,
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

  $("#add-task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#task-input");
    const title = input.value.trim();
    if (!title) return;
    addTask(
      title,
      $("#category-select").value,
      Number($("#estimate-input").value),
      $("#daily-input").checked
    );
    input.value = "";
    input.focus();
  });

  $("#estimate-input").addEventListener("input", renderEstimateLabel);

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

  dayRollover();
  renderEstimateLabel();
  renderAll();
  checkSchedule();
})();
