import { isNormalizedError, normalizeError, type NormalizedError } from "@/lib/errors";

export const NEON_BASE = "https://console.neon.tech/api/v2";
const CONFIGURED_NEON_PROXY_URL = import.meta.env.VITE_NEON_PROXY_URL?.trim() || "";
export const NEON_PROXY_URL = CONFIGURED_NEON_PROXY_URL || "/api/neon-proxy";

export type ApiMode = "proxy";

export interface CallOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
  apiKey: string;
  mode?: ApiMode | string;
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

export async function callNeon<T = any>(path: string, opts: CallOptions): Promise<T> {
  const method = opts.method ?? "GET";
  const qs = buildQuery(opts.query);
  const route = `${method} ${path}${qs}`;
  const started = performance.now();

  try {
    const res = await fetch(NEON_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${opts.apiKey}` },
      signal: opts.signal,
      body: JSON.stringify({ method, path, query: opts.query, body: opts.body }),
    });

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
      emit({ ts: err.timestamp, route: `${route} (proxy)`, method, status: res.status, ms, ok: false, requestId, errorMessage: err.message });
      throw err;
    }

    if (text && !isJsonContentType(contentType)) {
      const err = normalizeError({
        status: 0,
        route,
        requestId,
        message: "Neon proxy returned a non-JSON response; the proxy endpoint is probably serving the app shell instead of forwarding to Neon",
      });
      emit({ ts: err.timestamp, route: `${route} (proxy)`, method, status: res.status, ms, ok: false, requestId, errorMessage: err.message });
      throw err;
    }

    emit({ ts: new Date().toISOString(), route: `${route} (proxy)`, method, status: res.status, ms, ok: true, requestId });
    return parsed as T;
  } catch (e: any) {
    if (isAbort(e) || isNormalizedError(e)) throw e;
    const err = normalizeError({ status: 0, route, message: e?.message || `Could not reach Neon proxy at ${NEON_PROXY_URL}` });
    emit({ ts: err.timestamp, route: `${route} (proxy)`, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
    throw err;
  }
}

export function isAbort(e: unknown) {
  return (e as any)?.name === "AbortError";
}

export type { NormalizedError };
