# 🎨 Daily Digital Art Digest

A small widget that collects the most popular **new** digital art from
**ArtStation**, **Reddit**, **Pixiv** and **DeviantArt**, ranks it into one
list, and sends it to you.

Live page: <https://petulent-princess-productivity.web.app/art-digest/>

## How it works

```
GitHub Actions (daily)         this repo                  you
┌──────────────────┐   commit  ┌─────────────────┐  read  ┌──────────────────┐
│ collect.mjs      │ ────────► │ data/latest.json│ ─────► │ /art-digest/ page│
│ 4 sources → rank │           │ data/email.html │        │ daily email      │
└──────────────────┘           └─────────────────┘        └──────────────────┘
```

The collection runs in CI rather than in your browser because ArtStation,
Pixiv and DeviantArt don't allow cross-origin reads, and because a static page
can't wake itself up once a day. The widget only reads the committed JSON, so
it stays a plain static page with no server, no build and no API keys.

| File | Purpose |
| --- | --- |
| `collect.mjs` | Fetches all four sources, normalizes, ranks, writes `data/` |
| `index.html`, `digest.css`, `digest.js` | The widget: filterable gallery of the current digest |
| `test/run.mjs` | Fixture tests for the parsers, ranking and email template |
| `data/latest.json` | The current digest (written by CI) |
| `data/email.html` | The same digest as a ready-to-send HTML email |
| `data/archive/*.json` | One snapshot per day |

## Sources

| Source | Endpoint | Popularity signal |
| --- | --- | --- |
| ArtStation | community trending explore feed | likes |
| Reddit | `top?t=day` across r/Art, r/DigitalArt, r/ImaginaryLandscapes, r/ImaginaryCharacters, r/ConceptArt, r/SciFiArt, r/FantasyArt | upvotes |
| Pixiv | public daily illustration ranking | bookmarks |
| DeviantArt | `boost:popular max_age:24h in:digitalart` RSS | position in the feed |

Adult/NSFW posts are filtered out of every source. A source that fails is
reported in the digest and in the widget footer instead of failing the run —
the other three still ship.

### Ranking

Upvotes, likes and bookmarks aren't the same currency, so each piece is scored
against the top piece *of its own source* (80%) plus a freshness bonus (20%),
giving a 0–100 "heat". The final list is then filled round-robin across the
sources so one busy site can't take over the digest.

## Running it yourself

```sh
node art-digest/collect.mjs     # writes art-digest/data/
node art-digest/test/run.mjs    # fixture tests, no network

python3 -m http.server 8000     # then open /art-digest/
```

| Env var | Default | Purpose |
| --- | --- | --- |
| `ART_DIGEST_LIMIT` | `24` | How many pieces to keep |
| `ART_DIGEST_WINDOW_HOURS` | `48` | How new "new" has to be |
| `ART_DIGEST_SUBS` | see above | Comma-separated subreddits |
| `ART_DIGEST_PIXIV_PROXY` | `https://i.pixiv.re` | Pixiv blocks hotlinked thumbnails, so they're re-served through a mirror. Set to empty to drop Pixiv thumbnails instead |
| `ART_DIGEST_OUT` | `art-digest/data` | Output directory |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | unset | Optional. Reddit throttles datacenter IPs on the public JSON API; with these repository secrets set the collector uses app-only OAuth instead |

## Schedule

`.github/workflows/art-digest.yml` runs the collector every day at 13:05 UTC,
commits `data/` when it changes, and attaches the digest to the run. GitHub
only runs `schedule:` triggers from the **default branch**, so the daily run
starts once this workflow is merged to `master`; until then use *Actions → Art
digest → Run workflow*, or push a change to `collect.mjs`.

## Getting it emailed

`data/email.html` is a complete, client-safe HTML email of the current digest.
A daily Claude routine reads it out of the repo and sends it on — nothing to
configure. Any other mailer works the same way: fetch the file and send it as
the message body, e.g.

```sh
curl -s https://raw.githubusercontent.com/JasonLayel/JLTest/master/art-digest/data/email.html
```
