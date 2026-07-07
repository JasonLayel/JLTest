/* Random Task Picker — a to-do list with randomization.
 * All data lives in localStorage; no server required.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "randomTaskPicker.v1";

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
    tasks: [], // {id, title, categoryId, done, createdAt, completedAt}
    history: [], // {id, taskId, title, categoryId, at, source: "manual"|"scheduled", status: "picked"|"done"|"dismissed"}
    settings: {
      scheduleEnabled: false,
      scheduleTimes: ["10:00", "13:00", "15:00"],
      firedToday: {}, // { "10:00": "2026-07-07", ... } last date each slot fired
      rules: {
        distinctCategories: true,
        distinctWindow: 3,
        excludedCategoryIds: [],
      },
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
      merged.settings = Object.assign(structuredClone(DEFAULT_STATE.settings), parsed.settings || {});
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
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const catById = (id) => state.categories.find((c) => c.id === id);

  // ---------- Picking logic ----------

  function eligibleTasks() {
    const { rules } = state.settings;
    let pool = state.tasks.filter(
      (t) => !t.done && !rules.excludedCategoryIds.includes(t.categoryId)
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
    renderCategoryOptions();
    renderFilters();
    renderTasks();
    renderSchedule();
    renderRules();
    renderHistory();
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
    $("#pick-banner-category").textContent = catById(entry.categoryId)?.name ?? "";
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

      const badge = document.createElement("span");
      badge.className = "task-cat-badge";
      badge.textContent = cat?.name ?? "?";
      badge.style.background = cat?.color ?? "#888";

      const del = document.createElement("button");
      del.className = "task-delete";
      del.textContent = "🗑";
      del.setAttribute("aria-label", "Delete task");
      del.addEventListener("click", () => deleteTask(t.id));

      item.append(check, title, badge, del);
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

  // ---------- Actions ----------

  function addTask(title, categoryId) {
    state.tasks.push({
      id: uid(),
      title,
      categoryId,
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
    save();
    renderTasks();
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
    addTask(title, $("#category-select").value);
    input.value = "";
    input.focus();
  });

  $("#pick-now-btn").addEventListener("click", () => {
    const entry = pickRandom("manual");
    if (!entry) {
      alert(
        "No eligible tasks to pick from. Add some tasks, or check your rules (excluded categories / different-categories rule)."
      );
      return;
    }
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

  renderAll();
  checkSchedule();
})();
