# NeonPocket Console
<img width="1320" height="2682" alt="image" src="https://github.com/user-attachments/assets/6cb50329-5fa0-4305-b1f6-6b4c18fc4577" />

A mobile-first management console for [Neon.tech](https://neon.tech) built with React + Vite + TypeScript. Uses only real Neon public APIs — **no mock data for Neon resources, no app-created Neon SQL tables, and no app-created Neon RLS policies**.

## Setup

```bash
bun install
bun run dev      # local dev
bun run build    # production build
bun run lint
bun run test
```

Open the app, paste your Neon Console API key (generate one from the Neon Console profile menu under **Account settings → API keys**; current keys typically start with `napi_`), choose a workspace/organization, then select one of its projects.

## Architecture

- **Typed Neon API client** (`src/lib/neon/`) using the configured proxy endpoint so Neon API keys stay out of URLs and browser CORS behavior is consistent.
- **Cloudflare Worker Neon proxy** (`workers/neon-proxy.ts`): a stateless relay that forwards only the current request to Neon's Console API and never stores raw API keys, request bodies, or responses.
- **Encrypted local vault** (`src/lib/vault.ts`): IndexedDB + Web Crypto AES-GCM. Optional PBKDF2 passphrase. Forget-key and clear-cache controls in Settings.
- **Device authentication gate** (`src/lib/deviceAuth.ts`): optional platform authenticator unlock for the local vault. On iPhone this is Face ID, on supported Apple devices Touch ID, and on supported Windows devices Windows Hello.
- **Optional Cloudflare D1 profile sync** (`/api/app-profile`): stores app profile/audit metadata only when enabled and when a D1 binding exists. The endpoint requires the current Bearer key, derives the key hash server-side, and never stores the raw Neon API key.
- **Organization-first workspace flow**: project tools stay locked until a workspace is explicitly selected.
- **TanStack Query** for all remote data, with AbortController and operation polling (running operations are polled, finished/failed stop).
- **Normalized errors** everywhere: status, message, request id, route, timestamp, retryable.

## Implemented endpoints

Projects · Branches · Databases · Roles · Endpoints · Operations · Organizations · API keys · Regions · Consumption · Data API (get / refresh schema cache via `PATCH /projects/{id}/branches/{id}/data-api/{database}` with empty body) · Branch restore.

Capabilities differ by account, plan, organization role, beta access, and API version. Unsupported responses (`401/403/404/409/422/429/5xx`) surface with the real status and message — nothing is faked.

## Data API limitations

- Beta. Configured per branch + database.
- Browsing rows requires a **valid JWT** with a `sub` claim used by your RLS policies (`auth.jwt() ->> 'sub'`).
- **RLS is always enforced.** NeonPocket never bypasses it.

## Neon API transport

NeonPocket defaults to **Auto** transport. Auto first tries Neon's public Console API directly from the browser. Safari/mobile browsers can return status `0` / `Load failed` when direct CORS/preflight is blocked; in that case Auto falls back to the configured Cloudflare Worker proxy endpoint.

When the app and Worker are deployed together on Cloudflare Workers, the default relative proxy path works:

```txt
/api/neon-proxy
```

If you host the frontend separately from the Worker, set a public app environment variable that points to the deployed Worker endpoint:

```env
VITE_NEON_PROXY_URL=https://<your-worker-domain>/api/neon-proxy
```

The proxy forwards only the current request to Neon's API, rejects non-relative paths, validates allowed browser origins, and does not store keys, request bodies, or responses.

## Cloudflare Worker setup

The Worker source lives at:

```txt
workers/neon-proxy.ts
```

The root deploy config is:

```txt
wrangler.jsonc
```

Deploy:

```bash
npx wrangler deploy
```

### Cloudflare Worker variables

Set these variables on the Cloudflare Worker:

| Variable | Required | Example | Notes |
|---|---:|---|---|
| `ALLOWED_ORIGINS` | Yes | `https://neon.webusta.org,http://localhost:8080` | Comma-separated exact browser origins allowed to call the Worker. Do **not** include paths. |
| `NEON_BASE_URL` | No | `https://console.neon.tech/api/v2` | Optional override. Leave unset unless testing. |

Do **not** put a Neon API key in Cloudflare Worker variables. NeonPocket is user-key based: the user enters their own Neon Console API key inside the app, and the Worker forwards that one request without storing it.

## Optional Cloudflare D1 profile sync

A database is **not required** for core NeonPocket usage. Use D1 only when you want app-owned profile and audit metadata. The implementation stores profile details, settings subset, user agent, IP as seen by Cloudflare, device-auth state, and a Neon key hash/hint. It does **not** store the raw Neon API key.

See:

```txt
docs/cloudflare-d1-profile-sync.md
```

Recommended use:

```txt
Settings → API & Cloud profile → Cloud profile sync
```

Keep this off unless you have bound a D1 database and you intentionally want profile/audit records.

## Device authentication / Face ID

Set up local device authentication here:

```txt
Settings → Security → Device authentication → Set up
```

This uses the browser platform authenticator. On iPhone Safari it can trigger Face ID. On other platforms it uses the native authenticator supported by the browser and OS.

It protects local stored-key unlocks. It is not a replacement for Neon-side API key permissions.

## Neon API key location

The Neon Console API key is entered only in the NeonPocket UI:

```txt
Connect screen → Neon API key → napi_...
```

If “Remember on this device” is enabled, the key is encrypted locally in the browser via IndexedDB + Web Crypto. It is not committed to git, not placed in Cloudflare, and not stored raw in D1.

## Recommended runtime setting

Use:

```txt
Settings → API transport → Auto
```

Auto tries direct Neon API access first and then falls back to the Worker proxy when the browser blocks the direct request. If you want to force the Worker path during testing, use:

```txt
Settings → API transport → Proxy
```

## Security

- API keys and JWTs are never logged. Authorization headers are redacted from diagnostics.
- Secrets never appear in URLs.
- The Cloudflare Worker proxy does not persist raw keys, request bodies, or Neon responses.
- Optional D1 profile sync requires Bearer authorization, derives profile ownership server-side from the Neon API key hash, and stores only app metadata, key hash, and key hint.
- The Worker allowlists browser origins with `ALLOWED_ORIGINS`.
- Encrypted vault is local-only. "Forget key" wipes ciphertext + metadata.
- Device authentication can protect local vault unlocks with Face ID / Touch ID / Windows Hello where supported.
- "Clear local cache" removes UI preferences, selection, and diagnostics.
- "Sign out" clears in-memory API key and selection state.

## References

- Neon API: https://neon.com/docs/reference/api-reference
- Neon Data API overview: https://neon.com/docs/data-api/overview
- Neon Data API getting started: https://neon.com/docs/data-api/get-started
- Cloudflare Workers Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/
- Cloudflare Workers environment variables: https://developers.cloudflare.com/workers/configuration/environment-variables/
- Cloudflare D1: https://developers.cloudflare.com/d1/
