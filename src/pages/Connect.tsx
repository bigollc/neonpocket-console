import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  Database,
  Eye,
  EyeOff,
  FileKey2,
  GitBranch,
  KeyRound,
  Layers3,
  Loader2,
  Lock,
  Network,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { useApp } from "@/state/AppContext";
import { NeonService } from "@/lib/neon/service";
import { hasVault, vaultUsesPassphrase, saveKey, unlockKey, forgetKey } from "@/lib/vault";
import { hasDeviceAuth, verifyDeviceAuth } from "@/lib/deviceAuth";
import { isNormalizedError, normalizeError } from "@/lib/errors";
import { syncCloudProfile } from "@/lib/cloudProfile";

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

function userEmailFromPayload(value: any) {
  const user = value?.user ?? value;
  return user?.email || user?.auth_accounts?.find?.((a: any) => a.email)?.email || "";
}

function userNameFromPayload(value: any) {
  const user = value?.user ?? value;
  return user?.name || user?.login || userEmailFromPayload(value) || "Neon user";
}

const neonRefs = [
  { label: "Neon API", href: "https://neon.com/docs/reference/api-reference" },
  { label: "Organizations API", href: "https://neon.com/docs/manage/orgs-api" },
  { label: "Consumption metrics", href: "https://neon.com/docs/guides/consumption-metrics" },
  { label: "Data API", href: "https://neon.com/docs/data-api/overview" },
];

const productCards = [
  {
    icon: Boxes,
    title: "Mobile control plane",
    desc: "Open organizations, projects, branches, databases, roles, endpoints, operations, and Data API settings from a phone-first console.",
  },
  {
    icon: Activity,
    title: "Usage awareness",
    desc: "Read Neon consumption endpoints when your plan exposes them, then show compute, storage, history, and transfer without waking compute endpoints.",
  },
  {
    icon: Users,
    title: "Organization context",
    desc: "Compare Personal API keys and Organization API keys, resolve your org membership role, and keep project actions scoped to the selected organization.",
  },
];

const featureMap = [
  { icon: Layers3, label: "Projects & branches" },
  { icon: Database, label: "Databases & roles" },
  { icon: Network, label: "Endpoints & operations" },
  { icon: WalletCards, label: "Plan & usage visibility" },
];

export default function Connect() {
  const { setApiKey, settings, refreshVaultState, playUiSound } = useApp();
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
      let currentUser: any = null;
      try {
        currentUser = await NeonService.getCurrentUser({ apiKey: k, mode: settings.apiMode });
        if (!hasUserPayload(currentUser)) throw unexpectedNeonShapeError("GET /users/me");
      } catch (userError: any) {
        if (isNormalizedError(userError) && userError.status === 0) throw userError;
        const projectList = await NeonService.listProjects({ apiKey: k, mode: settings.apiMode });
        if (!hasProjectsPayload(projectList)) throw unexpectedNeonShapeError("GET /projects");
      }
      setApiKey(k);
      if (settings.cloudProfileSync) {
        void syncCloudProfile({
          apiKey: k,
          userName: userNameFromPayload(currentUser),
          email: userEmailFromPayload(currentUser),
          deviceAuthEnabled: hasDeviceAuth(),
          settings: {
            greetings: settings.greetings,
            sounds: settings.sounds,
            apiMode: settings.apiMode,
          },
        });
      }
      playUiSound("success");
      toast.success("Connected to Neon");
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      const normalized = isNormalizedError(e) ? e : null;
      const msg = normalized ? `${normalized.status} · ${normalized.message}` : (e?.message || "Connection failed");
      playUiSound("warning");
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
      if (hasDeviceAuth()) await verifyDeviceAuth();
      const k = await unlockKey(storedUsesPass ? unlockPass : undefined);
      await validateAndEnter(k);
    } catch (e: any) {
      playUiSound("warning");
      if (!isNormalizedError(e)) toast.error(e?.message || "Failed to unlock vault");
    } finally { setLoading(false); }
  }

  async function onForget() {
    await forgetKey();
    setStoredExists(false);
    await refreshVaultState();
    playUiSound("warning");
    toast.success("Local key removed from this device");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_32rem),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.32))] px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo className="size-9" />
            <div>
              <div className="text-base font-semibold tracking-tight">NeonPocket Console</div>
              <div className="text-xs text-muted-foreground">Mobile-first control plane for Neon</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {neonRefs.slice(0, 2).map(ref => (
              <a key={ref.href} href={ref.href} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                {ref.label}
              </a>
            ))}
          </div>
        </header>

        <main className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">
            <div className="hairline rounded-2xl bg-card/80 p-5 backdrop-blur md:p-7">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="size-3.5" /> Built on documented Neon APIs, not scraped console screens
              </div>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
                Manage Neon from your phone without guessing what your account can do.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                NeonPocket turns Neon’s public API surface into a fast mobile console: connect your own API key, select an organization, inspect projects and branches, review usage availability, and see your organization role before performing scoped actions.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {featureMap.map(item => (
                  <div key={item.label} className="rounded-xl border bg-background/55 p-3">
                    <item.icon className="mb-2 size-4 text-primary" />
                    <div className="text-xs font-medium">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {productCards.map(card => (
                <div key={card.title} className="hairline rounded-xl bg-card/80 p-4">
                  <card.icon className="mb-3 size-5 text-primary" />
                  <div className="text-sm font-semibold">{card.title}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="hairline rounded-xl bg-card/80 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileKey2 className="size-4" /> API key model</div>
                <div className="space-y-3 text-xs leading-5 text-muted-foreground">
                  <div className="rounded-lg border bg-background/55 p-3">
                    <div className="mb-1 font-medium text-foreground">Personal API key</div>
                    <p>Useful for personal development and scripts. It can access projects you own or can access; organization requests need an explicit <span className="mono">org_id</span>.</p>
                  </div>
                  <div className="rounded-lg border bg-background/55 p-3">
                    <div className="mb-1 font-medium text-foreground">Organization API key</div>
                    <p>Useful for team automation. It is already scoped to one organization and can list organization projects, members, API keys, and supported organization resources.</p>
                  </div>
                  <div className="rounded-lg border bg-background/55 p-3">
                    <div className="mb-1 font-medium text-foreground">Project-scoped organization key</div>
                    <p>Useful for limited integrations. It only exposes a specific project-level scope; NeonPocket will keep unsupported organization-level panels honest.</p>
                  </div>
                </div>
              </div>

              <div className="hairline rounded-xl bg-card/80 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4" /> What we store</div>
                <div className="space-y-2 text-xs leading-5 text-muted-foreground">
                  <div className="flex gap-2"><BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /><span><b className="text-foreground">API key:</b> only kept in memory unless “Remember on this device” is enabled.</span></div>
                  <div className="flex gap-2"><BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /><span><b className="text-foreground">Local vault:</b> encrypted with Web Crypto AES-GCM in IndexedDB; optional passphrase uses PBKDF2 strengthening.</span></div>
                  <div className="flex gap-2"><BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /><span><b className="text-foreground">Cloud profile sync:</b> optional metadata only — user name/email, key hash/hint, device and UI preferences, and audit timestamps. The raw Neon API key is not stored there.</span></div>
                  <div className="flex gap-2"><BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /><span><b className="text-foreground">Neon resources:</b> organizations, projects, branches, roles, endpoints, operations, and usage are read live from Neon APIs and are not copied into an app database.</span></div>
                </div>
              </div>
            </div>

            <div className="hairline rounded-xl bg-card/80 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4" /> References used by NeonPocket</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {neonRefs.map(ref => (
                  <a key={ref.href} href={ref.href} target="_blank" rel="noreferrer" className="group rounded-lg border bg-background/55 p-3 text-xs transition-colors hover:bg-accent/40">
                    <span className="font-medium">{ref.label}</span>
                    <ArrowRight className="mt-2 size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </a>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.aside initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }} className="lg:sticky lg:top-6">
            <div className="hairline rounded-2xl bg-card p-5 shadow-sm">
              <div className="mb-4">
                <div className="text-lg font-semibold">Connect your Neon account</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  Paste a Neon Console API key. We validate against <span className="mono">/users/me</span> first, then fall back to <span className="mono">/projects</span> for scoped keys.
                </div>
              </div>

              {storedExists ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="size-4" /> <span>Encrypted key found on this device</span>
                  </div>
                  {hasDeviceAuth() && (
                    <div className="rounded-md bg-primary/10 p-2 text-xs text-primary">
                      Device authentication is enabled. Unlock may request Face ID, Touch ID, or your platform authenticator.
                    </div>
                  )}
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
                  <button onClick={onForget} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
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
                      Create one in Neon Console under <span className="mono">Account settings → API keys</span>. Neon Console API keys usually start with <span className="mono">napi_</span>.
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
                      <div className="text-[11px] text-muted-foreground">Encrypted locally with Web Crypto AES-GCM in IndexedDB.</div>
                    </div>
                    <Switch checked={remember} onCheckedChange={setRemember} />
                  </div>

                  {remember && (
                    <div className="space-y-1.5">
                      <Label htmlFor="pp">Optional passphrase</Label>
                      <Input id="pp" type="password" placeholder="Strengthens encryption with PBKDF2" value={passphrase} onChange={e => setPass(e.target.value)} />
                    </div>
                  )}

                  <Button onClick={onConnect} disabled={loading || !normalizedKey} className="w-full">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : "Connect to NeonPocket"}
                  </Button>

                  <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <ShieldCheck className="size-3.5 mt-px shrink-0" />
                    <span>All Neon account data is read live through official API endpoints. Unsupported plan/scope states are shown as unavailable instead of mocked.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-3">
              <a href="https://neon.com/docs/reference/api-reference" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">Neon API docs</a>
              <Link to="/diagnostics" className="underline underline-offset-4 hover:text-foreground">Diagnostics</Link>
            </div>
          </motion.aside>
        </main>
      </div>
    </div>
  );
}
