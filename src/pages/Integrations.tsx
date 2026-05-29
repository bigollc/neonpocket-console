import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp, useNeonCtx } from "@/state/AppContext";
import { useGenericQuery } from "@/state/queries";
import { NeonService } from "@/lib/neon/service";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, KeyRound, Building2, MapPin, BarChart3 } from "lucide-react";
import { toast } from "sonner";

function CopyBtn({ text }: { text: string }) {
  return <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}>
    <Copy className="size-3.5 mr-1.5" />Copy
  </Button>;
}

export default function Integrations() {
  const ctx = useNeonCtx();
  const { selectedProjectId, selectedBranchId } = useApp();

  const orgs = useGenericQuery(["orgs", ctx.mode], (signal) => NeonService.listOrganizations({ ...ctx as any, signal }), !!ctx.apiKey);
  const keys = useGenericQuery(["apikeys", ctx.mode], (signal) => NeonService.listApiKeys({ ...ctx as any, signal }), !!ctx.apiKey);
  const regions = useGenericQuery(["regions", ctx.mode], (signal) => NeonService.listRegions({ ...ctx as any, signal }), !!ctx.apiKey);
  const usage = useGenericQuery(["consumption", ctx.mode], (signal) => NeonService.consumption({ ...ctx as any, signal }), !!ctx.apiKey);

  const cliProject = selectedProjectId ? `neon branches list --project-id ${selectedProjectId}` : `neon projects list`;
  const ghaSnippet = `# .github/workflows/neon.yml
- uses: neondatabase/create-branch-action@v5
  with:
    project_id: ${selectedProjectId || "<project_id>"}
    parent: ${selectedBranchId || "<parent_branch_id>"}
    api_key: \${{ secrets.NEON_API_KEY }}`;

  return (
    <Page>
      <PageHeader title="Integrations" description="Real data from your Neon account where the API exposes it." />

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Organizations" icon={Building2} q={orgs} render={(d: any) => {
          const arr = d?.organizations ?? [];
          if (!arr.length) return <EmptyState title="No organizations" description="Your account has no organizations, or this endpoint isn't enabled for your plan." />;
          return <ul className="text-sm divide-y divide-border">{arr.map((o: any) => (
            <li key={o.id} className="py-2 flex justify-between"><span>{o.name || o.handle}</span><span className="mono text-xs text-muted-foreground">{o.plan || ""}</span></li>
          ))}</ul>;
        }} />
        <Card title="API keys" icon={KeyRound} q={keys} render={(d: any) => {
          const arr = Array.isArray(d) ? d : (d?.keys || []);
          if (!arr.length) return <EmptyState title="No API key metadata returned" description="Your token may not be allowed to list keys." />;
          return <ul className="text-sm divide-y divide-border">{arr.map((k: any) => (
            <li key={k.id} className="py-2 flex justify-between"><span>{k.name}</span><span className="mono text-[11px] text-muted-foreground">{k.created_at?.slice(0,10)}</span></li>
          ))}</ul>;
        }} />
        <Card title="Regions" icon={MapPin} q={regions} render={(d: any) => {
          const arr = d?.regions ?? (Array.isArray(d) ? d : []);
          if (!arr.length) return <EmptyState title="No region list returned" />;
          return <div className="flex flex-wrap gap-1.5">{arr.map((r: any, i: number) => <span key={i} className="px-2 py-0.5 text-xs hairline rounded mono">{r.region_id || r.id || r.name}</span>)}</div>;
        }} />
        <Card title="Consumption" icon={BarChart3} q={usage} render={(d: any) => {
          if (!d || (Array.isArray(d) && !d.length)) return <EmptyState title="No usage data" description="Your plan may not expose consumption metrics through the API." />;
          return <pre className="text-[11px] mono bg-muted/40 p-2 rounded max-h-48 overflow-auto">{JSON.stringify(d, null, 2)}</pre>;
        }} />
      </div>

      <div className="mt-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tooling</div>
        <div className="grid md:grid-cols-2 gap-3">
          <ToolCard title="Vercel" desc="Connect Neon as the Postgres provider for your Vercel project."
            link="https://vercel.com/marketplace/neon" />
          <ToolCard title="GitHub Actions" desc="Create preview branches per PR using the official action." link="https://github.com/neondatabase/create-branch-action"
            snippet={ghaSnippet} />
          <ToolCard title="Neon CLI" desc="Install and use the official CLI with your selected project." link="https://neon.com/docs/reference/neon-cli"
            snippet={cliProject} />
          <ToolCard title="Neon MCP" desc="Use Neon from MCP-compatible AI tools." link="https://neon.com/docs/ai/neon-mcp-server" />
        </div>
      </div>
    </Page>
  );
}

function Card({ title, icon: Icon, q, render }: any) {
  return (
    <div className="hairline rounded-lg bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-medium"><Icon className="size-4" />{title}</div>
      <div className="p-4">
        {q.isLoading ? <Skeleton className="h-16" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : render(q.data)}
      </div>
    </div>
  );
}
function ToolCard({ title, desc, link, snippet }: { title: string; desc: string; link: string; snippet?: string }) {
  return (
    <div className="hairline rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{title}</div>
          <div className="text-xs text-muted-foreground mt-1">{desc}</div>
        </div>
        <a className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" href={link} target="_blank" rel="noreferrer"><ExternalLink className="size-3" />Docs</a>
      </div>
      {snippet && (
        <div className="mt-3">
          <pre className="text-[11px] mono bg-muted/40 p-2 rounded overflow-x-auto whitespace-pre">{snippet}</pre>
          <div className="mt-2"><CopyBtn text={snippet} /></div>
        </div>
      )}
    </div>
  );
}
