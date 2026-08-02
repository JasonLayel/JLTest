# 🎨 Muse — Random Art Task Assigner

Tell Muse how much **energy** you have and whether you want to work
**traditionally or digitally**, and it assigns you a matching art exercise from a
large database — plus two **inspiration words**, a **limited color palette**, and
an optional **challenge**. Complete it and it lights up your **calendar** and
builds your **streak**.

Runs entirely in the browser (PC or mobile) with no server, no account and no
build step. All data is stored locally on your device. It's a progressive web
app, so on a phone you can "Add to Home Screen" to install it like a native app,
and it works offline.

## Features

- **Energy selector** — Spark (5–15 min) · Warm-Up (15–30) · Session (30–60) ·
  Deep Dive (60+). Drives which tasks match and the suggested duration.
- **Medium selector** — Traditional · Digital · Surprise me.
- **Randomized task** from a database of ~160 exercises across figure, portrait,
  anatomy, still life, landscape, botanical, animals, perspective, composition,
  value & light, color, character, concept, abstract, pattern, lettering, master
  studies, imagination and more — filtered to your energy + medium.
- **Two inspiration words** — a primary focus word and a secondary word to weave
  in, from a large evocative word bank.
- **Limited color palette** — generated with a poetic name and copyable hex
  swatches. Types include **Complex (up to 5)**, **Analogous / single-family**,
  **Monochrome**, **Greyscale / Grisaille**, **Complementary**,
  **Split-Complementary**, **Triadic**, **Warm/Cool limited**, and **Earthen**.
  Tap any swatch to copy its hex.
- **Optional challenge modifier** — creative constraints ("non-dominant hand",
  "3 values only", "one continuous line"…).
- **Optional focus filter** — narrow to a single subject/discipline, or leave on
  Any.
- **Lock & reroll** — lock the parts you like and reroll the rest, or reroll any
  single element on its own.
- **Session timer** — counts down the suggested duration for your energy level.
- **Copy / share** the full prompt, and **save favorites**.
- **Calendar** that lights up every day you completed a session, with your
  **current streak**, **best streak** and **total sessions**. Tap a lit day to
  see what you did.
- **Log** — full history plus saved favorites, with notes.

## Running it

Serve the folder with any static file server and open it in a browser:

```sh
cd art-assigner
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or host it on any static host and open the URL on your phone or PC. PWA install
and offline support require HTTPS (or localhost).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App layout: Create / Calendar / Log tabs |
| `app.js` | Task database, palette generator, state, streaks, rendering |
| `styles.css` | Responsive dark/light styling |
| `manifest.json`, `icon.svg`, `icons/`, `sw.js` | PWA install + offline support |
