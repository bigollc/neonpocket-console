interface CloudProfilePayload {
  apiKey: string;
  userName: string;
  email: string;
  deviceAuthEnabled: boolean;
  settings: Record<string, unknown>;
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

export async function syncCloudProfile(payload: CloudProfilePayload) {
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
    return response.ok;
  } catch {
    return false;
  }
}
