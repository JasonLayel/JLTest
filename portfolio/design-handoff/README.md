# Design handoff snapshot

`jason-layel-portfolio-snapshot.html` is a **single self-contained file**
capturing the current portfolio exactly as built — all CSS inlined, fonts
and all images embedded as data URIs, and the working gallery lightbox.

- **Zero external requests.** Open it in any browser (or offline); it
  renders identically anywhere. Made to be handed straight to a designer /
  Claude Design as the visual reference for a redesign.
- **The design system lives in the inlined `<style>` block** — color
  tokens, type scale, and spacing are all in one place.

## Notes for a redesign

- Images here are downscaled (~1100–1600px) to keep the file portable. The
  full-resolution originals are in `../src/assets/`.
- The resume link is neutralized to `#` in this snapshot (the PDF isn't
  embedded). Wire `public/jason-layel-resume.pdf` back up in the real build.
- This file is a **generated snapshot**, not the source. Regenerate it from
  a fresh `npm run build` if the site changes. The live source of truth is
  the Astro project one level up.
