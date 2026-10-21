# Working in this repo

## Who this is for

Jason. Windows PC, Android phone. These preferences are not style notes, they
are requirements, and they have been got wrong before.

## Writing instructions for him

**Never say "open a terminal", "run this command", or "from the project
folder" and leave it there.** That is the exact failure to avoid. If a step
needs a terminal, either:

1. **Wrap it in a double-click launcher** (`.bat`, CRLF endings, `cd /d
   "%~dp0"` at the top, `pause` at the end so the window stays open). This is
   the preferred answer and usually possible. Then the instruction is "double
   click `X.bat`".
2. Or, if a launcher genuinely cannot work, spell out the clicks: which
   folder, how to get a prompt open *in that folder*, what he will see, what
   to type, and what success looks like.

Other rules for any instructions:

- Say which steps are a **web page** and which are a **program on his PC**.
  Do not assume he knows which a given thing is.
- Give the **exact text** of buttons and menu items, and name the alternative
  wordings when a product has renamed things between versions.
- Say what he should **see** after each step, so he can tell whether it worked.
- Put the likely failures in a troubleshooting section with the exact fix, not
  a description of the problem.
- One step per step. Do not fold three actions into a sentence.
- **His PC does not have these files.** This repo lives in a cloud container
  and on GitHub. Never tell him to open, run or double-click something without
  first getting it onto his machine: send the file or a zip of the folder
  directly, and say where it lands and how to extract it. "The `hearth`
  folder" means nothing until he has one.

## Tone

- Plain. **No em dashes.** Contractions are fine.
- Direct feedback. Say when something is wrong or when an idea is weak, and
  say why. Do not soften it into mush.
- Do not pad with apology or preamble.

## Verify, do not recall

Product UI moves faster than training data. Before writing steps for the
Firebase console, Google Cloud, ComfyUI, Anthropic console or any other
third-party product, **check the current documentation** rather than writing
from memory. Name both the old and new menu paths when they have changed.

## Technical conventions

- Vanilla HTML/CSS/JS. No framework, no build step, no npm dependencies in the
  app itself. Firebase Cloud Functions may have dependencies.
- API keys stay server-side, always. Firebase secrets, never the client.
- Anything that must run on Windows must not use shell tools that only exist
  on Unix. No `cp`, `rm`, `mv` in predeploy hooks or scripts. Use Node.
- Local-first: `localStorage` for state, sync on top, export/import always
  available.
- Every app folder stays self-contained, ready to move to its own repo.

## Projects here

- `hearth/` is the art advisor companion. `hearth/SETUP.md` is the setup path,
  `hearth/PLAN.md` the plan, `hearth/compass.md` the profile it runs on.
- The repo root is an unrelated to-do app (Petulant Princess Productivity).

There is a separate companion-sim project on his PC, not in this repo. Its
`_profile.json` equivalent should eventually read from Hearth's shared
profile rather than keeping its own copy.
