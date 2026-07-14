# Jason Layel — Portfolio

Portfolio site for architectural visualization work. Built with
[Astro](https://astro.build) as a fully static single page: self-hosted
fonts, no analytics, no external requests. The only JavaScript on the page
is the gallery lightbox (a few dozen lines, inlined at build).

## Local development

```bash
cd portfolio
npm install
npm run dev        # http://localhost:4321
```

```bash
npm run build      # static output in dist/
npm run preview    # serve the built site locally
```

Requires Node 20+.

## Adding or reordering work

1. Drop the render into `src/assets/stills/` with a descriptive kebab-case
   filename (`arts-center-dusk.jpg`).
2. Add one line to the `sequence` array at the top of
   `src/components/Gallery.astro` with the title, tag, and grid width
   (`full`, `half`, or `third`).

Files in `stills/` that aren't listed in `sequence` still appear at the end
of the grid at half width, with a caption derived from the filename — so
step 2 is optional but recommended. Astro generates optimized responsive
variants for everything at build time.

Other content homes:

- **Hero image** — `src/pages/index.astro` imports
  `stills/arts-center-dusk.jpg`; swap the import to change it.
- **Logo** — the header uses `src/assets/brand/logo.png`. Alternate marks
  and lockups live in `src/assets/brand/`.
- **About image** — `src/assets/about/tree-art.jpg`.
- **Resume** — `public/jason-layel-resume.pdf` (linked from About and
  Contact).
- **Copy** — hero, capabilities, timeline, about, and contact text all live
  in `src/pages/index.astro`.

## Deployment (free hosting)

The site is a plain static build — any static host works.

### Cloudflare Pages / Netlify (recommended)

Connect the repo, then set:

- **Base directory:** `portfolio`
- **Build command:** `npm run build`
- **Output directory:** `dist`

Set `site` in `astro.config.mjs` to your final URL. Custom domains are free
on both.

### GitHub Pages

1. In `astro.config.mjs`, set `site` to
   `https://<username>.github.io` and add `base: '/<repo-name>'` (skip
   `base` if using a custom domain or a `<username>.github.io` repo).
2. Use the official [Astro deploy action](https://docs.astro.build/en/guides/deploy/github/)
   with `path: ./portfolio` as the working directory.

## Project structure

```
portfolio/
├── astro.config.mjs        # site URL / base path
├── src/
│   ├── assets/
│   │   ├── stills/         # the work — gallery images
│   │   ├── brand/          # logo marks and lockups
│   │   └── about/          # about-section imagery
│   ├── components/         # Nav, Footer, Gallery (grid + lightbox)
│   ├── layouts/Base.astro  # head, meta/OG tags, fonts, nav, footer
│   ├── pages/index.astro   # the whole site: hero/work/capabilities/about/contact
│   └── styles/global.css   # design tokens and shared styles
└── public/                 # served as-is (favicon, og image, resume PDF)
```
