import { callNeon, type ApiMode } from "./client";
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
    callNeon<{ organization: NeonOrganization }>(`/organizations/${orgId}`, { ...c }),
  listOrganizationMembers: (c: Ctx, orgId: string) =>
    callNeon<any>(`/organizations/${orgId}/members`, { ...c, query: { limit: 100 } }),
  listOrganizationApiKeys: (c: Ctx, orgId: string) =>
    callNeon<{ api_keys: NeonApiKey[] } | { keys: NeonApiKey[] }>(`/organizations/${orgId}/api_keys`, { ...c }),

  // Projects
  listProjects: (c: Ctx, orgId?: string | null) =>
    callNeon<{ projects: NeonProject[] }>("/projects", { ...c, query: { limit: 400, org_id: orgId || undefined } }),
  getProject: (c: Ctx, projectId: string) =>
    callNeon<{ project: NeonProject }>(`/projects/${projectId}`, { ...c }),
  createProject: (c: Ctx, project: Partial<NeonProject>) =>
    callNeon<{ project: NeonProject }>(`/projects`, { ...c, method: "POST", body: { project } }),
  updateProject: (c: Ctx, projectId: string, project: Partial<NeonProject>) =>
    callNeon<{ project: NeonProject }>(`/projects/${projectId}`, { ...c, method: "PATCH", body: { project } }),
  deleteProject: (c: Ctx, projectId: string) =>
    callNeon<{ project: NeonProject }>(`/projects/${projectId}`, { ...c, method: "DELETE" }),

  // Branches
  listBranches: (c: Ctx, projectId: string) =>
    callNeon<{ branches: NeonBranch[] }>(`/projects/${projectId}/branches`, { ...c }),
  getBranch: (c: Ctx, projectId: string, branchId: string) =>
    callNeon<{ branch: NeonBranch }>(`/projects/${projectId}/branches/${branchId}`, { ...c }),
  createBranch: (c: Ctx, projectId: string, body: any) =>
    callNeon<any>(`/projects/${projectId}/branches`, { ...c, method: "POST", body }),
  deleteBranch: (c: Ctx, projectId: string, branchId: string) =>
    callNeon<any>(`/projects/${projectId}/branches/${branchId}`, { ...c, method: "DELETE" }),

  // Databases
  listDatabases: (c: Ctx, projectId: string, branchId: string) =>
    callNeon<{ databases: NeonDatabase[] }>(`/projects/${projectId}/branches/${branchId}/databases`, { ...c }),
  createDatabase: (c: Ctx, projectId: string, branchId: string, database: { name: string; owner_name: string }) =>
    callNeon<{ database: NeonDatabase }>(`/projects/${projectId}/branches/${branchId}/databases`, { ...c, method: "POST", body: { database } }),

  // Roles
  listRoles: (c: Ctx, projectId: string, branchId: string) =>
    callNeon<{ roles: NeonRole[] }>(`/projects/${projectId}/branches/${branchId}/roles`, { ...c }),
  createRole: (c: Ctx, projectId: string, branchId: string, name: string) =>
    callNeon<{ role: NeonRole }>(`/projects/${projectId}/branches/${branchId}/roles`, { ...c, method: "POST", body: { role: { name } } }),
  getRole: (c: Ctx, projectId: string, branchId: string, roleName: string) =>
    callNeon<{ role: NeonRole }>(`/projects/${projectId}/branches/${branchId}/roles/${encodeURIComponent(roleName)}`, { ...c }),

  // Endpoints
  listEndpoints: (c: Ctx, projectId: string) =>
    callNeon<{ endpoints: NeonEndpoint[] }>(`/projects/${projectId}/endpoints`, { ...c }),
  startEndpoint: (c: Ctx, projectId: string, endpointId: string) =>
    callNeon<any>(`/projects/${projectId}/endpoints/${endpointId}/start`, { ...c, method: "POST" }),
  suspendEndpoint: (c: Ctx, projectId: string, endpointId: string) =>
    callNeon<any>(`/projects/${projectId}/endpoints/${endpointId}/suspend`, { ...c, method: "POST" }),
  restartEndpoint: (c: Ctx, projectId: string, endpointId: string) =>
    callNeon<any>(`/projects/${projectId}/endpoints/${endpointId}/restart`, { ...c, method: "POST" }),

  // Operations
  listOperations: (c: Ctx, projectId: string, limit = 50) =>
    callNeon<{ operations: NeonOperation[] }>(`/projects/${projectId}/operations`, { ...c, query: { limit } }),
  getOperation: (c: Ctx, projectId: string, opId: string) =>
    callNeon<{ operation: NeonOperation }>(`/projects/${projectId}/operations/${opId}`, { ...c }),

  // Data API (Neon Data API)
  getDataApi: (c: Ctx, projectId: string, branchId: string, database: string) =>
    callNeon<NeonDataApi>(`/projects/${projectId}/branches/${branchId}/data-api/${encodeURIComponent(database)}`, { ...c }),
  refreshDataApiCache: (c: Ctx, projectId: string, branchId: string, database: string) =>
    callNeon<any>(`/projects/${projectId}/branches/${branchId}/data-api/${encodeURIComponent(database)}`, { ...c, method: "PATCH", body: {} }),

  // API keys / consumption / regions
  listApiKeys: (c: Ctx) =>
    callNeon<NeonApiKey[]>(`/api_keys`, { ...c }),
  consumption: (c: Ctx, query?: Record<string, string>) =>
    callNeon<NeonConsumption>(`/consumption/projects`, { ...c, query }),
  listRegions: (c: Ctx) =>
    callNeon<any>(`/regions`, { ...c }),
};
