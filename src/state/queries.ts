import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { NeonService } from "@/lib/neon/service";
import type { ApiMode } from "@/lib/neon/client";
import { useApp } from "@/state/AppContext";
import type { NormalizedError } from "@/lib/errors";
import type { NeonOrganization, NeonUser } from "@/lib/neon/types";

export const DEFAULT_WORKSPACE_ID = "__default_workspace__";

export interface WorkspaceOption extends NeonOrganization {
  id: string;
  name: string;
  isDefault?: boolean;
}

function ctxOf(apiKey: string | null, mode: ApiMode) {
  if (!apiKey) throw new Error("No API key");
  return { apiKey, mode };
}

export function normalizeUser(payload: any): NeonUser | null {
  return payload?.user ?? payload ?? null;
}

export function normalizeOrganization(payload: any): NeonOrganization | null {
  return payload?.organization ?? payload ?? null;
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
  return useQuery<{ organizations: WorkspaceOption[]; unavailable?: NormalizedError }, NormalizedError>({
    queryKey: ["organizations", settings.apiMode],
    enabled: !!apiKey,
    queryFn: async ({ signal }) => {
      try {
        const data = await NeonService.listOrganizations({ ...ctxOf(apiKey, settings.apiMode), signal });
        const organizations = (data.organizations || [])
          .map((org: any) => ({ ...org, id: workspaceId(org), name: workspaceName(org) }))
          .filter((org: WorkspaceOption) => !!org.id);
        return { organizations };
      } catch (error: any) {
        // Organization-scoped and project-scoped keys can authenticate and list
        // projects while not being allowed to enumerate the user's orgs. Keep the
        // workspace flow usable via the default, unfiltered projects workspace.
        if ([0, 401, 403, 404].includes(error?.status)) return { organizations: [], unavailable: error };
        throw error;
      }
    },
    retry: (count, err) => !!err?.retryable && count < 2,
  });
}

export function useOrganizationQuery(orgId: string | null | undefined) {
  const { apiKey, settings } = useApp();
  return useQuery<any, NormalizedError>({
    queryKey: ["organization", orgId || "none", settings.apiMode],
    enabled: !!apiKey && !!orgId && orgId !== DEFAULT_WORKSPACE_ID,
    queryFn: ({ signal }) => NeonService.getOrganization({ ...ctxOf(apiKey, settings.apiMode), signal }, orgId!),
    retry: (count, err) => !!err?.retryable && count < 2,
  });
}

export function useProjectsQuery() {
  const { apiKey, settings, selectedOrganizationId } = useApp();
  const hasExplicitOrganization = !!selectedOrganizationId && selectedOrganizationId !== DEFAULT_WORKSPACE_ID;
  const orgId = hasExplicitOrganization ? selectedOrganizationId : null;
  const workspaceKey = selectedOrganizationId || DEFAULT_WORKSPACE_ID;

  return useQuery<{ projects: any[] }, NormalizedError>({
    queryKey: ["projects", workspaceKey, settings.apiMode],
    enabled: !!apiKey,
    queryFn: async ({ signal }) => {
      const ctx = { ...ctxOf(apiKey, settings.apiMode), signal };
      try {
        return await NeonService.listProjects(ctx, orgId);
      } catch (error: any) {
        if (orgId && [0, 400, 401, 403, 404, 422].includes(error?.status)) {
          return NeonService.listProjects(ctx, null);
        }
        throw error;
      }
    },
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

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
}

export function useConsumptionHistoryQuery({ projectIds, orgId }: { projectIds?: string[]; orgId?: string }) {
  const { apiKey, settings } = useApp();
  const ids = (projectIds || []).filter(Boolean).slice(0, 100);
  const metrics = [
    "compute_unit_seconds",
    "root_branch_bytes_month",
    "child_branch_bytes_month",
    "instant_restore_bytes_month",
    "public_network_transfer_bytes",
    "private_network_transfer_bytes",
    "snapshot_storage_bytes_month",
  ].join(",");

  return useQuery<any, NormalizedError>({
    queryKey: ["consumption-history-v2", orgId || "default", ids.join(","), settings.apiMode],
    enabled: !!apiKey && (!!orgId || ids.length > 0),
    queryFn: ({ signal }) => NeonService.consumptionHistoryProjectsV2({ ...ctxOf(apiKey, settings.apiMode), signal }, {
      org_id: orgId,
      project_ids: ids.length ? ids.join(",") : undefined,
      from: monthStartIso(),
      to: new Date().toISOString(),
      granularity: "monthly",
      metrics,
      limit: 100,
    }),
    retry: false,
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
