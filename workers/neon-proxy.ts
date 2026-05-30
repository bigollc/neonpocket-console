interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

const DEFAULT_NEON_BASE = "https://console.neon.tech/api/v2";

interface D1PreparedStatement {
  bind(...values: unknown[]): { run(): Promise<unknown> };
  run(): Promise<unknown>;
}

interface D1DatabaseBinding {
  prepare(sql: string): D1PreparedStatement;
}

interface Env {
  /** Static Vite app assets generated into ./dist and bound by wrangler.jsonc. */
  ASSETS: Fetcher;
  /** Optional D1 binding for app profile/audit sync. The app works without it. */
  DB?: D1DatabaseBinding;
  /** Comma-separated browser origins allowed to call this Worker. Use exact origins, or * only during testing. */
  ALLOWED_ORIGINS?: string;
  /** Optional override for testing. Production should normally keep the default Neon Console API base. */
  NEON_BASE_URL?: string;
}

interface ForwardBody {
  method?: string;
  path?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

interface AppProfileBody {
  userName?: string;
  email?: string;
  deviceAuthEnabled?: boolean;
  settings?: unknown;
  userAgent?: string;
  language?: string;
  timezone?: string;
}

const PROXY_PATH = "/api/neon-proxy";
const PROFILE_PATH = "/api/app-profile";
const MAX_JSON_BODY_BYTES = 64 * 1024;
const MAX_SETTINGS_JSON_BYTES = 16 * 1024;
const MAX_PROXY_PATH_CHARS = 2048;

const json = (body: unknown, status: number, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      ...headers,
    },
  });

function allowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin") || "";
  const requestOrigin = new URL(request.url).origin;
  const configured = (env.ALLOWED_ORIGINS || requestOrigin)
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  if (configured.includes("*")) return "*";
  if (origin && configured.includes(origin)) return origin;
  if (!origin && configured.includes(requestOrigin)) return requestOrigin;
  return null;
}

function corsHeaders(request: Request, env: Env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return null;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  } satisfies HeadersInit;
}

function safeBase(env: Env) {
  const value = (env.NEON_BASE_URL || DEFAULT_NEON_BASE).replace(/\/+$/, "");
  return value || DEFAULT_NEON_BASE;
}

function hasUnsafePathCharacter(value: string) {
  return Array.from(value).some(char => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 || char === "\\" || char === "?" || char === "#";
  });
}

function normalizeProxyPath(rawPath: unknown) {
  const path = String(rawPath || "");
  if (!path.startsWith("/")) throw new Error("Path must start with /");
  if (path.length > MAX_PROXY_PATH_CHARS) throw new Error("Path is too long");
  if (hasUnsafePathCharacter(path) || path.includes("://")) throw new Error("Disallowed path");
  if (/%2f|%5c/i.test(path)) throw new Error("Disallowed path");

  let decoded = path;
  try { decoded = decodeURIComponent(path); } catch { throw new Error("Disallowed path"); }
  if (hasUnsafePathCharacter(decoded) || decoded.includes("://")) throw new Error("Disallowed path");
  if (decoded.split("/").some(segment => segment === "." || segment === "..")) throw new Error("Disallowed path");
  return path;
}

function safeUpstreamUrl(env: Env, path: string) {
  const base = new URL(safeBase(env));
  const apiRoot = base.pathname.replace(/\/$/, "");
  const url = new URL(`${apiRoot}${path}`, base.origin);
  if (url.origin !== base.origin || !url.pathname.startsWith(`${apiRoot}/`)) {
    throw new Error("Disallowed path");
  }
  return url;
}


function bearerToken(request: Request) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+([^\r\n]+)$/i);
  const token = match?.[1]?.trim() || "";
  return token || null;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function keyHintFromToken(token: string) {
  if (!token) return "";
  return token.length <= 12 ? "••••" : `${token.slice(0, 5)}…${token.slice(-4)}`;
}

async function readJsonBody<T>(request: Request): Promise<T> {
  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength > MAX_JSON_BODY_BYTES) throw new Error("Request body is too large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) throw new Error("Request body is too large");
  return JSON.parse(text || "{}");
}

function clientIp(request: Request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

async function normalizeProfile(body: AppProfileBody, neonApiKey: string) {
  const email = String(body.email || "").trim().slice(0, 320);
  const keyHash = await sha256Hex(neonApiKey);
  const settingsJson = JSON.stringify(body.settings && typeof body.settings === "object" ? body.settings : {});
  if (new TextEncoder().encode(settingsJson).byteLength > MAX_SETTINGS_JSON_BYTES) {
    throw new Error("Settings payload is too large");
  }

  return {
    userId: keyHash,
    userName: String(body.userName || email || "Neon user").trim().slice(0, 200),
    email,
    keyHash,
    keyHint: keyHintFromToken(neonApiKey),
    deviceAuthEnabled: body.deviceAuthEnabled ? 1 : 0,
    settingsJson,
    userAgent: String(body.userAgent || "").slice(0, 600),
    language: String(body.language || "").slice(0, 80),
    timezone: String(body.timezone || "").slice(0, 120),
  };
}

async function runOptionalSchemaPatch(db: D1DatabaseBinding, sql: string) {
  try {
    await db.prepare(sql).run();
  } catch {
    // Ignore duplicate-column or unsupported patch errors. The primary CREATE TABLE
    // statements below are the source of truth for fresh D1 databases.
  }
}

async function ensureProfileSchema(db: D1DatabaseBinding) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_profiles (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      user_name TEXT,
      neon_key_hash TEXT,
      neon_key_hint TEXT,
      device_auth_enabled INTEGER NOT NULL DEFAULT 0,
      settings_json TEXT,
      user_agent TEXT,
      language TEXT,
      timezone TEXT,
      last_ip TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      event TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  await runOptionalSchemaPatch(db, "ALTER TABLE app_profiles ADD COLUMN last_ip TEXT");
  await runOptionalSchemaPatch(db, "ALTER TABLE app_profiles ADD COLUMN language TEXT");
  await runOptionalSchemaPatch(db, "ALTER TABLE app_profiles ADD COLUMN timezone TEXT");
}

async function handleAppProfile(request: Request, env: Env) {
  const cors = corsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return cors ? new Response(null, { status: 204, headers: cors }) : json({ error: "Origin is not allowed" }, 403);
  }
  if (!cors) return json({ error: "Origin is not allowed" }, 403);
  if (request.method !== "POST") return json({ error: "Only POST is supported" }, 405, cors);

  const neonApiKey = bearerToken(request);
  if (!neonApiKey) {
    return json({ ok: false, stored: false, error: "Missing Authorization: Bearer <NEON_API_KEY>" }, 401, cors);
  }

  if (!env.DB) {
    return json({ ok: true, stored: false, reason: "D1 binding is not configured" }, 200, cors);
  }

  let body: AppProfileBody;
  try {
    body = await readJsonBody<AppProfileBody>(request);
  } catch (error) {
    const message = errorMessage(error);
    return json({ ok: false, stored: false, error: message === "Request body is too large" ? message : "Invalid JSON body" }, 400, cors);
  }

  let profile: Awaited<ReturnType<typeof normalizeProfile>>;
  try {
    profile = await normalizeProfile(body, neonApiKey);
  } catch (error) {
    return json({ ok: false, stored: false, error: errorMessage(error) }, 400, cors);
  }
  const now = new Date().toISOString();
  const ip = clientIp(request);

  try {
    await ensureProfileSchema(env.DB);

    await env.DB.prepare(`
      INSERT INTO app_profiles (
        user_id, email, user_name, neon_key_hash, neon_key_hint, device_auth_enabled,
        settings_json, user_agent, language, timezone, last_ip, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        email=excluded.email,
        user_name=excluded.user_name,
        neon_key_hash=excluded.neon_key_hash,
        neon_key_hint=excluded.neon_key_hint,
        device_auth_enabled=excluded.device_auth_enabled,
        settings_json=excluded.settings_json,
        user_agent=excluded.user_agent,
        language=excluded.language,
        timezone=excluded.timezone,
        last_ip=excluded.last_ip,
        updated_at=excluded.updated_at
    `).bind(
      profile.userId,
      profile.email,
      profile.userName,
      profile.keyHash,
      profile.keyHint,
      profile.deviceAuthEnabled,
      profile.settingsJson,
      profile.userAgent,
      profile.language,
      profile.timezone,
      ip,
      now,
      now,
    ).run();

    await env.DB.prepare(`
      INSERT INTO app_audit_events (id, user_id, event, ip, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), profile.userId, "profile_synced", ip, profile.userAgent, now).run();

    return json({ ok: true, stored: true, at: now }, 200, cors);
  } catch (error) {
    return json({
      ok: false,
      stored: false,
      error: "D1 profile sync failed",
      hint: "Check the DB binding and database id. Server logs contain the internal failure detail.",
    }, 500, cors);
  }
}

async function handleNeonProxy(request: Request, env: Env) {
  const cors = corsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return cors
      ? new Response(null, { status: 204, headers: cors })
      : json({ error: "Origin is not allowed" }, 403);
  }

  if (!cors) {
    return json({ error: "Origin is not allowed" }, 403);
  }

  if (request.method !== "POST") {
    return json({ error: "Only POST is supported" }, 405, cors);
  }

  const auth = request.headers.get("Authorization") || "";
  if (!bearerToken(request)) {
    return json({ error: "Missing Authorization: Bearer <NEON_API_KEY>" }, 401, cors);
  }

  let payload: ForwardBody;
  try {
    payload = await readJsonBody<ForwardBody>(request);
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const method = (payload.method || "GET").toUpperCase();
  if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    return json({ error: "Unsupported method" }, 405, cors);
  }

  let path: string;
  let upstreamUrl: URL;
  try {
    path = normalizeProxyPath(payload.path);
    upstreamUrl = safeUpstreamUrl(env, path);
  } catch (error) {
    return json({ error: errorMessage(error) }, 400, cors);
  }
  if (payload.query) {
    for (const [key, value] of Object.entries(payload.query)) {
      if (value !== undefined && value !== null && value !== "") {
        upstreamUrl.searchParams.append(key, String(value));
      }
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      method,
      headers: {
        "Accept": "application/json",
        "Authorization": auth,
        ...(payload.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: payload.body !== undefined ? JSON.stringify(payload.body) : undefined,
    });
  } catch (error) {
    return json({ error: errorMessage(error) || "Neon upstream request failed" }, 502, cors);
  }

  const responseHeaders = new Headers(cors);
  responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Cache-Control", "no-store");

  const neonRequestId = upstream.headers.get("neon-request-id") || upstream.headers.get("x-request-id");
  if (neonRequestId) responseHeaders.set("neon-request-id", neonRequestId);

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === PROXY_PATH) return handleNeonProxy(request, env);
    if (url.pathname === PROFILE_PATH) return handleAppProfile(request, env);

    return env.ASSETS.fetch(request);
  },
};
