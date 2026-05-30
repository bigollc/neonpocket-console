import { callNeon, type ApiMode } from "./client";
import { neonPathSegment as seg } from "./path";
import type {
  NeonProject, NeonBranch, NeonDatabase, NeonRole, NeonEndpoint, NeonOperation,
  NeonOrganization, NeonUser, NeonApiKey, NeonConsumption, NeonDataApi,
} from "./types";

interface Ctx { apiKey: string; mode: ApiMode; signal?: AbortSignal }

export const NeonService = {
  // Account / organizations
  getCurrentUser: (c: Ctx) =>
    callNeon<{ user: NeonUser } | NeonUser>("/users/me", { ...c }),
  listOrganizations: (c: Ctx) =>
    callNeon<{ organizations: NeonOrganization[] }>("/users/me/organizations", { ...c }),
  getOrganization: (c: Ctx, orgId: string) =>
    callNeon<{ organization: NeonOrganization }>(`/organizations/${seg(orgId)}`, { ...c }),
  listOrganizationMembers: (c: Ctx, orgId: string) =>
    callNeon<any>(`/organizations/${seg(orgId)}/members`, { ...c, query: { limit: 100 } }),
  listOrganizationApiKeys: (c: Ctx, orgId: string) =>
    callNeon<{ api_keys: NeonApiKey[] } | { keys: NeonApiKey[] }>(`/organizations/${seg(orgId)}/api_keys`, { ...c }),

  // Projects
  listProjects: (c: Ctx, orgId?: string | null) =>
    callNeon<{ projects: NeonProject[] }>("/projects", { ...c, query: { limit: 400, org_id: orgId || undefined } }),
  getProject: (c: Ctx, projectId: string) =>
    callNeon<{ project: NeonProject }>(`/projects/${seg(projectId)}`, { ...c }),
  createProject: (c: Ctx, project: Partial<NeonProject>) =>
    callNeon<{ project: NeonProject }>(`/projects`, { ...c, method: "POST", body: { project } }),
  updateProject: (c: Ctx, projectId: string, project: Partial<NeonProject>) =>
    callNeon<{ project: NeonProject }>(`/projects/${seg(projectId)}`, { ...c, method: "PATCH", body: { project } }),
  deleteProject: (c: Ctx, projectId: string) =>
    callNeon<{ project: NeonProject }>(`/projects/${seg(projectId)}`, { ...c, method: "DELETE" }),

  // Branches
  listBranches: (c: Ctx, projectId: string) =>
    callNeon<{ branches: NeonBranch[] }>(`/projects/${seg(projectId)}/branches`, { ...c }),
  getBranch: (c: Ctx, projectId: string, branchId: string) =>
    callNeon<{ branch: NeonBranch }>(`/projects/${seg(projectId)}/branches/${seg(branchId)}`, { ...c }),
  createBranch: (c: Ctx, projectId: string, body: any) =>
    callNeon<any>(`/projects/${seg(projectId)}/branches`, { ...c, method: "POST", body }),
  deleteBranch: (c: Ctx, projectId: string, branchId: string) =>
    callNeon<any>(`/projects/${seg(projectId)}/branches/${seg(branchId)}`, { ...c, method: "DELETE" }),

  // Databases
  listDatabases: (c: Ctx, projectId: string, branchId: string) =>
    callNeon<{ databases: NeonDatabase[] }>(`/projects/${seg(projectId)}/branches/${seg(branchId)}/databases`, { ...c }),
  createDatabase: (c: Ctx, projectId: string, branchId: string, database: { name: string; owner_name: string }) =>
    callNeon<{ database: NeonDatabase }>(`/projects/${seg(projectId)}/branches/${seg(branchId)}/databases`, { ...c, method: "POST", body: { database } }),

  // Roles
  listRoles: (c: Ctx, projectId: string, branchId: string) =>
    callNeon<{ roles: NeonRole[] }>(`/projects/${seg(projectId)}/branches/${seg(branchId)}/roles`, { ...c }),
  createRole: (c: Ctx, projectId: string, branchId: string, name: string) =>
    callNeon<{ role: NeonRole }>(`/projects/${seg(projectId)}/branches/${seg(branchId)}/roles`, { ...c, method: "POST", body: { role: { name } } }),
  getRole: (c: Ctx, projectId: string, branchId: string, roleName: string) =>
    callNeon<{ role: NeonRole }>(`/projects/${seg(projectId)}/branches/${seg(branchId)}/roles/${seg(roleName)}`, { ...c }),

  // Endpoints
  listEndpoints: (c: Ctx, projectId: string) =>
    callNeon<{ endpoints: NeonEndpoint[] }>(`/projects/${seg(projectId)}/endpoints`, { ...c }),
  startEndpoint: (c: Ctx, projectId: string, endpointId: string) =>
    callNeon<any>(`/projects/${seg(projectId)}/endpoints/${seg(endpointId)}/start`, { ...c, method: "POST" }),
  suspendEndpoint: (c: Ctx, projectId: string, endpointId: string) =>
    callNeon<any>(`/projects/${seg(projectId)}/endpoints/${seg(endpointId)}/suspend`, { ...c, method: "POST" }),
  restartEndpoint: (c: Ctx, projectId: string, endpointId: string) =>
    callNeon<any>(`/projects/${seg(projectId)}/endpoints/${seg(endpointId)}/restart`, { ...c, method: "POST" }),

  // Operations
  listOperations: (c: Ctx, projectId: string, limit = 50) =>
    callNeon<{ operations: NeonOperation[] }>(`/projects/${seg(projectId)}/operations`, { ...c, query: { limit } }),
  getOperation: (c: Ctx, projectId: string, opId: string) =>
    callNeon<{ operation: NeonOperation }>(`/projects/${seg(projectId)}/operations/${seg(opId)}`, { ...c }),

  // Data API (Neon Data API)
  getDataApi: (c: Ctx, projectId: string, branchId: string, database: string) =>
    callNeon<NeonDataApi>(`/projects/${seg(projectId)}/branches/${seg(branchId)}/data-api/${seg(database)}`, { ...c }),
  refreshDataApiCache: (c: Ctx, projectId: string, branchId: string, database: string) =>
    callNeon<any>(`/projects/${seg(projectId)}/branches/${seg(branchId)}/data-api/${seg(database)}`, { ...c, method: "PATCH", body: {} }),

  // API keys / consumption / regions
  listApiKeys: (c: Ctx) =>
    callNeon<NeonApiKey[]>(`/api_keys`, { ...c }),
  consumption: (c: Ctx, query?: Record<string, string>) =>
    callNeon<NeonConsumption>(`/consumption/projects`, { ...c, query }),
  consumptionHistoryProjectsV2: (c: Ctx, query: Record<string, string | number | boolean | undefined>) =>
    callNeon<NeonConsumption>(`/consumption_history/v2/projects`, { ...c, query }),
  listRegions: (c: Ctx) =>
    callNeon<any>(`/regions`, { ...c }),
};
