import { isNormalizedError, normalizeError, type NormalizedError } from "@/lib/errors";

export const NEON_BASE = "https://console.neon.tech/api/v2";
const CONFIGURED_NEON_PROXY_URL = import.meta.env.VITE_NEON_PROXY_URL?.trim() || "";
export const NEON_PROXY_URL = CONFIGURED_NEON_PROXY_URL || "/api/neon-proxy";
const HAS_CONFIGURED_PROXY = !!CONFIGURED_NEON_PROXY_URL;

export type ApiMode = "auto" | "direct" | "proxy";

export interface CallOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
  apiKey: string;
  mode?: ApiMode;
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

type Transport = "direct" | "proxy";
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

function statusZeroMessage(error: unknown) {
  return isNormalizedError(error) ? error.message : (error as any)?.message || "Network error";
}

function isStatusZero(error: unknown) {
  return isNormalizedError(error) && error.status === 0;
}

function isBrowserBlockedMessage(message: string) {
  return /load failed|failed to fetch|networkerror|cors/i.test(message);
}

export async function callNeon<T = any>(path: string, opts: CallOptions): Promise<T> {
  const method = opts.method ?? "GET";
  const mode = opts.mode ?? "auto";
  const qs = buildQuery(opts.query);
  const route = `${method} ${path}${qs}`;
  const started = performance.now();

  const directUrl = `${NEON_BASE}${path}${qs}`;
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Authorization": `Bearer ${opts.apiKey}`,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const parseResponse = async (res: Response, transport: Transport) => {
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
      emit({ ts: err.timestamp, route: `${route} (${transport})`, method, status: res.status, ms, ok: false, requestId, errorMessage: err.message });
      throw err;
    }

    if (text && !isJsonContentType(contentType)) {
      const message = transport === "proxy"
        ? "Neon proxy returned a non-JSON response; the proxy endpoint is probably serving the app shell instead of forwarding to Neon"
        : "Neon API returned a non-JSON response";
      const err = normalizeError({ status: 0, route, requestId, message });
      emit({ ts: err.timestamp, route: `${route} (${transport})`, method, status: res.status, ms, ok: false, requestId, errorMessage: err.message });
      throw err;
    }

    emit({ ts: new Date().toISOString(), route: `${route} (${transport})`, method, status: res.status, ms, ok: true, requestId });
    return parsed as T;
  };

  const requestDirect = async () => {
    try {
      const res = await fetch(directUrl, {
        method,
        headers,
        signal: opts.signal,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      return parseResponse(res, "direct");
    } catch (e: any) {
      if (isAbort(e) || isNormalizedError(e)) throw e;
      const rawMessage = e?.message || "Could not reach Neon API directly";
      const message = isBrowserBlockedMessage(rawMessage)
        ? `Browser blocked the direct Neon API request (${rawMessage}). This usually means the browser could not complete the CORS/preflight request for ${NEON_BASE}.`
        : rawMessage;
      const err = normalizeError({ status: 0, route, message });
      emit({ ts: err.timestamp, route: `${route} (direct)`, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
      throw err;
    }
  };

  const requestProxy = async () => {
    try {
      const res = await fetch(NEON_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${opts.apiKey}` },
        signal: opts.signal,
        body: JSON.stringify({ method, path, query: opts.query, body: opts.body }),
      });
      return parseResponse(res, "proxy");
    } catch (e: any) {
      if (isAbort(e) || isNormalizedError(e)) throw e;
      const err = normalizeError({ status: 0, route, message: e?.message || "Could not reach Neon proxy" });
      emit({ ts: err.timestamp, route: `${route} (proxy)`, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
      throw err;
    }
  };

  if (mode === "direct") return requestDirect();
  if (mode === "proxy") return requestProxy();

  try {
    return await requestDirect();
  } catch (directError: any) {
    if (isAbort(directError)) throw directError;
    if (!isStatusZero(directError)) throw directError;

    try {
      return await requestProxy();
    } catch (proxyError: any) {
      if (isAbort(proxyError)) throw proxyError;
      if (!isStatusZero(proxyError)) throw proxyError;

      const proxyHint = HAS_CONFIGURED_PROXY
        ? `Configured proxy also failed: ${statusZeroMessage(proxyError)}`
        : `No working proxy is configured at ${NEON_PROXY_URL}. Static hosts do not execute this route unless a backend/serverless endpoint is deployed; set VITE_NEON_PROXY_URL to your Cloudflare Worker URL.`;
      const err = normalizeError({
        status: 0,
        route,
        message: `${statusZeroMessage(directError)} ${proxyHint}`,
      });
      emit({ ts: err.timestamp, route: `${route} (auto)`, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
      throw err;
    }
  }
}

export function isAbort(e: unknown) {
  return (e as any)?.name === "AbortError";
}

export type { NormalizedError };
