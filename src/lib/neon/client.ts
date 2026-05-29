import { isNormalizedError, normalizeError, type NormalizedError } from "@/lib/errors";

export const NEON_BASE = "https://console.neon.tech/api/v2";
const CONFIGURED_NEON_PROXY_URL = import.meta.env.VITE_NEON_PROXY_URL?.trim() || "";
export const NEON_PROXY_URL = CONFIGURED_NEON_PROXY_URL || "/api/neon-proxy";
const HAS_CONFIGURED_PROXY = !!CONFIGURED_NEON_PROXY_URL;
const SHORTCUT_NAME = "NeonPocket Bridge";
const SHORTCUT_RESULT_PREFIX = "neonpocket.shortcut.result.";
const SHORTCUT_PENDING_PREFIX = "neonpocket.shortcut.pending.";
const SHORTCUT_EVENT = "neonpocket-shortcut-result";

export type ApiMode = "auto" | "direct" | "proxy" | "shortcut";

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

type Transport = "direct" | "proxy" | "shortcut";
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

function isIOSLike() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function decodeBridgePayload(value: string) {
  const decoded = decodeURIComponent(value.replace(/^#?neonpocket_bridge=/, ""));
  const binary = atob(decoded);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function consumeShortcutBridgeResultFromLocation() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  if (!hash.startsWith("#neonpocket_bridge=")) return false;

  try {
    const result = decodeBridgePayload(hash);
    if (!result?.id) return false;
    localStorage.setItem(`${SHORTCUT_RESULT_PREFIX}${result.id}`, JSON.stringify(result));
    localStorage.removeItem(`${SHORTCUT_PENDING_PREFIX}${result.id}`);
    window.dispatchEvent(new CustomEvent(SHORTCUT_EVENT, { detail: result.id }));
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
    return true;
  } catch (error) {
    console.warn("Failed to parse NeonPocket Shortcut bridge result", error);
    return false;
  }
}

async function readShortcutResult<T>(id: string, route: string, method: string, started: number): Promise<T | null> {
  consumeShortcutBridgeResultFromLocation();
  const raw = localStorage.getItem(`${SHORTCUT_RESULT_PREFIX}${id}`);
  if (!raw) return null;
  localStorage.removeItem(`${SHORTCUT_RESULT_PREFIX}${id}`);

  const result = JSON.parse(raw);
  const ms = Math.round(performance.now() - started);
  const status = Number(result.status || 0);
  const headers = result.headers || {};
  const requestId = headers["neon-request-id"] || headers["x-request-id"] || result.requestId;
  const contentType = headers["content-type"] || headers["Content-Type"] || "application/json";
  const text = typeof result.body === "string" ? result.body : JSON.stringify(result.body ?? "");
  let parsed: any = undefined;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }

  if (result.error || status < 200 || status >= 300) {
    const err = normalizeError({ status: status || 0, route, body: parsed, requestId, message: result.error });
    emit({ ts: err.timestamp, route: `${route} (shortcut)`, method, status: status || 0, ms, ok: false, requestId, errorMessage: err.message });
    throw err;
  }

  if (text && !isJsonContentType(contentType)) {
    const err = normalizeError({ status: 0, route, requestId, message: "iOS Shortcut bridge returned a non-JSON Neon response" });
    emit({ ts: err.timestamp, route: `${route} (shortcut)`, method, status, ms, ok: false, requestId, errorMessage: err.message });
    throw err;
  }

  emit({ ts: new Date().toISOString(), route: `${route} (shortcut)`, method, status, ms, ok: true, requestId });
  return parsed as T;
}

function waitForShortcutResult<T>(id: string, route: string, method: string, started: number, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const finish = () => {
      done = true;
      window.removeEventListener(SHORTCUT_EVENT, onEvent as EventListener);
      window.removeEventListener("hashchange", onHashChange);
      clearInterval(interval);
      clearTimeout(timeout);
    };
    const tryRead = async () => {
      if (done) return;
      try {
        const result = await readShortcutResult<T>(id, route, method, started);
        if (result !== null) {
          finish();
          resolve(result);
        }
      } catch (error) {
        finish();
        reject(error);
      }
    };
    const onEvent = () => void tryRead();
    const onHashChange = () => void tryRead();
    const onAbort = () => {
      finish();
      reject(new DOMException("Aborted", "AbortError"));
    };

    window.addEventListener(SHORTCUT_EVENT, onEvent as EventListener);
    window.addEventListener("hashchange", onHashChange);
    signal?.addEventListener("abort", onAbort, { once: true });
    const interval = window.setInterval(() => void tryRead(), 750);
    const timeout = window.setTimeout(() => {
      const err = normalizeError({
        status: 0,
        route,
        message: "iOS Shortcut bridge was opened but no response returned yet. Finish the NeonPocket Bridge shortcut, then retry the request if Safari returned without data.",
      });
      emit({ ts: err.timestamp, route: `${route} (shortcut)`, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
      finish();
      reject(err);
    }, 90_000);
    void tryRead();
  });
}

async function requestShortcut<T>(path: string, opts: CallOptions, method: string, route: string, started: number): Promise<T> {
  if (typeof window === "undefined" || !isIOSLike()) {
    const err = normalizeError({ status: 0, route, message: "iOS Shortcut bridge is only available in Safari/WebKit on iPhone or iPad." });
    emit({ ts: err.timestamp, route: `${route} (shortcut)`, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
    throw err;
  }

  const id = randomId();
  const callbackUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#neonpocket_bridge=`;
  const payload = {
    version: 1,
    id,
    neonBase: NEON_BASE,
    callbackUrl,
    method,
    path,
    query: opts.query,
    body: opts.body,
    apiKey: opts.apiKey,
  };

  localStorage.setItem(`${SHORTCUT_PENDING_PREFIX}${id}`, JSON.stringify({ ts: new Date().toISOString(), route }));

  try {
    await navigator.clipboard.writeText(JSON.stringify(payload));
  } catch {
    const err = normalizeError({
      status: 0,
      route,
      message: "Could not copy the Neon request for iOS Shortcut bridge. Open Diagnostics, copy the bridge payload manually, then run the NeonPocket Bridge shortcut.",
    });
    emit({ ts: err.timestamp, route: `${route} (shortcut)`, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: err.message });
    throw err;
  }

  emit({ ts: new Date().toISOString(), route: `${route} (shortcut handoff)`, method, status: 0, ms: Math.round(performance.now() - started), ok: false, errorMessage: "Opening iOS Shortcut bridge" });
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=clipboard`;
  return waitForShortcutResult<T>(id, route, method, started, opts.signal);
}

export async function callNeon<T = any>(path: string, opts: CallOptions): Promise<T> {
  consumeShortcutBridgeResultFromLocation();

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
  if (mode === "shortcut") return requestShortcut<T>(path, opts, method, route, started);

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

      if (isIOSLike()) {
        try {
          return await requestShortcut<T>(path, opts, method, route, started);
        } catch (shortcutError: any) {
          if (isAbort(shortcutError)) throw shortcutError;
        }
      }

      const proxyHint = HAS_CONFIGURED_PROXY
        ? `Configured proxy also failed: ${statusZeroMessage(proxyError)}`
        : `No working proxy is configured at ${NEON_PROXY_URL}. Static Lovable hosts do not execute this route; set VITE_NEON_PROXY_URL to a deployed serverless proxy endpoint or use iOS Shortcut transport.`;
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
