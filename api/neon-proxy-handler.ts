/**
 * Stateless Web Fetch handler for the Neon API proxy.
 *
 * This exists only for deployments that can run backend/serverless code. Static
 * hosts must set VITE_NEON_PROXY_URL to a deployed copy of this endpoint.
 */

const NEON_BASE = "https://console.neon.tech/api/v2";
const MAX_JSON_BODY_BYTES = 64 * 1024;
const MAX_PROXY_PATH_CHARS = 2048;

declare const process: { env?: Record<string, string | undefined> } | undefined;

interface ForwardBody {
  method?: string;
  path?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

function allowedOrigin(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const requestOrigin = new URL(req.url).origin;
  const configured = ((typeof process !== "undefined" ? process.env?.ALLOWED_ORIGINS : undefined) || requestOrigin)
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  if (configured.includes("*")) return "*";
  if (origin && configured.includes(origin)) return origin;
  if (!origin && configured.includes(requestOrigin)) return requestOrigin;
  return null;
}

function corsHeaders(req: Request) {
  const origin = allowedOrigin(req);
  if (!origin) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  } satisfies HeadersInit;
}

const json = (body: unknown, status: number, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", ...headers },
  });


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

function safeUpstreamUrl(path: string) {
  const base = new URL(NEON_BASE);
  const url = new URL(`${base.pathname.replace(/\/$/, "")}${path}`, base.origin);
  if (url.origin !== base.origin || !url.pathname.startsWith(`${base.pathname.replace(/\/$/, "")}/`)) {
    throw new Error("Disallowed path");
  }
  return url;
}

async function readJsonBody<T>(req: Request): Promise<T> {
  const contentLength = Number(req.headers.get("Content-Length") || "0");
  if (contentLength > MAX_JSON_BODY_BYTES) throw new Error("Request body is too large");
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) throw new Error("Request body is too large");
  return JSON.parse(text || "{}");
}

export default async function handler(req: Request): Promise<Response> {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return cors ? new Response(null, { status: 204, headers: cors }) : json({ error: "Origin is not allowed" }, 403);
  }

  if (!cors) return json({ error: "Origin is not allowed" }, 403);

  if (req.method !== "POST") {
    return json({ error: "Only POST is supported" }, 405, cors);
  }

  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+[^\r\n]+$/i.test(auth)) {
    return json({ error: "Missing Authorization: Bearer <NEON_API_KEY>" }, 401, cors);
  }

  let payload: ForwardBody;
  try { payload = await readJsonBody<ForwardBody>(req); } catch (error) {
    const detail = errorMessage(error);
    const message = detail === "Request body is too large" ? detail : "Invalid JSON body";
    return json({ error: message }, 400, cors);
  }

  const method = (payload.method || "GET").toUpperCase();
  if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    return json({ error: "Unsupported method" }, 405, cors);
  }

  let path: string;
  let url: URL;
  try {
    path = normalizeProxyPath(payload.path);
    url = safeUpstreamUrl(path);
  } catch (error) {
    return json({ error: errorMessage(error) }, 400, cors);
  }
  if (payload.query) {
    for (const [k, v] of Object.entries(payload.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.append(k, String(v));
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(url.toString(), {
      method,
      headers: {
        "Accept": "application/json",
        "Authorization": auth,
        ...(payload.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: payload.body !== undefined ? JSON.stringify(payload.body) : undefined,
    });
  } catch (error) {
    return json({ error: errorMessage(error) || "Neon proxy upstream request failed" }, 502, cors);
  }

  const text = await upstream.text();
  const headers = new Headers(cors);
  headers.set("Content-Type", upstream.headers.get("content-type") || "application/json");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "no-store");
  const reqId = upstream.headers.get("neon-request-id") || upstream.headers.get("x-request-id");
  if (reqId) headers.set("neon-request-id", reqId);
  return new Response(text, { status: upstream.status, headers });
}
