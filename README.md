# 🎲 Random Task Picker

A to-do list with randomization built in. Add tasks across categories, then let
the app decide what you should do next — either on demand or automatically at
scheduled times.

Runs entirely in the browser (PC or mobile) with no server or build step: all
data is stored locally on your device. It's a progressive web app, so on a
phone you can use "Add to Home Screen" to install it like a native app, and it
works offline.

## Features

- **Tasks by category** — default categories: Mental Action, Contemplation,
  Recreation, Bodily Action, Environmental Action, and Pursuits.
- **🎲 Pick for me** — randomly chooses an open task, respecting your rules.
- **Scheduled picks** — set times (defaults: 10:00 AM, 1:00 PM, 3:00 PM) and the
  app auto-picks a task and sends a browser notification. Scheduled picks fire
  while the app is open in a tab or running as an installed PWA (a purely local
  app can't wake your device when it's fully closed).
- **Rules**
  - *Different categories*: require that the last N picks (configurable, 2–6)
    all come from different categories.
  - *Eligible categories*: exclude specific categories from random picks.
- **History** — a log of every pick, its source (manual 🎲 or scheduled ⏰),
  and how it was resolved (done ✓ / dismissed ✕).

## Running it

Serve the folder with any static file server and open it in a browser:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or host it on any static host (GitHub Pages works great) and open the URL on
your phone or PC. Notifications and PWA install require HTTPS (or localhost).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App layout: tasks, schedule & rules, history tabs |
| `app.js` | All logic: state, picking, rules, scheduling, rendering |
| `styles.css` | Responsive, mobile-first styling with dark mode |
| `manifest.json`, `icon.svg`, `sw.js` | PWA install + offline support |
