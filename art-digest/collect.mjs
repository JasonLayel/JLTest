#!/usr/bin/env node
/**
 * Digital Art Digest — collector.
 *
 * Pulls the most popular *new* digital art from ArtStation, Reddit, Pixiv and
 * DeviantArt, normalizes every post into one shape, ranks them across sources
 * and writes:
 *
 *   data/latest.json          the feed the widget reads
 *   data/archive/<date>.json  one snapshot per run, kept for history
 *   data/email.html           a ready-to-send HTML digest
 *
 * Zero dependencies, Node 20+. Runs in CI (see .github/workflows/art-digest.yml)
 * because the art sites are only reachable from an unrestricted network.
 *
 * Env knobs (all optional):
 *   ART_DIGEST_LIMIT          how many items to keep       (default 24)
 *   ART_DIGEST_WINDOW_HOURS   "new" cutoff                 (default 48)
 *   ART_DIGEST_SUBS           comma-separated subreddits
 *   ART_DIGEST_OUT            output directory             (default ./data)
 *   ART_DIGEST_PIXIV_PROXY    host that re-serves i.pximg.net thumbnails
 *   REDDIT_CLIENT_ID/SECRET   use Reddit's OAuth API instead of the public JSON
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  limit: int(process.env.ART_DIGEST_LIMIT, 24),
  windowHours: int(process.env.ART_DIGEST_WINDOW_HOURS, 48),
  outDir: resolve(process.env.ART_DIGEST_OUT || join(HERE, 'data')),
  subs: (process.env.ART_DIGEST_SUBS ||
    'Art,DigitalArt,ImaginaryLandscapes,ImaginaryCharacters,ConceptArt,SciFiArt,FantasyArt'
  ).split(',').map((s) => s.trim()).filter(Boolean),
  // i.pximg.net refuses hotlinks, so thumbnails go through a mirror that adds
  // the Referer Pixiv wants. Set to "" to drop Pixiv thumbnails entirely.
  pixivProxy: process.env.ART_DIGEST_PIXIV_PROXY ?? 'https://i.pixiv.re',
  siteUrl: 'https://petulent-princess-productivity.web.app/art-digest/',
};

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BOT_UA = 'art-digest/1.0 (+https://github.com/JasonLayel/JLTest)';

/* ------------------------------------------------------------------ utils */

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with a timeout and one retry on transient failures. */
async function get(url, { headers = {}, as = 'json', attempts = 3 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': BOT_UA, ...headers },
        signal: AbortSignal.timeout(25_000),
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return as === 'json' ? await res.json() : await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await sleep(1500 * attempt);
    }
  }
  throw new Error(`${new URL(url).host}: ${lastError?.message || 'request failed'}`);
}

/** First endpoint in the list that answers wins. */
async function getFirst(urls, options) {
  const errors = [];
  for (const url of urls) {
    try {
      return await get(url, options);
    } catch (err) {
      errors.push(err.message);
    }
  }
  throw new Error(errors.join(' | '));
}

const decodeEntities = (s = '') =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');

const clean = (s = '') => decodeEntities(String(s)).replace(/\s+/g, ' ').trim();

const https = (url) => (url ? String(url).replace(/^http:\/\//i, 'https://') : '');

const iso = (seconds) =>
  Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;

const compact = (n) =>
  n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

/**
 * A trimmed view of a raw row, recorded only when a source returns rows but
 * none survive normalizing — which means the site changed its response shape
 * and the digest needs a fix. Without it that failure is invisible.
 */
export function sampleShape(row, depth = 1) {
  if (row == null || typeof row !== 'object') return row;
  const out = {};
  for (const [key, value] of Object.entries(row).slice(0, 40)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = depth > 0 ? sampleShape(value, depth - 1) : '{…}';
    } else if (Array.isArray(value)) {
      out[key] = `[${value.length}]`;
    } else if (typeof value === 'string') {
      out[key] = value.length > 80 ? `${value.slice(0, 80)}…` : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** First non-empty value among several candidate paths. */
const pick = (...values) => values.find((v) => typeof v === 'string' && v.trim()) || '';

/* ---------------------------------------------------------------- sources */

/** Reddit: top posts of the day across the art subreddits. */
export function normalizeReddit(payload, subreddit = '') {
  const children = payload?.data?.children ?? [];
  return children
    .map((child) => child?.data)
    .filter(Boolean)
    .filter((p) => !p.over_18 && !p.stickied && !p.is_self)
    .map((p) => {
      const preview = p.preview?.images?.[0];
      const image =
        https(decodeEntities(preview?.source?.url || '')) ||
        (/\.(jpe?g|png|gif|webp)$/i.test(p.url_overridden_by_dest || '') ? https(p.url_overridden_by_dest) : '');
      const thumb =
        https(decodeEntities(preview?.resolutions?.slice(-2)[0]?.url || '')) ||
        (/^https?:/.test(p.thumbnail || '') ? https(p.thumbnail) : '') ||
        image;
      return {
        id: `reddit:${p.id}`,
        source: 'reddit',
        title: clean(p.title) || 'Untitled',
        artist: clean(p.author ? `u/${p.author}` : ''),
        artistUrl: p.author ? `https://www.reddit.com/user/${p.author}` : '',
        url: `https://www.reddit.com${p.permalink}`,
        image,
        thumb,
        value: Number(p.score) || 0,
        scoreLabel: `${compact(Number(p.score) || 0)} upvotes`,
        postedAt: iso(p.created_utc),
        context: clean(p.subreddit_name_prefixed || (subreddit && `r/${subreddit}`) || ''),
      };
    })
    .filter((item) => item.image || item.thumb);
}

/**
 * Reddit's Atom feed, used when the JSON API refuses the request — which it
 * does from datacenter IPs like GitHub's runners. The feed is ordered by top
 * of the day but carries no vote counts, so position is the only signal.
 */
export function normalizeRedditRss(xml, subreddit = '') {
  const entries = String(xml).split(/<entry>/).slice(1).map((b) => b.split(/<\/entry>/)[0]);
  const tag = (block, name) => {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
    return m ? clean(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')) : '';
  };

  return entries
    .map((block, index) => {
      const html = decodeEntities(
        (block.match(/<content[^>]*>([\s\S]*?)<\/content>/i) || [])[1] || ''
      );
      const image = (html.match(/<img[^>]+src="([^"]+)"/i) || [])[1] || '';
      const link = (block.match(/<link[^>]+href="([^"]+)"/i) || [])[1] || '';
      const author = tag(block, 'name').replace(/^\/u\//, '');
      const id = (tag(block, 'id').match(/t3_(\w+)/) || [])[1] || String(index);
      // A multireddit feed tags every entry with the subreddit it came from.
      const sub =
        subreddit ||
        (block.match(/<category[^>]+term="([^"]+)"/i) || [])[1] ||
        (link.match(/reddit\.com\/r\/([^/]+)/i) || [])[1] ||
        '';
      return {
        id: `reddit:${id}`,
        source: 'reddit',
        title: tag(block, 'title') || 'Untitled',
        artist: author ? `u/${author}` : '',
        artistUrl: author ? `https://www.reddit.com/user/${author}` : '',
        url: https(decodeEntities(link)),
        image: https(decodeEntities(image)),
        thumb: https(decodeEntities(image)),
        value: Math.max(1, entries.length - index),
        scoreLabel: `#${index + 1} top today${sub ? ` in r/${sub}` : ''}`,
        postedAt: (() => {
          const d = new Date(tag(block, 'updated') || tag(block, 'published'));
          return Number.isNaN(d.valueOf()) ? null : d.toISOString();
        })(),
        context: sub ? `r/${sub}` : '',
      };
    })
    .filter((item) => item.url && item.image);
}

/** App-only OAuth token, when repository secrets provide credentials. */
async function redditToken() {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) return null;
  const auth = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString('base64');
  try {
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': BOT_UA,
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    return (await res.json()).access_token || null;
  } catch {
    return null;
  }
}

async function collectReddit(cfg) {
  const token = await redditToken();
  const multi = cfg.subs.join('+');

  // Reddit turns away unauthenticated datacenter traffic, and not always the
  // same way, so try the richest route first and fall back to the Atom feed.
  // Every route asks for all the subreddits at once: one request is far less
  // likely to be rate-limited than seven.
  const routes = [
    token && {
      name: 'oauth',
      run: () =>
        get(`https://oauth.reddit.com/r/${multi}/top.json?t=day&limit=100&raw_json=1`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((payload) => ({
          items: normalizeReddit(payload),
          fetched: payload?.data?.children?.length ?? 0,
        })),
    },
    {
      name: 'public json',
      run: () =>
        get(`https://www.reddit.com/r/${multi}/top.json?t=day&limit=100&raw_json=1`, {
          headers: { 'User-Agent': BROWSER_UA },
          attempts: 2,
        }).then((payload) => ({
          items: normalizeReddit(payload),
          fetched: payload?.data?.children?.length ?? 0,
        })),
    },
    {
      name: 'atom feed',
      run: () =>
        get(`https://www.reddit.com/r/${multi}/top.rss?t=day&limit=100`, {
          as: 'text',
          headers: { 'User-Agent': BROWSER_UA, Accept: 'application/atom+xml,text/xml' },
          attempts: 2,
        }).then((xml) => ({
          items: normalizeRedditRss(xml),
          fetched: (String(xml).match(/<entry>/g) || []).length,
        })),
    },
  ].filter(Boolean);

  const errors = [];
  for (const route of routes) {
    try {
      const result = await route.run();
      if (!result.items.length) {
        errors.push(`${route.name}: ${result.fetched} rows, none usable`);
        continue;
      }
      return { ...result, note: route.name === 'oauth' ? '' : `via ${route.name}` };
    } catch (err) {
      errors.push(`${route.name}: ${err.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}

/**
 * ArtStation asset URLs carry the render size as the second-to-last path
 * segment (.../20260910144737/smaller_square/piece.jpg), so a bigger version
 * of a cover is one substitution away.
 */
const AS_SIZES = ['micro_square', 'smaller_square', 'small_square', 'small', 'medium', 'large'];
export function artstationSize(url, size) {
  if (!url) return '';
  return url.replace(
    new RegExp(`/(${AS_SIZES.join('|')})/([^/]+)$`),
    (match, _found, file) => `/${size}/${file}`
  );
}

/**
 * ArtStation: the community "trending" explore feed.
 *
 * That feed returns square cover URLs and no like counts, while the older
 * projects feed returns a `cover` object with likes — so covers are picked
 * from whichever keys exist, and when no counts come back at all the feed's
 * own ordering becomes the score.
 */
export function normalizeArtStation(payload) {
  const rows = payload?.data ?? payload?.projects ?? (Array.isArray(payload) ? payload : []);
  const usable = rows.filter((p) => p && !p.adult_content && !p.hide_as_adult);
  const hasLikes = usable.some((p) => Number(p.likes_count ?? p.likes ?? 0) > 0);

  return usable
    .map((p, index) => {
      const cover = p.cover || {};
      const square = pick(
        p.smaller_square_cover_url, p.small_square_cover_url, p.square_cover_url,
        cover.smaller_square_image_url, cover.square_image_url, cover.thumb_url
      );
      const wide = pick(
        p.medium_cover_url, p.cover_url, p.large_cover_url,
        cover.medium_image_url, cover.image_url, cover.large_image_url
      );
      const hash = p.hash_id || p.hashId || p.id;
      const likes = Number(p.likes_count ?? p.likes ?? 0) || 0;
      return {
        id: `artstation:${hash}`,
        source: 'artstation',
        title: clean(p.title) || 'Untitled',
        artist: clean(p.user?.full_name || p.user?.username || p.username || ''),
        artistUrl: p.user?.username ? `https://www.artstation.com/${p.user.username}` : https(pick(p.user?.permalink)),
        url: https(pick(p.permalink, p.url, hash ? `https://www.artstation.com/artwork/${hash}` : '')),
        image: https(wide || artstationSize(square, 'large') || square),
        // Only the square covers are given; the wider renders are derived from
        // the asset path and do not exist for every piece, so offer a ladder
        // and let the collector keep the first one that actually resolves.
        thumb: https(artstationSize(square, 'medium') || wide || square),
        thumbFallbacks: [
          https(artstationSize(square, 'large')),
          https(artstationSize(square, 'small')),
          https(pick(p.small_square_cover_url, cover.square_image_url)),
          https(square),
        ].filter(Boolean),
        value: hasLikes ? likes : usable.length - index,
        scoreLabel: hasLikes ? `${compact(likes)} likes` : `#${index + 1} trending`,
        postedAt: p.published_at ? new Date(p.published_at).toISOString() : null,
        context: 'Trending',
      };
    })
    .filter((item) => item.url && (item.image || item.thumb));
}

async function collectArtStation() {
  const payload = await getFirst(
    [
      'https://www.artstation.com/api/v2/community/explore/projects/trending.json?page=1&dimension=all&per_page=50',
      'https://www.artstation.com/projects.json?page=1&sorting=trending',
    ],
    { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json', Referer: 'https://www.artstation.com/' } }
  );
  const rows = payload?.data ?? payload?.projects ?? [];
  const items = normalizeArtStation(payload);
  return { items, fetched: rows.length, sample: sampleShape(rows[0]) };
}

/** Pixiv: the public daily illustration ranking (all-ages only). */
export function normalizePixiv(payload, { pixivProxy = '' } = {}) {
  const proxyThumb = (url) => {
    const clean = https(url);
    if (!clean) return '';
    if (!/i\.pximg\.net/.test(clean)) return clean;
    return pixivProxy ? clean.replace(/^https:\/\/i\.pximg\.net/, pixivProxy.replace(/\/$/, '')) : '';
  };

  return (payload?.contents ?? [])
    .filter((p) => p && p.illust_type !== '2') // skip ugoira (animated) entries
    .filter((p) => {
      const t = p.illust_content_type || {};
      return !t.sexual && !t.grotesque && !t.antisocial;
    })
    .map((p) => {
      const big = String(p.url || '').replace('/c/240x480/', '/c/600x1200_90/');
      return {
        id: `pixiv:${p.illust_id}`,
        source: 'pixiv',
        title: clean(p.title) || 'Untitled',
        artist: clean(p.user_name),
        artistUrl: p.user_id ? `https://www.pixiv.net/users/${p.user_id}` : '',
        url: `https://www.pixiv.net/artworks/${p.illust_id}`,
        image: proxyThumb(big),
        thumb: proxyThumb(p.url),
        value: Number(p.rating_count) || 0,
        scoreLabel: `${compact(Number(p.rating_count) || 0)} bookmarks · #${p.rank} today`,
        postedAt: iso(Number(p.illust_upload_timestamp)),
        context: `Daily ranking #${p.rank}`,
      };
    });
}

async function collectPixiv(cfg) {
  const payload = await get(
    'https://www.pixiv.net/ranking.php?mode=daily&content=illust&format=json&p=1',
    { headers: { 'User-Agent': BROWSER_UA, Referer: 'https://www.pixiv.net/', Accept: 'application/json' } }
  );
  const items = normalizePixiv(payload, cfg);
  return { items, fetched: (payload?.contents ?? []).length, sample: sampleShape(payload?.contents?.[0]) };
}

/** DeviantArt: the popular-this-week RSS feed for digital art. */
export function normalizeDeviantArt(xml) {
  const blocks = String(xml).split(/<item>/).slice(1).map((b) => b.split(/<\/item>/)[0]);
  const attr = (block, tag, name) => {
    const m = block.match(new RegExp(`<${tag}[^>]*\\b${name}="([^"]*)"`, 'i'));
    return m ? decodeEntities(m[1]) : '';
  };
  const tag = (block, name) => {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
    if (!m) return '';
    return clean(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ''));
  };

  return blocks
    .filter((block) => !/<media:rating>\s*adult/i.test(block))
    .map((block, index) => {
      const thumbs = [...block.matchAll(/<media:thumbnail[^>]*url="([^"]*)"/gi)].map((m) => decodeEntities(m[1]));
      const full = attr(block, 'media:content', 'url');
      const author = tag(block, 'media:credit') || attr(block, 'media:credit', 'url');
      const link = tag(block, 'link');
      return {
        id: `deviantart:${(link.match(/-(\d+)$/) || [])[1] || index}`,
        source: 'deviantart',
        title: tag(block, 'title') || 'Untitled',
        artist: clean(author),
        artistUrl: author ? `https://www.deviantart.com/${author.toLowerCase()}` : '',
        url: https(link),
        image: https(full || thumbs.at(-1) || ''),
        thumb: https(thumbs.at(-1) || full || ''),
        // The feed is already ordered by popularity but carries no counts, so
        // position in the feed is the only signal available.
        value: Math.max(1, blocks.length - index),
        scoreLabel: `#${index + 1} most popular`,
        postedAt: (() => {
          const d = new Date(tag(block, 'pubDate'));
          return Number.isNaN(d.valueOf()) ? null : d.toISOString();
        })(),
        context: 'Popular now',
      };
    })
    .filter((item) => item.url && (item.image || item.thumb));
}

/**
 * DeviantArt's official API, used when app credentials are configured. Its RSS
 * feed is behind bot protection that turns away CI runners, so credentials are
 * the only reliable route from a datacenter.
 */
export function normalizeDeviantArtApi(payload) {
  return (payload?.results ?? [])
    .filter((d) => d && !d.is_mature && !d.is_deleted)
    .map((d) => ({
      id: `deviantart:${d.deviationid}`,
      source: 'deviantart',
      title: clean(d.title) || 'Untitled',
      artist: clean(d.author?.username || ''),
      artistUrl: d.author?.username ? `https://www.deviantart.com/${d.author.username}` : '',
      url: https(d.url || ''),
      image: https(pick(d.content?.src, d.preview?.src, d.thumbs?.at(-1)?.src)),
      thumb: https(pick(d.preview?.src, d.thumbs?.at(-1)?.src, d.content?.src)),
      value: Number(d.stats?.favourites) || 0,
      scoreLabel: `${compact(Number(d.stats?.favourites) || 0)} favourites`,
      postedAt: iso(Number(d.published_time)),
      context: 'Daily Deviation',
    }))
    .filter((item) => item.url && (item.image || item.thumb));
}

async function deviantArtToken() {
  if (!process.env.DEVIANTART_CLIENT_ID || !process.env.DEVIANTART_CLIENT_SECRET) return null;
  try {
    const url =
      'https://www.deviantart.com/oauth2/token?grant_type=client_credentials' +
      `&client_id=${encodeURIComponent(process.env.DEVIANTART_CLIENT_ID)}` +
      `&client_secret=${encodeURIComponent(process.env.DEVIANTART_CLIENT_SECRET)}`;
    return (await get(url, { attempts: 2 }))?.access_token || null;
  } catch {
    return null;
  }
}

async function collectDeviantArt() {
  const token = await deviantArtToken();
  if (token) {
    const payload = await get(
      `https://www.deviantart.com/api/v1/oauth2/browse/dailydeviations?mature_content=false&access_token=${token}`,
      { headers: { 'User-Agent': BROWSER_UA } }
    );
    const items = normalizeDeviantArtApi(payload);
    return {
      items,
      fetched: (payload?.results ?? []).length,
      note: 'via the API',
      sample: sampleShape(payload?.results?.[0]),
    };
  }

  const query = encodeURIComponent('boost:popular max_age:24h in:digitalart');
  const xml = await getFirst(
    [
      `https://backend.deviantart.com/rss.xml?type=deviation&q=${query}&limit=60`,
      `https://www.deviantart.com/rss.xml?type=deviation&q=${query}&limit=60`,
      // Without the age filter the feed is served from a different cache and
      // sometimes answers when the filtered one does not.
      `https://backend.deviantart.com/rss.xml?type=deviation&q=${encodeURIComponent('boost:popular in:digitalart')}&limit=60`,
    ],
    { as: 'text', headers: { 'User-Agent': BROWSER_UA, Accept: 'application/rss+xml,text/xml' } }
  );
  const items = normalizeDeviantArt(xml);
  return {
    items,
    fetched: (String(xml).match(/<item>/g) || []).length,
    note: 'via RSS',
    sample: items.length ? undefined : String(xml).slice(0, 400),
  };
}

export const SOURCES = [
  { id: 'artstation', label: 'ArtStation', home: 'https://www.artstation.com', collect: collectArtStation },
  { id: 'reddit', label: 'Reddit', home: 'https://www.reddit.com', collect: collectReddit },
  { id: 'pixiv', label: 'Pixiv', home: 'https://www.pixiv.net', collect: collectPixiv },
  { id: 'deviantart', label: 'DeviantArt', home: 'https://www.deviantart.com', collect: collectDeviantArt },
];

/* ---------------------------------------------------------------- ranking */

/**
 * Scores are not comparable across sources (Reddit upvotes vs ArtStation
 * likes vs Pixiv bookmarks), so each source is normalized against its own top
 * post, nudged by how fresh the piece is, and then the sources are interleaved
 * so one busy site can't take over the whole digest.
 */
export function rankItems(bySource, { limit = 24, windowHours = 48, now = Date.now() } = {}) {
  const cutoff = now - windowHours * 3600 * 1000;

  const ranked = new Map();
  for (const [source, items] of Object.entries(bySource)) {
    const fresh = items.filter((item) => {
      if (!item.postedAt) return true; // no timestamp: trust the source's own ordering
      const t = Date.parse(item.postedAt);
      return !Number.isFinite(t) || t >= cutoff;
    });
    const max = Math.max(1, ...fresh.map((i) => i.value || 0));
    const scored = fresh
      .map((item) => {
        const popularity = Math.min(1, (item.value || 0) / max);
        const ageHours = item.postedAt ? Math.max(0, (now - Date.parse(item.postedAt)) / 3.6e6) : windowHours / 2;
        const freshness = Math.max(0, 1 - ageHours / (windowHours * 1.5));
        return { ...item, heat: Math.round((popularity * 0.8 + freshness * 0.2) * 100) };
      })
      .sort((a, b) => b.heat - a.heat || b.value - a.value);
    ranked.set(source, dedupe(scored));
  }

  // Round-robin across sources, best first.
  const out = [];
  const order = [...ranked.keys()].sort((a, b) => (ranked.get(b)[0]?.heat ?? 0) - (ranked.get(a)[0]?.heat ?? 0));
  for (let round = 0; out.length < limit; round++) {
    let added = 0;
    for (const source of order) {
      const item = ranked.get(source)[round];
      if (!item) continue;
      out.push(item);
      added++;
      if (out.length >= limit) break;
    }
    if (!added) break;
  }
  return out;
}

/* -------------------------------------------------------------- thumbnails */

/** HEAD (or a one-byte GET, for hosts that refuse HEAD) to see if a URL resolves. */
async function urlResolves(url) {
  const headers = { 'User-Agent': BROWSER_UA, Referer: 'https://www.google.com/' };
  try {
    let res = await fetch(url, { method: 'HEAD', headers, signal: AbortSignal.timeout(12_000) });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        headers: { ...headers, Range: 'bytes=0-0' },
        signal: AbortSignal.timeout(12_000),
      });
    }
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

/**
 * Some thumbnails are derived rather than given: ArtStation's are upsized from
 * a square cover, Pixiv's go through a mirror. The email can't retry a broken
 * image the way the widget can, so every thumbnail is checked here and either
 * swapped for the source's fallback or dropped, leaving a text card.
 */
export async function resolveThumbnails(items, { check = urlResolves, concurrency = 8 } = {}) {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const ladder = [item.thumb, ...(item.thumbFallbacks || [])].filter(
        (url, i, all) => url && all.indexOf(url) === i
      );
      let resolved = '';
      for (const candidate of ladder) {
        if (await check(candidate)) {
          resolved = candidate;
          break;
        }
      }
      if (resolved === item.thumb) continue;
      item.thumb = resolved;
      // The big version is derived from the same guess as the thumbnail, so
      // when the guess was wrong fall back to what did resolve.
      item.image = resolved;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return items;
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.source}|${item.title.toLowerCase()}|${item.artist.toLowerCase()}`;
    if (seen.has(key) || seen.has(item.id)) return false;
    seen.add(key);
    seen.add(item.id);
    return true;
  });
}

/* ------------------------------------------------------------------ email */

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SOURCE_COLORS = {
  artstation: '#13aff0',
  reddit: '#ff4500',
  pixiv: '#0096fa',
  deviantart: '#00e59b',
};

/** Table-based HTML so it survives email clients. */
export function renderEmail(digest, { siteUrl = CONFIG.siteUrl } = {}) {
  const date = new Date(digest.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  const cards = digest.items
    .map((item, index) => {
      const color = SOURCE_COLORS[item.source] || '#8b5cf6';
      const thumb = item.thumb || item.image;
      return `
      <tr>
        <td style="padding:0 0 18px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e1ea;border-radius:12px;overflow:hidden;background:#ffffff;">
            <tr>
              <td width="120" valign="top" style="padding:0;">
                ${thumb
                  ? `<a href="${esc(item.url)}"><img src="${esc(thumb)}" width="120" alt="" style="display:block;width:120px;height:120px;object-fit:cover;border:0;"></a>`
                  : `<div style="width:120px;height:120px;background:${color};"></div>`}
              </td>
              <td valign="top" style="padding:12px 16px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
                <div style="font-size:11px;color:${color};font-weight:700;letter-spacing:.04em;text-transform:uppercase;">
                  ${index + 1}. ${esc(digest.sourceLabels[item.source] || item.source)}${item.context ? ` · ${esc(item.context)}` : ''}
                </div>
                <div style="margin:4px 0 2px;font-size:16px;line-height:1.3;font-weight:600;">
                  <a href="${esc(item.url)}" style="color:#1c1420;text-decoration:none;">${esc(item.title)}</a>
                </div>
                <div style="font-size:13px;color:#6b6270;">${esc(item.artist)}</div>
                <div style="margin-top:6px;font-size:12px;color:#8a8194;">🔥 ${item.heat} · ${esc(item.scoreLabel)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  const sourceLine = digest.sources
    .map((s) => `${s.status === 'ok' ? '✓' : '✕'} ${esc(s.label)}${s.status === 'ok' ? ` (${s.kept})` : ''}`)
    .join(' &nbsp;·&nbsp; ');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f7f4f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="padding-bottom:18px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
        <div style="font-size:22px;font-weight:700;color:#1c1420;">🎨 Today's best new digital art</div>
        <div style="font-size:13px;color:#6b6270;margin-top:4px;">${esc(date)} · top ${digest.items.length} of ${digest.totalCollected} new pieces</div>
      </td></tr>
      ${cards}
      <tr><td style="padding-top:6px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;color:#8a8194;">
        <div>Sources: ${sourceLine}</div>
        <div style="margin-top:8px;"><a href="${esc(siteUrl)}" style="color:#e8489b;">Open the full widget →</a></div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/* ------------------------------------------------------------------- main */

export async function buildDigest(cfg = CONFIG) {
  const bySource = {};
  const report = [];

  const results = await Promise.allSettled(SOURCES.map((s) => s.collect(cfg)));

  SOURCES.forEach((source, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') {
      const { items, fetched, note, sample } = result.value;
      bySource[source.id] = items;
      report.push({
        id: source.id,
        label: source.label,
        home: source.home,
        // Rows that all fail to normalize mean the site changed its response
        // shape: report that as a failure rather than an empty success.
        status: items.length || !fetched ? 'ok' : 'changed',
        fetched,
        kept: items.length,
        note: note || '',
        error: items.length || !fetched ? null : `returned ${fetched} rows, none usable — the response shape changed`,
        ...(items.length || !fetched ? {} : { sample: sample ?? null }),
      });
    } else {
      bySource[source.id] = [];
      report.push({
        id: source.id,
        label: source.label,
        home: source.home,
        status: 'failed',
        fetched: 0,
        kept: 0,
        note: '',
        error: String(result.reason?.message || result.reason).slice(0, 300),
      });
    }
  });

  const items = await resolveThumbnails(
    rankItems(bySource, { limit: cfg.limit, windowHours: cfg.windowHours })
  );
  const broken = items.filter((item) => !item.thumb).length;
  if (broken) console.log(`${broken} of ${items.length} thumbnails did not resolve and were dropped`);

  return {
    generatedAt: new Date().toISOString(),
    windowHours: cfg.windowHours,
    totalCollected: Object.values(bySource).reduce((n, list) => n + list.length, 0),
    sourceLabels: Object.fromEntries(SOURCES.map((s) => [s.id, s.label])),
    sources: report,
    items,
  };
}

async function main() {
  const digest = await buildDigest(CONFIG);

  await mkdir(join(CONFIG.outDir, 'archive'), { recursive: true });
  const json = `${JSON.stringify(digest, null, 2)}\n`;
  const day = digest.generatedAt.slice(0, 10);
  await writeFile(join(CONFIG.outDir, 'latest.json'), json);
  await writeFile(join(CONFIG.outDir, 'archive', `${day}.json`), json);
  await writeFile(join(CONFIG.outDir, 'email.html'), `${renderEmail(digest)}\n`);

  for (const s of digest.sources) {
    const detail = s.status === 'ok' ? `${s.kept} kept of ${s.fetched}${s.note ? ` — ${s.note}` : ''}` : s.error;
    console.log(`${s.status === 'ok' ? '✓' : '✕'} ${s.label.padEnd(12)} ${detail}`);
    if (s.sample) console.log(`  sample row: ${JSON.stringify(s.sample).slice(0, 1200)}`);
  }
  console.log(`\n${digest.items.length} items written to ${CONFIG.outDir}`);

  const working = digest.sources.filter((s) => s.status === 'ok').length;
  if (!working || !digest.items.length) {
    console.error('No source returned usable items.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
