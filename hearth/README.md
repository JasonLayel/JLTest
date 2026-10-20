# 🔥 Hearth

An art companion that sits with you while you draw. It scopes a piece down to
something you can finish in one sitting, breaks it into a step at a time, keeps
you company while you work, and closes the session with one specific thing you
did well and one sentence for next time.

Third in the family: **Spark** hands you something to look at, **Ignite** tells
you what to do today, **Hearth** stays with you until it's done.

Phase 1 — text only. Voice is Phase 2, progress photos Phase 3. See `PLAN.md`.

## What it does

- **Arrive** — opens on the note you left last time. Pick a fire level and a
  medium; you're in.
- **Lane** — start something, carry on, drill the arc's focus skill, or just
  hang out and doodle. The last one is a real option, not a consolation.
- **Scope** — tell it roughly what you want to make and it cuts it down to what
  fits the time you actually have. This is the most important screen in the app.
- **Work** — one step at a time, each with a *done-when* test and an escape
  hatch. A timer that marks halfway and ten-to-go locally. It stays quiet
  unless you talk to it.
- **Close** — what moved, one specific win, and the next sentence, written for
  you to edit.

## Where to use it

It is a PWA on a plain URL, so **bookmark the deployed address on your phone**
and it is there. Two surfaces:

- **Session** - the five beats, for when you are drawing. Works on the phone
  too, which is the traditional-drawing case: phone beside the paper.
- **Talk** (the ◎ button) - just texting, no session, no timer. This is the
  between-sessions channel: ask what to work on, say you do not feel like it,
  tell it how yesterday went.

History is per device for now. Cross-device sync is not built; Export/Import
in Settings moves it by hand.

## The rules it runs on

The companion's character comes from `companions/`, written from the Phase 0
interview and explained in prose in `compass.md`. Some of it is behavioural
law rather than flavour:

- **No critique during a session.** Encouragement and the next move only.
  Analysis happens afterwards, if asked.
- **Never nitpick**, and **never prescribe a redraw** unless asked.
- **Never agree that you're lazy** — and never argue about it either.
- **No money or goals mid-session.**
- **Scope to one sitting.** A piece not finished today is a piece that won't be
  returned to.

Two layers, and the split is deliberate:

- `companions/_profile.json` - **who Jason is.** Shared by every companion,
  present and future: how to talk to him, the standing rules, his rhythm.
- `companions/hearth.json` - **this companion.** Its role, its voice, its
  domain, the art-specific rules, the skill ledger and the current arc.

So a financial or meal-prep companion later is a new file next to
`hearth.json`, not a new endpoint. They all inherit the same person.

Change who the companion is by editing those files, not the prompt.

Two safeguards sit behind the prompt, because a prompt alone does not hold a
voice:

- **`functions/style.js`** checks every reply and regenerates up to three
  times if it drifts into assistant phrasing, therapist phrasing, discipline
  or shame language, an unasked critique, a redraw suggestion, money talk
  mid-session, lists, headings or em dashes. The rules here are nearly all
  negative, and models follow "do this" far better than "never do that".
- **Settings → Run voice check** fires five canned situations at the companion
  and shows what comes back, touching nothing real. Run it after deploying,
  and again whenever you change the persona.

## Running it locally

```sh
python3 -m http.server 8000     # then open http://localhost:8000
```

The static app works immediately. `/api/hearth` won't exist, so the companion
runs **offline**: the session structure, step cards, timer, history and ledger
all work, with a generic fallback ladder instead of a scoped one. To run the
real endpoint locally, use `firebase emulators:start` instead.

## Deploying

Cloud Functions need the Firebase **Blaze** plan. From `hearth/`:

```sh
npm install -g firebase-tools
firebase login
firebase use --add                                  # writes .firebaserc
firebase functions:secrets:set ANTHROPIC_API_KEY    # paste a key from console.anthropic.com
firebase deploy --only functions,hosting
```

`firebase.json` has a predeploy step that copies `companions/` into
`functions/` so the profile ships with the endpoint and **not** with the public
site. `companions/**` and every `.md` are excluded from hosting.

## Cost

Haiku 5.5 for conversation, Sonnet 5.5 for scoping and the close. On the
expected pattern — four afternoons a week — this lands around **$1.50–$3 a
month**. The estimate and its assumptions are in `PLAN.md` §8.5.

**Set a spend limit in the Anthropic Console.** That is the real cap. The
function's rate limit (12/min per IP), per-instance daily ceiling (300 calls)
and `maxInstances: 2` bound a runaway loop, but they are a seatbelt, not a
budget.

## Known gaps

- **The endpoint is unauthenticated.** Rate-limited and on an unguessable URL,
  but anyone who finds it can spend your tokens. Firebase **App Check** is the
  fix and is not wired up yet — the same gap Ignite carries.
- No voice (Phase 2), no progress photos (Phase 3), no fable engine (Phase 4),
  no weekly or arc review (Phase 5).
- Data is device-local, so the phone and the PC keep separate histories.
  Sync is **not** built; use Export/Import in Settings for now.
- A live session now survives a closed tab or a crash (it is written to
  `hearth.session.v1` as you go, and one left open for more than six hours is
  filed into history rather than resumed).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The five beats, the arc view, settings |
| `app.js` | The whole app: state, beats, timer, ladder, close, ledger |
| `styles.css` | Ash-and-ember tokens, dark-first, light supported |
| `compass.md` | The companion's memory in prose, the authoritative account |
| `companions/_profile.json` | Who Jason is. Shared by every companion |
| `companions/hearth.json` | The art companion: role, rules, skills, arc |
| `functions/style.js` | The output filter that holds the voice |
| `compass.html` | The Phase 0 interview that produced both |
| `functions/index.js` | `/api/hearth` — hello, scope, talk, close |
| `PLAN.md` | The project plan, revised after Phase 0 |
| `manifest.json`, `sw.js`, `icon.svg`, `icons/` | PWA install + offline shell |

## Invariants to keep

- Vanilla HTML/CSS/JS. No framework, no build step, no npm dependencies in the
  app itself.
- The API key stays server-side. Always.
- `companions/` is never served from hosting.
- `hearth/` stays self-contained, ready to move to its own repo.
