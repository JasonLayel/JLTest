# Content guide — every open slot

Everything below renders on the live site as a clearly-marked dashed box
until you fill it. Nothing is fake-filled; the structure is real.

## 1. Images (just drop files in — no code changes)

| File | Used on | Spec |
|---|---|---|
| `src/assets/work/rendering-hero.jpg` | Work card + case study hero | ≥ 2400px wide, your best still |
| `src/assets/work/vr-ar-hero.jpg` | Work card + case study hero | ≥ 2400px wide (headset session photo or engine capture) |
| `src/assets/work/reality-capture-hero.jpg` | Work card + case study hero | ≥ 2400px wide (point cloud / mesh view reads great) |
| `src/assets/work/interactive-hero.jpg` | Work card + case study hero | ≥ 2400px wide (UI in context) |
| `src/assets/about/portrait.jpg` | About section | ≥ 1200px wide, 4:5-ish crop |

JPG, PNG, or WebP all work. Astro generates optimized responsive versions
at build time.

## 2. Case studies — `src/content/work/*.md`

Four structured slot files exist, one per discipline. For each:

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

- **Tooling list** (capabilities section): your real software/hardware
  stack. Will render as a mono-type strip.
- **Resume details** (about section): paste resume text; becomes a career
  timeline. Also drop a PDF at `public/jason-layel-resume.pdf`.
- **Contact links**: LinkedIn / ArtStation / Vimeo / etc. URLs.

## 4. Config

- `astro.config.mjs` → set `site:` to your real domain before deploying.
- `src/components/Footer.astro` → add a location line if you want one.
