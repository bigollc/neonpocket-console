const DEVICE_AUTH_KEY = "neonpocket.device-auth.v1";

interface DeviceAuthRecord {
  credentialId: string;
  createdAt: string;
}

function randomBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64Url(bytes: Uint8Array) {
  let raw = "";
  bytes.forEach(byte => { raw += String.fromCharCode(byte); });
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function supportsDeviceAuth() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

export function getDeviceAuthRecord(): DeviceAuthRecord | null {
  try {
    const raw = localStorage.getItem(DEVICE_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasDeviceAuth() {
  return !!getDeviceAuthRecord();
}

export async function setupDeviceAuth() {
  if (!supportsDeviceAuth()) throw new Error("Device authentication is not supported here");

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(),
      rp: { name: "NeonPocket Console" },
      user: {
        id: randomBytes(16),
        name: "neonpocket-local-device",
        displayName: "NeonPocket device unlock",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      attestation: "none",
      timeout: 60000,
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error("Device authentication setup was cancelled");

  const record: DeviceAuthRecord = {
    credentialId: toBase64Url(new Uint8Array(credential.rawId)),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(DEVICE_AUTH_KEY, JSON.stringify(record));
  return record;
}

export async function verifyDeviceAuth() {
  const record = getDeviceAuthRecord();
  if (!record) return true;
  if (!supportsDeviceAuth()) throw new Error("Device authentication is not supported here");

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(),
      allowCredentials: [{ type: "public-key", id: fromBase64Url(record.credentialId) }],
      userVerification: "required",
      timeout: 60000,
    },
  });

  if (!assertion) throw new Error("Device authentication was cancelled");
  return true;
}

export function clearDeviceAuth() {
  localStorage.removeItem(DEVICE_AUTH_KEY);
}
