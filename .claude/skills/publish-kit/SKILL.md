---
name: publish-kit
description: >
  Turn one finished piece (render, animation, drawing, asset pack) into its
  complete publishing tail: marketplace listing, ArtStation description,
  Instagram caption, X post, YouTube Shorts script, and optional print-listing
  copy. Usage: /publish-kit <describe the piece>, or /publish-kit with images
  attached. Jason makes the piece once; this makes the ten shadows it casts.
---

You are producing the full content tail for ONE finished piece by Jason
Layel, architectural visualization lead (UE5/D5/Twinmotion/Blender) who
also does traditional drawing/painting. Read `advisor/PROFILE.md` for voice
and context, and `advisor/PLAYBOOK.md` for current platform strategy.

## Intake: need these 5 facts (ask only for what's missing, once)

1. **What is it?** (e.g. "UE5 modern kitchen interior, 6 stills + 20s flythrough")
2. **Tools used** and any notable technique
3. **One interesting thing**, what was hard, learned, or unusual about it
4. **Where is it going?** (portfolio only / marketplace product / print), 
   determines which outputs to generate
5. **Link targets** (store URL, portfolio URL) if any exist yet

If images are attached or paths given, look at them, describe what's
actually in the frame, not generic viz language.

## Outputs

Write all files to `content/<piece-slug>/` (create it), one file per output,
then list what was created. Generate only the outputs that match where the
piece is going:

- `listing.md`, marketplace listing (if it's a product): SEO title built for
  search ("UE5 Modern Kitchen Interior Archviz Scene, PBR, 4K"), tag list,
  feature bullets (specs: poly counts, texture res, engine version, what's
  included), short + long description. Verify current category/tag
  conventions on the target marketplace with WebSearch if unsure.
- `artstation.md`, project title + description for ArtStation: confident,
  craft-focused, mentions tools, ends with store/portfolio link line.
- `instagram.txt`, caption for @juice.served (traditional work) or main
  feed (3D): hook first line, 2 to 3 short lines, then hashtag block
  (8 to 15 niche tags, not #art #love).
- `x.txt`, one post, under 260 chars, written like a peer in the
  archviz/UE5 community, not a marketer. Optionally a 2 to 3 post thread if
  there's a real process story.
- `shorts-script.md`, 15 to 30s short-form video script (if there's motion or
  process footage): shot list with timings + on-screen text + one-line CTA.
- `print.md`, print listing copy for INPRNT/Displate (only for pieces that
  work as wall art).

## Voice rules

- **Never use em-dashes or en-dashes (the long dash) in any generated copy.** Jason
  treats the long dash as an AI tell. Use commas, colons, parentheses, or
  separate sentences. Hyphens in compounds ("real-time") are fine.
- Professional peer, not influencer. No "🔥 SMASH that follow", no
  breathless adjectives. Confidence through specificity: name the technique,
  the light source, the reference.
- Never oversell: if it's a study, call it a study.
- Never imply MG2/client work is his personal product. If the piece
  description sounds like day-job work, stop and flag it instead of writing
  copy for it.
- Titles on stores are search queries; titles on ArtStation/IG are art
  titles. Don't mix the two registers.

## After generating

Suggest (don't nag): one line noting the piece should also go into the
portfolio-site queue if it's portfolio-grade. Append one dated line to
`advisor/LOG.md` recording that a publish kit was generated for this piece.
