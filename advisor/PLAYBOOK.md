# Playbook — current strategy

Maintained by the art-career-advisor agent. This is the single source of
truth for what we're pursuing and why. Anything not listed here is
deliberately *not* being pursued right now.

_Last updated: 2026-07-12 (immediate priorities chosen: portfolio site +
publish-kit pipeline)_

## Immediate priorities (chosen 2026-07-12)

1. **Portfolio site** — Claude-built static site on GitHub Pages with
   Jason's own domain, replacing Wix. Doubles as the external-offer
   career tool (comp case at MG2 already played in 2025; next raise comes
   from competing offers). Checklist lives in the 2026-07-12 LOG entry.
2. **Publish-kit pipeline** — `/publish-kit` command built; every finished
   piece gets its full content tail (listing, ArtStation, IG, X, Shorts
   script, print copy) generated in one pass into `content/<slug>/`.

Comp/promotion case at MG2: DONE (2025, produced the $92K raise). Not
repeatable soon — do not re-recommend.

## Active income streams

_None active yet. First advisor session should pick one passive stream to
test — the strongest candidates given the profile are archviz asset/scene
packs (Fab, Blender Market) or D5/Twinmotion ecosystem content._

| Stream | Effort type | Status | Started | Verdict criteria |
| --- | --- | --- | --- | --- |
| Upwork 3D rendering | Active | Dormant — proven at ~$2–4K/yr for 2 years, then stopped | ~2018 era | Revive only at a high rate floor and after the moonlighting question is settled |

## Portfolio site — standing priority #1 (MUCH FURTHER ALONG than thought)

A near-complete portfolio site already exists, built in a separate Code
session. As of 2026-07-14 it lives in this same repo on branch
**`claude/cool-wright-ys0p7w`**, in the `portfolio/` subdirectory.

- **Stack:** Astro static site, zero JS shipped, self-hosted fonts, no
  external calls. Dark editorial design system in `src/styles/global.css`.
- **Positioning:** aimed squarely at the external-offers / career audience
  (hero: "I make unbuilt architecture feel real… one-person Visualization
  Technology department at MG2"; contact: "open to the right role"). This is
  correct — next raise comes from competing offers, so the site IS the tool.
- **Already done:** 21 stills in the gallery; full About + career timeline;
  tool strip; resume PDF; contact links (email, LinkedIn, ArtStation); one
  Vimeo film embedded; brand/logo pack; favicon.
- **Open slots (visible dashed boxes, nothing fake-filled):**
  - 3 case studies still in slot state (`isSlot: true`) — Rendering,
    Film Cinematics, Interactive — need real brief→approach→outcome prose
    + frontmatter + hero images.
  - XR/VR/AR section is a placeholder (needs a Vimeo id + poster).
  - Featured film needs a real title/description.
  - About portrait image missing (`src/assets/about/portrait.jpg`).
  - `astro.config.mjs` `site:` still needs the real domain.
- **Imagery provenance — RESOLVED (2026-08-04).** Jason confirms all 21
  current stills are cleared to send. The big launch blocker is gone; the
  site is safe to share with recruiters. (A formal MG2 written policy is
  still worth having on file for future additions, but no longer gates the
  current site.)
- **Pending content drop — end of week (~2026-08-08):** more images + video
  coming. Stills drop into `portfolio/src/assets/stills/` (auto-appear in
  gallery). Video goes into the Cinematics and/or XR sections as Vimeo
  embeds (`<VimeoFilm vimeoId="..." poster="stills/....png" />` in
  `index.astro`). Advisor/other session to wire these when they arrive.
- **Coordination:** two sessions now touch this repo. This (advisor) session
  owns strategy/content/deploy guidance; the other session owns the site
  build. Don't push to `claude/cool-wright-ys0p7w` without coordinating.
- **Domain:** purchased (exact name still TBD — ask Jason).
- **Launch decisions (2026-07-14):**
  - **Visibility = public but noindex** — live at the domain, shareable by
    direct link, but a `<meta name="robots" content="noindex">` in
    `Base.astro` keeps it out of search. Correct while employed at MG2 and
    quietly seeking offers. Revisit (remove noindex) once he's ready to be
    openly on the market.
  - **Host = Cloudflare Pages** — base dir `portfolio`, build `npm run
    build`, output `dist`. Move domain nameservers to Cloudflare for clean
    DNS + SSL.
  - Remaining pre-launch edits (need permission to touch
    `claude/cool-wright-ys0p7w`, or hand to the other session): add noindex
    meta to `Base.astro`; set `site:` in `astro.config.mjs` to the domain.

## Marketing

- Portfolio home: **ArtStation** (already his most-posted platform) — needs
  curation pass; everything else should point here.
- Posting cadence: _not decided_
- Niche / identity: professional archviz + real-time (UE5/D5/Twinmotion),
  with traditional drawing/painting as a parallel lane on @juice.served.
- Cleanup queue: Wix site outdated, Behance stale, LinkedIn dormant, X
  account exists but has never posted.

## Pricing notes

- Rate floor for any active freelance: roughly $60–90+/hr equivalent —
  he leads a firm's viz department; don't compete at commodity rates.

## Skill plan

_Not set. Candidates: cinematic sequencing/editing polish, presentation/
composition, keep feeding traditional practice._

## Parked ideas (considered, not now)

- **Generic print-on-demand merch (t-shirts)** — tried on TeePublic, no
  traction, account mysteriously deactivated. Do not revisit without a
  specific new angle. (Art prints via INPRNT/Displate remain open — that's a
  different product.)
