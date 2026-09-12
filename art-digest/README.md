# 🎨 Daily Digital Art Digest

A small widget that collects the most popular **new** digital art from
**ArtStation**, **Reddit** (two dozen art subreddits), **Pixiv**,
**DeviantArt**, **Bluesky** and **Danbooru**, ranks it into one list, and sends
it to you.

Live page: <https://petulent-princess-productivity.web.app/art-digest/>

## How it works

```
GitHub Actions (daily)          this repo                      you
┌──────────────────┐   commit   ┌─────────────────┐   read    ┌──────────────────┐
│ collect.mjs      │ ─────────► │ data/latest.json│ ────────► │ /art-digest/ page│
│ 4 sources → rank │            │ data/email.html │           └──────────────────┘
└────────┬─────────┘            └─────────────────┘
         │  send-email.mjs (SMTP)                              ┌──────────────────┐
         └───────────────────────────────────────────────────► │ your inbox       │
                                                               └──────────────────┘
```

The collection runs in CI rather than in your browser because ArtStation,
Pixiv and DeviantArt don't allow cross-origin reads, and because a static page
can't wake itself up once a day. The widget only reads the committed JSON, so
it stays a plain static page with no server, no build and no API keys.

| File | Purpose |
| --- | --- |
| `collect.mjs` | Fetches all four sources, normalizes, ranks, writes `data/` |
| `send-email.mjs` | Sends the digest over SMTP (no dependencies) |
| `index.html`, `digest.css`, `digest.js` | The widget: filterable gallery of the current digest |
| `test/run.mjs` | Fixture tests for the parsers, ranking and email template |
| `test/smtp.mjs` | Mail round-trip against a throwaway local SMTP server |
| `data/latest.json` | The current digest (written by CI) |
| `data/email.html` | The same digest as a ready-to-send HTML email |
| `data/archive/*.json` | One snapshot per day |

## Sources

| Source | Endpoint | Popularity signal |
| --- | --- | --- |
| ArtStation | community trending explore feed | position in the trending feed (the feed carries no like counts), or likes when the projects feed answers |
| Reddit | `top?t=day` across the subreddits below | upvotes, or feed position on the Atom fallback |
| Pixiv | daily illustration ranking (plus the R-18 ranking with a session cookie) | bookmarks |
| DeviantArt | Daily Deviations (API) or `boost:popular max_age:24h in:digitalart` RSS | favourites, or position in the feed |
| Bluesky | `searchPosts` over the art hashtags, public AppView, no credentials | likes |
| Danbooru | `order:score age:1d` | score and favourites |

### Subreddits

Fetched as one multireddit request per group of nine — three requests for the
whole list. Reddit rate-limits by request count, so the number of requests
matters more than their size, and the two failure modes are handled
differently:

- **404** — a name in the group is gone. The group is halved and each half
  retried until the bad name is alone, then dropped and reported.
- **429 or worse** — usually Reddit refusing traffic, so the *same* group is
  retried after a pause; splitting first would only send more requests, which
  is what once made 14 live subreddits look dead. If the retry doesn't clear
  it either, it is one subreddit refusing rather than all of Reddit, and the
  group is halved to find it.

Every drop is reported in the digest with its reason, and the run is capped at
24 requests and four minutes.

r/battlemaps is not in the list: it answers `429` to every anonymous feed
request, and isolating it costs enough requests to starve the groups behind it.
Reddit OAuth credentials may reach it — add it back with
`ART_DIGEST_EXTRA_SUBS=battlemaps` if you set them.

| Group | Subreddits |
| --- | --- |
| Fine art | r/Art, r/DigitalArt, r/painting, r/ImaginaryBestOf |
| Concept art | r/ConceptArt, r/SpecArt, r/SciFiArt, r/FantasyArt, r/ImaginaryTechnology, r/ImaginaryArchitecture |
| Tabletop & character art | r/characterdrawing, r/DnD, r/DungeonsAndDragons, r/Pathfinder_RPG, r/Warhammer40k |
| Fandom | r/FanArt, r/ImaginaryCharacters, r/ImaginaryMonsters, r/ImaginaryWesteros, r/AnimeSketch, r/awwnime |
| Worlds | r/ImaginaryLandscapes, r/ImaginaryCityscapes, r/ImaginaryMythology, r/ImaginaryWildlands |

`ART_DIGEST_EXTRA_SUBS=foo,bar` adds to this list; `ART_DIGEST_SUBS=foo,bar`
replaces it entirely. Within Reddit's share of the digest, each subreddit gets a
pick before any subreddit gets a second one, so r/Art can't crowd out the
niche ones.

### Adult work

Adult work is **kept and flagged**, not filtered out: every item carries
`nsfw: true|false`, the widget shows an `18+` badge with an
Everything / SFW / 18+ filter and an optional blur, and the email labels each
adult pick. `ART_DIGEST_NSFW=exclude` drops them instead; `only` keeps nothing
else.

What each source actually returns:

| Source | Adult work |
| --- | --- |
| Reddit | `over_18` posts included and flagged. On the Atom fallback the flag comes from the feed's nsfw category, which is less reliable than the JSON API's |
| Danbooru | `questionable` and `explicit` ratings flagged |
| DeviantArt | mature deviations requested from the API and flagged |
| Bluesky | posts labelled porn / sexual / nudity / graphic-media flagged |
| ArtStation | adult work is flagged, but the logged-out explore feed rarely carries any |
| Pixiv | the R-18 ranking is only served to a logged-in session — set `PIXIV_SESSION` to your own `PHPSESSID` cookie to include it |

Adult/NSFW posts are filtered out of every source. A source that fails is
reported in the digest and in the widget footer instead of failing the run —
the others still ship. A source that answers but whose rows no longer
normalize is reported as `changed`, with a trimmed sample row saved in the
digest so the shape can be fixed without guessing.

### Access from CI

These sites treat datacenter IPs (which is what GitHub's runners are) very
differently from a home connection:

| Source | Without credentials, from CI |
| --- | --- |
| Pixiv | works (all-ages ranking only) |
| ArtStation | works |
| Bluesky | the public AppView answers `403` to GitHub's runners; set `BLUESKY_IDENTIFIER` and `BLUESKY_APP_PASSWORD` (an [app password](https://bsky.app/settings/app-passwords), not your account password) for a signed-in route |
| Danbooru | works |
| Reddit | the JSON API answers `403 Blocked`; the collector falls back to the Atom feed, which works but has no vote counts. Set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` (a *script* app at <https://www.reddit.com/prefs/apps>) to get the real API and real upvote counts |
| DeviantArt | `403` on every RSS host. Set `DEVIANTART_CLIENT_ID` / `DEVIANTART_CLIENT_SECRET` (register at <https://www.deviantart.com/developers/apps>) and the collector uses the official Daily Deviations API instead |

Both are repository secrets (*Settings → Secrets and variables → Actions*) and
both are optional — the digest ships with whatever sources answer.

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
| `ART_DIGEST_SUBS` | see above | Comma-separated subreddits, replacing the default list |
| `ART_DIGEST_EXTRA_SUBS` | unset | Comma-separated subreddits to add to the default list |
| `ART_DIGEST_TAGS` | conceptart, characterart, dnd, fanart, digitalart | Bluesky hashtags to search |
| `ART_DIGEST_SOURCES` | all | Comma-separated source ids to run (`artstation,reddit,pixiv,deviantart,bluesky,danbooru`) |
| `ART_DIGEST_NSFW` | `include` | `include`, `exclude` or `only` |
| `PIXIV_SESSION` | unset | A Pixiv `PHPSESSID` cookie, which unlocks the R-18 daily ranking |
| `BLUESKY_IDENTIFIER` / `BLUESKY_APP_PASSWORD` | unset | A handle and app password, used when the public AppView refuses the request |
| `ART_DIGEST_PIXIV_PROXY` | `https://i.pixiv.re` | Pixiv blocks hotlinked thumbnails, so they're re-served through a mirror. Set to empty to drop Pixiv thumbnails instead |
| `ART_DIGEST_OUT` | `art-digest/data` | Output directory |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | unset | Optional. Reddit blocks datacenter IPs on the public JSON API; with these set the collector uses app-only OAuth instead |
| `DEVIANTART_CLIENT_ID` / `DEVIANTART_CLIENT_SECRET` | unset | Optional. Without them DeviantArt is unreachable from CI; with them the collector reads Daily Deviations from the official API |

## Schedule

`.github/workflows/art-digest.yml` runs the collector every day at 13:05 UTC,
commits `data/` when it changes, and attaches the digest to the run. GitHub
only runs `schedule:` triggers from the **default branch**, so the daily run
starts once this workflow is merged to `master`; until then use *Actions → Art
digest → Run workflow*, or push a change to `collect.mjs`.

## Getting it emailed

`send-email.mjs` sends the digest over SMTP with no dependencies and no
third-party action holding your credentials. The workflow runs it after each
scheduled or manual collection; without credentials it prints a preview and
succeeds, so nothing breaks until you turn it on.

To turn it on, add these repository secrets
(*Settings → Secrets and variables → Actions*):

| Secret | Value |
| --- | --- |
| `DIGEST_SMTP_USER` | the sending address, e.g. `you@gmail.com` |
| `DIGEST_SMTP_PASS` | an [app password](https://myaccount.google.com/apppasswords) — never your account password |
| `DIGEST_TO` | optional; defaults to `DIGEST_SMTP_USER` |

Any SMTP host works: set `DIGEST_SMTP_HOST` / `DIGEST_SMTP_PORT` (defaults
`smtp.gmail.com` and `465`, implicit TLS).

```sh
node art-digest/send-email.mjs --dry-run   # print the message instead of sending
node art-digest/send-email.mjs             # send, if the credentials are set
```

`data/email.html` is also written on every run, so any other mailer can pick it
up as a message body:

```sh
curl -s https://raw.githubusercontent.com/JasonLayel/JLTest/master/art-digest/data/email.html
```

## Tests

```sh
node art-digest/test/run.mjs    # parsers, ranking, thumbnails, email template

# mail round-trip against a throwaway TLS server
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=localhost \
  -keyout /tmp/certs/key.pem -out /tmp/certs/cert.pem
CERT_DIR=/tmp/certs node art-digest/test/smtp.mjs
```

Both run in CI before every collection.
