# Environment variables (names only)

Never commit secret values. Copy `.env.example` for local use.

| Variable | Service | What it does | Required? | Where to obtain | Set value in | If unset |
| --- | --- | --- | --- | --- | --- | --- |
| `OPR_DIRECTORY_DATABASE_URL` | Turso / libSQL (remote) | Remote DB URL (`libsql://` or `https://`) | Optional | [Turso](https://turso.tech/) console | Netlify/Vercel env, `.env` | Uses local JSON file store |
| `OPR_DIRECTORY_DATABASE_AUTH_TOKEN` | Turso | Auth token for remote libSQL | With remote URL | Turso console → token | Netlify/Vercel env, `.env` | Local JSON works without it |
| `OPR_DIRECTORY_JSON_PATH` | Local filesystem | Path for JSON catalog when not using Turso | Optional | — | `.env` | `.data/catalog.json` |
| `OPR_DIRECTORY_ADMIN_TOKEN` | This app | Optional bearer that bypasses daily IP registration rate limit | Optional | Generate a long random string yourself | Netlify/Vercel env, `.env` | Open registration still works with rate limits |
| `OPR_DIRECTORY_PUBLIC_ORIGIN` | This app | Canonical public origin for docs/links | Recommended | Netlify/Vercel URL or `https://providers.devcentr.org` | Host env | Relative links still work |
| `OPR_DIRECTORY_NITRO_PRESET` | Nitro / SolidStart | `node-server` (local), `netlify`, or `vercel` | Optional | — | Netlify sets `netlify` in `netlify.toml` | Defaults to `node-server` |

**Note:** Do not set `OPR_DIRECTORY_DATABASE_URL` to a `file:` libSQL path in serverless builds — native bindings break on Netlify/Vercel Windows/Linux bundles. Use JSON locally and Turso remotely.
