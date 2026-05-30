import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp } from "@/state/AppContext";
import {
  normalizeUser,
  useCurrentUserQuery,
  useOrganizationApiKeysQuery,
  useOrganizationMembersQuery,
  useOrganizationsQuery,
  useProjectsQuery,
  userEmail,
} from "@/state/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, FolderGit2, KeyRound, Users } from "lucide-react";

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="hairline rounded-lg bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium"><Icon className="size-4" /> {title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function arr(payload: any, keys: string[]) {
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload)) return payload;
  return [];
}

export default function Organizations() {
  const { selectedOrganizationId, setSelectedOrganizationId, setSelectedProjectId } = useApp();
  const currentUser = useCurrentUserQuery();
  const orgs = useOrganizationsQuery();
  const projects = useProjectsQuery();
  const members = useOrganizationMembersQuery(selectedOrganizationId);
  const apiKeys = useOrganizationApiKeysQuery(selectedOrganizationId);
  const user = normalizeUser(currentUser.data);
  const selectedOrg = orgs.data?.organizations?.find((org: any) => org.id === selectedOrganizationId);

  return (
    <Page>
      <PageHeader title="Organizations" description="Choose an organization, then choose a project to unlock project and branch actions." />

      <div className="grid md:grid-cols-3 gap-3">
        <div className="hairline rounded-lg bg-card p-4 md:col-span-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Signed in as</div>
          <div className="mt-1 text-sm font-medium truncate">{user?.name || userEmail(user) || (currentUser.error ? "API key connected" : "Neon user")}</div>
          {userEmail(user) && <div className="mt-0.5 text-xs text-muted-foreground truncate">{userEmail(user)}</div>}
          {user?.id && <div className="mt-2 text-[11px] mono text-muted-foreground break-all">{user.id}</div>}
          {currentUser.error && <div className="mt-2 text-[11px] text-muted-foreground break-words">User profile is not available for this API key, but organization access can still work.</div>}
        </div>
        <div className="hairline rounded-lg bg-card p-4 md:col-span-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Selected organization</div>
          <div className="mt-1 text-sm font-medium">{selectedOrg?.name || "None selected"}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{selectedOrg ? selectedOrg.id : "Select an organization below to load its projects."}</div>
        </div>
      </div>

      <div className="mt-4 grid lg:grid-cols-2 gap-4">
        <Panel title="Organizations" icon={Building2}>
          {orgs.isLoading ? <Skeleton className="h-24" /> : orgs.error ? <ErrorState error={orgs.error} onRetry={() => orgs.refetch()} /> : (
            <div className="space-y-2">
              {orgs.data?.unavailable && (
                <div className="rounded-md border border-border p-3">
                  <div className="text-sm font-medium">Organization list unavailable</div>
                  <div className="mt-1 text-xs text-muted-foreground break-words">This API key may be scoped too narrowly to enumerate organizations.</div>
                </div>
              )}
              {(orgs.data?.organizations || []).map((org: any) => (
                <button key={org.id} onClick={() => setSelectedOrganizationId(org.id)} className={`w-full rounded-md border p-3 text-left transition-colors ${selectedOrganizationId === org.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"}`}>
                  <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="size-4" /> {org.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground mono truncate">{org.id}</div>
                  {org.role && <Badge variant="outline" className="mt-2">{org.role}</Badge>}
                </button>
              ))}
              {!orgs.data?.organizations?.length && !orgs.data?.unavailable && <EmptyState icon={Building2} title="No organizations returned" description="Connect a personal Neon API key that can list organizations." />}
            </div>
          )}
        </Panel>

        <Panel title="Projects in selected organization" icon={FolderGit2}>
          {!selectedOrganizationId ? <EmptyState icon={Building2} title="Select an organization first" description="Projects and branch-level tools stay hidden until an organization is selected." />
            : projects.isLoading ? <Skeleton className="h-24" />
            : projects.error ? <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
            : !projects.data?.projects?.length ? <EmptyState icon={FolderGit2} title="No projects" description="No projects were returned for this organization and API key." />
            : <div className="space-y-2">
              {projects.data.projects.map((project: any) => (
                <button key={project.id} onClick={() => setSelectedProjectId(project.id)} className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-accent/40">
                  <div className="flex items-center gap-2 text-sm font-medium"><FolderGit2 className="size-4" /> {project.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground mono truncate">{project.id}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{project.region_id} · PostgreSQL {project.pg_version ?? "—"}</div>
                </button>
              ))}
            </div>}
        </Panel>
      </div>

      {selectedOrganizationId && (
        <div className="mt-4 grid lg:grid-cols-2 gap-4">
          <Panel title="Members" icon={Users}>
            {members.isLoading ? <Skeleton className="h-24" /> : members.error ? <ErrorState error={members.error} onRetry={() => members.refetch()} /> : (
              <div className="space-y-2">
                {arr(members.data, ["members", "organization_members", "items"]).slice(0, 20).map((member: any, idx: number) => (
                  <div key={member.id || member.email || idx} className="rounded-md border border-border p-3">
                    <div className="text-sm font-medium truncate">{member.email || member.user?.email || member.member?.email || member.name || "Member"}</div>
                    <div className="text-xs text-muted-foreground">{member.role || member.org_role || member.member?.role || "member"}</div>
                  </div>
                ))}
                {!arr(members.data, ["members", "organization_members", "items"]).length && <EmptyState icon={Users} title="No members returned" />}
              </div>
            )}
          </Panel>
          <Panel title="Organization API keys" icon={KeyRound}>
            {apiKeys.isLoading ? <Skeleton className="h-24" /> : apiKeys.error ? <ErrorState error={apiKeys.error} onRetry={() => apiKeys.refetch()} /> : (
              <div className="space-y-2">
                {arr(apiKeys.data, ["api_keys", "keys"]).slice(0, 20).map((key: any) => (
                  <div key={key.id} className="rounded-md border border-border p-3">
                    <div className="text-sm font-medium truncate">{key.name || key.id}</div>
                    <div className="text-xs text-muted-foreground">Created {key.created_at || "—"}{key.last_used_at ? ` · Last used ${key.last_used_at}` : ""}</div>
                  </div>
                ))}
                {!arr(apiKeys.data, ["api_keys", "keys"]).length && <EmptyState icon={KeyRound} title="No API keys returned" description="The API only returns metadata, never secret key tokens." />}
              </div>
            )}
          </Panel>
        </div>
      )}
    </Page>
  );
}
