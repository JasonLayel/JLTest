# Content guide — every open slot

Everything below renders on the live site as a clearly-marked dashed box
until you fill it. Nothing is fake-filled; the structure is real.

## 0. Stills gallery — the easy drop zone

**Directory: `portfolio/src/assets/stills/`** — every image dropped here
appears in the "Stills" section automatically on the next build. Use
descriptive kebab-case filenames (`arts-center-dusk.jpg`); they become the
captions. Twenty renderings are already in.

**Full-width features:** filenames listed in `FEATURED` at the top of
`src/components/StillsGallery.astro` render full-width above the grid.
Currently: `arts-center-dusk`, `tree-art-final-small` (the latter renders
as soon as a file with that name lands in the stills directory).

**Logo:** drop a file at `src/assets/brand/logo.svg` (or `.png`/`.webp`)
and it replaces the JL&#9679; text mark in the header automatically.

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

Four structured slot files exist, one per discipline (3D Rendering, 3D Film Cinematics & Editing, VR/AR/XR, Interactive Experiences). For each:

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
