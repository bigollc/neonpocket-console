/**
 * Stateless Web Fetch handler for the Neon API proxy.
 *
 * This exists only for deployments that can run backend/serverless code. Static
 * hosts must set VITE_NEON_PROXY_URL to a deployed copy of this endpoint.
 */

const NEON_BASE = "https://console.neon.tech/api/v2";
const MAX_JSON_BODY_BYTES = 64 * 1024;

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
    headers: { "Content-Type": "application/json", ...headers },
  });

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
  if (!/^Bearer\s+\S+/i.test(auth)) {
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

  const path = String(payload.path || "");
  if (!path.startsWith("/")) {
    return json({ error: "Path must start with /" }, 400, cors);
  }

  if (path.includes("..") || path.includes("://")) {
    return json({ error: "Disallowed path" }, 400, cors);
  }

  const url = new URL(NEON_BASE + path);
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
  const reqId = upstream.headers.get("neon-request-id") || upstream.headers.get("x-request-id");
  if (reqId) headers.set("neon-request-id", reqId);
  return new Response(text, { status: upstream.status, headers });
}
