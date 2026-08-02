# 🔥 Ignite — Random Art Task Assigner

Tell Ignite how much **fire** you have — from a smoldering **Ember** to a full
**Inferno** — and whether you want to work **traditionally or digitally**, and it
assigns you a matching art exercise from a large database, plus two **inspiration
words**, a **limited color palette**, and an optional **challenge**. Complete it
and it lights up your **calendar** and builds your **streak** — every finished
day glows like it caught fire.

Runs entirely in the browser (PC or mobile) with no server, no account and no
build step. All data is stored locally on your device. It's a progressive web
app, so on a phone you can "Add to Home Screen" to install it like a native app,
and it works offline.

## Features

- **Fire level (energy)** — Ember (5–15 min) · Kindle (15–30) · Blaze (30–60) ·
  Inferno (60+). Drives which tasks match and the suggested duration.
- **Medium selector** — Traditional · Digital · Surprise me.
- **Randomized task** from a database of ~200 exercises across figure, portrait,
  anatomy, still life, landscape, botanical, animals, perspective, composition,
  value & light, color, character, concept, abstract, pattern, lettering, master
  studies, imagination and more — filtered to your fire level + medium.
- **Two inspiration words** — a primary focus word and a secondary word to weave
  in, from a large evocative word bank.
- **Limited color palette** — generated with a poetic name and copyable hex
  swatches. Types include **Complex (up to 5)**, **Analogous / single-family**,
  **Monochrome**, **Greyscale / Grisaille**, **Complementary**,
  **Split-Complementary**, **Triadic**, **Warm/Cool limited**, and **Earthen**.
  Tap any swatch to copy its hex.
- **AI backstory** (optional) — on character/concept tasks, a "Write a backstory"
  button asks Claude Haiku for 2–3 unique sentences built from your task and
  inspiration words. Requires the Cloud Function below; everything else works
  offline without it.
- **Feeling lucky** — one tap randomizes fire level, medium and everything else.
- **Optional challenge modifier** — creative constraints ("non-dominant hand",
  "3 values only", "one continuous line"…).
- **Optional focus filter** — narrow to a single subject/discipline, or Any.
- **Lock & reroll** — lock the parts you like and reroll the rest, or reroll any
  single element on its own.
- **Session timer** — counts down the suggested duration for your fire level.
- **Copy / share** the full prompt, and **save favorites**.
- **Calendar** that lights up every completed day, with your **current streak**,
  **best streak**, **this week** and **total sessions**. Tap a lit day to see
  what you did.
- **Log** — full history plus saved favorites, with notes.
- **Settings** — light/dark/system theme, an optional daily reminder, and data
  backup (export / import / clear). Everything stays on your device.

## Running it

Serve the folder with any static file server and open it in a browser:

```sh
cd art-assigner
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or host it on any static host and open the URL on your phone or PC. PWA install
and offline support require HTTPS (or localhost).

## AI backstory (optional Cloud Function)

The **Write a backstory** button calls a Firebase Cloud Function (`functions/`
at the repo root) that talks to the Anthropic API using **Claude Haiku 4.5** and
returns 2–3 sentences. The API key stays server-side; the app calls the function
same-origin through the `/api/backstory` hosting rewrite in `firebase.json`.

One-time setup (needs the Firebase **Blaze** pay-as-you-go plan for functions):

```sh
npm install -g firebase-tools          # if not installed
firebase login
firebase functions:secrets:set ANTHROPIC_API_KEY   # paste your Anthropic key
firebase deploy --only functions,hosting
```

Get an Anthropic key at console.anthropic.com. Cost is ~$0.001 per backstory
(Haiku 4.5, ~a tenth of a cent). Without the deployed function the button simply
shows a friendly "needs connection" message and the rest of the app is unaffected.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App layout: Create / Calendar / Log / Settings tabs |
| `app.js` | Task database, palette generator, state, streaks, settings |
| `styles.css` | Responsive fire-themed dark/light styling |
| `manifest.json`, `icon.svg`, `icons/`, `sw.js` | PWA install + offline support |
