export interface CloudProfilePayload {
  apiKey: string;
  userName: string;
  email: string;
  deviceAuthEnabled: boolean;
  settings: Record<string, unknown>;
}

export interface CloudProfileResult {
  ok: boolean;
  stored: boolean;
  status: number;
  reason?: string;
  message?: string;
  detail?: string;
  hint?: string;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

function keyHint(apiKey: string) {
  if (!apiKey) return "";
  return `${apiKey.slice(0, 5)}…${apiKey.slice(-4)}`;
}

export async function syncCloudProfile(payload: CloudProfilePayload): Promise<CloudProfileResult> {
  try {
    const response = await fetch("/api/app-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: payload.userName,
        email: payload.email,
        keyHash: await sha256(payload.apiKey),
        keyHint: keyHint(payload.apiKey),
        deviceAuthEnabled: payload.deviceAuthEnabled,
        settings: payload.settings,
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    let body: any = null;
    try { body = await response.json(); } catch { body = null; }

    return {
      ok: response.ok && !!body?.ok,
      stored: !!body?.stored,
      status: response.status,
      reason: body?.reason,
      message: body?.error || body?.message,
      detail: body?.detail,
      hint: body?.hint,
    };
  } catch (error: any) {
    return {
      ok: false,
      stored: false,
      status: 0,
      message: error?.message || "Could not reach app profile endpoint",
    };
  }
}
