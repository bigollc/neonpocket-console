import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, ShieldCheck, KeyRound, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { useApp } from "@/state/AppContext";
import { NeonService } from "@/lib/neon/service";
import { hasVault, vaultUsesPassphrase, saveKey, unlockKey, forgetKey } from "@/lib/vault";
import { isNormalizedError, normalizeError } from "@/lib/errors";

function hasUserPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const payload = "user" in value ? (value as { user?: unknown }).user : value;
  return !!payload && typeof payload === "object" && (
    "id" in payload ||
    "email" in payload ||
    "login" in payload ||
    "auth_accounts" in payload
  );
}

function hasProjectsPayload(value: unknown): value is { projects: unknown[] } {
  return !!value && typeof value === "object" && Array.isArray((value as { projects?: unknown }).projects);
}

function unexpectedNeonShapeError(route: string) {
  return normalizeError({
    status: 0,
    route,
    message: "Neon API returned an unexpected response shape",
  });
}

export default function Connect() {
  const { setApiKey, settings, refreshVaultState } = useApp();
  const navigate = useNavigate();
  const [apiKey, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [passphrase, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [storedExists, setStoredExists] = useState(false);
  const [storedUsesPass, setStoredUsesPass] = useState(false);
  const [unlockPass, setUnlockPass] = useState("");
  const normalizedKey = apiKey.replace(/\s+/g, "");
  const looksLikeLegacyPrefix = normalizedKey.toLowerCase().startsWith("neon_");
  const looksLikeApiKey = normalizedKey.toLowerCase().startsWith("napi_");

  useEffect(() => {
    (async () => {
      const has = await hasVault();
      setStoredExists(has);
      if (has) setStoredUsesPass(await vaultUsesPassphrase());
    })();
  }, []);

  async function validateAndEnter(k: string) {
    try {
      try {
        const currentUser = await NeonService.getCurrentUser({ apiKey: k, mode: settings.apiMode });
        if (!hasUserPayload(currentUser)) throw unexpectedNeonShapeError("GET /users/me");
      } catch (userError: any) {
        if (isNormalizedError(userError) && userError.status === 0) throw userError;
        const projectList = await NeonService.listProjects({ apiKey: k, mode: settings.apiMode });
        if (!hasProjectsPayload(projectList)) throw unexpectedNeonShapeError("GET /projects");
      }
      setApiKey(k);
      toast.success("Connected to Neon");
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      const normalized = isNormalizedError(e) ? e : null;
      const msg = normalized ? `${normalized.status} · ${normalized.message}` : (e?.message || "Connection failed");
      toast.error(normalized?.status === 0 ? "Could not reach Neon" : "Could not authenticate", { description: msg });
      throw e;
    }
  }

  async function onConnect() {
    if (!normalizedKey) return;
    setLoading(true);
    try {
      await validateAndEnter(normalizedKey);
      if (remember) {
        await saveKey(normalizedKey, passphrase || undefined);
        await refreshVaultState();
      }
    } catch { /* toast shown */ }
    finally { setLoading(false); }
  }

  async function onUnlock() {
    setLoading(true);
    try {
      const k = await unlockKey(storedUsesPass ? unlockPass : undefined);
      await validateAndEnter(k);
    } catch (e: any) {
      if (!isNormalizedError(e)) toast.error(e?.message || "Failed to unlock vault");
    } finally { setLoading(false); }
  }

  async function onForget() {
    await forgetKey();
    setStoredExists(false);
    await refreshVaultState();
    toast.success("Local key removed from this device");
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-background to-muted/30">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <Logo className="size-9" />
          <div>
            <div className="text-base font-semibold tracking-tight">NeonPocket Console</div>
            <div className="text-xs text-muted-foreground">Mobile-first Neon.tech control plane</div>
          </div>
        </div>

        <div className="hairline rounded-xl p-5 bg-card">
          {storedExists ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Lock className="size-4" /> <span>Encrypted key found on this device</span>
              </div>
              {storedUsesPass && (
                <div className="space-y-1.5">
                  <Label htmlFor="up">Passphrase</Label>
                  <Input id="up" type="password" value={unlockPass} onChange={e => setUnlockPass(e.target.value)} autoFocus />
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={onUnlock} disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Unlock"}
                </Button>
                <Button variant="outline" onClick={() => setStoredExists(false)}>Use another key</Button>
              </div>
              <button onClick={onForget} className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1">
                <Trash2 className="size-3" /> Forget key on this device
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ak" className="flex items-center gap-1.5"><KeyRound className="size-3.5" />Neon API key</Label>
                <div className="relative">
                  <Input id="ak" type={show ? "text" : "password"} placeholder="napi_…" autoComplete="off"
                    value={apiKey} onChange={e => setKey(e.target.value)} className="pr-10 mono" />
                  <button type="button" onClick={() => setShow(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Toggle visibility">
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground break-words">
                  Generate one from your Neon profile: open <span className="mono">Account settings → API keys</span>, then create and copy an API key. Neon API keys usually start with <span className="mono">napi_</span>.
                </div>
                {looksLikeLegacyPrefix && (
                  <div className="text-[11px] text-warning break-words">
                    This looks like a database or legacy token prefix. Neon API access expects a Console API key, typically starting with <span className="mono">napi_</span>.
                  </div>
                )}
                {normalizedKey && !looksLikeApiKey && !looksLikeLegacyPrefix && (
                  <div className="text-[11px] text-muted-foreground break-words">
                    The app will still try this token, but double-check that it is a Neon Console API key rather than a connection string or password.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-md hairline p-3">
                <div>
                  <div className="text-sm font-medium">Remember on this device</div>
                  <div className="text-[11px] text-muted-foreground">Encrypted with Web Crypto AES-GCM in IndexedDB.</div>
                </div>
                <Switch checked={remember} onCheckedChange={setRemember} />
              </div>

              {remember && (
                <div className="space-y-1.5">
                  <Label htmlFor="pp">Optional passphrase</Label>
                  <Input id="pp" type="password" placeholder="Strengthens encryption (PBKDF2)" value={passphrase} onChange={e => setPass(e.target.value)} />
                </div>
              )}

              <Button onClick={onConnect} disabled={loading || !normalizedKey} className="w-full">
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Connect"}
              </Button>

              <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <ShieldCheck className="size-3.5 mt-px shrink-0" />
                <span>Your key stays on this device. Auto mode calls Neon directly first and uses a configured proxy only if the browser blocks direct CORS/preflight.</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-3">
          <a href="https://neon.com/docs/reference/api-reference" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">Neon API docs</a>
          <Link to="/diagnostics" className="underline underline-offset-4 hover:text-foreground">Diagnostics</Link>
        </div>
      </motion.div>
    </div>
  );
}
