# NeonPocket Console

A mobile-first management console for [Neon.tech](https://neon.tech) built with React + Vite + TypeScript. Uses only real Neon public APIs — **no mock data, no app database, no app-created tables or RLS policies**.

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

- **Typed Neon API client** (`src/lib/neon/`) with Auto transport: direct browser calls to `https://console.neon.tech/api/v2/*` first, then a stateless Cloudflare Worker proxy fallback when the browser blocks direct CORS/preflight.
- **Cloudflare Worker Neon proxy** (`workers/neon-proxy.ts`): a stateless relay that forwards only the current request to Neon's Console API and never stores API keys, request bodies, or responses.
- **Encrypted local vault** (`src/lib/vault.ts`): IndexedDB + Web Crypto AES-GCM. Optional PBKDF2 passphrase. Forget-key and clear-cache controls in Settings.
- **Organization-first workspace flow**: the account shell loads the current user and organization list, requires a workspace before project tools appear, and fetches projects with `org_id` when an organization is selected.
- **TanStack Query** for all remote data, with AbortController and operation polling (running operations are polled, finished/failed stop).
- **Normalized errors** everywhere: status, message, request id, route, timestamp, retryable.
- **No app database. No app-created SQL tables. No app-created RLS policies.** The only persisted local state is UI preferences, the selected project/branch, the diagnostics ring buffer, and (optionally) the encrypted API key.

## Implemented endpoints

Projects · Branches · Databases · Roles · Endpoints · Operations · Organizations · API keys · Regions · Consumption · Data API (get / refresh schema cache via `PATCH /projects/{id}/branches/{id}/data-api/{database}` with empty body) · Branch restore.

Capabilities differ by account, plan, organization role, beta access, and API version. Unsupported responses (`401/403/404/409/422/429/5xx`) surface with the real status and message — nothing is faked.

## Data API limitations

- Beta. Configured per branch + database.
- Browsing rows requires a **valid JWT** with a `sub` claim used by your RLS policies (`auth.jwt() ->> 'sub'`).
- **RLS is always enforced.** NeonPocket never bypasses it.

## Neon API transport

NeonPocket defaults to **Auto** transport. Auto first tries Neon's public Console API directly from the browser. Safari/mobile browsers can return status `0` / `Load failed` when direct CORS/preflight is blocked; in that case Auto falls back to the configured Cloudflare Worker proxy endpoint.

Local `bun run dev` serves `/api/neon-proxy` through Vite middleware. Production/static hosts such as Lovable do not execute `/api/neon-proxy`, so production builds should set a public app environment variable that points to the deployed Worker:

```env
VITE_NEON_PROXY_URL=https://neonpocket-neon-proxy.<your-cloudflare-subdomain>.workers.dev
```

The proxy forwards only the current request to Neon's API, rejects non-relative paths, validates allowed browser origins, and does not store keys, request bodies, or responses.

## Cloudflare Worker proxy setup

Use the Worker proxy for Lovable, static hosting, Safari, and any environment where direct browser calls to Neon's Console API are blocked by CORS/preflight.

### 1. Deploy the Worker

The Worker source lives at:

```txt
workers/neon-proxy.ts
```

Example Wrangler config lives at:

```txt
workers/wrangler.example.jsonc
```

Copy it to a local deploy config, edit the values, then deploy:

```bash
cp workers/wrangler.example.jsonc workers/wrangler.jsonc
# edit workers/wrangler.jsonc
npx wrangler deploy --config workers/wrangler.jsonc
```

### 2. Cloudflare Worker variables

Set these variables on the Cloudflare Worker:

| Variable | Where | Required | Example | Notes |
|---|---|---:|---|---|
| `ALLOWED_ORIGINS` | Cloudflare Worker → Settings → Variables and Secrets | Yes | `https://id-preview--xxxx.lovable.app,https://webusta.org,http://localhost:8080` | Comma-separated exact browser origins allowed to call the Worker. Do **not** include paths. |
| `NEON_BASE_URL` | Cloudflare Worker → Settings → Variables and Secrets | No | `https://console.neon.tech/api/v2` | Optional override. Leave unset unless testing. |

Do **not** put a Neon API key in Cloudflare Worker variables. NeonPocket is user-key based: the user enters their own Neon Console API key inside the app, and the Worker forwards that one request without storing it.

### 3. Lovable / static app variable

Set this public environment variable in Lovable or your static host:

```env
VITE_NEON_PROXY_URL=https://neonpocket-neon-proxy.<your-cloudflare-subdomain>.workers.dev
```

After changing this variable, rebuild/redeploy the Vite app so the value is embedded into the client bundle.

### 4. Neon API key location

The Neon Console API key is entered only in the NeonPocket UI:

```txt
Connect screen → Neon API key → napi_...
```

If “Remember on this device” is enabled, the key is encrypted locally in the browser via IndexedDB + Web Crypto. It is not committed to git, not placed in Cloudflare, and not stored in an app database.

### 5. Recommended runtime setting

Use:

```txt
Settings → API transport → Auto
```

Auto tries direct Neon API access first and then falls back to `VITE_NEON_PROXY_URL` when the browser blocks the direct request. If you want to force the Worker path during testing, use:

```txt
Settings → API transport → Proxy
```

## Security

- API keys and JWTs are never logged. Authorization headers are redacted from diagnostics.
- Secrets never appear in URLs.
- The Cloudflare Worker does not persist keys, request bodies, or responses.
- The Worker allowlists browser origins with `ALLOWED_ORIGINS`.
- Encrypted vault is local-only. "Forget key" wipes ciphertext + metadata.
- "Clear local cache" removes UI preferences, selection, and diagnostics.
- "Sign out" clears in-memory API key and selection state.

## References

- Neon API: https://neon.com/docs/reference/api-reference
- Neon Data API overview: https://neon.com/docs/data-api/overview
- Neon Data API getting started: https://neon.com/docs/data-api/get-started
- Cloudflare Workers Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/
- Cloudflare Workers environment variables: https://developers.cloudflare.com/workers/configuration/environment-variables/
