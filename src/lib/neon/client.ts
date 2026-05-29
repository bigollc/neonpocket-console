import { isNormalizedError, normalizeError, type NormalizedError } from "@/lib/errors";

export const NEON_BASE = "https://console.neon.tech/api/v2";
const CONFIGURED_NEON_PROXY_URL = import.meta.env.VITE_NEON_PROXY_URL?.trim() || "";
export const NEON_PROXY_URL = CONFIGURED_NEON_PROXY_URL || "/api/neon-proxy";
const USES_DEFAULT_PROXY_ROUTE = !CONFIGURED_NEON_PROXY_URL;
const PROXY_NON_JSON_MESSAGE =
  "Neon proxy returned a non-JSON response; the /api/neon-proxy route is probably serving the app shell instead of the Neon proxy";
const DEFAULT_PROXY_AND_DIRECT_FAILED_MESSAGE =
  "The built-in /api/neon-proxy route is not running on this host, and direct browser access to Neon was blocked. Deploy the proxy to a backend-capable host and set VITE_NEON_PROXY_URL to that endpoint.";

export type ApiMode = "direct" | "proxy";

export interface CallOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
  apiKey: string;
  mode: ApiMode;
}

export interface DiagnosticEntry {
  ts: string;
  route: string;
  method: string;
  status: number;
  ms: number;
  ok: boolean;
  requestId?: string;
  errorMessage?: string;
}

type DiagListener = (e: DiagnosticEntry) => void;
const listeners = new Set<DiagListener>();
export function onDiagnostic(l: DiagListener) { listeners.add(l); return () => listeners.delete(l); }
function emit(e: DiagnosticEntry) { listeners.forEach(l => l(e)); }

function buildQuery(q?: CallOptions["query"]) {
  if (!q) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : "";
}

function isJsonContentType(contentType: string) {
  return /\bapplication\/json\b/i.test(contentType) || /\+json\b/i.test(contentType);
}

function isDefaultProxyNonJsonError(error: unknown) {
  return isNormalizedError(error) && error.status === 0 && error.message.includes(PROXY_NON_JSON_MESSAGE);
}

export async function callNeon<T = any>(path: string, opts: CallOptions): Promise<T> {
  const method = opts.method ?? "GET";
  const qs = buildQuery(opts.query);
  const route = `${method} ${path}${qs}`;
  const started = performance.now();

  const directUrl = `${NEON_BASE}${path}${qs}`;
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Authorization": `Bearer ${opts.apiKey}`,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const fetchDirect = () => fetch(directUrl, {
    method,
    headers,
    signal: opts.signal,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const fetchViaProxy = () => fetch(NEON_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${opts.apiKey}` },
    signal: opts.signal,
    body: JSON.stringify({ method, path, query: opts.query, body: opts.body }),
  });

  const parseResponse = async (res: Response, source: "direct" | "proxy") => {
    const ms = Math.round(performance.now() - started);
    const requestId = res.headers.get("neon-request-id") || res.headers.get("x-request-id") || undefined;
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    let parsed: any = undefined;

    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }

    if (!res.ok) {
      const err = normalizeError({ status: res.status, route, body: parsed, requestId });
      emit({ ts: err.timestamp, route, method, status: res.status, ms, ok: false, requestId, errorMessage: err.message });
      throw err;
    }

    if (!isJsonContentType(contentType)) {
      const message = source === "proxy" && USES_DEFAULT_PROXY_ROUTE
        ? PROXY_NON_JSON_MESSAGE
        : "Neon returned a non-JSON response";
      const err = normalizeError({ status: 0, route, requestId, message });
      emit({ ts: err.timestamp, route, method, status: res.status, ms, ok: false, requestId, errorMessage: err.message });
      throw err;
    }

    emit({ ts: new Date().toISOString(), route, method, status: res.status, ms, ok: true, requestId });
    return parsed as T;
  };

  const requestDirect = async () => {
    const res = await fetchDirect();
    return parseResponse(res, "direct");
  };

  const requestProxy = async () => {
    const res = await fetchViaProxy();
    return parseResponse(res, "proxy");
  };

  try {
    if (opts.mode === "direct") {
      try {
        return await requestDirect();
      } catch (directError: any) {
        if (isAbort(directError) || isNormalizedError(directError)) throw directError;
        emit({
          ts: new Date().toISOString(),
          route: `${route} (direct; retrying via proxy)`,
          method,
          status: 0,
          ms: Math.round(performance.now() - started),
          ok: false,
          errorMessage: directError?.message || "Direct request failed; retrying via proxy",
        });
        return await requestProxy();
      }
    }

    try {
      return await requestProxy();
    } catch (proxyError: any) {
      if (isAbort(proxyError)) throw proxyError;
      if (USES_DEFAULT_PROXY_ROUTE && isDefaultProxyNonJsonError(proxyError)) {
        emit({
          ts: new Date().toISOString(),
          route: `${route} (default proxy unavailable; retrying direct)`,
          method,
          status: 0,
          ms: Math.round(performance.now() - started),
          ok: false,
          errorMessage: "Default proxy route is not available; trying direct Neon API access",
        });
        try {
          return await requestDirect();
        } catch (directError: any) {
          if (isAbort(directError)) throw directError;
          if (isNormalizedError(directError) && directError.status !== 0) throw directError;
          const err = normalizeError({ status: 0, route, message: DEFAULT_PROXY_AND_DIRECT_FAILED_MESSAGE });
          emit({ ts: err.timestamp, route, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
          throw err;
        }
      }
      throw proxyError;
    }
  } catch (e: any) {
    if (isNormalizedError(e) || isAbort(e)) throw e;
    const fallbackHint = opts.mode === "direct" ? "; proxy fallback also failed" : "; proxy unavailable or blocked";
    const err = normalizeError({ status: 0, route, message: `${e?.message || "Network error or CORS blocked"}${fallbackHint}` });
    emit({ ts: err.timestamp, route, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
    throw err;
  }
}

export function isAbort(e: unknown) {
  return (e as any)?.name === "AbortError";
}

export type { NormalizedError };
