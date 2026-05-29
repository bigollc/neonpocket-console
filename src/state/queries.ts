import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { NeonService } from "@/lib/neon/service";
import { useApp } from "@/state/AppContext";
import type { NormalizedError } from "@/lib/errors";

function ctxOf(apiKey: string | null, mode: "direct" | "proxy") {
  if (!apiKey) throw new Error("No API key");
  return { apiKey, mode };
}

export function useProjectsQuery() {
  const { apiKey, settings } = useApp();
  return useQuery<{ projects: any[] }, NormalizedError>({
    queryKey: ["projects", settings.apiMode],
    enabled: !!apiKey,
    queryFn: ({ signal }) => NeonService.listProjects({ ...ctxOf(apiKey, settings.apiMode), signal }),
    retry: (count, err) => !!err?.retryable && count < 2,
  });
}

export function useBranchesQuery(projectId: string | null) {
  const { apiKey, settings } = useApp();
  return useQuery<{ branches: any[] }, NormalizedError>({
    queryKey: ["branches", projectId, settings.apiMode],
    enabled: !!apiKey && !!projectId,
    queryFn: ({ signal }) => NeonService.listBranches({ ...ctxOf(apiKey, settings.apiMode), signal }, projectId!),
  });
}

export function useDatabasesQuery(projectId: string | null, branchId: string | null) {
  const { apiKey, settings } = useApp();
  return useQuery<{ databases: any[] }, NormalizedError>({
    queryKey: ["databases", projectId, branchId, settings.apiMode],
    enabled: !!apiKey && !!projectId && !!branchId,
    queryFn: ({ signal }) => NeonService.listDatabases({ ...ctxOf(apiKey, settings.apiMode), signal }, projectId!, branchId!),
  });
}

export function useRolesQuery(projectId: string | null, branchId: string | null) {
  const { apiKey, settings } = useApp();
  return useQuery<{ roles: any[] }, NormalizedError>({
    queryKey: ["roles", projectId, branchId, settings.apiMode],
    enabled: !!apiKey && !!projectId && !!branchId,
    queryFn: ({ signal }) => NeonService.listRoles({ ...ctxOf(apiKey, settings.apiMode), signal }, projectId!, branchId!),
  });
}

export function useEndpointsQuery(projectId: string | null) {
  const { apiKey, settings } = useApp();
  return useQuery<{ endpoints: any[] }, NormalizedError>({
    queryKey: ["endpoints", projectId, settings.apiMode],
    enabled: !!apiKey && !!projectId,
    queryFn: ({ signal }) => NeonService.listEndpoints({ ...ctxOf(apiKey, settings.apiMode), signal }, projectId!),
  });
}

export function useOperationsQuery(projectId: string | null, opts?: { pollInterval?: number }) {
  const { apiKey, settings } = useApp();
  return useQuery<{ operations: any[] }, NormalizedError>({
    queryKey: ["operations", projectId, settings.apiMode],
    enabled: !!apiKey && !!projectId,
    queryFn: ({ signal }) => NeonService.listOperations({ ...ctxOf(apiKey, settings.apiMode), signal }, projectId!),
    refetchInterval: (q) => {
      const ops = (q.state.data as any)?.operations || [];
      const running = ops.some((o: any) => ["scheduling", "running"].includes(o.status));
      return running ? (opts?.pollInterval ?? 4000) : false;
    },
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
