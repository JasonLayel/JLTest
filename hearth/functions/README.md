# `/api/hearth`

One 2nd-gen HTTPS function, four ops, selected by `op` in the POST body.

| op | Model | Returns |
| --- | --- | --- |
| `hello` | none | `{arc, ledger, name}` from `compass.json`. No model call, so opening the app is free. |
| `scope` | `claude-sonnet-5-5` | `{title, reply, forecast, steps[]}` — the piece cut down to one sitting. |
| `talk` | `claude-haiku-5-5` | `{reply}`, or `{reply, step}` when a step just finished. |
| `close` | `claude-sonnet-5-5` | `{moved, win, nextSentence}`. |

## Setup

```sh
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions
```

`compass.json` must be present in this directory. The `predeploy` hook in
`../firebase.json` copies it from the project root; it is gitignored here so
there is only one canonical copy.

## Notes

- The system prompt is assembled from `compass.json` on every call — edit the
  Compass, not the prompt text, to change who the companion is talking to.
- Sonnet calls ask for the server-side refusal fallback
  (`server-side-fallback-2026-07-01`). If a deployment rejects that beta the
  call is retried once without it, so the feature can never break a session.
- Model responses for `scope` and `close` are requested as JSON and parsed
  tolerantly; if parsing fails the raw text is shown rather than an error.
- Transcripts are normalized before sending: the companion's opening line is
  dropped and same-role runs are merged, because the Messages API wants an
  alternating conversation that starts on a user turn.
- **No App Check yet.** The endpoint is public. Add it before sharing the URL.
