import { normalizeError, type NormalizedError } from "@/lib/errors";

export const NEON_BASE = "https://console.neon.tech/api/v2";
export const NEON_PROXY_URL = import.meta.env.VITE_NEON_PROXY_URL || "/api/neon-proxy";

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

  const fetchViaProxy = () => fetch(NEON_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${opts.apiKey}` },
    signal: opts.signal,
    body: JSON.stringify({ method, path, query: opts.query, body: opts.body }),
  });

  let res: Response;
  try {
    if (opts.mode === "direct") {
      try {
        res = await fetch(directUrl, {
          method, headers, signal: opts.signal,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
      } catch (directError: any) {
        if (isAbort(directError)) throw directError;
        emit({
          ts: new Date().toISOString(),
          route: `${route} (direct; retrying via proxy)`,
          method,
          status: 0,
          ms: Math.round(performance.now() - started),
          ok: false,
          errorMessage: directError?.message || "Direct request failed; retrying via proxy",
        });
        res = await fetchViaProxy();
      }
    } else {
      res = await fetchViaProxy();
    }
  } catch (e: any) {
    const fallbackHint = opts.mode === "direct" ? "; proxy fallback also failed" : "; proxy unavailable or blocked";
    const err = normalizeError({ status: 0, route, message: `${e?.message || "Network error or CORS blocked"}${fallbackHint}` });
    emit({ ts: err.timestamp, route, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
    throw err;
  }

  const ms = Math.round(performance.now() - started);
  const requestId = res.headers.get("neon-request-id") || res.headers.get("x-request-id") || undefined;
  const contentType = res.headers.get("content-type") || "";
  const isJsonResponse = /\bapplication\/json\b/i.test(contentType) || /\+json\b/i.test(contentType);

  if (!res.ok) {
    let parsed: any = undefined;
    const text = await res.text();
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }
    const err = normalizeError({ status: res.status, route, body: parsed, requestId });
    emit({ ts: err.timestamp, route, method, status: res.status, ms, ok: false, requestId, errorMessage: err.message });
    throw err;
  }

  if (!isJsonResponse) {
    const err = normalizeError({
      status: 0,
      route,
      requestId,
      message: "Neon proxy returned a non-JSON response; proxy is likely misconfigured (common with Lovable/static deploys serving the app shell instead of the Neon proxy route)",
    });
    emit({ ts: err.timestamp, route, method, status: res.status, ms, ok: false, requestId, errorMessage: err.message });
    throw err;
  }

  const text = await res.text();
  const parsed = text ? JSON.parse(text) : undefined;
  emit({ ts: new Date().toISOString(), route, method, status: res.status, ms, ok: true, requestId });
  return parsed as T;
}

export function isAbort(e: unknown) {
  return (e as any)?.name === "AbortError";
}

export type { NormalizedError };
