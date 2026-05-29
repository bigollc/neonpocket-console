import { Link } from "react-router-dom";
import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp } from "@/state/AppContext";
import { useProjectsQuery, useBranchesQuery, useDatabasesQuery, useRolesQuery, useEndpointsQuery, useOperationsQuery, useOrganizationsQuery, DEFAULT_WORKSPACE_ID } from "@/state/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { Activity, Building2, Cable, Database, FolderGit2, GitBranch, KeyRound, Plus, TerminalSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="hairline rounded-lg p-4 bg-card">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { selectedOrganizationId, setSelectedOrganizationId, selectedProjectId, selectedBranchId } = useApp();
  const orgs = useOrganizationsQuery();
  const projects = useProjectsQuery();
  const branches = useBranchesQuery(selectedProjectId);
  const databases = useDatabasesQuery(selectedProjectId, selectedBranchId);
  const roles = useRolesQuery(selectedProjectId, selectedBranchId);
  const endpoints = useEndpointsQuery(selectedProjectId);
  const operations = useOperationsQuery(selectedProjectId);

  const proj = projects.data?.projects?.find((p: any) => p.id === selectedProjectId);

  if (!selectedOrganizationId) {
    return (
      <Page>
        <PageHeader title="Dashboard" description="Choose an organization first, then select one of its projects." />
        {orgs.isLoading ? <Skeleton className="h-32 w-full" /> : orgs.error ? <ErrorState error={orgs.error} onRetry={() => orgs.refetch()} /> : (
          <div className="grid md:grid-cols-2 gap-3">
            <button onClick={() => setSelectedOrganizationId(DEFAULT_WORKSPACE_ID)} className="hairline rounded-lg bg-card p-4 text-left hover:bg-accent/40 transition-colors">
              <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="size-4" /> Default workspace</div>
              <div className="mt-1 text-xs text-muted-foreground">List projects available without an explicit organization filter.</div>
            </button>
            {(orgs.data?.organizations || []).map((org: any) => (
              <button key={org.id} onClick={() => setSelectedOrganizationId(org.id)} className="hairline rounded-lg bg-card p-4 text-left hover:bg-accent/40 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="size-4" /> {org.name}</div>
                <div className="mt-1 text-xs text-muted-foreground mono truncate">{org.id}</div>
                {org.role && <div className="mt-2 inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{org.role}</div>}
              </button>
            ))}
          </div>
        )}
      </Page>
    );
  }

  if (projects.isLoading) return <Page><Skeleton className="h-32 w-full" /></Page>;
  if (projects.error) return <Page><ErrorState error={projects.error} onRetry={() => projects.refetch()} /></Page>;
  if (!projects.data?.projects?.length) {
    return (
      <Page>
        <PageHeader title="Dashboard" description="No projects are available in the selected organization." />
        <EmptyState icon={FolderGit2} title="No projects in this workspace" description="Choose another organization or create a Neon project in the selected workspace." />
      </Page>
    );
  }
  if (!selectedProjectId || !proj) {
    return (
      <Page>
        <PageHeader title="Dashboard" description="Select a project from the top bar to unlock project and branch tools." />
        <div className="grid md:grid-cols-2 gap-3">
          {projects.data.projects.map((project: any) => (
            <div key={project.id} className="hairline rounded-lg bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><FolderGit2 className="size-4" /> {project.name}</div>
              <div className="mt-1 text-xs text-muted-foreground mono truncate">{project.id}</div>
              <div className="mt-2 text-xs text-muted-foreground">{project.region_id} · PostgreSQL {project.pg_version ?? "—"}</div>
            </div>
          ))}
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Dashboard" description={proj?.name ? `${proj.name}` : "Select a project"} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Projects" value={projects.data?.projects?.length ?? "—"} />
        <Stat label="Region" value={<span className="mono text-base">{proj?.region_id ?? "—"}</span>} />
        <Stat label="Postgres" value={proj?.pg_version ?? "—"} />
        <Stat label="Branches" value={branches.data?.branches?.length ?? (branches.isLoading ? "…" : "—")} />
        <Stat label="Databases" value={databases.data?.databases?.length ?? (databases.isLoading ? "…" : "—")} hint="in current branch" />
        <Stat label="Roles" value={roles.data?.roles?.length ?? (roles.isLoading ? "…" : "—")} hint="in current branch" />
        <Stat label="Endpoints" value={endpoints.data?.endpoints?.length ?? (endpoints.isLoading ? "…" : "—")} />
        <Stat label="Recent ops" value={operations.data?.operations?.length ?? (operations.isLoading ? "…" : "—")} />
      </div>

      <div className="mt-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Quick actions</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { to: "/branches", icon: GitBranch, label: "Create branch" },
            { to: "/branch/overview", icon: Database, label: "Create database" },
            { to: "/branch/overview", icon: KeyRound, label: "Create role" },
            { to: "/branch/sql", icon: TerminalSquare, label: "Open SQL editor" },
            { to: "/backend/data-api", icon: Cable, label: "Open Data API" },
            { to: "/integrations", icon: Plus, label: "Integrations" },
          ].map(a => (
            <Button asChild key={a.label} variant="outline" className="justify-start h-11">
              <Link to={a.to}><a.icon className="size-4 mr-2" />{a.label}</Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="hairline rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-medium"><Activity className="size-4" /> Recent operations</div>
          </div>
          {operations.isLoading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div>
            : operations.error ? <div className="p-4"><ErrorState error={operations.error} onRetry={() => operations.refetch()} /></div>
            : !operations.data?.operations?.length ? <div className="p-6"><EmptyState title="No recent operations" description="Once you act on the project, operations will appear here." /></div>
            : (
              <ul className="divide-y divide-border">
                {operations.data.operations.slice(0, 8).map((op: any) => (
                  <li key={op.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <StatusDot status={op.status} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate"><span className="mono text-xs">{op.action}</span></div>
                      <div className="text-[11px] text-muted-foreground truncate">{op.status}{op.error ? ` · ${op.error}` : ""}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0">
                      {op.updated_at ? formatDistanceToNow(new Date(op.updated_at), { addSuffix: true }) : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>

        <div className="hairline rounded-lg bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-medium"><Cable className="size-4" /> Endpoints</div>
          </div>
          {endpoints.isLoading ? <div className="p-4"><Skeleton className="h-20 w-full" /></div>
            : endpoints.error ? <div className="p-4"><ErrorState error={endpoints.error} onRetry={() => endpoints.refetch()} /></div>
            : !endpoints.data?.endpoints?.length ? <div className="p-6"><EmptyState title="No endpoints" description="Endpoints provide connection URLs for your branches." /></div>
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
      </div>
    </Page>
  );
}
