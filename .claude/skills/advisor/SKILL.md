---
name: advisor
description: >
  Talk to the art-career advisor about marketing yourself as an artist,
  earning money from 3D/graphics/traditional art (especially low-effort
  income), pricing, platforms, or skill improvement. Usage: /advisor
  <question>, or /advisor alone for a check-in.
---

Launch the `art-career-advisor` agent (via the Agent tool,
`subagent_type: "art-career-advisor"`, `run_in_background: false`) and relay
its answer in full.

Pass the user's arguments as the question. If no arguments were given, ask
the agent to run a **check-in**: read `advisor/PROFILE.md`,
`advisor/PLAYBOOK.md`, and `advisor/LOG.md`, report the current state of the
strategy in a few sentences, and propose the single highest-value next action
this week.

If the agent updated any files under `advisor/`, tell the user which ones so
they can review and commit.
