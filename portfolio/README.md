# Jason Layel — Portfolio

A clean, dark, image-first portfolio for 3D renderings and motion work.
Pure HTML/CSS/JS — no build step, no dependencies. Deploy anywhere
(GitHub Pages, Netlify, Vercel, any static host).

## Adding or removing work

Everything lives in **`works.js`** — you never touch the HTML.

1. Drop your image (`.jpg`, `.png`, `.webp`) or video (`.mp4`) into `media/`
2. Add an entry to the top of the `WORKS` list in `works.js`:

```js
{
  type: "image",                 // or "video"
  src: "media/my-render.jpg",
  title: "My Render",
  detail: "Blender · Cycles · 2026",   // optional
  span: "wide",                        // optional: "wide" or "tall"
},
```

3. To remove a piece, delete its entry. Done.

Videos: set `type: "video"`, point `src` at your `.mp4`, and add a
`poster` still image. Videos play muted on hover in the grid and with
full controls in the lightbox.

> The current `media/placeholder-*.svg` files and the
> `media/placeholder-loop.mp4` path are stand-ins — replace them with
> your real work.

## Customizing text

Name, tagline, contact email, and footer are in the `SITE` object at the
bottom of `works.js`.

## Local preview

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Deploying to GitHub Pages

This portfolio lives in the `portfolio/` folder of the repo. Enable Pages
(Repo → Settings → Pages → deploy from branch → `master`, root folder) and
the site is live at `https://<user>.github.io/<repo>/portfolio/` in ~1 min.
