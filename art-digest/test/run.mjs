/**
 * Fixture tests for the collector's pure parts: source normalizers, the
 * cross-source ranking, and the email renderer. No network — run with:
 *   node art-digest/test/run.mjs
 */

import assert from 'node:assert/strict';
import {
  normalizeReddit,
  normalizeRedditRss,
  sampleShape,
  normalizeArtStation,
  artstationSize,
  normalizePixiv,
  normalizeDeviantArt,
  normalizeDeviantArtApi,
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

const redditAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry>
  <author><name>/u/tuulikki</name></author>
  <id>t3_zz9001</id>
  <link href="https://www.reddit.com/r/Art/comments/zz9001/the_lighthouse/" />
  <updated>2026-09-11T07:30:00+00:00</updated>
  <title>The Lighthouse at Var</title>
  <content type="html">&lt;a href="https://i.redd.it/zz9001.jpg"&gt;&lt;img src="https://preview.redd.it/zz9001.jpg?width=640&amp;amp;s=x" alt="post"&gt;&lt;/a&gt;</content>
</entry>
<entry>
  <author><name>/u/nobody</name></author>
  <id>t3_zz9002</id>
  <link href="https://www.reddit.com/r/Art/comments/zz9002/text_post/" />
  <updated>2026-09-11T06:00:00+00:00</updated>
  <title>Discussion thread</title>
  <content type="html">&lt;p&gt;no image here&lt;/p&gt;</content>
</entry>
</feed>`;

test('reddit atom: used when the JSON API refuses, ranked by feed position', () => {
  const items = normalizeRedditRss(redditAtom, 'Art');
  assert.equal(items.length, 1, 'entries without an image are dropped');
  const [item] = items;
  assert.equal(item.id, 'reddit:zz9001');
  assert.equal(item.title, 'The Lighthouse at Var');
  assert.equal(item.artist, 'u/tuulikki');
  assert.equal(item.url, 'https://www.reddit.com/r/Art/comments/zz9001/the_lighthouse/');
  assert.equal(item.image, 'https://preview.redd.it/zz9001.jpg?width=640&s=x');
  assert.equal(item.scoreLabel, '#1 top today in r/Art');
  assert.equal(item.postedAt, '2026-09-11T07:30:00.000Z');
});

/* -------------------------------------------------------------- artstation */


test('artstation: reads the explore feed shape (square covers, no like counts)', () => {
  // Shape taken from a real trending response.
  const items = normalizeArtStation({
    data: [
      {
        id: 22861190,
        hash_id: '4193e2',
        url: 'https://www.artstation.com/artwork/4193e2',
        title: 'Leon S. Kennedy (fan art)',
        hide_as_adult: false,
        smaller_square_cover_url: 'https://cdna.artstation.com/p/assets/images/images/102/320/164/20260910144737/smaller_square/leon.jpg',
        small_square_cover_url: 'https://cdna.artstation.com/p/assets/images/images/102/320/164/20260910144737/small_square/leon.jpg',
        user: { username: 'he77ga', full_name: 'Olya Anufrieva' },
      },
      {
        id: 2,
        hash_id: 'second',
        url: 'https://www.artstation.com/artwork/second',
        title: 'Runner up',
        smaller_square_cover_url: 'https://cdna.artstation.com/p/assets/images/images/1/2/3/20260910144737/smaller_square/b.jpg',
        user: { username: 'two', full_name: 'Two' },
      },
    ],
  });

  assert.equal(items.length, 2);
  const [first, second] = items;
  assert.equal(first.artist, 'Olya Anufrieva');
  assert.equal(first.artistUrl, 'https://www.artstation.com/he77ga');
  assert.equal(first.url, 'https://www.artstation.com/artwork/4193e2');
  assert.ok(first.thumb.includes('/medium/leon.jpg'), 'the thumbnail is upsized from the square cover');
  assert.ok(first.image.includes('/large/leon.jpg'), 'the full image asks for the large render');
  assert.ok(first.thumbFallback.includes('/smaller_square/leon.jpg'), 'the original square cover stays as a fallback');
  assert.equal(first.scoreLabel, '#1 trending', 'no like counts: the feed order is the score');
  assert.ok(first.value > second.value, 'earlier in the trending feed ranks higher');
});

test('artstation: keeps using like counts when the projects feed provides them', () => {
  const [item] = normalizeArtStation({
    data: [{
      hash_id: 'likes1',
      title: 'With likes',
      permalink: 'https://www.artstation.com/artwork/likes1',
      likes_count: 3120,
      user: { full_name: 'Mira Solis' },
      cover: { medium_image_url: 'http://cdna.artstation.com/p/medium.jpg', smaller_square_image_url: 'https://cdna.artstation.com/p/square.jpg' },
    }],
  });
  assert.equal(item.scoreLabel, '3.1k likes');
  assert.equal(item.value, 3120);
  assert.equal(item.image, 'https://cdna.artstation.com/p/medium.jpg', 'http is upgraded to https');
});

test('artstationSize: only rewrites a real size segment', () => {
  assert.equal(
    artstationSize('https://cdna.artstation.com/p/a/b/20260910/smaller_square/x.jpg', 'large'),
    'https://cdna.artstation.com/p/a/b/20260910/large/x.jpg'
  );
  assert.equal(artstationSize('https://example.com/plain.jpg', 'large'), 'https://example.com/plain.jpg');
  assert.equal(artstationSize('', 'large'), '');
});

test('artstation: drops adult content', () => {
  const items = normalizeArtStation({
    data: [
      { hash_id: 'ok1', title: 'fine', url: 'https://www.artstation.com/artwork/ok1', smaller_square_cover_url: 'https://c/s/smaller_square/a.jpg', user: {} },
      { hash_id: 'adult1', title: 'nope', url: 'https://www.artstation.com/artwork/adult1', adult_content: true, smaller_square_cover_url: 'https://c/s/smaller_square/b.jpg', user: {} },
      { hash_id: 'adult2', title: 'nope', url: 'https://www.artstation.com/artwork/adult2', hide_as_adult: true, smaller_square_cover_url: 'https://c/s/smaller_square/c.jpg', user: {} },
    ],
  });
  assert.deepEqual(items.map((i) => i.id), ['artstation:ok1']);
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

test('deviantart api: normalizes daily deviations and skips mature ones', () => {
  const items = normalizeDeviantArtApi({
    results: [
      {
        deviationid: 'abc-123',
        title: 'Ember Fox',
        url: 'https://www.deviantart.com/aurelia/art/Ember-Fox-998877',
        is_mature: false,
        published_time: String(Math.floor(NOW / 1000) - 3600),
        author: { username: 'Aurelia' },
        preview: { src: 'https://images-wixmp.com/preview/ember.jpg' },
        content: { src: 'https://images-wixmp.com/full/ember.jpg' },
        stats: { favourites: 4210, comments: 88 },
      },
      { deviationid: 'm-1', title: 'Mature', url: 'https://www.deviantart.com/x/art/m-1', is_mature: true, author: { username: 'x' }, preview: { src: 'https://i/m.jpg' }, stats: { favourites: 99999 } },
      { deviationid: 'no-img', title: 'No image', url: 'https://www.deviantart.com/x/art/no-img', author: { username: 'x' }, stats: { favourites: 5 } },
    ],
  });
  assert.deepEqual(items.map((i) => i.id), ['deviantart:abc-123']);
  const [item] = items;
  assert.equal(item.artist, 'Aurelia');
  assert.equal(item.artistUrl, 'https://www.deviantart.com/Aurelia');
  assert.equal(item.image, 'https://images-wixmp.com/full/ember.jpg');
  assert.equal(item.thumb, 'https://images-wixmp.com/preview/ember.jpg');
  assert.equal(item.scoreLabel, '4.2k favourites');
  assert.equal(item.context, 'Daily Deviation');
  assert.ok(item.postedAt.startsWith('2026-09-11'));
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

/* ----------------------------------------------------------- diagnostics */

test('sampleShape: trims a raw row to something loggable', () => {
  const shape = sampleShape({
    id: 7,
    title: 'x'.repeat(200),
    tags: [1, 2, 3],
    cover: { thumb_url: 'https://a/b.jpg', nested: { deep: true } },
    flag: false,
  });
  assert.equal(shape.id, 7);
  assert.ok(shape.title.endsWith('…') && shape.title.length < 100, 'long strings are cut');
  assert.equal(shape.tags, '[3]');
  assert.equal(shape.cover.thumb_url, 'https://a/b.jpg');
  assert.equal(shape.cover.nested, '{…}', 'nesting stops at one level');
  assert.equal(shape.flag, false);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
