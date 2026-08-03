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
- **Weighted-random task** from a database of ~230 exercises across figure,
  portrait, anatomy, landscape, environment, **3D render / blockout**, **fusion**
  (character + environment + render combos), still life, botanical, animals,
  perspective, composition, value & light, color, abstract, pattern, lettering,
  master studies and more — filtered to your fire level + medium.
- **Task emphasis** (Settings) — everything stays possible, but the mix leans
  the way you want: **My pillars** (~75% character/portrait · environment/
  landscape · 3D blockout · combos), **Balanced**, or **Wildcard** (more of the
  long tail). Tune the weights in one commented table (`EMPHASIS` in `app.js`).
- **Recommended tool** — a medium-appropriate tool to make it with: physical
  media in Traditional mode (charcoal, soft pastels, watercolor, watercolor
  pencils, acrylics, graphite, colored pencil, alcohol markers, fineliners,
  gouache, oil, ink, brush pen, ballpoint, oil pastels, conté) or digital brush
  equivalents in Digital mode. Lock or reroll it like any other field. It's never
  biased by task — just random within your kit.
- **My tools** (Settings) — tap each tool to cycle **Off · Rare · Normal ·
  Often**. Turn off what you don't own so it only ever suggests your kit, and set
  favorites to Often. Off = 0, Rare = 1, Normal = 3, Often = 8 (weights are in
  `TOOL_WEIGHT` in `app.js`).
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

This is a **standalone project** — the app is at the folder root and it has its
own `firebase.json` / `.firebaserc`, independent of any other project.

## Running it locally

Serve this folder with any static file server and open it in a browser:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or host it on any static host and open the URL on your phone or PC. PWA install
and offline support require HTTPS (or localhost). The AI backstory button needs
the Cloud Function below (it's disabled/graceful without it).

## Deploying to Firebase (its own project)

The app is hosted at the domain root and the **Write a backstory** button calls a
Firebase Cloud Function (`functions/`) that talks to the Anthropic API using
**Claude Haiku 4.5**. The API key stays server-side; the app reaches the function
same-origin via the `/api/backstory` hosting rewrite in `firebase.json`.

One-time setup (Cloud Functions require the Firebase **Blaze** pay-as-you-go plan):

```sh
npm install -g firebase-tools                 # if not installed
firebase login
firebase use --add                            # pick/create your new Firebase project
firebase functions:secrets:set ANTHROPIC_API_KEY   # paste your Anthropic key
firebase deploy --only functions,hosting
```

Run these from inside this `ignite/` folder. Get an Anthropic key at
console.anthropic.com. Cost is ~$0.001 per backstory (Haiku 4.5, ~a tenth of a
cent). Without the deployed function the button simply shows a friendly "needs
connection" message and the rest of the app is unaffected.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App layout: Create / Calendar / Log / Settings tabs |
| `app.js` | Task database, palette generator, state, streaks, settings |
| `styles.css` | Responsive fire-themed dark/light styling |
| `manifest.json`, `icon.svg`, `icons/`, `sw.js` | PWA install + offline support |
