# Ignite — Project Context & Handoff

> Read this top-to-bottom and you can work on Ignite productively without reading
> the whole codebase first. It's the single source of truth for what Ignite is,
> how it's built, and how to extend it. Last updated 2026-09-24.

---

## 1. What Ignite is

**Ignite** is a **random art-task assigner** — a personal creative-practice tool.
The artist picks how much **energy/"fire"** they have and whether they want to work
**traditionally or digitally**, taps **Assign my task**, and Ignite hands them a
randomized prompt: a matching **art exercise**, a **recommended tool**, two
**inspiration words**, a **limited color palette**, an optional **challenge**, and
(on character/place tasks) an optional AI-written **backstory**. Completing a task
lights up a **streak calendar**.

- **Owner:** Jason Layel (jason.layel@gmail.com).
- **Vibe/theme:** "catching fire." Dark UI with a fire (amber→red) accent; the
  energy tiers and the app name lean into it. Completed calendar days glow like embers.
- **Audience:** primarily the owner, but built to be shippable/shareable.

The name in code/UI is **Ignite**. Note a historical wart: the localStorage key is
still `muse.artAssigner.v1` (the app was briefly called "Muse" on day one). **Do not
rename that key** — it would orphan every user's saved data.

---

## 2. Status, location, and how it ships

- **Repo:** `JasonLayel/JLTest`, working branch **`claude/art-task-assigner-app-me0fzx`**.
- **Everything lives in the `ignite/` folder** — a **fully standalone project**
  (its own `firebase.json` / `.firebaserc`, app at the folder root). It was
  deliberately extracted out of the unrelated "petulant-princess-productivity" app
  that also lives in this repo. The intended end-state is to copy `ignite/` into its
  **own git repo and its own Firebase project**; it isn't wired to a live Firebase
  project yet (`.firebaserc` has a `REPLACE-WITH-YOUR-PROJECT-ID` placeholder).
- **Live preview (single-file inlined build, no backend):**
  https://claude.ai/code/artifact/1dca4a0c-1f37-4fe5-ba1b-7ba13f2f1ffa
- **Commit attribution convention** (every commit ends with):
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017opSWQ311fkRXhmYnLSkWy
  ```

---

## 3. Tech stack & principles

- **Pure vanilla HTML/CSS/JS. No framework, no build step, no npm deps for the app.**
  Just static files. This is a hard design constraint — keep it dependency-free.
- **PWA:** installable, offline via a service worker, all state in `localStorage`.
- **One optional backend:** a single Firebase **Cloud Function** (Node 20) for the
  AI backstory. Everything else works fully offline without it.
- **Responsive, mobile-first.** Works on phone and desktop. Dark/light/system theme.

---

## 4. File layout (`ignite/`)

| Path | What it is |
|---|---|
| `index.html` | Whole UI: one scrolling page (Create → Calendar → Log) + a Settings modal + a "mark done" notes modal. No inline JS/CSS of substance. |
| `app.js` | **The entire app.** Data (tasks, words, constraints, tools, palettes), state, weighting, rendering, timer, calendar/streak, log, settings, backstory fetch, PWA registration. ~1100 lines, plain functions, no modules. |
| `styles.css` | Fire-themed design tokens + all styling; dark/light via CSS variables. |
| `manifest.json`, `sw.js`, `icon.svg`, `icons/icon-192.png`, `icons/icon-512.png` | PWA install + offline. Icons are a generated flame (see §12). |
| `firebase.json` | Hosting (`public: "."`) + a rewrite `/api/backstory` → the function + functions source config. |
| `.firebaserc` | Firebase project id — **placeholder**, set via `firebase use --add`. |
| `functions/index.js` | The `backstory` Cloud Function. |
| `functions/package.json`, `functions/.gitignore`, `functions/README.md` | Function deps (`@anthropic-ai/sdk`, `firebase-functions`) + docs. |
| `README.md` | User-facing feature list + run/deploy instructions. |
| `CONTEXT.md` | **This file.** |

`app.js` is organized top-to-bottom with `/* ---------- Section ---------- */`
banners: utilities → EFFORTS → TASKS → WORDS → CONSTRAINTS → TOOLS → palette
generators → state/persistence → weighting → selection → generate/reroll →
render → timer → save/streak → calendar → log → copy/share → backstory →
settings → controls → nav → init.

---

## 5. State & persistence (the data model)

All state is one object in `localStorage` under **`muse.artAssigner.v1`**:

```js
state = {
  history:   [ /* completed sessions, newest first */ ],
  favorites: [ /* saved (starred) prompts */ ],
  prefs:     { /* user settings */ },
}
```

**`prefs`** fields (all optional; defaults applied in `refreshControls()` / getters):

| key | values | meaning |
|---|---|---|
| `effort` | 1–4 | selected fire level (see EFFORTS) |
| `medium` | `'T'` \| `'D'` \| `'TD'` | Traditional / Digital / Surprise-me |
| `focus` | a category name or `'Any'` | hard filter to one category |
| `challenge` | bool | include a challenge modifier |
| `emphasis` | `'pillars'` \| `'balanced'` \| `'wildcard'` | task-mix weighting preset (default `pillars`) |
| `theme` | `'system'` \| `'dark'` \| `'light'` | color theme |
| `reminder` | `{ enabled, time }` | daily nudge |
| `lastReminded` | `'YYYY-MM-DD'` | dedupe for the reminder |
| `toolWeights` | `{ [toolName]: 'off'\|'rare'\|'normal'\|'often' }` | per-tool kit weighting (default treated as `normal`) |

A **session snapshot** (an entry in `history`/`favorites`), produced by `snapshot()`:

```js
{ id, date:'YYYY-MM-DD', ts, task, category, medium, effort, minutes,
  tool, primary, secondary,
  palette: { type, name, colors:[{hex, name}] },
  constraint, backstory, note }
```

`load()`/`save()` read/write the whole blob. Everything is device-local; there's
Export/Import/Clear in Settings for backup/transfer.

---

## 6. The generated prompt — fields, locks, rerolls

The current (unsaved) prompt is the module global `current`. Each **rollable field**
can be **locked** (kept on regenerate) and **rerolled** individually. `locks` is:

```js
{ task, tool, primary, secondary, palette, constraint }  // booleans
```

- `generate()` — regenerates every **unlocked** field (and any field with no value
  yet). Wired to both **Assign my task** and **Reroll all**.
- `rerollField(field)` — regenerates just that one field.
- Fields: **task**, **tool** (medium-matched), **primary**/**secondary** words,
  **palette**, **constraint** (only when the challenge toggle is on), plus a
  non-lockable **backstory** (button-driven) and read-only **effort/duration**.
- Rerolling the **task** also clears `current.backstory` and refreshes the tool
  (unless the tool is locked), because both depend on the task/medium.

`renderResult()` writes `current` into the DOM. `#result` holds the card;
per-field rows use `.lock-btn[data-lock=…]` / `.reroll-btn[data-reroll=…]`, which
`init()` wires generically.

---

## 7. Task database & schema

`TASKS` is an array of ~238 entries. Schema:

```js
{ t: 'Task title',   // string shown to the user
  c: 'Category',     // one category (drives weighting group + Focus dropdown)
  m: 'TD',           // eligible mediums: 'T', 'D', or 'TD' (both)
  e: '234' }         // eligible effort levels, as a string of digits 1–4
```

`matchingTasks()` filters `TASKS` by the selected effort (digit ∈ `e`), medium
(`m` contains `T`/`D`, or `TD` matches anything), and Focus (if not `Any`).

At the top of `TASKS` are the general exercises; near the **bottom is a
`// ── Curated prompts (yours) ──` block** — the owner's personal named prompts
(e.g. "D.va bust portrait", "Frieren landscape", "Blender to paint landscape —
architectural", "… Midjourney sketchover/paintover", "solringen paintover", tutorial
follow-alongs, subreddit prompts) — followed by `// ── More in the same veins ──`
(similar prompts I generated: named-character busts, franchise landscapes, AI
paintover workflows, artist studies, tutorial follow-alongs, 3D→paint). **To add
tasks, append one line each to this block.**

**EFFORTS** (fire levels):

| id | name | minutes (timer) | sub-label |
|---|---|---|---|
| 1 | Ember | 12 | 5–15 min |
| 2 | Kindle | 25 | 15–30 min |
| 3 | Blaze | 45 | 30–60 min |
| 4 | Inferno | 75 | 60+ min |

---

## 8. Weighting (this is the important/bespoke part)

The task pick is **weighted random, not uniform** — "feels random, leans hard toward
the owner's themes." Never remove tasks; just change how often they appear.

1. Each category maps to a **group** via `CATEGORY_GROUP` (unmapped → `longtail`):
   - **character**: Portrait, Character, Figure, Anatomy, Animals
   - **environment**: Landscape, Concept, Perspective
   - **render**: Render (3D/blockout studies)
   - **fusion**: Fusion (character+environment+render combos)
   - **longtail**: everything else (Still Life, Botanical, Texture, Pattern,
     Lettering, Color, Value & Light, Composition, Abstract, Master Study,
     Imagination, Warm-Up, Sequential)
2. Each **emphasis preset** gives per-group weights:

   ```js
   pillars:  { character:26, environment:26, render:16, fusion:10, longtail:22 } // default ≈75% pillars
   balanced: { character:20, environment:20, render:13, fusion:8,  longtail:39 } // ≈60%
   wildcard: { character:16, environment:16, render:10, fusion:8,  longtail:50 } // ≈50%
   ```
3. `pickWeightedTask(pool)` groups the *eligible* pool, chooses a group proportional
   to its weight (skipping empty groups), then picks uniformly within it.
4. `genTaskField()` uses the weighted pick **only when Focus = Any**; a chosen Focus
   is a hard single-category filter (uniform within it). There's a relax-fallback if
   a filter combo yields an empty pool.

Change the mix by editing `EMPHASIS` numbers or `CATEGORY_GROUP`. Verified empirically:
pillars ≈78/22, balanced ≈60/40, wildcard ≈49/51.

---

## 9. Recommended tool + "My tools" kit

Every task also suggests a **medium-matched tool**. Two pools:

- `TRADITIONAL_TOOLS` (16): Charcoal, Soft pastels, Watercolor, Watercolor pencils,
  Acrylics, Graphite pencil, Colored pencil, Alcohol markers, Fineliners, Gouache,
  Oil paint, Ink & dip pen, Brush pen, Ballpoint pen, Oil pastels, Conté on toned paper.
- `DIGITAL_TOOLS` (14): Hard round brush, Textured charcoal brush, Soft airbrush,
  Digital watercolor, Digital gouache, Blocky flat brush, Colored-pencil brush,
  Inking/lineart pen, Alcohol-marker brush, Smudge/blender, Lasso fill + hard brush,
  One big soft speedpaint brush, Pixel brush (1px), Grease pencil/lineart.

`genToolField(mediumLabel)` picks from the pool matching the resolved medium
(Traditional vs Digital; "Surprise me" resolves per task). It's **never biased by
task type** — deliberately. The **user pre-weights** it via Settings → **My tools**,
where each tool cycles **Off · Rare · Normal · Often** (stored in `prefs.toolWeights`).
Weights: `TOOL_WEIGHT = { off:0, rare:1, normal:3, often:8 }`; unset = `normal`. If a
whole medium is turned off, it falls back to the full pool so a tool still shows.

---

## 10. Palette generator, words, constraints

- **Palette:** `generatePalette()` picks a type from a weighted `PALETTE_BAG` and
  builds swatches via HSL math (`hslToHex`). Types: Complex (up to 5), Analogous
  (single-family), Monochrome, Greyscale/Grisaille, Complementary,
  Split-Complementary, Triadic, Warm limited, Cool limited, Earthen. Each palette
  gets a poetic two-word name (e.g. "Dusk Ember"). Swatches are tap-to-copy hex.
- **Words:** `WORDS` is a large evocative bank; two distinct words per prompt
  (primary + secondary).
- **Constraints:** `CONSTRAINTS` bank (e.g. "non-dominant hand", "3 values only",
  "one continuous line"), shown only when the challenge toggle is on.

---

## 11. AI backstory (the only networked feature)

On tasks whose category ∈ `BACKSTORY_CATEGORIES = {Character, Concept}`, a
**"Write a backstory"** button appears. It POSTs to **`/api/backstory`** and renders
2–3 sentences; degrades gracefully (friendly toast) with no backend/connection.

- **Frontend:** `generateBackstory()` → `fetch('/api/backstory', {task, category,
  primary, secondary, palette})` → `{ backstory }`. Stored on `current.backstory`,
  included in copy/share, the saved session, and the log.
- **Backend:** `functions/index.js`, a Firebase **2nd-gen HTTPS function** named
  `backstory`. Calls the **Anthropic API with `claude-haiku-4-5`**, `max_tokens: 220`,
  a concise system prompt (2–3 sentences, weave the two words, no colors/palette).
  API key is the Firebase **secret `ANTHROPIC_API_KEY`** — **server-side only; never
  in the client.** Best-effort rate limit (20 req/min/IP) + input length caps.
- **Same-origin:** the app calls a relative `/api/backstory`; `firebase.json` rewrites
  that to the function, so there's no CORS and no exposed key.
- **Cost:** ~$0.001 per backstory (Haiku). To switch providers/models, edit `model`
  (and the client) in `functions/index.js`.

---

## 12. UI structure

- **Header:** flame brand mark + "Ignite", a **streak chip** (🔥 count; scrolls to
  the calendar), and a **⚙ cog** that opens the Settings modal.
- **One page**, three `.page-section`s: **Create** (controls + result card),
  **Calendar & streak** (4 stat cards + month grid), **Log** (History / Favorites).
- **Settings modal** (`#tab-settings`, built by `buildSettings()`): Task emphasis,
  My tools, Appearance (theme), Daily reminder, Your data (export/import/clear), About.
- **Notes modal** (`#modal`): captures an optional note when marking a task done.
- **Calendar/streak:** `computeStreaks()` (current + best), `sessionsThisWeek()`,
  `countByDate()`, `renderCalendar()` (month grid; `.cal-cell.done` glows; tap a lit
  day for its sessions). Streak = consecutive days with ≥1 completed session.
- **Design tokens:** `styles.css` `:root` defines fire colors; dark is default,
  light + system supported. Accent gradient amber→red; `--accent-soft` for chips.
- **Icons:** the flame PNGs were generated by a standalone Node script (a tiny
  hand-rolled PNG encoder) — there's no SVG rasterizer in the environment. See git
  history if you need to regenerate them.

---

## 13. How to run, test, and preview

**Run locally** (from `ignite/`):
```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

**Automated testing** — this project is tested by driving the real app in
**pre-installed Chromium via Playwright** (there's no unit-test framework):
- Playwright is a **global** npm install; require it as
  `require(execSync('npm root -g')+'/playwright')`.
- Launch with `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.
- Serve the folder with `python3 -m http.server` and navigate to it.
- **Gotcha:** top-level `function` declarations (e.g. `genTaskField`, `groupOf`,
  `genToolField`, `pickWeightedTask`) become **`window.*`**, so you can call them in
  `page.evaluate()` for distribution tests. But `let`/`const` module globals like
  **`state` are NOT on `window`** — drive settings via the UI, or seed
  `localStorage['muse.artAssigner.v1']` in an init script and reload.
- Mock the backstory endpoint with `context.route('**/api/backstory', …)`.
- Scratch tests/screenshots go in the session scratchpad, not the repo.

**Preview build (the shareable artifact):** a small script inlines `index.html` +
`styles.css` + `app.js` into one file and strips the service-worker registration,
then it's published as a Claude Artifact (the URL in §2). `/api/backstory` won't
work in that preview (no backend) — it degrades gracefully.

---

## 14. Deploy (standalone Firebase project)

Cloud Functions require the Firebase **Blaze** (pay-as-you-go) plan. From `ignite/`:
```sh
npm install -g firebase-tools
firebase login
firebase use --add                                  # pick/create the project → writes .firebaserc
firebase functions:secrets:set ANTHROPIC_API_KEY    # paste an Anthropic API key
firebase deploy --only functions,hosting
```
The app serves at the domain root; the backstory button hits `/api/backstory`.
Get an Anthropic key at console.anthropic.com.

---

## 15. How to extend (common tasks)

- **Add art tasks:** append `{ t, c, m, e }` lines to the curated block near the end
  of `TASKS`. Pick a `c` whose group (via `CATEGORY_GROUP`) matches how often you want
  it to appear. New categories auto-appear in the Focus dropdown; add them to
  `CATEGORY_GROUP` or they default to `longtail`.
- **Retune the mix:** edit `EMPHASIS` numbers (or add a preset + a button in
  `buildSettings`), or remap `CATEGORY_GROUP`.
- **Add tools:** append to `TRADITIONAL_TOOLS` / `DIGITAL_TOOLS`; they auto-appear as
  chips in My tools.
- **Add words / constraints / palette types:** append to `WORDS` / `CONSTRAINTS` /
  the palette generator list + `PALETTE_BAG`.
- **Change the backstory model/provider:** edit `functions/index.js`.
- **Keep the dependency-free, offline-first, `localStorage`-keyed invariants.**

---

## 16. Gotchas / decisions to preserve

- Don't rename `localStorage` key `muse.artAssigner.v1` (orphans data).
- Keep the app **framework-free** and **offline-capable**; the only network call is
  the optional backstory.
- The **API key must stay server-side** (Firebase secret + same-origin rewrite).
  The backstory endpoint is public — a light rate limit is in place; for a widely
  shared deploy add **Firebase App Check** (not yet done).
- The tool suggestion is intentionally **not** biased by task; user weighting only.
- `ignite/` must stay self-contained (its own `firebase.json`/`.firebaserc`); it is
  not part of, and must not depend on, the other app in this repo.
