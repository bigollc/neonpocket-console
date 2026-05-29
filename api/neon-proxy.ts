/**
 * Stateless Neon API forwarding endpoint (Vercel/Netlify-compatible serverless function shape).
 * - Forwards ONLY to Neon's public API base URL.
 * - Rejects any non-Neon path.
 * - Does not persist API keys, requests, responses, or any resource metadata.
 *
 * Deployment note: This file is shape-compatible with Vercel Functions. If you host the
 * Vite app on a platform without serverless functions, set API mode to "direct" in Settings.
 */

const NEON_BASE = "https://console.neon.tech/api/v2";

interface ForwardBody {
  method?: string;
  path?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST is supported" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }
  const auth = req.headers.get("authorization");
  if (!auth || !/^Bearer\s+\S+/i.test(auth)) {
    return new Response(JSON.stringify({ error: "Missing Authorization: Bearer <NEON_API_KEY>" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  let payload: ForwardBody;
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const method = (payload.method || "GET").toUpperCase();
  const path = String(payload.path || "");
  if (!path.startsWith("/")) {
    return new Response(JSON.stringify({ error: "Path must start with /" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  // Only allow Neon API paths (no traversal, no host override).
  if (path.includes("..") || path.includes("://")) {
    return new Response(JSON.stringify({ error: "Disallowed path" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const url = new URL(NEON_BASE + path);
  if (payload.query) {
    for (const [k, v] of Object.entries(payload.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.append(k, String(v));
    }
  }
  const upstream = await fetch(url.toString(), {
    method,
    headers: {
      "Accept": "application/json",
      "Authorization": auth,
      ...(payload.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: payload.body !== undefined ? JSON.stringify(payload.body) : undefined,
  });
  const text = await upstream.text();
  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") || "application/json");
  const reqId = upstream.headers.get("neon-request-id") || upstream.headers.get("x-request-id");
  if (reqId) headers.set("neon-request-id", reqId);
  return new Response(text, { status: upstream.status, headers });
}
