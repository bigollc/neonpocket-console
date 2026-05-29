import { isNormalizedError, normalizeError, type NormalizedError } from "@/lib/errors";

export const NEON_BASE = "https://console.neon.tech/api/v2";

export type ApiMode = "direct";

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

  const url = `${NEON_BASE}${path}${qs}`;
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Authorization": `Bearer ${opts.apiKey}`,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      signal: opts.signal,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e: any) {
    if (isAbort(e)) throw e;
    if (isNormalizedError(e)) throw e;
    const rawMessage = e?.message || "Could not reach Neon API directly";
    const browserBlocked = /load failed|failed to fetch|networkerror|cors/i.test(rawMessage);
    const message = browserBlocked
      ? `Browser blocked the direct Neon API request (${rawMessage}). This usually means the browser could not complete the CORS/preflight request for https://console.neon.tech/api/v2.`
      : rawMessage;
    const err = normalizeError({ status: 0, route, message });
    emit({ ts: err.timestamp, route, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
    throw err;
  }

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

  if (text && !isJsonContentType(contentType)) {
    const err = normalizeError({ status: 0, route, requestId, message: "Neon API returned a non-JSON response" });
    emit({ ts: err.timestamp, route, method, status: res.status, ms, ok: false, requestId, errorMessage: err.message });
    throw err;
  }

  emit({ ts: new Date().toISOString(), route, method, status: res.status, ms, ok: true, requestId });
  return parsed as T;
}

export function isAbort(e: unknown) {
  return (e as any)?.name === "AbortError";
}

export type { NormalizedError };
