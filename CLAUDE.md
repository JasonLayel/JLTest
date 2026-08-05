# Working notes for this repo

## Writing style (STRICT, applies everywhere)

Never use em-dashes (—) or en-dashes (–) in anything delivered to Jason.
This applies to all rendered site copy, page titles, alt/aria text, code
comments, commit messages, and chat replies. Jason considers the long dash
a telltale sign of AI writing and wants it gone completely.

Use commas, colons, parentheses, or separate sentences instead. Regular
hyphens in compound words (e.g. "450-person", "real-time") are fine; only
the long dashes are banned. When in doubt, rewrite the sentence so no dash
is needed.

## Projects in this repo

- Root (`app.js`, `index.html`, etc.): "Petulant Princess Productivity", a
  local-first PWA to-do app. Lives on the `master` branch.
- `portfolio/`: Jason Layel's Astro portfolio site (design visualization),
  deployed to jasonlayel.com via Cloudflare. Lives on the
  `claude/cool-wright-ys0p7w` branch.
- `advisor/` + `.claude/` (on `claude/creative-marketing-advisor-g7mzai`):
  an art-career advisor agent, its `/advisor` and `/publish-kit` commands,
  and the memory files the advisor maintains.
