# 🎨 Daily Digital Art Digest

A small widget that collects the most popular **new** digital art from
**ArtStation**, **Reddit**, **Pixiv** and **DeviantArt**, ranks it into one
list, and sends it to you.

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
| Reddit | `top?t=day` across r/Art, r/DigitalArt, r/ImaginaryLandscapes, r/ImaginaryCharacters, r/ConceptArt, r/SciFiArt, r/FantasyArt | upvotes, or feed position on the Atom fallback |
| Pixiv | public daily illustration ranking | bookmarks |
| DeviantArt | Daily Deviations (API) or `boost:popular max_age:24h in:digitalart` RSS | favourites, or position in the feed |

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
| Pixiv | works |
| ArtStation | works |
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
| `ART_DIGEST_SUBS` | see above | Comma-separated subreddits |
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
