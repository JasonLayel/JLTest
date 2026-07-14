/* Renders the gallery from works.js and runs the lightbox.
   You should never need to edit this file to add work. */

(function () {
  // ── Site text ──────────────────────────────────────────────
  document.getElementById("site-name").textContent = SITE.name;
  document.getElementById("site-tagline").textContent = SITE.tagline;
  document.getElementById("footer-text").textContent = SITE.footer;
  document.getElementById("contact-link").href = "mailto:" + SITE.email;
  document.title = SITE.name + " — " + SITE.tagline;

  // ── Build the grid ─────────────────────────────────────────
  const grid = document.getElementById("work");

  WORKS.forEach((work, i) => {
    const tile = document.createElement("figure");
    tile.className = "tile" + (work.span ? " " + work.span : "");
    tile.tabIndex = 0;
    tile.setAttribute("role", "button");
    tile.setAttribute("aria-label", "View " + work.title);

    let mediaEl;
    if (work.type === "video") {
      mediaEl = document.createElement("video");
      mediaEl.src = work.src;
      if (work.poster) mediaEl.poster = work.poster;
      mediaEl.muted = true;
      mediaEl.loop = true;
      mediaEl.playsInline = true;
      mediaEl.preload = "metadata";
      tile.addEventListener("mouseenter", () => mediaEl.play().catch(() => {}));
      tile.addEventListener("mouseleave", () => { mediaEl.pause(); mediaEl.currentTime = 0; });

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "MOTION";
      tile.appendChild(badge);
    } else {
      mediaEl = document.createElement("img");
      mediaEl.src = work.src;
      mediaEl.alt = work.title;
      mediaEl.loading = "lazy";
    }
    tile.prepend(mediaEl);

    const meta = document.createElement("figcaption");
    meta.className = "meta";
    meta.innerHTML = "<h3></h3><p></p>";
    meta.querySelector("h3").textContent = work.title;
    meta.querySelector("p").textContent = work.detail || "";
    tile.appendChild(meta);

    const open = () => openLightbox(i);
    tile.addEventListener("click", open);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });

    grid.appendChild(tile);
  });

  // ── Reveal on scroll ───────────────────────────────────────
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); observer.unobserve(e.target); }
    }),
    { threshold: 0.12 }
  );
  document.querySelectorAll(".tile").forEach((t) => observer.observe(t));

  // ── Lightbox ───────────────────────────────────────────────
  const lb = document.getElementById("lightbox");
  const stage = document.getElementById("lb-stage");
  const caption = document.getElementById("lb-caption");
  let current = -1;

  function openLightbox(i) {
    current = i;
    const work = WORKS[i];
    stage.innerHTML = "";

    let el;
    if (work.type === "video") {
      el = document.createElement("video");
      el.src = work.src;
      if (work.poster) el.poster = work.poster;
      el.controls = true;
      el.autoplay = true;
      el.loop = true;
      el.playsInline = true;
    } else {
      el = document.createElement("img");
      el.src = work.src;
      el.alt = work.title;
    }
    stage.appendChild(el);

    caption.innerHTML = "<strong></strong><span></span>";
    caption.querySelector("strong").textContent = work.title;
    caption.querySelector("span").textContent = work.detail || "";

    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lb.hidden = true;
    stage.innerHTML = "";
    document.body.style.overflow = "";
    current = -1;
  }

  const step = (d) => openLightbox((current + d + WORKS.length) % WORKS.length);

  document.getElementById("lb-close").addEventListener("click", closeLightbox);
  document.getElementById("lb-prev").addEventListener("click", () => step(-1));
  document.getElementById("lb-next").addEventListener("click", () => step(1));
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });

  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
})();
