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
  const { apiKey, settings, diagnostics, clearDiagnostics, playUiSound } = useApp();
  const [running, setRunning] = useState(false);
  const [testKey, setTestKey] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const effectiveKey = apiKey || testKey.replace(/\s+/g, "");

  const report = useMemo(() => ({
    generated_at: new Date().toISOString(),
    app: "NeonPocket Console 0.1.0",
    page_origin: window.location.origin,
    page_path: window.location.pathname,
    neon_base: NEON_BASE,
    neon_proxy_url: NEON_PROXY_URL,
    api_mode: "proxy",
    api_key_hint: redact(effectiveKey),
    user_agent: navigator.userAgent,
    online: navigator.onLine,
    diagnostics,
  }), [diagnostics, effectiveKey]);

  const reportText = JSON.stringify(report, null, 2);
  const requestLogText = useMemo(() => diagnostics.map(d => [
    d.status,
    `${d.ms}ms`,
    d.route,
    d.ok ? "ok" : (d.errorMessage || "failed"),
    d.ts,
  ].join("\t")).join("\n"), [diagnostics]);

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    playUiSound("success");
    toast.success("Diagnostics report copied");
  }

  async function copyRequestLog() {
    await navigator.clipboard.writeText(requestLogText || "No requests yet.");
    playUiSound("success");
    toast.success("Request log copied");
  }

  function clearWithConfirm() {
    if (!confirmClear) {
      setConfirmClear(true);
      playUiSound("warning");
      toast.warning("Tap Clear again to confirm");
      window.setTimeout(() => setConfirmClear(false), 6000);
      return;
    }
    clearDiagnostics();
    setConfirmClear(false);
    playUiSound("soft");
    toast.success("Diagnostics cleared");
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
      playUiSound("success");
      toast.success("Neon checks completed");
    } catch (error: any) {
      playUiSound("warning");
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
        <AlertTitle>Proxy-only Neon API transport</AlertTitle>
        <AlertDescription>
          All Neon API calls are locked to <span className="mono">{NEON_PROXY_URL}</span>. Direct browser calls to
          <span className="mono"> {NEON_BASE}</span> are disabled because production browsers block Neon's CORS/preflight flow.
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

      <div className="hairline rounded-lg bg-card mb-4">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Request log</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={copyRequestLog} disabled={diagnostics.length === 0}>
              <ClipboardCopy className="size-3.5 mr-1.5" /> Copy all
            </Button>
            <Button variant={confirmClear ? "destructive" : "ghost"} size="sm" onClick={clearWithConfirm} disabled={diagnostics.length === 0}>
              <Trash2 className="size-3.5 mr-1.5" /> {confirmClear ? "Confirm clear" : "Clear"}
            </Button>
          </div>
        </div>
        <div className="max-h-56 overflow-auto text-[11px] mono">
          {diagnostics.length === 0 ? <div className="p-3 text-muted-foreground">No requests yet.</div> :
            diagnostics.map((d, i) => (
              <div key={i} className={`px-3 py-1.5 border-b last:border-b-0 border-border flex gap-2 min-w-0 ${d.ok ? "" : "text-destructive"}`}>
                <span className="w-12 shrink-0">{d.status}</span>
                <span className="w-14 shrink-0">{d.ms}ms</span>
                <span className="min-w-0 break-words">{d.route}</span>
              </div>
            ))
          }
        </div>
      </div>

      <div className="hairline rounded-lg bg-card">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Copyable report</div>
          <Button variant="ghost" size="sm" onClick={copyReport}>
            <ClipboardCopy className="size-3.5 mr-1.5" /> Copy report
          </Button>
        </div>
        <Textarea value={reportText} readOnly className="min-h-[420px] mono text-[11px] rounded-none border-0 focus-visible:ring-0" />
      </div>
    </Page>
  );
}
