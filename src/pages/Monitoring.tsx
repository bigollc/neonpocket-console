import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp } from "@/state/AppContext";
import { useEndpointsQuery, useOperationsQuery } from "@/state/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { Activity, BarChart3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Monitoring() {
  const { selectedProjectId } = useApp();
  const ops = useOperationsQuery(selectedProjectId, { pollInterval: 3000 });
  const endpoints = useEndpointsQuery(selectedProjectId);
  if (!selectedProjectId) return <Page><EmptyState title="Select a project" /></Page>;

  return (
    <Page>
      <PageHeader title="Monitoring" description="Live from Neon's operations and endpoints APIs." />

      <div className="hairline rounded-lg bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-medium"><Activity className="size-4" /> Operations timeline</div>
        {ops.isLoading ? <div className="p-4"><Skeleton className="h-32" /></div>
          : ops.error ? <div className="p-4"><ErrorState error={ops.error} onRetry={() => ops.refetch()} /></div>
          : !ops.data?.operations?.length ? <div className="p-6"><EmptyState title="No operations" /></div>
          : (
            <ul className="divide-y divide-border max-h-[60vh] overflow-y-auto">
              {ops.data.operations.map((o: any) => (
                <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <StatusDot status={o.status} />
                  <div className="min-w-0 flex-1">
                    <div className="mono text-xs truncate">{o.action}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {o.status}{o.failures_count ? ` · failures ${o.failures_count}` : ""}{o.error ? ` · ${o.error}` : ""}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {o.updated_at ? formatDistanceToNow(new Date(o.updated_at), { addSuffix: true }) : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>

      <div className="hairline rounded-lg bg-card mt-4">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-medium"><Activity className="size-4" /> Endpoint activity</div>
        {endpoints.isLoading ? <div className="p-4"><Skeleton className="h-20" /></div>
          : endpoints.error ? <div className="p-4"><ErrorState error={endpoints.error} /></div>
          : !endpoints.data?.endpoints?.length ? <div className="p-6"><EmptyState title="No endpoints" /></div>
          : (
            <ul className="divide-y divide-border">
              {endpoints.data.endpoints.map((ep: any) => (
                <li key={ep.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <StatusDot status={ep.current_state} />
                  <div className="min-w-0 flex-1">
                    <div className="mono text-xs truncate">{ep.host}</div>
                    <div className="text-[11px] text-muted-foreground">{ep.type} · {ep.current_state}{ep.pending_state ? ` → ${ep.pending_state}` : ""}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>

      <div className="hairline rounded-lg p-6 mt-4 bg-card">
        <EmptyState icon={BarChart3} tone="info" title="Metric charts not exposed for this token"
          description="Neon does not expose per-endpoint time-series via this token. Use the Neon Console for in-depth metrics." />
      </div>
    </Page>
  );
}
