/**
 * Encrypted local vault for the Neon API key.
 * AES-GCM via Web Crypto, stored in IndexedDB. Optional PBKDF2 passphrase.
 */

const DB_NAME = "neonpocket";
const STORE = "vault";
const KEY_ID = "neon_api_key_v1";

interface VaultRecord {
  id: string;
  iv: Uint8Array;
  salt: Uint8Array;
  ciphertext: ArrayBuffer;
  usesPassphrase: boolean;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(id: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(rec: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDel(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase) as BufferSource, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 250_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function deviceKey(salt: Uint8Array): Promise<CryptoKey> {
  // Stable device fingerprint (best-effort, local-only). Combined with random salt.
  const fp = [navigator.userAgent, navigator.language, screen.width, screen.height, "neonpocket-v1"].join("|");
  return deriveKey(fp, salt);
}

export async function hasVault(): Promise<boolean> {
  try {
    const rec = await idbGet<VaultRecord>(KEY_ID);
    return !!rec;
  } catch {
    return false;
  }
}

export async function vaultUsesPassphrase(): Promise<boolean> {
  const rec = await idbGet<VaultRecord>(KEY_ID);
  return !!rec?.usesPassphrase;
}

export async function saveKey(apiKey: string, passphrase?: string): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const usesPassphrase = !!passphrase;
  const key = usesPassphrase ? await deriveKey(passphrase!, salt) : await deviceKey(salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, enc.encode(apiKey) as BufferSource);
  await idbPut({ id: KEY_ID, iv, salt, ciphertext, usesPassphrase, createdAt: new Date().toISOString() } as VaultRecord);
}

export async function unlockKey(passphrase?: string): Promise<string> {
  const rec = await idbGet<VaultRecord>(KEY_ID);
  if (!rec) throw new Error("No local key stored");
  const key = rec.usesPassphrase
    ? (passphrase ? await deriveKey(passphrase, rec.salt) : (() => { throw new Error("Passphrase required"); })())
    : await deviceKey(rec.salt);
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: rec.iv as BufferSource }, key, rec.ciphertext);
    return dec.decode(pt);
  } catch {
    throw new Error(rec.usesPassphrase ? "Wrong passphrase" : "Vault could not be decrypted on this device");
  }
}

export async function removeVaultPassphrase(currentPassphrase: string): Promise<void> {
  if (!currentPassphrase) throw new Error("Current passphrase is required");
  const rec = await idbGet<VaultRecord>(KEY_ID);
  if (!rec) throw new Error("No local key stored");
  if (!rec.usesPassphrase) throw new Error("Stored key does not use a passphrase");
  const apiKey = await unlockKey(currentPassphrase);
  await saveKey(apiKey);
}

export async function forgetKey(): Promise<void> {
  await idbDel(KEY_ID);
}
