import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { NeonService } from "@/lib/neon/service";
import { useApp } from "@/state/AppContext";
import type { NormalizedError } from "@/lib/errors";
import type { NeonOrganization, NeonUser } from "@/lib/neon/types";

export const DEFAULT_WORKSPACE_ID = "__default_workspace__";

export interface WorkspaceOption extends NeonOrganization {
  id: string;
  name: string;
  isDefault?: boolean;
}

function ctxOf(apiKey: string | null, mode: "direct" | "proxy") {
  if (!apiKey) throw new Error("No API key");
  return { apiKey, mode };
}

export function normalizeUser(payload: any): NeonUser | null {
  return payload?.user ?? payload ?? null;
}

export function userEmail(user: NeonUser | null | undefined) {
  return user?.email || user?.auth_accounts?.find(a => a.email)?.email || "";
}

export function workspaceName(org: any) {
  return org?.name || org?.display_name || org?.handle || org?.id || org?.org_id || "Organization";
}

export function workspaceId(org: any) {
  return org?.id || org?.org_id;
}

export function useCurrentUserQuery() {
  const { apiKey, settings } = useApp();
  return useQuery<any, NormalizedError>({
    queryKey: ["current-user", settings.apiMode],
    enabled: !!apiKey,
    queryFn: ({ signal }) => NeonService.getCurrentUser({ ...ctxOf(apiKey, settings.apiMode), signal }),
    retry: (count, err) => !!err?.retryable && count < 2,
  });
}

export function useOrganizationsQuery() {
  const { apiKey, settings } = useApp();
  return useQuery<{ organizations: WorkspaceOption[] }, NormalizedError>({
    queryKey: ["organizations", settings.apiMode],
    enabled: !!apiKey,
    queryFn: async ({ signal }) => {
      const data = await NeonService.listOrganizations({ ...ctxOf(apiKey, settings.apiMode), signal });
      const organizations = (data.organizations || [])
        .map((org: any) => ({ ...org, id: workspaceId(org), name: workspaceName(org) }))
        .filter((org: WorkspaceOption) => !!org.id);
      return { organizations };
    },
    retry: (count, err) => !!err?.retryable && count < 2,
  });
}

export function useProjectsQuery() {
  const { apiKey, settings, selectedOrganizationId } = useApp();
  const orgId = selectedOrganizationId === DEFAULT_WORKSPACE_ID ? null : selectedOrganizationId;
  return useQuery<{ projects: any[] }, NormalizedError>({
    queryKey: ["projects", selectedOrganizationId, settings.apiMode],
    enabled: !!apiKey && !!selectedOrganizationId,
    queryFn: ({ signal }) => NeonService.listProjects({ ...ctxOf(apiKey, settings.apiMode), signal }, orgId),
    retry: (count, err) => !!err?.retryable && count < 2,
  });
}

export function useBranchesQuery(projectId: string | null) {
  const { apiKey, settings, selectedOrganizationId } = useApp();
  return useQuery<{ branches: any[] }, NormalizedError>({
    queryKey: ["branches", selectedOrganizationId, projectId, settings.apiMode],
    enabled: !!apiKey && !!selectedOrganizationId && !!projectId,
    queryFn: ({ signal }) => NeonService.listBranches({ ...ctxOf(apiKey, settings.apiMode), signal }, projectId!),
  });
}

export function useDatabasesQuery(projectId: string | null, branchId: string | null) {
  const { apiKey, settings, selectedOrganizationId } = useApp();
  return useQuery<{ databases: any[] }, NormalizedError>({
    queryKey: ["databases", selectedOrganizationId, projectId, branchId, settings.apiMode],
    enabled: !!apiKey && !!selectedOrganizationId && !!projectId && !!branchId,
    queryFn: ({ signal }) => NeonService.listDatabases({ ...ctxOf(apiKey, settings.apiMode), signal }, projectId!, branchId!),
  });
}

export function useRolesQuery(projectId: string | null, branchId: string | null) {
  const { apiKey, settings, selectedOrganizationId } = useApp();
  return useQuery<{ roles: any[] }, NormalizedError>({
    queryKey: ["roles", selectedOrganizationId, projectId, branchId, settings.apiMode],
    enabled: !!apiKey && !!selectedOrganizationId && !!projectId && !!branchId,
    queryFn: ({ signal }) => NeonService.listRoles({ ...ctxOf(apiKey, settings.apiMode), signal }, projectId!, branchId!),
  });
}

export function useEndpointsQuery(projectId: string | null) {
  const { apiKey, settings, selectedOrganizationId } = useApp();
  return useQuery<{ endpoints: any[] }, NormalizedError>({
    queryKey: ["endpoints", selectedOrganizationId, projectId, settings.apiMode],
    enabled: !!apiKey && !!selectedOrganizationId && !!projectId,
    queryFn: ({ signal }) => NeonService.listEndpoints({ ...ctxOf(apiKey, settings.apiMode), signal }, projectId!),
  });
}

export function useOperationsQuery(projectId: string | null, opts?: { pollInterval?: number }) {
  const { apiKey, settings, selectedOrganizationId } = useApp();
  return useQuery<{ operations: any[] }, NormalizedError>({
    queryKey: ["operations", selectedOrganizationId, projectId, settings.apiMode],
    enabled: !!apiKey && !!selectedOrganizationId && !!projectId,
    queryFn: ({ signal }) => NeonService.listOperations({ ...ctxOf(apiKey, settings.apiMode), signal }, projectId!),
    refetchInterval: (q) => {
      const ops = (q.state.data as any)?.operations || [];
      const running = ops.some((o: any) => ["scheduling", "running"].includes(o.status));
      return running ? (opts?.pollInterval ?? 4000) : false;
    },
  });
}

export function useOrganizationMembersQuery(orgId: string | null) {
  const { apiKey, settings } = useApp();
  return useQuery<any, NormalizedError>({
    queryKey: ["organization-members", orgId, settings.apiMode],
    enabled: !!apiKey && !!orgId && orgId !== DEFAULT_WORKSPACE_ID,
    queryFn: ({ signal }) => NeonService.listOrganizationMembers({ ...ctxOf(apiKey, settings.apiMode), signal }, orgId!),
  });
}

export function useOrganizationApiKeysQuery(orgId: string | null) {
  const { apiKey, settings } = useApp();
  return useQuery<any, NormalizedError>({
    queryKey: ["organization-api-keys", orgId, settings.apiMode],
    enabled: !!apiKey && !!orgId && orgId !== DEFAULT_WORKSPACE_ID,
    queryFn: ({ signal }) => NeonService.listOrganizationApiKeys({ ...ctxOf(apiKey, settings.apiMode), signal }, orgId!),
  });
}

export function useGenericQuery<T>(key: any[], fn: (signal: AbortSignal) => Promise<T>, enabled = true, options?: Partial<UseQueryOptions<T, NormalizedError>>) {
  return useQuery<T, NormalizedError>({
    queryKey: key,
    enabled,
    queryFn: ({ signal }) => fn(signal),
    ...options,
  });
}
