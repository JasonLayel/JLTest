# Hearth — Art Advisor Companion

> Project plan. Working name **Hearth**: the third app in the fire family — the one
> you sit beside while you work. Spark hands you something to look at, Ignite tells
> you what to do, Hearth stays with you until it's done.
>
> Owner: Jason Layel. Drafted 2026-10-17 from an interview (§2 records the answers).

---

## 1. The problem, stated honestly

You described yourself as between beginner and advancing-beginner, with **mostly
incomplete sketches and the occasional one with real potential**. That single
sentence should drive the entire design, because it tells us where the leak is.

It is not an idea problem — Ignite already generates 238 weighted task prompts with
palettes, words and constraints. It is not a reference problem — Spark already serves
random reference with notan, grayscale, grid and gesture drills. It is not a
motivation-to-start problem — streaks and fire levels already handle the opening move.

**The leak is the middle of a piece.** Roughly: minute 25 to minute 70, when the
drawing stops looking like the idea in your head and starts looking worse than the
sketch it came from. That is where pieces die, and nothing in your current toolkit is
standing there with you.

So Hearth's job, in one line:

> **Be present in the middle of a piece, break what's left into a step you can
> actually take, and make finishing feel more normal than quitting.**

Everything else in this plan — the voice, the humor, the fables, the monetization
awareness — is in service of that. If a feature doesn't help you finish more pieces
or come back more often, it's decoration.

### The success metric

One number, tracked from day one: **finish rate** — of the pieces you start, what
fraction reach a state you'd be willing to show. Today it is low by your own account.
Six weeks after Phase 1, it should be visibly higher. If finish rate doesn't move,
the project has failed no matter how good the conversation feels.

Secondary: sessions per week, median session length, pieces per month, and
"resurrections" (abandoned sketches brought to done).

---

## 2. What the companion knows about you (the interview record)

This section is the seed of the Compass file in §4. It is deliberately written as
fact, not as a summary, because the companion will read it.

| | |
|---|---|
| **Where you are** | Between beginner and advancing-beginner. Fundamentals still forming. Mostly incomplete sketches; occasionally one with a lot of potential. |
| **Time** | Two shapes, both real: **15–30 min on most days**, plus **45–90 min a few times a week**. Plan for both; never assume the long one. |
| **Subjects you want to be known for** | Characters & figures. Fantasy & narrative scenes. Nature, landscape, botanical. |
| **Mediums** | Digital on PC. Traditional on paper with the phone alongside. Both are first-class. |
| **Monetization, 1–3 years** | Commissions / client work. Prints, merch, product. Audience & subscription. (Not pursuing studio/editorial pipeline work.) |
| **Business side in v1** | Later phase. v1 is about drawing more and better — but goals are captured now so subject choice can bend toward them. |
| **Companion personality** | Warm, witty friend who teases. Affectionate, funny, calls out avoidance with humor rather than discipline. Companion, not coach. |
| **Where it lives** | PC browser as the primary surface; phone for text and listening, used alongside traditional drawing. |
| **How it sees the work** | Progress photos you choose to send, plus voice description. No continuous camera watching. |
| **Budget** | Under $10/month, all in. |

Open questions still to settle are in §13. None of them block Phase 0 or 1.

### What the taste data already says

`art-digest/taste.json` currently weights **architectural / archviz / environment /
cityscape / matte painting** most heavily, with contexts r/ImaginaryArchitecture and
r/ImaginaryCityscapes. Ignite's default `pillars` emphasis sends ~78% of tasks to
character / environment / render / fusion.

Note the gap: your stated targets include **characters & figures** and **botanical /
nature**, but your measured browsing taste leans hard toward **built environments**.
That's not a contradiction to fix — it's useful. It likely means environments are what
you *enjoy looking at* and characters are what you *want to be able to make*. Hearth
should say that out loud in the first Compass review and let you decide which one the
first arc serves. (My guess: use environment work as the reward and character work as
the deliberate practice.)

---

## 3. Division of labor across the three apps

Hearth does not replace Spark or Ignite, and must not absorb them. Each already does
its job well; Hearth is the connective tissue and the presence.

```
        ┌──────────────┐        ┌──────────────┐       ┌───────────────────┐
        │   IGNITE     │        │    SPARK     │       │   ART-DIGEST      │
        │ what to do   │        │ what to look │       │  what's out there │
        │ today        │        │ at           │       │  (taste.json)     │
        └──────┬───────┘        └──────┬───────┘       └─────────┬─────────┘
               │ tasks, effort tiers,  │ reference, drills,      │ daily feed,
               │ palettes, words,      │ "drawn" tracking,       │ measured taste
               │ streak, history       │ favorites, tags         │
               └───────────┬───────────┴─────────────┬───────────┘
                           ▼                         ▼
                 ┌──────────────────────────────────────────┐
                 │               HEARTH                     │
                 │  presence · decomposition · next step    │
                 │  memory · encouragement · finishing      │
                 └──────────────────────────────────────────┘
```

- **Ignite** answers "what should I do today." Hearth consumes its effort tiers (Ember
  12 / Kindle 25 / Blaze 45 / Inferno 75 — these map almost exactly onto your two time
  shapes) and its task/palette/word vocabulary, and reads its history and streak so it
  knows what you've actually been doing.
- **Spark** answers "what should I look at." Hearth sends it there with a purpose:
  a deep link that opens a specific board, tag, timer and study mode for the step at
  hand, instead of a generic random reference.
- **art-digest** answers "what does good look like right now, in my taste." Hearth
  reads `data/latest.json` straight off GitHub Pages — no auth, no API — and can point
  at a piece in today's digest that solves the exact problem you're stuck on.
- **Hearth** answers "what is the next brushstroke, and will you sit with me while I
  make it."

---

## 4. Memory architecture

This is the part that makes it a companion rather than a chatbot with a nice prompt.
Four layers, deliberately separated by how often they change — which is also what
makes it cheap to run, because only the small fast layers vary per request.

### Layer 1 — Compass (changes quarterly)

Hand-authored, human-readable, version controlled. The north star.

```json
{
  "identity":    { "name": "Jason", "level": "advancing beginner", "selfDescribed": "mostly incomplete sketches, occasionally real potential" },
  "northStar":   "Be an artist who finishes things people want to own.",
  "subjects":    ["characters & figures", "fantasy & narrative scenes", "nature / landscape / botanical"],
  "monetization":[
    { "target": "commissions",  "horizon": "18mo", "needs": ["likeness", "character consistency", "a sheet of 6 showable examples"] },
    { "target": "prints/merch", "horizon": "12mo", "needs": ["coherent series of 6-8", "archival capture", "print-resolution files"] },
    { "target": "audience",     "horizon": "24mo", "needs": ["process content", "a recognizable look", "posting cadence"] }
  ],
  "timeShapes":  [{ "label": "daily touch", "minutes": 20 }, { "label": "real session", "minutes": 60 }],
  "voice":       { "persona": "warm witty friend", "teasing": true, "humor": "high", "sentimentality": "low" },
  "antiGoals":   ["studio/editorial pipeline work", "becoming a productivity-app user instead of an artist"]
}
```

The `antiGoals` field is not decoration. It gives the companion permission to say
"that's not what you said you wanted" — which is most of what an advisor is for.

### Layer 2 — Ledger (changes weekly)

The slow-moving record. Four tables:

- **Skill ledger** — fundamentals with a level 0–5, a confidence, a last-practiced
  date, and **evidence** (a link to the piece or photo that justifies the level).
  Seeded in Phase 0 with: gesture, proportion, construction, perspective, value
  structure, edge control, colour harmony, composition, anatomy, foliage, architecture,
  rendering/finish. A level without evidence is a guess and gets flagged as one.
- **Piece archive** — every piece: brief, steps taken, photos, outcome
  (`finished` / `parked` / `abandoned`), and **why** it ended that way. The "why" is
  the most valuable column in the whole system; it is how the companion learns where
  your pieces die.
- **Series** — named sets of 6–8 pieces with a shared constraint. The bridge to
  monetization (see §9).
- **Taste drift** — snapshots of `taste.json` over time, so the companion can notice
  "you've stopped looking at cityscapes and started looking at botanicals."

### Layer 3 — Arc (changes every 4–6 weeks)

One focus skill. One series. One or two active pieces. That's the whole arc.

**One focus skill at a time** is a hard rule. You are at the stage where three
simultaneous improvement targets produce zero improvement and a lot of noise.

### Layer 4 — Session (ephemeral, then distilled)

The live transcript, step log, and photos. At session close, distilled into **one
paragraph plus a set of ledger deltas**, and the raw transcript is dropped from the
context that the model ever sees again.

**This is the cost and quality control.** The model never re-reads old transcripts. It
reads Compass + Arc + the current piece + the last few distilled session notes. That
keeps the request small, keeps the companion's sense of you sharp rather than
diluted, and is why the monthly bill in §8 lands near $2 instead of near $60.

---

## 5. The session loop

Five beats. Phase 1 builds all five, text only.

### Beat 1 — Arrive (target: 10 seconds)

Hearth opens already knowing where you left off. The first thing on screen is not a
menu, it is the sentence you wrote at the last close: *"Next: block in the cathedral's
shadow side, 20 min, don't touch the windows."*

Then one question, three taps: **how much fire, which medium, how long** — the same
three axes Ignite already uses, so the vocabulary is shared.

Zero-friction start is a hard requirement. If opening Hearth costs more than ten
seconds of decision-making, it becomes the thing you avoid on the days you most need
it, and the project dies the way productivity apps die.

### Beat 2 — Pick a lane

Five lanes, and the companion recommends one based on the Arc, your energy, and what
it knows is sitting unfinished:

1. **Continue** a piece in flight (default — and quietly the most important).
2. **Start** a new piece (from a fable, from Ignite, or from something you walked in with).
3. **Drill** the arc's focus skill (hands off to Spark with a specific board + timer).
4. **Rescue** an abandoned sketch from the Finish Lane (§7).
5. **Hang out** — no goal, just doodle and talk. This lane must exist. A companion you
   can't waste time with isn't a companion, and a low-stakes lane on a low-energy day
   protects the habit better than a skipped day does.

### Beat 3 — Build the ladder

The decomposition engine. Given the piece, the time budget, and where it stands, it
generates **the next one to three steps and no more**. Never the whole plan.

Each step has exactly four parts:

| Part | Purpose | Example |
|---|---|---|
| **Goal** | what changes on the canvas | "Establish three values: sky, mass, foreground." |
| **Done-when** | the objective exit test | "Squint and you can still tell the three apart." |
| **One cue** | a single teaching idea, not a lecture | "Darkest dark goes next to lightest light, once, where you want the eye." |
| **Escape hatch** | what to do instead if stuck | "If the values fight, flip to grayscale in Spark and match the reference's notan." |

The **done-when** is what stops infinite fiddling, and the **escape hatch** is what
stops abandonment. Steps are sized to the session you actually said you had — a
20-minute Ember session gets one step, not a plan for a masterpiece.

Stage vocabulary the ladder draws from: *intent → thumbnails → block-in → construction
→ line → value → colour → detail → finish → capture*. The companion names which stage
you're in, because "I'm in value, not detail" is itself a skill you're building.

### Beat 4 — Work (companion mode)

Mostly silent. See §6 for exactly when it speaks. You draw; it's there; occasionally
it says something useful or funny.

Checkpoints are **always yours to initiate** except at step boundaries. You say "look
at this," it looks (§6.3).

### Beat 5 — Close (90 seconds, non-negotiable)

The most under-rated beat and the one most apps skip:

1. **What moved** — one sentence, from the step log.
2. **One specific win** — named precisely. Not "good session." *"The silhouette on the
   left tower reads instantly now; two weeks ago that would've been mush."*
3. **The next sentence** — written down, concrete enough to act on cold. This is what
   makes Beat 1 take ten seconds next time.
4. **Ledger deltas** — skill evidence, piece status, the honest "why" if you're parking it.
5. **Capture prompt** — if the piece is done, shoot it properly now (§9).

---

## 6. Conversation design

### 6.1 Persona

Warm, witty, teasing. Specifically:

- **Affectionate by default.** Uses your name sparingly, remembers specifics, has
  opinions, is glad you showed up.
- **Teases the avoidance, never the skill.** "Third time you've redrawn that hand
  instead of starting the background. The background knows. It's hurt." Fair game.
  "Your hands need work" as an unprompted jab — never.
- **Specific praise only.** Generic encouragement is worse than silence because it
  teaches you to discount everything it says. The rule: *praise must name a thing,
  and the thing must be real.* Credibility is the entire product; one hollow
  compliment costs more than ten missed ones.
- **Low sentimentality.** No inspirational-poster register. Dry when it's funny.
- **Has continuity.** Running jokes, callbacks to old pieces, a memory of the time you
  swore off clouds forever. That is what makes it a companion and not a prompt.

### 6.2 The speak policy

A real-time drawing companion that talks too much is actively harmful — it breaks the
exact flow state you're trying to enter. So silence is the default and speech is
triggered, never ambient.

**It speaks when:**
- you address it;
- a step's done-when is met or you say you're done with a step;
- a time marker you asked for arrives ("halfway", "ten minutes left");
- a stuck signal appears — a long silence past your threshold, or you say any of the
  magic words: *stuck, ugly, hate, ruined, giving up, I can't*;
- the session's time budget runs out and the close is due.

**It does not speak:** on a timer, to fill a gap, to re-explain a cue, or to praise
something it cannot see.

**Dial:** Quiet / Normal / Chatty, plus two commands that always work — **"shush"**
(mute until addressed) and **"talk to me"** (open the tap; some days the silence is the
problem). The dial is per-session, remembered per lane: the Hang Out lane defaults
chatty, a Blaze session defaults quiet.

### 6.3 Progress-photo critique format

When you send a photo, the response has a fixed four-part shape. Fixed structure is
what keeps it useful instead of rambling, and makes it skimmable by ear.

1. **Read** — what it actually sees, plainly. This also lets you catch it being wrong
   before you act on advice built on a misreading.
2. **One note** — the single highest-leverage change *for the current step's done-when*.
   Not a critique of the finished piece that doesn't exist yet. Critiquing a block-in
   for its missing detail is the fastest way to make someone quit.
3. **An anchor** — one real, specific thing that's working.
4. **Next** — the concrete next move, or confirmation that the step is done.

**The one-note rule:** a maximum of one correction per session, two if you explicitly
ask for more. You are at a level where the limiting factor is not information.

Before commenting on value or composition, it should do what Spark already taught you
to do — ask for or apply grayscale and flip — rather than guessing in colour.

### 6.4 The Ugly Stage protocol

An explicit, named feature, because it addresses your stated failure mode head on.

Every piece has a point where it looks worse than the sketch it came from. That is a
structural property of making pictures, not a verdict on your talent — but it *feels*
exactly like a verdict, and that feeling is what's been killing your pieces.

So Hearth does three things:

- **Forecasts it.** When the ladder is built: *"Around step four this is going to look
  worse than it does right now. That's scheduled. When it happens, it means it's
  working."*
- **Names it when it arrives.** *"Right — this is the ugly part. Told you. Keep going;
  you're two steps from it coming back."*
- **Holds the line.** When the magic words fire, it does not offer to start something
  new. It offers the smallest possible next step, or an escape hatch, or a five-minute
  break with a timer. Starting something fresh when a piece gets ugly is the single
  habit this app exists to break.

### 6.5 Sample transcript

Short, because feel matters more than feature lists here:

> **H:** You left a note: *block in the cathedral's shadow side, don't touch the
> windows.* Twenty minutes, Kindle, digital?
> **J:** yeah
> **H:** One step: get the shadow mass in as one flat shape. Done when the building
> reads as two values from across the room. Darkest dark next to lightest light goes
> at the doorway, nowhere else. Go — I'll shut up.
>
> *[14 minutes of silence]*
>
> **J:** this looks awful
> **H:** It's supposed to. You're at the part where the sketch's charm is gone and the
> render hasn't arrived. Don't start a new one — I can hear you thinking about it.
> Flat shape still one value?
> **J:** no I started rendering the windows
> **H:** Jason.
> **J:** I KNOW
> **H:** Undo to the flat shape. The windows will still be there in forty years,
> they're stone. Two minutes, one value, then we stop and I'll tell you something nice.
>
> *[later]*
>
> **H:** Done. And the thing I owe you: that doorway reads instantly now — you placed
> the contrast once and left it alone, which you did not do in the tower piece last
> month. Next time: windows. Properly. I wrote it down.

---

## 7. Feature set

### F1 — Session engine (Phase 1)
The five beats, the step ladder, the step log, the close ritual. The core.

### F2 — Memory (Phase 1)
Compass, Ledger, Arc, Session distillation. Local-first, Firestore-synced.

### F3 — Voice (Phase 2)
Browser speech both directions: `SpeechRecognition` for push-to-talk input,
`speechSynthesis` for output. No audio ever leaves the device — only text reaches the
API. Barge-in (your speech cancels its speech). Reliable on Chrome/Edge on PC and
Chrome on Android; **iOS Safari recognition is unreliable**, so the phone client must
be fully usable as text-in / voice-out. Stated honestly up front rather than
discovered in week three.

### F4 — Eyes (Phase 3)
Progress photos from the phone camera or a PC file/clipboard paste. Downscaled
client-side to ~1024px on the long edge before upload (quality is unaffected at
critique level; cost drops several-fold). The §6.3 format. Before/after pairs stored
on the piece.

### F5 — Fables & sparks (Phase 4)
Your story feature, and the most distinctive thing here. Hearth writes a 120–180 word
vignette seeded from the Compass, the arc's subject, `taste.json`, and Ignite's word
and palette banks. Then it **extracts 6–8 motifs as pickable chips** — a figure, a
place, a creature, an object, a light condition, a mood, a moment — and asks which
ones you want to draw from. Your picks become the piece brief; the brief generates
Spark reference queries and an Ignite-style palette.

Mechanically this is Ignite's existing `/api/backstory` function grown up: same
same-origin rewrite, same server-side secret, bigger prompt, structured output so the
motifs come back as data rather than prose to be parsed.

### F6 — Finish Lane (Phase 5)
The sketch-rescue system. You photograph the backlog of incomplete sketches once;
Hearth ranks them by *closest to finishable × most aligned with current goals* and
runs Rescue sessions against the top of the list. Tracks resurrections as a first-class
metric, because turning your existing pile of "ones with potential" into finished work
is the fastest possible path to having a portfolio at all.

### F7 — Encouragement system (Phase 5)
Non-punitive by construction, because punitive streaks are why people quit apps:

- **Touches, not days.** Five minutes counts. A touch is a touch.
- **No broken streaks.** The counter never resets to zero with a scolding. It fades
  and recovers. Missing Tuesday is not a moral event.
- **Forgiveness is built in**, not earned: planned rest, sick days, life.
- **Comeback ritual.** After a gap, the first session is deliberately tiny and the
  companion is pleased to see you. Nobody needs a lecture on the day they return;
  it's the day they're most likely to leave again.
- Ignite's existing streak calendar is read as input, not duplicated.

### F8 — Reviews (Phase 5)
Weekly (5 min): what moved, finish rate, one observation, next week's one thing.
Arc review (every 4–6 weeks): skill ledger re-evidenced, new focus skill, series
progress, and an honest look at whether the Compass still describes what you want.

### F9 — Business track (Phase 6, deliberately deferred)
See §9. Deferred, but three cheap things start in v1 so Phase 6 has something to work
with.

---

## 8. Technical design

### 8.1 Stack

Match your existing pattern exactly — it works, it's proven across two apps, and it
keeps the whole thing dependency-free:

- **Vanilla HTML/CSS/JS. No framework, no build step, no npm deps in the app.** Same
  hard constraint as Ignite and Spark.
- **PWA**, installable, offline-capable, service worker.
- **`localStorage` first** for all state, so a session never depends on the network
  mid-stroke. **Firestore sync** on top for cross-device, copying the pattern already
  in `JLTest/sync.js` with the Firebase compat libs in `lib/`.
- **One Firebase 2nd-gen Cloud Function family** under `/api/*`, same-origin rewrite,
  **Anthropic key as a Firebase secret, server-side only** — exactly the shape
  `ignite/functions/index.js` already proves out. Reuse its rate-limit guard, and this
  time **add Firebase App Check**, which Ignite's own CONTEXT.md flags as the
  outstanding gap on a public endpoint.
- **`hearth/` is self-contained**, with its own `firebase.json` / `.firebaserc`, ready
  to move to its own repo and Firebase project — same convention as `ignite/`.

**Recommendation: PWA + the small backend.** You asked me to pick. A browser-only build
can't hold an API key, and a full real-time voice-to-voice loop would blow a $10 budget
on a single 90-minute session. Browser speech APIs plus text model calls through one
tiny function gets you ~95% of the felt experience for ~5% of the cost — and you
already have the function written.

### 8.2 Two clients, one session

```
PC browser (primary)            Phone (companion surface)
 digital drawing                 traditional drawing, or listening
   │                                  │
   │  session doc (Firestore)         │
   └──────────────┬───────────────────┘
                  ▼
        /api/hearth/*  (Firebase Functions, key server-side)
                  ▼
           Anthropic API
```

A session is a Firestore document. Either device can **host** it; the other attaches as
an ear and a mouth. Drawing digitally on the PC: browser hosts, phone optional. Drawing
on paper: phone hosts, and it's the camera too. Same app, same code, different role —
no second codebase.

### 8.3 Prompt architecture

Request composition, in cache-friendly order (stable content first so the prefix
actually caches):

```
system:   persona + speak policy + output contract      [stable — cached]
          Compass                                        [stable — cached]
          Ledger digest (skills, recent pieces)           [weekly — cached]
          Arc (focus skill, series, active pieces)        [per-arc — cached]
          ── cache breakpoint ──
messages: current piece state + step log
          last 3 distilled session notes
          live conversation turns
```

Deliberately: no raw old transcripts, ever. Structured outputs for anything the app
needs as data — step ladders, motif chips, ledger deltas — so the client never parses
prose.

### 8.4 Model routing

| Job | Model | Why |
|---|---|---|
| In-session conversation, step generation | `claude-haiku-5-5` | $0.10/$0.50 per Mtok. Fast, and conversational companionship doesn't need frontier reasoning. |
| Progress-photo critique, piece planning, fables | `claude-sonnet-5-5` | $2/$10. Vision quality and judgement matter here. |
| Weekly + arc reviews | `claude-opus-5-5` | $4/$20. Runs ~5×/month over the full ledger; this is where real insight pays for itself. |

### 8.5 Cost estimate

Assuming ~20 sessions/month (your stated mix: ~14 short, ~6 long), 3 photo critiques
per long session, 8 fables, 5 reviews:

| Line | Volume | Est. cost |
|---|---|---|
| In-session chat (Haiku 5.5) | ~20 sessions × ~20 turns × ~4k in / 150 out | **~$0.25** |
| Photo critiques (Sonnet 5.5) | ~60 images, downscaled to 1024px | **~$0.70** |
| Fables + piece planning (Sonnet 5.5) | ~8–12 calls | **~$0.15** |
| Weekly / arc reviews (Opus 5.5) | ~5 calls × ~15k in / 2k out | **~$0.50** |
| Firebase Hosting + Firestore | free tier | **$0** |
| Cloud Functions | well inside the 2M free invocations | **~$0** |
| | **Total** | **≈ $1.50–$3 / month** |

Comfortably inside $10 with room for a heavier month. Four controls keep it there:

1. **Downscale images client-side** before upload — the single biggest lever.
2. **Prompt caching** on the Compass/Ledger/Arc prefix (cache reads are $0.20/Mtok on
   the 5.5 generation).
3. **A hard monthly ceiling in the function**: accumulate token usage in Firestore and
   degrade to Haiku-only, then refuse, past a threshold you set. Plus a spend limit set
   in the Anthropic Console as the backstop.
4. **Session distillation** (§4) — the architectural reason the bill stays flat as your
   history grows.

Verify current pricing at the Anthropic Console before committing; the table above is
accurate as of this plan's date but model pricing moves.

### 8.6 Privacy — worth being explicit

Progress photos of your artwork are sent to the Anthropic API for critique. Your voice
is **not** — speech is transcribed on-device by the browser, and only text leaves. If
you want a session where nothing about the work leaves the machine, the voice-only
lane (no photos) gives you the companionship with no image upload. Worth knowing
deliberately rather than discovering later.

---

## 9. Monetization: deferred, but seeded now

You chose "later phase," which is right — a business track on top of an unreliable
habit builds on sand. But three things cost nothing now and are expensive to retrofit,
so v1 does them:

1. **Series, not one-offs.** Prints and an audience both need *coherent sets* — 6–8
   pieces sharing a subject, palette or constraint. The arc structure in §4 already
   holds a series. From Phase 1, pieces belong to a series by default, which costs you
   nothing and means that in a year you have sellable sets rather than a pile of
   unrelated images.
2. **Archival capture at the close.** When a piece is finished, capture it properly
   *that day*: consistent lighting, square-on, highest resolution available, raw file
   kept. The cheapest possible investment in future print income, and impossible to
   recover a year later from a phone snap taken at an angle. The close ritual prompts
   for it.
3. **Subject bias toward the targets.** Commissions need likeness and character
   consistency; prints need series; audience needs a recognizable look. Even in v1 the
   companion weights subject suggestions toward those — without ever saying the word
   "monetization" mid-session, which would be the fastest way to kill the mood.

Phase 6 then adds: portfolio gap analysis against the three targets, a commission
sheet and pricing draft, posting cadence, and process-content capture. Only once
finish rate says the habit holds.

---

## 10. Phases

Each phase ships something usable. Each has an acceptance test — something you can
pass or fail, not a feeling.

### Phase 0 — Compass (one 90-minute sitting, no code)
A deep interview with Claude producing `hearth/compass.md`, a seeded skill ledger with
honest level-and-evidence rows, and arc #1.
**Accept when:** the Compass names 3 monetization targets with what each requires, 3
subject targets, 5 ranked skills with evidence, 3 anti-goals, and one focus skill — and
reading it back feels accurate rather than flattering.
**Do this one first regardless of whether the rest gets built.** It has standalone
value, and it's the input everything else consumes.

### Phase 1 — Hearth v0, text only (1–2 weeks)
PWA shell, the five beats, step ladder, step log, close ritual, local persistence,
Firestore sync, the `/api/hearth` function with App Check and spend caps.
**Accept when:** 5 real sessions run end-to-end without you steering the app itself,
one piece advances 3 steps across 3 sessions, and the close notes are good enough that
Beat 1 genuinely takes 10 seconds.
**Cut if short on time:** Firestore sync (localStorage only), the Hang Out lane.
**Stop and rethink if:** you find yourself not opening it. That's a friction problem in
Beat 1, not a missing-feature problem, and more features will make it worse.

### Phase 2 — Voice (1 week)
TTS out, push-to-talk STT in, the speak policy, the chattiness dial, shush/talk-to-me,
barge-in, the phone-as-attached-client role.
**Accept when:** a 45-minute PC session runs without you touching the keyboard, and you
don't want to mute it by minute 20.

### Phase 3 — Eyes (1 week)
Photo capture both clients, client-side downscale, the four-part critique format,
grayscale/flip before value notes, before/after archive on the piece.
**Accept when:** 4 out of 5 critiques produce a change you actually make in the same
session.
**Stop and rethink if:** critiques read as generic. That's a prompt and
context problem — it probably isn't getting the current step's done-when.

### Phase 4 — Stories & sparks (1 week)
Fable engine with structured motif extraction, motif chips, brief generation, Spark
deep links, Ignite data import, art-digest feed read.
**Accept when:** one piece goes from fable → chosen motifs → brief → Spark references →
finished, and the fable genuinely made you want to draw it.

### Phase 5 — Finishing (1–2 weeks)
Finish Lane intake and ranking, Ugly Stage protocol formalized, touch-based
encouragement with forgiveness, comeback ritual, weekly and arc reviews, finish-rate
dashboard.
**Accept when:** finish rate over the trailing 6 weeks is ≥50% of started pieces, and
3 previously abandoned sketches are done.

### Phase 6 — Business track (later, gated on Phase 5's metric)
Series planner, archival capture checklist, portfolio gap analysis, commission sheet
and pricing draft, posting cadence, process-content capture.
**Gate:** don't start until finish rate has held above 50% for two consecutive arcs.
Monetizing an unreliable output is how people end up hating a thing they used to love.

---

## 11. Data model sketch

```js
// localStorage key: hearth.v1   (own namespace; never touch muse.artAssigner.v1)
{
  compass: { /* §4 layer 1 */ },
  ledger: {
    skills: [{ id:'value-structure', level:2, confidence:'medium',
               lastPracticed:'2026-10-12', evidence:['piece_18#photo_3'] }],
    pieces: [{ id:'piece_18', title:'Cathedral, shadow side', series:'series_2',
               brief:{}, stage:'value', steps:[], photos:[],
               status:'in-flight', why:null, started:'2026-10-10' }],
    series: [{ id:'series_2', name:'Quiet Architecture', target:8, done:2,
               constraint:'three values, no figures' }],
    tasteSnapshots: [{ date:'2026-10-17', top:['architectural','environment'] }]
  },
  arc: { id:'arc_1', focusSkill:'value-structure', series:'series_2',
         active:['piece_18'], started:'2026-10-17', reviewDue:'2026-11-28' },
  sessions: [{ id, date, lane:'continue', piece:'piece_18', minutes:22,
               effort:2, medium:'D', steps:[{ goal, doneWhen, cue, escape, outcome }],
               distilled:'Flat shadow mass landed; drifted into window detail twice.',
               nextSentence:'Windows — properly. Pick one, finish it, stop.',
               win:'Contrast placed once at the doorway and left alone.' }],
  prefs: { chattiness:'normal', voice:{ tts:true, pushToTalk:true },
           silenceNudgeMin:8, theme:'system', spendCapUsd:8 }
}
```

Export / import / clear in settings, same as Ignite, because device-local data without
an export is data you will eventually lose.

---

## 12. Risks

| Risk | Why it's real | Mitigation |
|---|---|---|
| **It talks too much and breaks flow** | The most likely way a real-time companion fails | Silence by default, triggered speech only, dial + "shush" (§6.2) |
| **Praise inflation destroys trust** | A companion that likes everything is worthless as an advisor | One-note rule, specificity requirement, never praise the unseen, periodic bluntness audit |
| **It becomes another abandoned productivity app** | You have the receipts on this one | 10-second Beat 1, the Hang Out lane, touches-not-days, no setup screens, no shame mechanics |
| **Over-planning a piece** | A 14-step ladder is procrastination in a trench coat | Hard cap: 3 steps ahead, generated adaptively |
| **iOS Safari speech gaps** | `SpeechRecognition` is unreliable there | Text-first design; voice is enhancement, never requirement |
| **Cost runaway** | One chatty 90-min session could spike a month | Haiku default, image downscale, Firestore spend ledger with hard cap, Console limit |
| **Memory rot** | A Compass that no longer describes you makes every suggestion subtly wrong | Quarterly Compass review; ledger levels require evidence |
| **Critique misreads the photo** | Bad lighting, WIP ambiguity | The "Read" beat first, so you catch it before acting on it |
| **Scope creep into Spark/Ignite territory** | Tempting; they're right there | Hard rule: Hearth links and reads, never duplicates (§3) |
| **Three apps, no glue, nothing used** | The real end-state risk | Hearth *is* the glue; if Phase 4 integration doesn't land, Hearth is just a chatbot |

---

## 13. Open questions

None block Phase 0 or Phase 1.

1. **Name.** "Hearth" is my suggestion — fire family, means the place you sit beside
   while you work. Ember/Kindle/Blaze/Inferno are taken by Ignite's effort tiers.
2. **Firebase project.** New project for `hearth/` (my recommendation, matching Ignite's
   intended end-state), or reuse `petulent-princess-productivity`?
3. **How blunt should critique be?** On a 1–5 from "gentle" to "brutal," where do you
   want it by default — and should it shift when you say "be honest with me"? I'd
   default to 3 with a "go hard" command, but this is a taste call and it matters more
   than most settings here.
4. **Phone OS** — iOS or Android? Decides whether voice input works on the phone at all
   (§8.1), and therefore how much Phase 2 can promise for traditional-drawing sessions.
5. **Should Hearth ever assign tasks itself**, or always hand off to Ignite? I'd keep
   assignment in Ignite and have Hearth request from it — one source of truth for the
   task bank.
6. **Ignite's home.** Its CONTEXT.md says it should move to its own repo and Firebase
   project. Worth doing before Hearth starts reading its data, so the integration is
   written against the final shape.

---

## 14. What to do next

1. **Run Phase 0.** One sitting, 90 minutes, no code. It's the highest-value hour in
   this whole plan and it pays off even if nothing else gets built.
2. Answer the §13 questions that have opinions attached — especially #3.
3. Then Phase 1, scoped exactly as written: text only, five beats, one piece.

