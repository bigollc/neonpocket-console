const DEFAULT_NEON_BASE = "https://console.neon.tech/api/v2";

interface Env {
  /** Static Vite app assets generated into ./dist and bound by wrangler.jsonc. */
  ASSETS: Fetcher;
  /** Optional D1 binding for app profile/audit sync. The app works without it. */
  DB?: any;
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
  keyHash?: string;
  keyHint?: string;
  deviceAuthEnabled?: boolean;
  settings?: unknown;
  userAgent?: string;
  language?: string;
  timezone?: string;
}

const PROXY_PATH = "/api/neon-proxy";
const PROFILE_PATH = "/api/app-profile";

const json = (body: unknown, status: number, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
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

function clientIp(request: Request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

function normalizeProfile(body: AppProfileBody) {
  const email = String(body.email || "").slice(0, 320);
  const keyHash = String(body.keyHash || "").slice(0, 128);
  const userId = keyHash || email || crypto.randomUUID();
  return {
    userId,
    userName: String(body.userName || email || "Neon user").slice(0, 200),
    email,
    keyHash,
    keyHint: String(body.keyHint || "").slice(0, 32),
    deviceAuthEnabled: body.deviceAuthEnabled ? 1 : 0,
    settingsJson: JSON.stringify(body.settings || {}),
    userAgent: String(body.userAgent || "").slice(0, 600),
    language: String(body.language || "").slice(0, 80),
    timezone: String(body.timezone || "").slice(0, 120),
  };
}

async function runOptionalSchemaPatch(db: any, sql: string) {
  try {
    await db.prepare(sql).run();
  } catch {
    // Ignore duplicate-column or unsupported patch errors. The primary CREATE TABLE
    // statements below are the source of truth for fresh D1 databases.
  }
}

async function ensureProfileSchema(db: any) {
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

  if (!env.DB) {
    return json({ ok: true, stored: false, reason: "D1 binding is not configured" }, 200, cors);
  }

  let body: AppProfileBody;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, stored: false, error: "Invalid JSON body" }, 400, cors);
  }

  const profile = normalizeProfile(body);
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

    return json({ ok: true, stored: true, profile_id: profile.userId, at: now }, 200, cors);
  } catch (error) {
    return json({
      ok: false,
      stored: false,
      error: "D1 profile sync failed",
      detail: errorMessage(error),
      hint: "Check the DB binding, database id, and whether old tables need a manual migration/drop if their schema differs.",
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

  const auth = request.headers.get("Authorization");
  if (!auth || !/^Bearer\s+\S+/i.test(auth)) {
    return json({ error: "Missing Authorization: Bearer <NEON_API_KEY>" }, 401, cors);
  }

  let payload: ForwardBody;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const method = (payload.method || "GET").toUpperCase();
  if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    return json({ error: "Unsupported method" }, 405, cors);
  }

  const path = String(payload.path || "");
  if (!path.startsWith("/")) {
    return json({ error: "Path must start with /" }, 400, cors);
  }

  if (path.includes("..") || path.includes("://")) {
    return json({ error: "Disallowed path" }, 400, cors);
  }

  const upstreamUrl = new URL(`${safeBase(env)}${path}`);
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
  } catch (error: any) {
    return json({ error: error?.message || "Neon upstream request failed" }, 502, cors);
  }

  const responseHeaders = new Headers(cors);
  responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");

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
