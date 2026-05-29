export interface NormalizedError {
  status: number;
  message: string;
  requestId?: string;
  route: string;
  timestamp: string;
  retryable: boolean;
  details?: unknown;
  code?: string;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export function normalizeError(opts: {
  status: number;
  route: string;
  body?: any;
  requestId?: string;
  message?: string;
}): NormalizedError {
  const message =
    opts.message ||
    (typeof opts.body === "object" && opts.body && (opts.body.message || opts.body.error || opts.body.detail)) ||
    (typeof opts.body === "string" ? opts.body : undefined) ||
    httpStatusText(opts.status);
  return {
    status: opts.status,
    message: String(message).slice(0, 600),
    requestId: opts.requestId,
    route: opts.route,
    timestamp: new Date().toISOString(),
    retryable: RETRYABLE.has(opts.status),
    details: opts.body,
  };
}

export function httpStatusText(status: number) {
  switch (status) {
    case 0: return "Network error or CORS blocked";
    case 400: return "Bad request";
    case 401: return "Unauthorized — check your Neon API key";
    case 403: return "Forbidden — your key lacks permission for this resource";
    case 404: return "Not found";
    case 409: return "Conflict";
    case 422: return "Unprocessable entity";
    case 429: return "Rate limited";
    case 500: return "Neon server error";
    case 502: return "Bad gateway";
    case 503: return "Service unavailable";
    case 504: return "Gateway timeout";
    default: return `HTTP ${status}`;
  }
}

export function isNormalizedError(e: unknown): e is NormalizedError {
  return !!e && typeof e === "object" && "status" in (e as any) && "route" in (e as any);
}

export function redactAuth(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (/^authorization$/i.test(k) || /token/i.test(k) || /apikey/i.test(k)) out[k] = "[REDACTED]";
    else out[k] = v;
  }
  return out;
}
