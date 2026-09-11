/**
 * Fixture tests for the collector's pure parts: source normalizers, the
 * cross-source ranking, and the email renderer. No network — run with:
 *   node art-digest/test/run.mjs
 */

import assert from 'node:assert/strict';
import {
  normalizeReddit,
  normalizeArtStation,
  normalizePixiv,
  normalizeDeviantArt,
  rankItems,
  renderEmail,
} from '../collect.mjs';

let passed = 0;
const failures = [];
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ✕ ${name}\n    ${err.message}`);
  }
};

const NOW = Date.UTC(2026, 8, 11, 12, 0, 0);
const hoursAgo = (h) => (NOW - h * 3600_000) / 1000;

/* ------------------------------------------------------------------ reddit */

const redditPayload = {
  data: {
    children: [
      {
        data: {
          id: 'aaa111',
          title: 'Neon Harbour &amp; the Last Ferry',
          author: 'painterly',
          permalink: '/r/Art/comments/aaa111/neon_harbour/',
          score: 8421,
          created_utc: hoursAgo(5),
          subreddit_name_prefixed: 'r/Art',
          over_18: false,
          is_self: false,
          url_overridden_by_dest: 'https://i.redd.it/aaa111.jpg',
          preview: {
            images: [
              {
                source: { url: 'https://preview.redd.it/aaa111.jpg?width=1920&amp;s=abc' },
                resolutions: [
                  { url: 'https://preview.redd.it/aaa111.jpg?width=320&amp;s=d' },
                  { url: 'https://preview.redd.it/aaa111.jpg?width=640&amp;s=e' },
                  { url: 'https://preview.redd.it/aaa111.jpg?width=960&amp;s=f' },
                ],
              },
            ],
          },
        },
      },
      { data: { id: 'nsfw1', title: 'nope', author: 'x', permalink: '/p', score: 99999, over_18: true, created_utc: hoursAgo(1), preview: { images: [{ source: { url: 'https://preview.redd.it/n.jpg' } }] } } },
      { data: { id: 'text1', title: 'Weekly thread', author: 'mod', permalink: '/t', score: 500, is_self: true, stickied: true, created_utc: hoursAgo(2) } },
      { data: { id: 'noimg', title: 'A link post', author: 'y', permalink: '/l', score: 300, created_utc: hoursAgo(3), url_overridden_by_dest: 'https://example.com/article' } },
    ],
  },
};

test('reddit: keeps only SFW image posts', () => {
  const items = normalizeReddit(redditPayload, 'Art');
  assert.equal(items.length, 1, 'NSFW, self and image-less posts are dropped');
});

test('reddit: decodes entities in titles and image URLs', () => {
  const [item] = normalizeReddit(redditPayload, 'Art');
  assert.equal(item.title, 'Neon Harbour & the Last Ferry');
  assert.equal(item.image, 'https://preview.redd.it/aaa111.jpg?width=1920&s=abc');
  assert.ok(!item.thumb.includes('&amp;'), 'thumbnail URL is decoded');
  assert.equal(item.artist, 'u/painterly');
  assert.equal(item.url, 'https://www.reddit.com/r/Art/comments/aaa111/neon_harbour/');
  assert.equal(item.scoreLabel, '8.4k upvotes');
  assert.equal(item.context, 'r/Art');
});

/* -------------------------------------------------------------- artstation */

const artstationPayload = {
  data: [
    {
      id: 1,
      hash_id: 'zZk9L',
      title: 'Skyward Cathedral',
      permalink: 'https://www.artstation.com/artwork/zZk9L',
      likes_count: 3120,
      published_at: new Date(NOW - 9 * 3600_000).toISOString(),
      user: { full_name: 'Mira Solis', permalink: 'https://www.artstation.com/mirasolis' },
      cover: {
        medium_image_url: 'http://cdna.artstation.com/p/medium.jpg',
        smaller_square_image_url: 'https://cdna.artstation.com/p/square.jpg',
      },
    },
    { id: 2, hash_id: 'adult1', title: 'nope', permalink: 'https://www.artstation.com/artwork/adult1', adult_content: true, likes_count: 90000, user: { full_name: 'x' }, cover: { thumb_url: 'https://c/t.jpg' } },
  ],
};

test('artstation: normalizes trending projects and drops adult content', () => {
  const items = normalizeArtStation(artstationPayload);
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.id, 'artstation:zZk9L');
  assert.equal(item.artist, 'Mira Solis');
  assert.equal(item.image, 'https://cdna.artstation.com/p/medium.jpg', 'http is upgraded to https');
  assert.equal(item.scoreLabel, '3.1k likes');
});

/* ------------------------------------------------------------------- pixiv */

const pixivPayload = {
  contents: [
    {
      illust_id: 90210,
      title: '夜明けの街',
      user_name: 'kaze',
      user_id: 55,
      rank: 1,
      rating_count: 12480,
      view_count: 90000,
      illust_upload_timestamp: hoursAgo(20),
      illust_type: '0',
      url: 'https://i.pximg.net/c/240x480/img-master/img/2026/09/10/00/00/00/90210_p0_master1200.jpg',
      illust_content_type: { sexual: 0, grotesque: false },
    },
    { illust_id: 3, title: 'r18', user_name: 'z', rank: 2, rating_count: 99999, illust_type: '0', url: 'https://i.pximg.net/x.jpg', illust_content_type: { sexual: 2 } },
    { illust_id: 4, title: 'ugoira', user_name: 'z', rank: 3, rating_count: 50, illust_type: '2', url: 'https://i.pximg.net/y.jpg', illust_content_type: {} },
  ],
};

test('pixiv: filters R-18 and animations, proxies hotlink-blocked thumbnails', () => {
  const items = normalizePixiv(pixivPayload, { pixivProxy: 'https://i.pixiv.re' });
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.url, 'https://www.pixiv.net/artworks/90210');
  assert.equal(item.thumb, 'https://i.pixiv.re/c/240x480/img-master/img/2026/09/10/00/00/00/90210_p0_master1200.jpg');
  assert.ok(item.image.includes('/c/600x1200_90/'), 'the large image uses a bigger master size');
  assert.equal(item.scoreLabel, '12.5k bookmarks · #1 today');
});

test('pixiv: an empty proxy drops thumbnails instead of shipping broken ones', () => {
  const [item] = normalizePixiv(pixivPayload, { pixivProxy: '' });
  assert.equal(item.thumb, '');
  assert.equal(item.image, '');
});

/* -------------------------------------------------------------- deviantart */

const deviantartXml = `<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item>
  <title>Ember Fox</title>
  <link>https://www.deviantart.com/aurelia/art/Ember-Fox-998877</link>
  <pubDate>Wed, 10 Sep 2026 21:15:00 PDT</pubDate>
  <media:credit role="author" url="https://www.deviantart.com/aurelia">Aurelia</media:credit>
  <media:content url="https://images-wixmp.com/full/ember.jpg" medium="image" width="1600" height="900"/>
  <media:thumbnail url="https://images-wixmp.com/t150/ember.jpg" width="150"/>
  <media:thumbnail url="https://images-wixmp.com/t400/ember.jpg" width="400"/>
  <media:rating>nonadult</media:rating>
</item>
<item>
  <title>Mature piece</title>
  <link>https://www.deviantart.com/x/art/Mature-1</link>
  <media:credit role="author">x</media:credit>
  <media:content url="https://images-wixmp.com/full/m.jpg" medium="image"/>
  <media:rating>adult</media:rating>
</item>
</channel></rss>`;

test('deviantart: parses the RSS feed and skips mature deviations', () => {
  const items = normalizeDeviantArt(deviantartXml);
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.id, 'deviantart:998877');
  assert.equal(item.title, 'Ember Fox');
  assert.equal(item.artist, 'Aurelia');
  assert.equal(item.thumb, 'https://images-wixmp.com/t400/ember.jpg', 'largest thumbnail wins');
  assert.equal(item.scoreLabel, '#1 most popular');
  assert.ok(item.postedAt.startsWith('2026-09-11'), 'pubDate parsed to ISO');
});

/* ----------------------------------------------------------------- ranking */

const makeItems = (source, n, base) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${source}:${i}`,
    source,
    title: `${source} piece ${i}`,
    artist: `artist ${i}`,
    artistUrl: '',
    url: `https://example.com/${source}/${i}`,
    image: 'https://example.com/i.jpg',
    thumb: 'https://example.com/t.jpg',
    value: base - i * 10,
    scoreLabel: `${base - i * 10} points`,
    postedAt: new Date(NOW - (i + 1) * 3600_000).toISOString(),
    context: '',
  }));

test('ranking: interleaves sources so one site cannot dominate', () => {
  const ranked = rankItems(
    { reddit: makeItems('reddit', 20, 9000), artstation: makeItems('artstation', 20, 400), pixiv: makeItems('pixiv', 20, 5000) },
    { limit: 12, windowHours: 48, now: NOW }
  );
  assert.equal(ranked.length, 12);
  const counts = ranked.reduce((acc, i) => ({ ...acc, [i.source]: (acc[i.source] || 0) + 1 }), {});
  assert.deepEqual(counts, { reddit: 4, artstation: 4, pixiv: 4 });
});

test('ranking: drops anything older than the window', () => {
  const stale = makeItems('reddit', 3, 9000).map((i) => ({ ...i, postedAt: new Date(NOW - 200 * 3600_000).toISOString() }));
  const ranked = rankItems({ reddit: stale, pixiv: makeItems('pixiv', 2, 100) }, { limit: 10, windowHours: 48, now: NOW });
  assert.ok(ranked.every((i) => i.source === 'pixiv'), 'only fresh items survive');
});

test('ranking: keeps undated items (the source ordered them for us)', () => {
  const undated = makeItems('deviantart', 3, 30).map((i) => ({ ...i, postedAt: null }));
  const ranked = rankItems({ deviantart: undated }, { limit: 5, windowHours: 48, now: NOW });
  assert.equal(ranked.length, 3);
});

test('ranking: heat is 0-100 and the top post of each source scores highest', () => {
  const ranked = rankItems({ reddit: makeItems('reddit', 5, 9000) }, { limit: 5, windowHours: 48, now: NOW });
  assert.ok(ranked.every((i) => i.heat >= 0 && i.heat <= 100));
  assert.deepEqual([...ranked].sort((a, b) => b.heat - a.heat).map((i) => i.id), ranked.map((i) => i.id));
});

test('ranking: removes duplicate posts of the same piece', () => {
  const dupes = [...makeItems('reddit', 2, 100), ...makeItems('reddit', 2, 100)];
  const ranked = rankItems({ reddit: dupes }, { limit: 10, windowHours: 48, now: NOW });
  assert.equal(ranked.length, 2);
});

/* ------------------------------------------------------------------- email */

test('email: renders every item, escapes markup, and links the widget', () => {
  const digest = {
    generatedAt: new Date(NOW).toISOString(),
    totalCollected: 90,
    sourceLabels: { reddit: 'Reddit', pixiv: 'Pixiv' },
    sources: [
      { id: 'reddit', label: 'Reddit', status: 'ok', kept: 8 },
      { id: 'pixiv', label: 'Pixiv', status: 'failed', kept: 0 },
    ],
    items: [
      { ...makeItems('reddit', 1, 900)[0], title: '<script>alert(1)</script>', heat: 91, context: 'r/Art' },
      { ...makeItems('pixiv', 1, 900)[0], heat: 80, thumb: '' , image: ''},
    ],
  };
  const html = renderEmail(digest, { siteUrl: 'https://example.com/art-digest/' });
  assert.ok(html.includes('&lt;script&gt;'), 'titles are escaped');
  assert.ok(!html.includes('<script>'), 'no raw script tag survives');
  assert.ok(html.includes('1. Reddit · r/Art'));
  assert.ok(html.includes('✕ Pixiv'), 'failed sources are reported');
  assert.ok(html.includes('https://example.com/art-digest/'));
  assert.equal((html.match(/<tr>\s*<td style="padding:0 0 18px 0;">/g) || []).length, 2);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
