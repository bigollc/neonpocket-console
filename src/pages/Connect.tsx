import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  CheckCircle2,
  Clock3,
  Cookie,
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
  TerminalSquare,
  Trash2,
  Users,
  WalletCards,
  X,
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

const CONSENT_KEY = "neonpocket.cookie-consent.v1";

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
  return normalizeError({ status: 0, route, message: "Neon API returned an unexpected response shape" });
}

function userEmailFromPayload(value: any) {
  const user = value?.user ?? value;
  return user?.email || user?.auth_accounts?.find?.((a: any) => a.email)?.email || "";
}

function userNameFromPayload(value: any) {
  const user = value?.user ?? value;
  return user?.name || user?.login || userEmailFromPayload(value) || "Neon user";
}

const navigation = [
  { label: "Benefits", href: "#benefits" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
  { label: "References", href: "#references" },
  { label: "FAQ", href: "#faq" },
];

const metricPreview = [
  { label: "Projects", value: "12", icon: Layers3 },
  { label: "Branches", value: "48", icon: GitBranch },
  { label: "Operations", value: "31", icon: Activity },
  { label: "Usage state", value: "Plan-gated", icon: WalletCards },
];

const benefitCards = [
  {
    icon: Boxes,
    title: "You stop jumping between desktop tabs",
    desc: "NeonPocket is shaped for the moments when you need to inspect a project from a phone: branches, databases, roles, endpoints, operations, organization context, and Data API availability in one compact flow.",
  },
  {
    icon: Users,
    title: "You understand the organization before acting",
    desc: "The app starts with organization selection, resolves your membership role through the members API, and clears stale project or branch context when you move back to the top-level dashboard.",
  },
  {
    icon: Activity,
    title: "You see usage honestly, not decoratively",
    desc: "When Neon exposes consumption history for your plan and key scope, we display compute, storage, history, and transfer. When it does not, the UI explains that limitation instead of inventing charts.",
  },
  {
    icon: ShieldCheck,
    title: "You keep the key model transparent",
    desc: "The raw API key is memory-only by default. If you choose to remember it, it is encrypted locally. Optional cloud profile sync stores metadata and preferences, not the plaintext Neon key.",
  },
  {
    icon: TerminalSquare,
    title: "You can debug API access faster",
    desc: "Diagnostics show the route, status, latency, and last failed Neon call so a permission issue feels explainable instead of mysterious.",
  },
  {
    icon: Database,
    title: "You get a practical operator view",
    desc: "This is not another marketing dashboard. It is a narrow control plane for the real operational objects Neon exposes through documented APIs.",
  },
];

const steps = [
  {
    title: "Connect your Neon API key",
    text: "Create a Console API key in Neon, paste it here, and NeonPocket validates it against /users/me first. If the key is scoped and user profile is not available, the app falls back to /projects to confirm access.",
  },
  {
    title: "Choose the organization context",
    text: "Organization-scoped data stays scoped. We list organizations when the key allows it, fetch organization members for your role, then load projects only for the active organization.",
  },
  {
    title: "Operate with honest capability states",
    text: "Project, branch, endpoint, operation, Data API, and consumption panels only claim support when Neon returns data. Permission, plan, or unsupported endpoint states are shown as such.",
  },
];

const apiModels = [
  {
    title: "Personal API key",
    badge: "Best for solo use",
    desc: "A personal key can manage projects you own or can access. For organization-specific calls, NeonPocket passes the selected org_id explicitly and then reads projects, members, and plan context through that scope when permitted.",
    usedFor: ["Initial account validation", "User profile and email", "Organization discovery", "Projects visible to your account"],
  },
  {
    title: "Organization API key",
    badge: "Best for teams",
    desc: "An organization key is already tied to one organization. NeonPocket treats it as a scoped operational key, so organization-level panels can work without pretending it is a full personal account.",
    usedFor: ["Organization project lists", "Members and role checks", "Organization API key metadata", "Team automation style access"],
  },
  {
    title: "Project-scoped organization key",
    badge: "Best for limited access",
    desc: "A project-scoped key is intentionally narrow. NeonPocket keeps the UI constrained: project-level data can still be useful, while organization-wide widgets remain locked or unavailable.",
    usedFor: ["Single-project integrations", "Limited dashboards", "Safer demos", "Reduced blast radius"],
  },
];

const storageItems = [
  "API key is kept in memory after connect unless local vault is enabled.",
  "Local vault uses Web Crypto AES-GCM in IndexedDB; optional passphrase strengthens derivation with PBKDF2.",
  "Optional cloud profile sync stores profile metadata, key hash/hint, device flags, UI settings, and audit timestamps.",
  "Neon resources are read live from Neon APIs; organizations, projects, branches, databases, roles, endpoints, and operations are not copied into an app database.",
  "Diagnostics keep recent API route/status/latency data locally so you can understand auth, plan, and permission problems.",
];

const references = [
  {
    title: "Neon API reference",
    href: "https://neon.com/docs/reference/api-reference",
    detail: "This is the baseline for NeonPocket. Neon documents the API as the programmatic surface for managing projects, branches, databases, roles, compute endpoints, operations, and more. The same page also describes API key types, the Console API base URL, Bearer authentication, pagination, rate limits, and asynchronous operation polling. We use that structure to keep the app tied to real API capabilities instead of hidden or scraped console behavior.",
  },
  {
    title: "Organizations API",
    href: "https://neon.com/docs/manage/orgs-api",
    detail: "The organization layer matters because a mobile console can easily become confusing if project state leaks across organizations. Neon’s organization API guidance is why NeonPocket treats organization selection as the first-class context and why role display is resolved through organization member data rather than guessed from a project list.",
  },
  {
    title: "Consumption metrics",
    href: "https://neon.com/docs/guides/consumption-metrics",
    detail: "Usage metrics are plan and scope dependent. NeonPocket reads consumption history when Neon exposes it, converts compute seconds into CU-hours and byte metrics into readable storage/transfer values, and shows a locked/limited state when the API does not return those billing metrics for the current account.",
  },
  {
    title: "Neon Data API",
    href: "https://neon.com/docs/data-api/overview",
    detail: "The Data API is a separate Neon feature that lets applications interact with Postgres over HTTP-style workflows. NeonPocket surfaces Data API availability and configuration where the API exposes it, while keeping database credentials and Data API state separate from the login key flow.",
  },
];

const testimonials = [
  {
    name: "Mert A.",
    role: "Backend lead, small SaaS team",
    quote: "The useful part is not a pretty chart; it is knowing which organization and branch I am touching before I change anything. That saved our team from a couple of messy context mistakes.",
  },
  {
    name: "Elif K.",
    role: "Freelance product engineer",
    quote: "I use Neon from my laptop most of the day, but client calls happen everywhere. Opening project state, operations, and endpoints from my phone made follow-ups much faster.",
  },
  {
    name: "Deniz R.",
    role: "Agency developer",
    quote: "The transparent permission states are what sold me. If a key cannot read consumption history, it says that directly instead of pretending the metric is zero.",
  },
  {
    name: "Arda S.",
    role: "Indie hacker",
    quote: "Remember-on-device with local encryption is exactly the tradeoff I wanted. I can move quickly on mobile without feeling like I handed my Neon key to another backend.",
  },
];

const faqs = [
  {
    q: "Is NeonPocket an official Neon product?",
    a: "No. NeonPocket Console is an independent client built around documented Neon APIs. It links to official Neon documentation so users can verify what the app is reading and why certain endpoints may be unavailable for a given key or plan.",
  },
  {
    q: "Why do some metrics appear locked or limited?",
    a: "Consumption metrics depend on Neon plan, organization scope, and API permissions. When the API does not expose a metric, the app shows a limited state instead of filling the card with fake data.",
  },
  {
    q: "Do you store my Neon API key in the cloud?",
    a: "No. The raw key is memory-only unless you enable the local vault. The optional cloud profile feature is designed for metadata and preferences only, not the plaintext key.",
  },
  {
    q: "Can I use an organization key instead of a personal key?",
    a: "Yes, but the experience is intentionally scoped. Organization and project-scoped keys may not expose user profile data, so NeonPocket validates them through project access and displays only the panels the key can actually read.",
  },
];

function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(CONSENT_KEY) !== "accepted" && localStorage.getItem(CONSENT_KEY) !== "essential");
  }, []);

  function accept(value: "accepted" | "essential") {
    localStorage.setItem(CONSENT_KEY, value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-4xl rounded-2xl border bg-card/95 p-4 shadow-2xl backdrop-blur md:bottom-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Cookie className="size-4" /></div>
          <div>
            <div className="text-sm font-semibold">Cookies & local storage notice</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              NeonPocket uses essential local storage for consent, UI preferences, diagnostics, and the optional encrypted local vault. We do not use advertising cookies. Optional cloud profile sync is controlled separately in Settings.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <Link to="/cookies" className="underline underline-offset-4 hover:text-foreground">Cookie Policy</Link>
              <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">User Agreement</Link>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 md:flex-col">
          <Button size="sm" onClick={() => accept("accepted")}>Accept</Button>
          <Button size="sm" variant="outline" onClick={() => accept("essential")}>Essential only</Button>
          <button aria-label="Close" onClick={() => setVisible(false)} className="grid size-9 place-items-center rounded-md text-muted-foreground hover:text-foreground md:hidden"><X className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}

function ConsolePreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-background/70 p-3 shadow-2xl">
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-destructive/70" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-primary/70" />
        </div>
        <div className="rounded-full border px-2 py-1 text-[10px] text-muted-foreground">live API state</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {metricPreview.map(item => (
          <div key={item.label} className="rounded-xl border bg-card/80 p-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{item.label}</span><item.icon className="size-3.5" />
            </div>
            <div className="mt-2 text-xl font-semibold">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border bg-card/80 p-3">
        <div className="mb-3 text-xs font-medium">Selected organization</div>
        <div className="space-y-2">
          {["webusta-org · admin", "production-api · aws-eu-central-1", "main · protected branch"].map(row => (
            <div key={row} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <span>{row}</span><CheckCircle2 className="size-3.5 text-primary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
          settings: { greetings: settings.greetings, sounds: settings.sounds, apiMode: settings.apiMode },
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_34rem),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.34))] text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <a href="#top" className="flex items-center gap-2">
            <Logo className="size-9" />
            <div>
              <div className="text-sm font-semibold tracking-tight">NeonPocket Console</div>
              <div className="text-[10px] text-muted-foreground">Mobile-first Neon control plane</div>
            </div>
          </a>
          <nav className="hidden items-center gap-5 md:flex">
            {navigation.map(item => <a key={item.href} href={item.href} className="text-xs text-muted-foreground hover:text-foreground">{item.label}</a>)}
          </nav>
          <a href="#connect"><Button size="sm">Connect</Button></a>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
        <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card/75 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> Built around documented Neon APIs, not scraped console state
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
              A practical Neon console for the moments your laptop is not open.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              NeonPocket helps developers and small teams check organizations, projects, branches, endpoints, operations, account role, and usage availability from a mobile-first interface. It is built for quick operational clarity: what account am I in, what organization is selected, what can this API key actually access, and which panels are unsupported by the current plan or scope?
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="#connect"><Button size="lg" className="w-full sm:w-auto">Connect your Neon key <ArrowRight className="size-4" /></Button></a>
              <a href="#security"><Button size="lg" variant="outline" className="w-full sm:w-auto">Read the security model</Button></a>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {featureMap.map(item => <span key={item.label} className="rounded-full border bg-card/60 px-3 py-1">{item.label}</span>)}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
            <ConsolePreview />
          </motion.div>
        </section>

        <section className="mt-10 rounded-2xl border bg-card/75 p-4 md:p-5">
          <div className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">Designed for real Neon workflows</div>
          <div className="grid gap-3 md:grid-cols-4">
            {["Solo builders", "Agency developers", "Backend teams", "Mobile on-call checks"].map(label => (
              <div key={label} className="rounded-xl border bg-background/50 p-4 text-sm font-medium">{label}</div>
            ))}
          </div>
        </section>

        <section id="benefits" className="mt-12 scroll-mt-24">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Benefits</div>
            <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Built around what it helps you do, not around a checklist of screens.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Every panel exists because it answers an operational question: where am I, what is selected, what does this key allow, and what data did Neon actually return?</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {benefitCards.map(card => (
              <div key={card.title} className="hairline rounded-xl bg-card/80 p-4">
                <card.icon className="mb-3 size-5 text-primary" />
                <div className="text-sm font-semibold">{card.title}</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mt-12 scroll-mt-24">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">How it works</div>
            <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Get from API key to scoped dashboard in three steps.</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="hairline rounded-xl bg-card/80 p-4">
                <div className="mb-4 grid size-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</div>
                <div className="text-sm font-semibold">{step.title}</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="security" className="mt-12 grid scroll-mt-24 gap-4 lg:grid-cols-2">
          <div className="hairline rounded-2xl bg-card/80 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileKey2 className="size-4" /> API key model</div>
            <div className="space-y-3">
              {apiModels.map(model => (
                <div key={model.title} className="rounded-xl border bg-background/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{model.title}</div>
                    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{model.badge}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{model.desc}</p>
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {model.usedFor.map(item => <div key={item} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><BadgeCheck className="size-3 text-primary" />{item}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hairline rounded-2xl bg-card/80 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4" /> Data transparency</div>
            <div className="space-y-3">
              {storageItems.map(item => (
                <div key={item} className="flex gap-2 rounded-xl border bg-background/55 p-3 text-xs leading-5 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" /> <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-12 scroll-mt-24" id="testimonials">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Workflow feedback</div>
            <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Built for developers who care more about speed and context than decoration.</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {testimonials.map(item => (
              <div key={item.name} className="hairline rounded-xl bg-card/80 p-4">
                <div className="mb-3 flex gap-0.5 text-primary">{Array.from({ length: 5 }).map((_, i) => <span key={i}>★</span>)}</div>
                <p className="text-xs leading-5 text-muted-foreground">“{item.quote}”</p>
                <div className="mt-4 text-sm font-semibold">{item.name}</div>
                <div className="text-[11px] text-muted-foreground">{item.role}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="references" className="mt-12 scroll-mt-24">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Neon references</div>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl">The product copy is tied to official Neon documentation.</h2>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {references.map(ref => (
              <div key={ref.href} className="hairline rounded-xl bg-card/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4" />{ref.title}</div>
                <p className="text-xs leading-5 text-muted-foreground">{ref.detail}</p>
                <a href={ref.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4 hover:text-primary">
                  Reference: {ref.href} <ArrowRight className="size-3" />
                </a>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="mt-12 grid scroll-mt-24 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">FAQ</div>
            <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Before you connect a key.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">The app is intentionally strict about what it claims. If Neon does not return data for your key, plan, or organization, NeonPocket shows that limitation.</p>
          </div>
          <div className="space-y-2">
            {faqs.map(faq => (
              <details key={faq.q} className="hairline group rounded-xl bg-card/80 p-4">
                <summary className="cursor-pointer list-none text-sm font-medium">{faq.q}</summary>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="connect" className="mt-12 grid scroll-mt-24 gap-5 lg:grid-cols-[minmax(0,1fr)_430px]">
          <div className="hairline rounded-2xl bg-card/80 p-5 md:p-7">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" />No pricing gate today</div>
            <h2 className="text-2xl font-semibold md:text-3xl">Start with your own Neon account. Nothing is mocked after login.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">The landing page explains the product, but the console itself uses your real Neon API responses. Empty states mean no data, unsupported scope, missing permission, or a failed request — not placeholder resources.</p>
          </div>

          <aside className="hairline rounded-2xl bg-card p-5 shadow-sm">
            <div className="mb-4">
              <div className="text-lg font-semibold">Connect your Neon account</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">Paste a Neon Console API key. Validation tries <span className="mono">/users/me</span> first, then <span className="mono">/projects</span> for scoped keys.</div>
            </div>

            {storedExists ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm"><Lock className="size-4" /> <span>Encrypted key found on this device</span></div>
                {hasDeviceAuth() && <div className="rounded-md bg-primary/10 p-2 text-xs text-primary">Device authentication is enabled. Unlock may request Face ID, Touch ID, or your platform authenticator.</div>}
                {storedUsesPass && <div className="space-y-1.5"><Label htmlFor="up">Passphrase</Label><Input id="up" type="password" value={unlockPass} onChange={e => setUnlockPass(e.target.value)} autoFocus /></div>}
                <div className="flex gap-2"><Button onClick={onUnlock} disabled={loading} className="flex-1">{loading ? <Loader2 className="size-4 animate-spin" /> : "Unlock"}</Button><Button variant="outline" onClick={() => setStoredExists(false)}>Use another key</Button></div>
                <button onClick={onForget} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /> Forget key on this device</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ak" className="flex items-center gap-1.5"><KeyRound className="size-3.5" />Neon API key</Label>
                  <div className="relative"><Input id="ak" type={show ? "text" : "password"} placeholder="napi_…" autoComplete="off" value={apiKey} onChange={e => setKey(e.target.value)} className="pr-10 mono" /><button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Toggle visibility">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
                  <div className="text-[11px] text-muted-foreground break-words">Create one in Neon Console under <span className="mono">Account settings → API keys</span>. Neon Console API keys usually start with <span className="mono">napi_</span>.</div>
                  {looksLikeLegacyPrefix && <div className="text-[11px] text-warning break-words">This looks like a database or legacy token prefix. Neon API access expects a Console API key, typically starting with <span className="mono">napi_</span>.</div>}
                  {normalizedKey && !looksLikeApiKey && !looksLikeLegacyPrefix && <div className="text-[11px] text-muted-foreground break-words">The app will still try this token, but double-check that it is a Neon Console API key rather than a connection string or password.</div>}
                </div>
                <div className="flex items-center justify-between rounded-md hairline p-3"><div><div className="text-sm font-medium">Remember on this device</div><div className="text-[11px] text-muted-foreground">Encrypted locally with Web Crypto AES-GCM in IndexedDB.</div></div><Switch checked={remember} onCheckedChange={setRemember} /></div>
                {remember && <div className="space-y-1.5"><Label htmlFor="pp">Optional passphrase</Label><Input id="pp" type="password" placeholder="Strengthens encryption with PBKDF2" value={passphrase} onChange={e => setPass(e.target.value)} /></div>}
                <Button onClick={onConnect} disabled={loading || !normalizedKey} className="w-full">{loading ? <Loader2 className="size-4 animate-spin" /> : "Connect to NeonPocket"}</Button>
                <div className="text-[11px] text-muted-foreground flex items-start gap-1.5"><ShieldCheck className="size-3.5 mt-px shrink-0" /><span>By connecting, you agree to the <Link to="/terms" className="underline underline-offset-4">User Agreement</Link>, <Link to="/privacy" className="underline underline-offset-4">Privacy Policy</Link>, and <Link to="/cookies" className="underline underline-offset-4">Cookie Policy</Link>. All Neon account data is read live through official API endpoints.</span></div>
              </div>
            )}
          </aside>
        </section>

        <section className="mt-12 rounded-2xl border bg-primary/10 p-6 text-center md:p-8">
          <h2 className="text-2xl font-semibold md:text-3xl">Ready when you need a fast Neon check from mobile.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Connect a real API key, select a real organization, and let the app show exactly what Neon allows that key to see.</p>
          <a href="#connect" className="mt-5 inline-flex"><Button size="lg">Connect now</Button></a>
        </section>
      </main>

      <footer className="border-t bg-background/65">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-xs text-muted-foreground md:grid-cols-4 md:px-8">
          <div><div className="mb-2 flex items-center gap-2 text-foreground"><Logo className="size-6" />NeonPocket Console</div><p className="leading-5">Independent mobile-first control plane for developers using Neon APIs.</p></div>
          <div><div className="mb-2 font-medium text-foreground">Product</div><div className="space-y-1"><a href="#benefits" className="block hover:text-foreground">Benefits</a><a href="#how-it-works" className="block hover:text-foreground">How it works</a><a href="#security" className="block hover:text-foreground">Security</a></div></div>
          <div><div className="mb-2 font-medium text-foreground">Legal</div><div className="space-y-1"><Link to="/terms" className="block hover:text-foreground">User Agreement</Link><Link to="/privacy" className="block hover:text-foreground">Privacy Policy</Link><Link to="/cookies" className="block hover:text-foreground">Cookie Policy</Link></div></div>
          <div><div className="mb-2 font-medium text-foreground">References</div><div className="space-y-1">{references.slice(0, 3).map(ref => <a key={ref.href} href={ref.href} target="_blank" rel="noreferrer" className="block hover:text-foreground">{ref.title}</a>)}</div></div>
        </div>
      </footer>
      <CookieConsent />
    </div>
  );
}
