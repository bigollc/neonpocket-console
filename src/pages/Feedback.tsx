import { useMemo, useState } from "react";
import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp } from "@/state/AppContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Mail } from "lucide-react";
import { toast } from "sonner";

const SUPPORT_EMAIL = "info@webusta.org";

function browserName(userAgent: string) {
  if (/Edg\//i.test(userAgent)) return "Microsoft Edge";
  if (/CriOS\//i.test(userAgent)) return "Chrome iOS";
  if (/Chrome\//i.test(userAgent)) return "Google Chrome";
  if (/FxiOS\//i.test(userAgent)) return "Firefox iOS";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/OPR\//i.test(userAgent)) return "Opera";
  if (/Safari\//i.test(userAgent) && /Version\//i.test(userAgent)) return "Safari";
  return "Unknown browser";
}

function osName(userAgent: string, platform: string) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    const version = userAgent.match(/OS ([\d_]+)/i)?.[1]?.replace(/_/g, ".");
    return version ? `iOS ${version}` : "iOS";
  }
  if (/Android/i.test(userAgent)) {
    const version = userAgent.match(/Android ([\d.]+)/i)?.[1];
    return version ? `Android ${version}` : "Android";
  }
  if (/Windows NT/i.test(userAgent)) return "Windows";
  if (/Mac OS X/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent) || /Linux/i.test(platform)) return "Linux";
  return platform || "Unknown OS";
}

function deviceType(userAgent: string) {
  if (/iPhone|Android.*Mobile/i.test(userAgent)) return "Phone";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "Tablet";
  return "Desktop / browser";
}

function boolLabel(value: boolean) {
  return value ? "enabled" : "disabled";
}

export default function Feedback() {
  const { selectedOrganizationId, selectedProjectId, selectedBranchId, selectedDatabase, settings, diagnostics, playUiSound } = useApp();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const canSubmit = title.trim().length > 0 && details.trim().length > 0;
  const lastFailed = diagnostics.find(d => !d.ok);
  const recentDiagnostics = diagnostics.slice(0, 8).map(d => ({
    ts: d.ts,
    ok: d.ok,
    status: d.status,
    method: d.method,
    route: d.route,
    ms: d.ms,
    error: d.errorMessage || null,
  }));

  const device = useMemo(() => {
    const nav = window.navigator;
    const screenInfo = window.screen;
    const ua = nav.userAgent || "";
    return {
      device_type: deviceType(ua),
      operating_system: osName(ua, nav.platform || ""),
      browser: browserName(ua),
      platform: nav.platform || null,
      language: nav.language || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen_resolution: `${screenInfo.width}x${screenInfo.height}`,
      device_pixel_ratio: window.devicePixelRatio || 1,
      user_agent: ua,
    };
  }, []);

  const diagnosticPayload = useMemo(() => ({
    app: "NeonPocket Console 0.1.0",
    generated_at: new Date().toISOString(),
    route: window.location.pathname,
    context: {
      organization_id: selectedOrganizationId,
      project_id: selectedProjectId,
      branch_id: selectedBranchId,
      database: selectedDatabase,
      api_mode: settings.apiMode,
      theme: settings.theme,
      motion: settings.motion,
      sounds: boolLabel(settings.sounds),
      local_history: boolLabel(settings.localHistory),
      cloud_profile_sync: boolLabel(settings.cloudProfileSync),
      mobile_bottom_nav: boolLabel(settings.mobileBottomNav),
    },
    user_environment: device,
    diagnostics_summary: {
      total_events: diagnostics.length,
      failed_events: diagnostics.filter(d => !d.ok).length,
      last_status: diagnostics[0]?.status ?? null,
      last_route: diagnostics[0]?.route ?? null,
      last_failed: lastFailed ? {
        status: lastFailed.status,
        method: lastFailed.method,
        route: lastFailed.route,
        ms: lastFailed.ms,
        error: lastFailed.errorMessage || null,
        ts: lastFailed.ts,
      } : null,
      recent_events: recentDiagnostics,
    },
  }), [selectedOrganizationId, selectedProjectId, selectedBranchId, selectedDatabase, settings, diagnostics, lastFailed, recentDiagnostics, device]);

  const humanSummary = `User/session summary:
- Device: ${device.device_type}
- OS: ${device.operating_system}
- Browser: ${device.browser}
- Screen: ${device.screen_resolution} @ ${device.device_pixel_ratio}x
- Viewport: ${device.viewport}
- Timezone: ${device.timezone || "unknown"}
- Route: ${window.location.pathname}
- Organization: ${selectedOrganizationId || "not selected"}
- Project: ${selectedProjectId || "not selected"}
- Branch: ${selectedBranchId || "not selected"}
- Database: ${selectedDatabase || "not selected"}
- API mode: ${settings.apiMode}
- Diagnostics: ${diagnostics.length} recent event(s), ${diagnostics.filter(d => !d.ok).length} failed event(s)
- Last API status: ${diagnostics[0]?.status ?? "none"}
- Last failed route: ${lastFailed ? `${lastFailed.status} · ${lastFailed.route}` : "none"}`;

  const template = `## ${title || "Feedback title required"}

${details || "Feedback details required before opening email."}

---
${humanSummary}

---
Diagnostic payload:
\`\`\`json
${JSON.stringify(diagnosticPayload, null, 2)}
\`\`\``;

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("NeonPocket Feedback: " + title.trim())}&body=${encodeURIComponent(template)}`;

  function openEmail(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!canSubmit) {
      event.preventDefault();
      playUiSound("warning");
      toast.error("Title and details are required", { description: "Add both fields before opening email." });
      return;
    }
    playUiSound("nav");
  }

  return (
    <Page>
      <PageHeader title="Feedback" description="Local-only composer. Diagnostics exclude API keys and other sensitive values." />
      <div className="space-y-3 max-w-2xl">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Short title for the issue or suggestion" />
        </div>
        <div className="space-y-1.5">
          <Label>Details</Label>
          <Textarea value={details} onChange={e => setDetails(e.target.value)} className="min-h-[160px]" placeholder="What happened, what did you expect, and what were you trying to do?" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild disabled={!canSubmit}>
            <a href={canSubmit ? mailto : "#"} aria-disabled={!canSubmit} onClick={openEmail} className={!canSubmit ? "pointer-events-none opacity-50" : undefined}>
              <Mail className="size-4 mr-2" />Open email
            </a>
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="grid size-5 shrink-0 place-items-center rounded-full border text-foreground">
            <Info className="size-3" />
          </span>
          <span>Emails are addressed to <span className="mono">{SUPPORT_EMAIL}</span>.</span>
        </div>
        <div className="hairline rounded-md bg-card">
          <div className="px-3 py-2 border-b border-border text-xs">Preview</div>
          <pre className="p-3 text-[11px] mono whitespace-pre-wrap">{template}</pre>
        </div>
      </div>
    </Page>
  );
}
