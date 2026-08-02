# Ignite Cloud Functions

`backstory` — a 2nd-gen HTTPS function that generates a 2–3 sentence backstory
for a character/place art task using **Claude Haiku 4.5**.

The Ignite app (in the parent folder) calls it at `/api/backstory`, mapped to
this function by the Hosting rewrite in `../firebase.json`, so requests are
same-origin and the API key never reaches the browser.

## Setup & deploy

Requires the Firebase **Blaze** plan (Cloud Functions need it).

```sh
firebase functions:secrets:set ANTHROPIC_API_KEY   # paste your Anthropic key
firebase deploy --only functions,hosting
```

## Request / response

```
POST /api/backstory
{ "task": "...", "category": "...", "primary": "...", "secondary": "...", "palette": "..." }

200 → { "backstory": "..." }
```

## Notes

- Model: `claude-haiku-4-5`, `max_tokens: 220`. ~$0.001 per call.
- Best-effort per-instance rate limit (20 req/min/IP). For a public site, add
  [Firebase App Check](https://firebase.google.com/docs/app-check) to stop
  others from calling the endpoint and spending your credits.
- To switch providers/models, edit `model` (and the client) in `index.js`.
