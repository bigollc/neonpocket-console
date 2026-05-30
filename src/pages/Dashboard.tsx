import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Activity, BarChart3, Building2, Cable, Database, FolderGit2, GitBranch, Network, Plus, Server, TerminalSquare } from "lucide-react";
import { Page, PageHeader } from "@/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { NeonService } from "@/lib/neon/service";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/AppContext";
import { DEFAULT_WORKSPACE_ID, useOrganizationsQuery, useProjectsQuery, useConsumptionHistoryQuery } from "@/state/queries";

function Stat({ label, value, hint, icon: Icon, muted = false, restricted = false }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: any; muted?: boolean; restricted?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden hairline rounded-lg p-4 bg-card transition-opacity",
        muted && "opacity-55",
        restricted && "border-destructive/30",
      )}
      style={restricted ? {
        backgroundImage: "repeating-linear-gradient(135deg, rgba(239, 68, 68, 0.13) 0, rgba(239, 68, 68, 0.13) 1px, transparent 1px, transparent 10px)",
      } : undefined}
    >
      {restricted && <div className="pointer-events-none absolute inset-0 bg-card/35" />}
      <div className="relative flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <div className="relative text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {hint && <div className="relative text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function bytesToGb(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0";
  const gb = bytes / 1024 ** 3;
  return gb < 10 ? gb.toFixed(2) : gb.toFixed(1);
}

function cuSecondsToHours(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0";
  const hours = seconds / 3600;
  return hours < 10 ? hours.toFixed(2) : hours.toFixed(1);
}

function metricTotal(payload: any, names: string[]) {
  const wanted = new Set(names);
  let total = 0;

  function visit(value: any, parentKey?: string) {
    if (typeof value === "number" && parentKey && wanted.has(parentKey)) {
      total += value;
      return;
    }
    if (!value || typeof value !== "object") return;
    if (typeof value.value === "number" && typeof value.metric === "string" && wanted.has(value.metric)) total += value.value;
    if (typeof value.value === "number" && typeof value.name === "string" && wanted.has(value.name)) total += value.value;
    for (const [key, child] of Object.entries(value)) visit(child, key);
  }

  visit(payload);
  return total;
}

function newestTimestamp(item: any) {
  return item?.updated_at || item?.created_at || item?.completed_at || item?.started_at || "";
}

function usageRestrictionHint(error: any) {
  if (!error) return "Select a workspace to load usage.";
  if ([401, 403].includes(error?.status)) return "Not available for this plan or API key scope.";
  if (error?.status === 404) return "Consumption history is not exposed for this account.";
  return error?.message || "Usage metrics are unavailable.";
}

export default function Dashboard() {
  const { apiKey, settings, selectedOrganizationId, setSelectedOrganizationId, setSelectedProjectId, playUiSound } = useApp();
  const organizations = useOrganizationsQuery();
  const projects = useProjectsQuery();
  const projectList = projects.data?.projects || [];
  const hasWorkspaceSelection = !!selectedOrganizationId;
  const projectIds = hasWorkspaceSelection ? projectList.map((project: any) => project.id).filter(Boolean).slice(0, 100) : [];
  const explicitOrgId = selectedOrganizationId && selectedOrganizationId !== DEFAULT_WORKSPACE_ID ? selectedOrganizationId : undefined;
  const consumption = useConsumptionHistoryQuery({ projectIds, orgId: explicitOrgId });
  const metricsRestricted = !!consumption.error;
  const metricsMuted = !hasWorkspaceSelection || consumption.isLoading || metricsRestricted;
  const metricHint = metricsRestricted ? usageRestrictionHint(consumption.error) : "current month";

  const workspaces = useMemo(() => [
    { id: DEFAULT_WORKSPACE_ID, name: "Default workspace", isDefault: true, description: "Projects visible without an explicit organization filter." },
    ...(organizations.data?.organizations || []).map((org: any) => ({ ...org, description: org.plan ? `Plan: ${org.plan}` : org.handle || org.id })),
  ], [organizations.data?.organizations]);

  const branchQueries = useQueries({
    queries: projectIds.slice(0, 25).map(projectId => ({
      queryKey: ["platform-branches", projectId, settings.apiMode],
      enabled: !!apiKey && hasWorkspaceSelection,
      queryFn: ({ signal }: { signal: AbortSignal }) => NeonService.listBranches({ apiKey: apiKey!, mode: settings.apiMode, signal }, projectId),
      staleTime: 30_000,
    })),
  });

  const operationQueries = useQueries({
    queries: projectIds.slice(0, 25).map(projectId => ({
      queryKey: ["platform-operations", projectId, settings.apiMode],
      enabled: !!apiKey && hasWorkspaceSelection,
      queryFn: ({ signal }: { signal: AbortSignal }) => NeonService.listOperations({ apiKey: apiKey!, mode: settings.apiMode, signal }, projectId, 10),
      staleTime: 30_000,
    })),
  });

  const allBranches = useMemo(() => branchQueries.flatMap((query, index) => {
    const project = projectList[index];
    return (query.data as any)?.branches?.map((branch: any) => ({ ...branch, project_name: project?.name, project_id: project?.id })) || [];
  }), [branchQueries, projectList]);

  const allOperations = useMemo(() => operationQueries.flatMap((query, index) => {
    const project = projectList[index];
    return (query.data as any)?.operations?.map((operation: any) => ({ ...operation, project_name: project?.name, project_id: project?.id })) || [];
  }).sort((a, b) => new Date(newestTimestamp(b)).getTime() - new Date(newestTimestamp(a)).getTime()), [operationQueries, projectList]);

  const recentBranches = useMemo(() => [...allBranches].sort((a, b) => new Date(newestTimestamp(b)).getTime() - new Date(newestTimestamp(a)).getTime()).slice(0, 8), [allBranches]);
  const activeEndpoints = useMemo(() => projectList.reduce((sum: number, project: any) => sum + (project?.compute_last_active_at || project?.active_time_seconds ? 1 : 0), 0), [projectList]);

  const usagePayload = consumption.data;
  const computeCuHours = cuSecondsToHours(metricTotal(usagePayload, ["compute_unit_seconds"]));
  const storageGb = bytesToGb(metricTotal(usagePayload, ["root_branch_bytes_month", "child_branch_bytes_month", "snapshot_storage_bytes_month"]));
  const historyGb = bytesToGb(metricTotal(usagePayload, ["instant_restore_bytes_month"]));
  const transferGb = bytesToGb(metricTotal(usagePayload, ["public_network_transfer_bytes", "private_network_transfer_bytes"]));
  const loadingBranches = branchQueries.some(query => query.isLoading);
  const loadingOperations = operationQueries.some(query => query.isLoading);

  return (
    <Page>
      <PageHeader title="Dashboard" description="Platform overview across your Neon projects, usage, branches, and recent activity." />

      {!hasWorkspaceSelection && (
        <div className="mb-5 hairline rounded-xl bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Choose a workspace first</div>
              <div className="mt-1 text-xs text-muted-foreground">No organization is selected yet. Select an organization or the default workspace before loading project-scoped dashboard data.</div>
            </div>
            <Building2 className="size-5 text-muted-foreground shrink-0" />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {organizations.isLoading ? (
              <>
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </>
            ) : (
              workspaces.map((workspace: any) => (
                <button key={workspace.id} onClick={() => { setSelectedOrganizationId(workspace.id); playUiSound("nav"); }} className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/40">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="size-4" />
                    <span className="truncate">{workspace.name}</span>
                    {workspace.isDefault && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">default</span>}
                    {workspace.role && <span className="ml-auto rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{workspace.role}</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground truncate">{workspace.description || workspace.id}</div>
                  <div className="mt-1 text-[10px] mono text-muted-foreground truncate">{workspace.id}</div>
                </button>
              ))
            )}
            {organizations.data?.unavailable && (
              <div className="rounded-lg border border-border p-3 text-left md:col-span-2">
                <div className="text-sm font-medium">Organization list unavailable</div>
                <div className="mt-1 text-xs text-muted-foreground">This key may be organization-scoped or project-scoped. Use the default workspace to load accessible projects.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {projects.isLoading && hasWorkspaceSelection ? <Skeleton className="h-32 w-full" /> : projects.error && hasWorkspaceSelection ? <ErrorState error={projects.error} onRetry={() => projects.refetch()} /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Compute" value={!hasWorkspaceSelection ? "—" : consumption.isLoading ? "…" : metricsRestricted ? "—" : computeCuHours} hint={metricsRestricted || !hasWorkspaceSelection ? usageRestrictionHint(consumption.error) : "CU-hrs"} icon={Server} muted={metricsMuted} restricted={metricsRestricted} />
            <Stat label="Storage" value={!hasWorkspaceSelection ? "—" : consumption.isLoading ? "…" : metricsRestricted ? "—" : storageGb} hint={metricsRestricted || !hasWorkspaceSelection ? usageRestrictionHint(consumption.error) : "GB"} icon={Database} muted={metricsMuted} restricted={metricsRestricted} />
            <Stat label="History" value={!hasWorkspaceSelection ? "—" : consumption.isLoading ? "…" : metricsRestricted ? "—" : historyGb} hint={metricsRestricted || !hasWorkspaceSelection ? usageRestrictionHint(consumption.error) : "GB"} icon={BarChart3} muted={metricsMuted} restricted={metricsRestricted} />
            <Stat label="Network transfer" value={!hasWorkspaceSelection ? "—" : consumption.isLoading ? "…" : metricsRestricted ? "—" : transferGb} hint={metricsRestricted || !hasWorkspaceSelection ? usageRestrictionHint(consumption.error) : "GB"} icon={Network} muted={metricsMuted} restricted={metricsRestricted} />
            <Stat label="Projects" value={hasWorkspaceSelection ? projectList.length : "—"} icon={FolderGit2} muted={!hasWorkspaceSelection} />
            <Stat label="Branches" value={!hasWorkspaceSelection ? "—" : loadingBranches ? "…" : allBranches.length} hint={projectIds.length > 25 ? "first 25 projects" : undefined} icon={GitBranch} muted={!hasWorkspaceSelection} />
            <Stat label="Recent activity" value={!hasWorkspaceSelection ? "—" : loadingOperations ? "…" : allOperations.length} hint="operations as API activity" icon={Activity} muted={!hasWorkspaceSelection} />
            <Stat label="Active projects" value={!hasWorkspaceSelection ? "—" : activeEndpoints || "—"} hint="reported by project metadata" icon={Cable} muted={!hasWorkspaceSelection} />
          </div>

          {consumption.error && hasWorkspaceSelection && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
              Usage metrics are blocked by this account plan, API key scope, or Neon consumption history permissions. Project, branch, and activity data remain available below.
            </div>
          )}

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="hairline rounded-lg bg-card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 text-sm font-medium"><FolderGit2 className="size-4" /> Projects</div>
                <Button asChild size="sm" variant="outline" disabled={!hasWorkspaceSelection}><Link to="/project/dashboard"><Plus className="size-4 mr-2" />Project dashboard</Link></Button>
              </div>
              {!hasWorkspaceSelection ? <div className="p-6"><EmptyState title="Select a workspace" description="Project lists stay locked until an organization or the default workspace is selected above." /></div>
                : !projectList.length ? <div className="p-6"><EmptyState title="No projects" description="No projects are available for this workspace or API key." /></div>
                : (
                  <ul className="divide-y divide-border">
                    {projectList.slice(0, 8).map((project: any) => (
                      <li key={project.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{project.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate mono">{project.id}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{project.region_id} · PostgreSQL {project.pg_version ?? "—"}</div>
                        </div>
                        <Button asChild variant="ghost" size="sm" onClick={() => { setSelectedProjectId(project.id); playUiSound("nav"); }}>
                          <Link to="/project/dashboard">Open</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>

            <div className="hairline rounded-lg bg-card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 text-sm font-medium"><Activity className="size-4" /> Recent commits / activity</div>
              </div>
              {!hasWorkspaceSelection ? <div className="p-6"><EmptyState title="No workspace selected" description="Recent Neon operations appear after a workspace is selected." /></div>
                : loadingOperations ? <div className="p-4"><Skeleton className="h-20 w-full" /></div>
                : !allOperations.length ? <div className="p-6"><EmptyState title="No recent activity" description="Neon exposes project operations here; commit-style activity appears when returned by the API." /></div>
                : (
                  <ul className="divide-y divide-border">
                    {allOperations.slice(0, 8).map((op: any) => (
                      <li key={`${op.project_id}-${op.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <StatusDot status={op.status} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate"><span className="mono text-xs">{op.action}</span></div>
                          <div className="text-[11px] text-muted-foreground truncate">{op.project_name || op.project_id} · {op.status}</div>
                        </div>
                        <div className="text-[11px] text-muted-foreground shrink-0">
                          {newestTimestamp(op) ? formatDistanceToNow(new Date(newestTimestamp(op)), { addSuffix: true }) : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
            </div>

            <div className="hairline rounded-lg bg-card md:col-span-2">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 text-sm font-medium"><GitBranch className="size-4" /> Latest branches</div>
                <Button asChild size="sm" variant="outline" disabled={!hasWorkspaceSelection}><Link to="/branches"><TerminalSquare className="size-4 mr-2" />Manage branches</Link></Button>
              </div>
              {!hasWorkspaceSelection ? <div className="p-6"><EmptyState title="No workspace selected" description="Branches appear after a workspace and project context is available." /></div>
                : loadingBranches ? <div className="p-4"><Skeleton className="h-20 w-full" /></div>
                : !recentBranches.length ? <div className="p-6"><EmptyState title="No branches" description="Branches will appear here after project branch data is available." /></div>
                : (
                  <ul className="divide-y divide-border">
                    {recentBranches.map((branch: any) => (
                      <li key={`${branch.project_id}-${branch.id}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{branch.name}{branch.default ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">default</span> : null}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{branch.project_name || branch.project_id}</div>
                        </div>
                        <div className="text-[11px] text-muted-foreground mono truncate">{branch.id}</div>
                        <div className="text-[11px] text-muted-foreground md:text-right">
                          {newestTimestamp(branch) ? formatDistanceToNow(new Date(newestTimestamp(branch)), { addSuffix: true }) : "—"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
