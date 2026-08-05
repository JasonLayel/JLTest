# Log — experiments and results

Append-only. Newest entries at the top. The advisor uses this to learn what
works for Jason specifically and to avoid repeating failed advice.

Format: `## YYYY-MM-DD — short title`, then a few lines: what was done,
what happened, what it changes.

---

## 2026-08-04 — About photos live; site is send-ready

Jason uploaded his headshot + a family photo via GitHub web upload
(learned: the portfolio/ tree only exists on the cool-wright branch, so
GitHub's default master view hid the folder — direct branch links solve
it). Two-column About now renders: headshot primary portrait, family
photo secondary. Confirmed working/live. The site is now genuinely
send-ready to recruiters (cleared imagery, polished About, noindex,
custom domain). Remaining, in priority order: (1) three case studies —
the top credibility lever for a leadership hire, advisor to draft with
Jason; (2) EOW stills + XR video (stills auto-load, video needs wiring).

## 2026-08-04 — Portfolio content tweaks (pre-send polish)

Round of site tweaks on Jason's request: stills now click-to-zoom
(dependency-free lightbox); removed the dashed description slots; About
rewritten much shorter and recruiter-focused for a viz-LEADERSHIP hire
(creativity + design chops + pipeline/workflow depth + scaling across a
450-person firm), unified to one body font size; added a Behance link.
Hid the Work/case-studies and XR/VR/AR sections (no real content yet) —
kept as PHASE 2 comments so they restore with an uncomment; case-study
pages stop generating while entries are slots. Note: the OTHER session is
actively editing this same branch (pushed font/type-scale commits mid-
edit) — rebased cleanly, but two-session churn on `cool-wright` is a live
coordination risk. Current visible sections: Stills, Cinematics, About,
Contact. Pending EOW: more stills + video (restores XR).

## 2026-08-04 — Portfolio site building & deploying on Cloudflare

Site now builds and deploys via Cloudflare Workers (static-assets flow, not
Pages — CF funnels static sites through Workers now). Committed
`portfolio/wrangler.jsonc` (assets-only, ./dist) and added `noindex` to
Base.astro. Two gotchas that cost rounds, recorded so we don't repeat them:
(1) CF Workers root-directory field wants a LEADING SLASH — `/portfolio`,
not `portfolio`; (2) the dashboard Worker name must exactly match the
`name` in wrangler.jsonc (`jasonlayel-portfolio`). Live on
`*.workers.dev`. Remaining: attach custom domain jasonlayel.com; then the
content work (case studies, imagery clearance, portrait, XR video).

## 2026-07-14 — Found the near-complete portfolio site

Jason revealed a portfolio site is already built in a separate Code session
and committed to this repo on branch `claude/cool-wright-ys0p7w`
(`portfolio/`, Astro). Reviewed it: genuinely strong — correct external-
offers positioning, 21 stills, full About/timeline, resume, one film. Open
items: 3 case-study slots, XR placeholder, portrait image, `site:` domain
config. Flagged the key risk: several still filenames look like real MG2/
client projects → provenance must be cleared before PUBLIC launch, tying
straight back to Jason's stated NDA concern. Domain purchased (name still
needed). Advisor memory (PLAYBOOK) updated to treat the site as near-done,
not unstarted.

## 2026-07-12 — Priorities chosen: portfolio site + publish-kit

Jason confirmed the comp case at MG2 was already played (2025 → $92K); next
raise lever is competing external offers, which makes the public portfolio a
career tool as well. Chose to immediately pursue: (1) Claude-built portfolio
site on GitHub Pages + own domain, replacing Wix; (2) content-multiplication
pipeline — `/publish-kit` command created. Jason's inputs still needed for
the site: domain purchase, 10–15 curated pieces with titles/blurbs, bio,
contact preference, MG2 policy email.

## 2026-07-11 — Portfolio rebuild declared standing priority #1

Jason flagged: portfolio is in rough shape and a priority (serves career
jumps + side work), and he can't confidently use MG2 renderings/animations
because the show/post rules are unclear. Agent updated with a portfolio-
rebuild mandate: written-permission-first framework for day-job work, no
workarounds, and a dual/triple-purpose strategy for personal pieces
(portfolio + marketplace product + content). Next concrete step recorded in
PLAYBOOK: email MG2 principal/HR for the portfolio policy, then run an
inventory/audit session with the advisor.

## 2026-07-11 — Profile filled in from Jason's career details

Jason provided LinkedIn screenshots, all platform links, salary, preferred
tools, and side-income history. PROFILE.md rewritten with real data; agent
prompt re-tuned from "generic artist" to "professional archviz lead with
real-time engine specialty." Two prior experiments recorded: Upwork (worked,
~$4K/yr peak, dormant) and TeePublic tees (failed, account deactivated).
Remaining unknowns: hours/week, income target, on-camera comfort, home
hardware, MG2 moonlighting policy.

## 2026-07-10 — Advisor created

Initial setup. Agent, profile, playbook, and log created. No experiments run
yet. Next step: Jason fills in `advisor/PROFILE.md`, then runs `/advisor` for
the first strategy session.
