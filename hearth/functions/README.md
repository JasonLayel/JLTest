# `/api/hearth`

One 2nd-gen HTTPS function, four ops, selected by `op` in the POST body.

| op | Model | Returns |
| --- | --- | --- |
| `hello` | none | `{companion, arc, ledger, name}`. No model call, so opening the app is free. |
| `scope` | `claude-sonnet-5-5` | `{title, reply, forecast, steps[]}` — the piece cut down to one sitting. |
| `talk` | `claude-haiku-5-5` | `{reply}`, or `{reply, step}` when a step just finished. |
| `close` | `claude-sonnet-5-5` | `{moved, win, nextSentence}`. |
| `voicecheck` | `claude-haiku-5-5` | Five canned scenarios and their replies. Touches no real state. |
| `pull` | none | The stored state for this sync key. |
| `push` | none | Merges the sent state into the stored one and returns the merged truth. |
| `profile` | none | The authored `_profile.json`, so another project can read it instead of keeping a copy. |

## Setup

```sh
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions
```

`companions/` must be present in this directory. The `predeploy` hook in
`../firebase.json` copies it from the project root; it is gitignored here so
there is only one canonical copy.

`companions/_profile.json` is the shared person. `companions/<id>.json` is one
companion. The request's `companion` field selects it and falls back to
`hearth`, so adding another advisor is a new JSON file and nothing else.

## Sync

`pull`, `push` and `profile` need **Firestore enabled** on the project. They
cost no tokens, so they skip the model guards but keep the rate limit. If
Firestore is missing the endpoint answers 503 and the app carries on without
sync rather than breaking.

State lives at `hearth/{sha256(key)}/companions/{companionId}`. The passphrase
is never stored, only its hash, and it is the only credential: there are no
accounts. Merging is in `sync.js` and is append-biased on purpose, because
losing a session is unacceptable and a duplicate is merely annoying.

## Notes

- The system prompt is assembled from the companion files on every call. Edit
  those, not the prompt text.
- `personaPrompt()` is deliberately written loose, warm and without em dashes.
  A model copies the style of its own instructions, so tidy report prose in
  here produces a companion that talks like a report.
- Every reply goes through `style.js` and is regenerated up to three times if
  it drifts. The rejection note names the offending phrase as it appeared, so
  the retry instruction is something the model can act on.
- Sonnet calls ask for the server-side refusal fallback
  (`server-side-fallback-2026-07-01`). If a deployment rejects that beta the
  call is retried once without it, so the feature can never break a session.
- Model responses for `scope` and `close` are requested as JSON and parsed
  tolerantly; if parsing fails the raw text is shown rather than an error.
- Transcripts are normalized before sending: the companion's opening line is
  dropped and same-role runs are merged, because the Messages API wants an
  alternating conversation that starts on a user turn.
- **No App Check yet.** The endpoint is public. Add it before sharing the URL.
