# Content guide — every open slot

Everything below renders on the live site as a clearly-marked dashed box
until you fill it. Nothing is fake-filled; the structure is real.

## 0. Stills gallery — the easy drop zone

**Directory: `portfolio/src/assets/stills/`** — every image dropped here
appears in the "Stills" section automatically on the next build. Use
descriptive kebab-case filenames (`arts-center-dusk.jpg`); they become the
captions. Twenty renderings are already in.

The gallery is pure imagery — filenames become alt text only, so
descriptive names still matter for accessibility and SEO.

**Page hero backdrop** is `tree-art-final-small` (with a scroll-driven
parallax zoom). To swap it, change the stem in `src/pages/index.astro` and
the `EXCLUDED` list in `StillsGallery.astro` so it doesn't also appear in
the grid. **Full-width features:** add a stem to `FEATURED` at the top of
`StillsGallery.astro` to render it full-width above the grid.

**Logo:** `src/assets/brand/logo.png` is the header mark (auto-picked-up;
swap the file to change it). All other logo variants live in
`src/assets/brand/`; `mark-solid.png` is also the favicon
(`public/favicon.png`).

**Cinematics & XR/VR/AR:** both are Vimeo click-to-play embeds in
`src/pages/index.astro` (`<VimeoFilm vimeoId="..." title="..."
poster="stills/....png" />`). Cinematics has one film in (title/description
still an open slot). XR/VR/AR is a placeholder — give its `<VimeoFilm>` a
`vimeoId` and `poster` to activate it. Send more Vimeo links + poster
frames to grow either section.

## 1. Images (just drop files in — no code changes)

| File | Used on | Spec |
|---|---|---|
| `src/assets/work/rendering-hero.jpg` | Work card + case study hero | ≥ 2400px wide, your best still |
| `src/assets/work/vr-ar-hero.jpg` | Work card + case study hero | ≥ 2400px wide (headset session photo or engine capture) |
| `src/assets/work/film-cinematics-hero.jpg` | Work card + case study hero | ≥ 2400px wide (a signature film frame) |
| `src/assets/work/interactive-hero.jpg` | Work card + case study hero | ≥ 2400px wide (UI in context) |
| `src/assets/about/portrait.jpg` | About section | ≥ 1200px wide, 4:5-ish crop |

JPG, PNG, or WebP all work. Astro generates optimized responsive versions
at build time.

## 2. Case studies — `src/content/work/*.md`

Three structured slot files exist — 3D Rendering, 3D Film Cinematics & Editing, and Interactive Experiences (VR/AR/XR lives in its own video section instead). They stack vertically in the Work section. For each:

1. Frontmatter: real `title`, one-line `summary`, `year`, `role`,
   `tools: ['...', '...']`, and flip `isSlot: false`.
2. Body: replace the three `<div class="slot">` blocks with real prose
   following the same shape — **brief → approach → outcome**.
3. Extra images: add files to `src/assets/work/` and reference them in the
   Markdown with standard image syntax, e.g.
   `![caption](../../assets/work/rendering-01.jpg)`.

Respect NDA/ownership: for MG2 project work, confirm you can publish the
imagery, and credit the firm where appropriate.

## 3. Text slots on the home page — `src/pages/index.astro`

- ~~Tooling list~~ — done, from resume.
- ~~Resume details~~ — done: career timeline + linked PDF at
  `public/jason-layel-resume.pdf`.
- ~~Contact links~~ — done: LinkedIn + ArtStation + resume.

## 4. Config

- `astro.config.mjs` → set `site:` to your real domain before deploying.
