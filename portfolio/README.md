# Jason Layel — Portfolio

Static portfolio site for design visualization work. Built with
[Astro](https://astro.build): zero JavaScript shipped to the browser, no
external requests (fonts are self-hosted), no analytics, no model calls —
pure static HTML/CSS output.

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

## Adding content

See [CONTENT-GUIDE.md](./CONTENT-GUIDE.md) for every open content slot.
The short version:

- **Images** — drop files into `src/assets/work/` and `src/assets/about/`
  using the exact filenames printed inside each dashed "image slot" box on
  the site. The build picks them up automatically and generates optimized
  responsive variants; no code changes needed.
- **Case studies** — edit the four files in `src/content/work/`. Replace the
  `<div class="slot">` blocks with real prose, fill in the frontmatter
  (`title`, `summary`, `year`, `role`, `tools`), and set `isSlot: false`.
  Add a new `.md` file to add a new project.
- **Text slots** — anything in a dashed box labeled `// content slot` is a
  visible TODO. Search the codebase for `class="slot"` to find them all.

## Deployment (free hosting)

The site is a plain static build — any static host works. Two good free
options:

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
│   ├── assets/             # images (auto-optimized; drop files here)
│   ├── components/         # Nav, Footer, WorkCard, ImageSlot
│   ├── content/work/       # case studies (Markdown + frontmatter)
│   ├── content.config.ts   # case study schema
│   ├── layouts/Base.astro  # head, fonts, nav, footer
│   ├── pages/
│   │   ├── index.astro     # single-page home (hero/work/capabilities/about/contact)
│   │   └── work/[slug].astro  # case study template
│   └── styles/global.css   # design system
└── public/                 # served as-is (favicon, resume PDF)
```
