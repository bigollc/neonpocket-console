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

Open the app, paste your Neon API key (create one in the Neon Console under **Account → API keys**), and you're in.

## Architecture

- **Typed Neon API client** (`src/lib/neon/`) with two modes:
  - **Direct** — calls `https://console.neon.tech/api/v2/*` from the browser.
  - **Fallback proxy** — POSTs to `/api/neon-proxy` (`api/neon-proxy.ts`), a **stateless** forwarder that relays the current request and never persists keys, bodies, or responses.
- **Encrypted local vault** (`src/lib/vault.ts`): IndexedDB + Web Crypto AES-GCM. Optional PBKDF2 passphrase. Forget-key and clear-cache controls in Settings.
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

If direct browser calls to `console.neon.tech` are blocked by CORS, switch **API mode → Fallback proxy** in Settings. Deploy `api/neon-proxy.ts` to any platform supporting Vercel-style Web Fetch handlers (Vercel, Netlify, Deno Deploy). The proxy forwards only to Neon's base URL, rejects non-Neon paths, and persists nothing.

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
