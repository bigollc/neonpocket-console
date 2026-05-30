import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Cookie, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";

const updatedAt = "May 30, 2026";

type PolicyKey = "terms" | "privacy" | "cookies";

type PolicySection = {
  title: string;
  body: string[];
};

type Policy = {
  key: PolicyKey;
  title: string;
  kicker: string;
  icon: any;
  intro: string;
  sections: PolicySection[];
};

const policies: Record<PolicyKey, Policy> = {
  terms: {
    key: "terms",
    title: "User Agreement",
    kicker: "Terms of use",
    icon: FileText,
    intro: "These terms explain how NeonPocket Console should be used. The product is an independent client for documented Neon APIs and is not an official Neon product.",
    sections: [
      {
        title: "1. Product scope",
        body: [
          "NeonPocket Console is a mobile-first interface for users who connect their own Neon Console API key. It reads resources that Neon exposes to that key, such as organizations, projects, branches, databases, roles, endpoints, operations, organization members, and supported usage metrics.",
          "The app does not create fake resources or mock usage states. If a Neon endpoint is unavailable for your key, account, plan, or organization scope, the app may show an unavailable, locked, limited, or failed state.",
        ],
      },
      {
        title: "2. Your Neon account and API key",
        body: [
          "You are responsible for creating, rotating, and revoking your Neon API key from Neon Console. Only connect keys that you are authorized to use.",
          "Actions performed through NeonPocket are API actions performed with your key. If a future version adds write operations, you remain responsible for confirming the selected organization, project, branch, and operation before proceeding.",
        ],
      },
      {
        title: "3. Independent service notice",
        body: [
          "NeonPocket is not affiliated with, endorsed by, or operated by Neon. Neon names and documentation links are used to explain compatibility with Neon’s public API surface.",
        ],
      },
      {
        title: "4. Availability and correctness",
        body: [
          "The app aims to present Neon API responses clearly, but it cannot guarantee that every Neon API response, plan limitation, or organization permission will be available at all times.",
          "You should verify sensitive operations in Neon Console or your own operational process before making production-impacting changes.",
        ],
      },
      {
        title: "5. No pricing policy yet",
        body: [
          "NeonPocket currently does not present a paid pricing plan on the landing page. If billing or subscriptions are added later, the related terms will be expanded before collecting payment.",
        ],
      },
    ],
  },
  privacy: {
    key: "privacy",
    title: "Privacy Policy",
    kicker: "Data handling",
    icon: ShieldCheck,
    intro: "This policy explains what NeonPocket processes, what stays local, and what optional metadata may be synced if a cloud profile feature is enabled.",
    sections: [
      {
        title: "1. API key handling",
        body: [
          "By default, the Neon API key is held in browser memory after you connect. It is cleared when you sign out, reload depending on session state, or clear local state.",
          "If you enable “Remember on this device,” the key is stored in the local vault using Web Crypto AES-GCM in IndexedDB. If you add an optional passphrase, that passphrase is used to strengthen local encryption derivation with PBKDF2.",
          "The raw Neon API key is not designed to be stored in the cloud profile database.",
        ],
      },
      {
        title: "2. Neon resource data",
        body: [
          "Organizations, projects, branches, databases, roles, endpoints, operations, organization members, Data API settings, and usage values are read live from Neon APIs using the connected key.",
          "The app should not copy Neon account resources into its own application database. UI state may cache short-lived query results in the browser for responsiveness.",
        ],
      },
      {
        title: "3. Optional cloud profile metadata",
        body: [
          "If cloud profile sync is enabled, metadata may include user name, email, key hash or key hint, device/authentication flags, selected UI preferences, sync status, IP/user-agent metadata, and audit timestamps.",
          "Cloud profile sync is for preferences and account convenience. It should not be used to store raw database passwords, connection strings, or raw Neon API keys.",
        ],
      },
      {
        title: "4. Diagnostics",
        body: [
          "Diagnostics may include API route, HTTP status, latency, timestamp, and error message. This helps users understand whether an issue comes from network, CORS/proxy, API permissions, plan limits, or unsupported Neon endpoints.",
        ],
      },
      {
        title: "5. Your controls",
        body: [
          "You can sign out, forget the local key, clear local cache, disable cloud profile sync, and revoke the Neon API key directly inside Neon Console.",
        ],
      },
    ],
  },
  cookies: {
    key: "cookies",
    title: "Cookie & Local Storage Policy",
    kicker: "Consent and storage",
    icon: Cookie,
    intro: "NeonPocket uses browser storage for product functionality. The current landing page does not require advertising cookies.",
    sections: [
      {
        title: "1. Essential storage",
        body: [
          "Essential storage includes cookie/local-storage consent, UI preferences, selected theme, motion settings, diagnostics, and feature toggles needed for the application to behave consistently.",
        ],
      },
      {
        title: "2. Local vault storage",
        body: [
          "If you choose “Remember on this device,” the encrypted local vault is stored in IndexedDB. This is optional and can be removed from Settings or from the connection screen.",
        ],
      },
      {
        title: "3. Analytics and advertising",
        body: [
          "The current product copy does not describe third-party advertising cookies. If analytics or marketing tools are added in the future, this policy and the consent flow should be updated before activation.",
        ],
      },
      {
        title: "4. Consent choices",
        body: [
          "The landing page offers Accept and Essential only choices. Essential only keeps the minimum local storage required to remember the consent decision and run the app safely.",
        ],
      },
    ],
  },
};

function policyFromPath(pathname: string): Policy {
  if (pathname.includes("privacy")) return policies.privacy;
  if (pathname.includes("cookies")) return policies.cookies;
  return policies.terms;
}

export default function Legal() {
  const location = useLocation();
  const policy = policyFromPath(location.pathname);
  const Icon = policy.icon;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_28rem),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.28))] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link to="/connect" className="flex items-center gap-2">
            <Logo className="size-8" />
            <div>
              <div className="text-sm font-semibold">NeonPocket Console</div>
              <div className="text-[10px] text-muted-foreground">Legal and transparency</div>
            </div>
          </Link>
          <Link to="/connect" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Back to landing
          </Link>
        </header>

        <main className="hairline rounded-2xl bg-card/85 p-5 md:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <Icon className="size-3.5" /> {policy.kicker}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{policy.title}</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground md:text-base">{policy.intro}</p>
          <div className="mt-4 rounded-xl border bg-background/55 p-3 text-xs text-muted-foreground">
            Last updated: {updatedAt}. This page is product transparency text, not legal advice. Review with qualified counsel before relying on it for a commercial launch.
          </div>

          <div className="mt-8 space-y-6">
            {policy.sections.map(section => (
              <section key={section.title}>
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <div className="mt-2 space-y-2">
                  {section.body.map(paragraph => (
                    <p key={paragraph} className="text-sm leading-6 text-muted-foreground">{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8 grid gap-2 rounded-xl border bg-background/55 p-4 text-xs text-muted-foreground md:grid-cols-3">
            <Link to="/terms" className="inline-flex items-center gap-2 hover:text-foreground"><FileText className="size-3.5" /> User Agreement</Link>
            <Link to="/privacy" className="inline-flex items-center gap-2 hover:text-foreground"><ShieldCheck className="size-3.5" /> Privacy Policy</Link>
            <Link to="/cookies" className="inline-flex items-center gap-2 hover:text-foreground"><Cookie className="size-3.5" /> Cookie Policy</Link>
          </div>
        </main>
      </div>
    </div>
  );
}
