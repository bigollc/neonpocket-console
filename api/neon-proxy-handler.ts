/**
 * Stateless Web Fetch handler for the Neon API proxy.
 *
 * This exists only for deployments that can run backend/serverless code. Static
 * hosts must set VITE_NEON_PROXY_URL to a deployed copy of this endpoint.
 */

const NEON_BASE = "https://console.neon.tech/api/v2";

interface ForwardBody {
  method?: string;
  path?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status: number, extraHeaders?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...extraHeaders },
  });

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Only POST is supported" }, 405);
  }

  const auth = req.headers.get("authorization");
  if (!auth || !/^Bearer\s+\S+/i.test(auth)) {
    return json({ error: "Missing Authorization: Bearer <NEON_API_KEY>" }, 401);
  }

  let payload: ForwardBody;
  try { payload = await req.json(); } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const method = (payload.method || "GET").toUpperCase();
  const path = String(payload.path || "");
  if (!path.startsWith("/")) {
    return json({ error: "Path must start with /" }, 400);
  }

  if (path.includes("..") || path.includes("://")) {
    return json({ error: "Disallowed path" }, 400);
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
  } catch (error: any) {
    return json({ error: error?.message || "Neon proxy upstream request failed" }, 502);
  }

  const text = await upstream.text();
  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", upstream.headers.get("content-type") || "application/json");
  const reqId = upstream.headers.get("neon-request-id") || upstream.headers.get("x-request-id");
  if (reqId) headers.set("neon-request-id", reqId);
  return new Response(text, { status: upstream.status, headers });
}
