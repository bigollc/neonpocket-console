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

- **Typed Neon API client** (`src/lib/neon/`) with two modes:
  - **Direct** — calls `https://console.neon.tech/api/v2/*` from the browser.
  - **Fallback proxy** — the default mode. POSTs to `VITE_NEON_PROXY_URL` when set, otherwise `/api/neon-proxy` (`api/neon-proxy.ts`), a **stateless** forwarder that relays the current request and never persists keys, bodies, or responses. Vite serves the same proxy handler during local development.
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

## CORS fallback

NeonPocket defaults to **API mode → Fallback proxy** because direct browser calls to `console.neon.tech` can be blocked by CORS. Local `bun run dev` serves this route through Vite middleware. The browser posts to `import.meta.env.VITE_NEON_PROXY_URL || "/api/neon-proxy"`, so production builds can point at an external proxy endpoint without code changes.

For production, deploy `api/neon-proxy.ts` to a platform that actually runs backend/serverless code. The recommended target for this repository is a Vercel Edge/Web Fetch-style function exposed at `https://<your-vercel-project>.vercel.app/api/neon-proxy`; equivalent Netlify, Deno Deploy, or Supabase Edge deployments are also fine if they expose the same POST contract and call the shared `api/neon-proxy-handler.ts`. The proxy forwards only to Neon's base URL, rejects non-Neon paths, and persists nothing.

### Lovable deployment note

Lovable hosting can publish the Vite app as static files, and static hosting alone does **not** execute the `/api/neon-proxy` route. If `/api/neon-proxy` is not backed by a real serverless/edge deployment, the app must not be treated as successfully connected just because the static UI loaded: proxy requests will fail or be blocked. Deploy the proxy to a backend-capable target such as Vercel Edge at `https://<your-vercel-project>.vercel.app/api/neon-proxy`, then set Lovable's public environment variable to that absolute URL, for example:

```env
VITE_NEON_PROXY_URL=https://<your-vercel-project>.vercel.app/api/neon-proxy
```

Rebuild/redeploy the Lovable app after setting the variable so Vite embeds the public proxy URL in the client bundle.

## Security

- API keys and JWTs are never logged. Authorization headers are redacted from diagnostics.
- Secrets never appear in URLs.
- Encrypted vault is local-only. "Forget key" wipes ciphertext + metadata.
- "Clear local cache" removes UI preferences, selection, and the diagnostics buffer.
- "Sign out" clears in-memory API key and selection state.

## References

- Neon API: https://neon.com/docs/reference/api-reference
- Neon Data API overview: https://neon.com/docs/data-api/overview
- Data API getting started: https://neon.com/docs/data-api/get-started
