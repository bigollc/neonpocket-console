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

type CloudProfileResponseBody = {
  ok?: boolean;
  stored?: boolean;
  reason?: string;
  error?: string;
  message?: string;
  detail?: string;
  hint?: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Could not reach app profile endpoint");
}

export async function syncCloudProfile(payload: CloudProfilePayload): Promise<CloudProfileResult> {
  try {
    const response = await fetch("/api/app-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${payload.apiKey}`,
      },
      body: JSON.stringify({
        userName: payload.userName,
        email: payload.email,
        deviceAuthEnabled: payload.deviceAuthEnabled,
        settings: payload.settings,
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    let body: CloudProfileResponseBody | null = null;
    try { body = await response.json() as CloudProfileResponseBody; } catch { body = null; }

    return {
      ok: response.ok && !!body?.ok,
      stored: !!body?.stored,
      status: response.status,
      reason: body?.reason,
      message: body?.error || body?.message,
      detail: body?.detail,
      hint: body?.hint,
    };
  } catch (error) {
    return {
      ok: false,
      stored: false,
      status: 0,
      message: errorMessage(error),
    };
  }
}
