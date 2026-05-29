import { useMemo, useState } from "react";
import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp } from "@/state/AppContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";

export default function Feedback() {
  const { selectedProjectId, selectedBranchId, settings, diagnostics } = useApp();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const lastFailed = diagnostics.find(d => !d.ok);
  const diag = useMemo(() => ({
    app: "NeonPocket Console 0.1.0",
    route: window.location.pathname,
    project_id: selectedProjectId,
    branch_id: selectedBranchId,
    api_mode: settings.apiMode,
    last_status: diagnostics[0]?.status ?? null,
    last_failed: lastFailed ? { status: lastFailed.status, route: lastFailed.route, ms: lastFailed.ms } : null,
  }), [selectedProjectId, selectedBranchId, settings.apiMode, diagnostics, lastFailed]);

  const template = `## ${title || "Feedback"}

${details || "(Describe the issue or suggestion)"}

---
Diagnostics (no secrets included):
\`\`\`json
${JSON.stringify(diag, null, 2)}
\`\`\``;

  const mailto = `mailto:?subject=${encodeURIComponent("NeonPocket Feedback: " + (title || ""))}&body=${encodeURIComponent(template)}`;

  return (
    <Page>
      <PageHeader title="Feedback" description="Local-only composer. Diagnostics never contain API keys, JWTs, or request bodies." />
      <div className="space-y-3 max-w-2xl">
        <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Details</Label><Textarea value={details} onChange={e => setDetails(e.target.value)} className="min-h-[160px]" /></div>
        <div className="flex gap-2">
          <Button onClick={() => { navigator.clipboard.writeText(template); toast.success("Copied issue template"); }}><Copy className="size-4 mr-2" />Copy</Button>
          <Button variant="outline" asChild><a href={mailto}><Mail className="size-4 mr-2" />Open email</a></Button>
        </div>
        <div className="hairline rounded-md bg-card">
          <div className="px-3 py-2 border-b border-border text-xs">Preview</div>
          <pre className="p-3 text-[11px] mono whitespace-pre-wrap">{template}</pre>
        </div>
      </div>
    </Page>
  );
}
