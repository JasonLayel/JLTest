# 🎧 Loop Metronome

A cute, self‑contained web metronome that plays a soft click/pop at a chosen tempo — and can **randomize itself** so it throws you for a loop: stretches of relatively constant beats, mixed with tempo that wanders or goes completely wild.

Everything runs locally in your browser. No installs, no accounts, no internet required.

## Use it

Just open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge — desktop or mobile).

- Press **▶ Start** (or the **Space** bar) to begin.
- Tap the **🔊** button any time to preview the current click sound.

> Browsers only allow audio after a click/tap, so the first sound happens when you hit Start or preview.

## The controls

| Control | What it does |
| --- | --- |
| **⏱️ Stretch length** (dual handles, 0–60 s) | Every groove is held for a **random time between the two handles** before it changes. The left handle is the shortest a stretch can be, the right handle is the longest — so you get a natural mix of short and long passages inside your bounds. Set both handles to the same spot for a fixed length, or both near `0` to reroll every beat. |
| **🎢 Drift within a stretch** (dual handles, None → Big) | Each stretch rolls a **random drift strength between the two handles** — how much the tempo speeds up or slows down while it plays out. The left handle is the calmest it can be, the right handle the wildest. Direction (accelerate vs. decay) is chosen at random each stretch. Set both to the far left for zero drift. |
| **🎯 Tempo range** (dual handles) | Fence in the tempo. Drag the two handles to set the **floor** (it will never drop below) and the **ceiling** (it will never rise above). A narrow range feels controlled; a wide range invites big jumps. |
| **🎨 Sound** | Pick the voice: **Pop** (round & cute), **Woodblock**, **Tick** (crisp digital), or **Beep**. |
| **🔈 Volume** | Output level. |

All three ranges use the same two‑handle slider — push and pull each end to set its floor and ceiling.

Your settings are remembered between visits (saved in the browser).

## Presets

One tap loads a vibe; tweak any slider afterward to make it your own.

- 🧘 **Steady** — basically a normal metronome, ~96 BPM, no surprises.
- 🌊 **Calm** — gentle randomization that stays in a comfortable pocket (70–112 BPM).
- 🍃 **Wander** — noticeably restless; wider range and more frequent changes.
- 🌪️ **Chaos** — throws the tempo all over the place: short stretches, wide range (42–224 BPM), wild drift.

## The live view

- A big pulsing dial shows the **current BPM**, flashing on every beat.
- A badge tells you whether the current stretch is **↗ speeding up**, **↘ slowing down**, or **→ steady**, plus roughly how long until the next change.
- A rolling **graph** plots the tempo over the last ~30 seconds so you can watch the loops unfold, with the floor/ceiling drawn as guide lines.

## How the randomness works

The engine runs a little state machine. Each **stretch** gets:

1. **A length** picked at random between your two *Stretch length* handles — so stretches vary naturally instead of all being the same duration.
2. **A drift strength** picked at random between your two *Drift* handles — some stretches barely move, others ramp hard, depending on where you set the handles.
3. **A starting tempo** — with a probability that grows with that stretch's drift strength, it makes a wild jump anywhere inside your tempo range; otherwise it takes a gentle step from where it was (which feels continuous).
4. **A drift target** — using the stretch's drift strength it may ramp up, ramp down, or hold flat. The tempo interpolates smoothly from the stretch's start tempo to its target.

Every beat is clamped to your tempo range, so it always stays inside the fence you set. Timing uses the Web Audio clock with a look‑ahead scheduler, so beats stay accurate even while the tempo is changing.

## Files

- `index.html` — the entire app (HTML + CSS + JS in one file, no dependencies).

That's it. Open it and go. 💫
