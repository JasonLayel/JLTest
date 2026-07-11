/* ─────────────────────────────────────────────────────────────
   YOUR PORTFOLIO — edit this file to add or remove work.

   1. Drop your image or video file into the  media/  folder.
   2. Add an entry to the top of the list below (newest first).
   3. Delete an entry to remove it from the site. That's it.

   Fields:
     type    "image" or "video"
     src     path to the file, e.g. "media/my-render.jpg"
     title   shown in the lightbox and on hover
     detail  optional — tool / year / short note
     span    optional — "wide" or "tall" to make a piece larger
     poster  optional (videos only) — a still image shown before play
   ───────────────────────────────────────────────────────────── */

const WORKS = [
  {
    type: "image",
    src: "media/placeholder-01.svg",
    title: "Monolith Study",
    detail: "Blender · Cycles · 2026",
    span: "wide",
  },
  {
    type: "image",
    src: "media/placeholder-02.svg",
    title: "Chromatic Field",
    detail: "Houdini · Redshift · 2026",
  },
  {
    type: "image",
    src: "media/placeholder-03.svg",
    title: "Vessel 07",
    detail: "Cinema 4D · Octane · 2025",
  },
  {
    type: "video",
    src: "media/placeholder-loop.mp4",
    poster: "media/placeholder-04.svg",
    title: "Kinetic Loop",
    detail: "Motion study · 2025",
    span: "wide",
  },
  {
    type: "image",
    src: "media/placeholder-05.svg",
    title: "Terrain Fragment",
    detail: "World Machine · Blender · 2025",
  },
  {
    type: "image",
    src: "media/placeholder-06.svg",
    title: "Soft Machine",
    detail: "ZBrush · Keyshot · 2024",
  },
];

/* Site-wide text — edit to taste. */
const SITE = {
  name: "JASON LAYEL",
  tagline: "3D Artist — Renders, Motion, Worldbuilding",
  email: "jason.layel@gmail.com",
  footer: "© 2026 Jason Layel. All work shown is original.",
};
