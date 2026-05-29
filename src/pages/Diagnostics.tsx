import { useMemo, useState } from "react";
import { Activity, ClipboardCopy, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/layout/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/state/AppContext";
import { NEON_BASE, NEON_PROXY_URL } from "@/lib/neon/client";
import { NeonService } from "@/lib/neon/service";

function redact(value: string | null | undefined) {
  if (!value) return null;
  return `${value.slice(0, 5)}…${value.slice(-4)}`;
}

export default function Diagnostics() {
  const { apiKey, settings, diagnostics, clearDiagnostics } = useApp();
  const [running, setRunning] = useState(false);
  const [testKey, setTestKey] = useState("");
  const effectiveKey = apiKey || testKey.replace(/\s+/g, "");

  const report = useMemo(() => ({
    generated_at: new Date().toISOString(),
    app: "NeonPocket Console 0.1.0",
    page_origin: window.location.origin,
    page_path: window.location.pathname,
    neon_base: NEON_BASE,
    neon_proxy_url: NEON_PROXY_URL,
    api_mode: settings.apiMode,
    api_key_hint: redact(effectiveKey),
    user_agent: navigator.userAgent,
    online: navigator.onLine,
    diagnostics,
  }), [diagnostics, effectiveKey, settings.apiMode]);

  const reportText = JSON.stringify(report, null, 2);

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    toast.success("Diagnostics copied");
  }

  async function runChecks() {
    if (!effectiveKey) {
      toast.error("No API key available for diagnostics");
      return;
    }
    setRunning(true);
    try {
      await NeonService.getCurrentUser({ apiKey: effectiveKey, mode: settings.apiMode });
      await NeonService.listOrganizations({ apiKey: effectiveKey, mode: settings.apiMode });
      await NeonService.listProjects({ apiKey: effectiveKey, mode: settings.apiMode });
      toast.success("Neon checks completed");
    } catch (error: any) {
      toast.error("Neon check failed", { description: error?.message || "Unknown error" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title="Diagnostics"
        description="Copy this report after a failed connection attempt. API keys and Authorization headers are never logged."
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={runChecks} disabled={running || !effectiveKey}>
              <Play className="size-3.5 mr-1.5" /> {running ? "Running…" : "Run checks"}
            </Button>
            <Button variant="outline" size="sm" onClick={copyReport}>
              <ClipboardCopy className="size-3.5 mr-1.5" /> Copy report
            </Button>
          </>
        )}
      />

      <Alert className="mb-4">
        <Activity className="size-4" />
        <AlertTitle>Cloudflare Worker proxy</AlertTitle>
        <AlertDescription>
          Auto mode tries <span className="mono">{NEON_BASE}</span> first. If the browser blocks the direct request, it falls back to
          <span className="mono"> {NEON_PROXY_URL}</span>. For Lovable/static deployments, set <span className="mono">VITE_NEON_PROXY_URL</span>
          to your Cloudflare Worker URL because static hosting does not execute <span className="mono">/api/neon-proxy</span>.
        </AlertDescription>
      </Alert>

      {!apiKey && (
        <div className="hairline rounded-lg bg-card p-3 mb-4 space-y-1.5">
          <Label htmlFor="diag-key">Temporary Neon API key for diagnostics</Label>
          <Input
            id="diag-key"
            type="password"
            value={testKey}
            onChange={e => setTestKey(e.target.value)}
            placeholder="napi_…"
            autoComplete="off"
            className="mono"
          />
          <div className="text-[11px] text-muted-foreground">This key stays in this page state only and is redacted in copied reports.</div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <div className="hairline rounded-lg bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Origin</div>
          <div className="mt-1 text-sm mono break-all">{window.location.origin}</div>
        </div>
        <div className="hairline rounded-lg bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Neon API</div>
          <div className="mt-1 text-sm mono break-all">{NEON_BASE}</div>
        </div>
        <div className="hairline rounded-lg bg-card p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Recent requests</div>
          <div className="mt-1 text-sm mono">{diagnostics.length}</div>
        </div>
      </div>

      <div className="hairline rounded-lg bg-card">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Copyable report</div>
          <Button variant="ghost" size="sm" onClick={() => { clearDiagnostics(); toast.success("Diagnostics cleared"); }}>
            <Trash2 className="size-3.5 mr-1.5" /> Clear
          </Button>
        </div>
        <Textarea value={reportText} readOnly className="min-h-[420px] mono text-[11px] rounded-none border-0 focus-visible:ring-0" />
      </div>
    </Page>
  );
}
