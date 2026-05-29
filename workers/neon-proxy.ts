const DEFAULT_NEON_BASE = "https://console.neon.tech/api/v2";

interface Env {
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
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  if (configured.includes("*")) return "*";
  if (origin && configured.includes(origin)) return origin;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
  },
};
