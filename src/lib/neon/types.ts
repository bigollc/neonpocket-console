// Loose Neon API types — Neon's public API surface evolves; we keep these structural.

export interface NeonProject {
  id: string;
  name: string;
  region_id?: string;
  pg_version?: number;
  created_at?: string;
  updated_at?: string;
  org_id?: string;
  platform_id?: string;
  store_passwords?: boolean;
  proxy_host?: string;
  branch_logical_size_limit?: number;
  [k: string]: any;
}

export interface NeonBranch {
  id: string;
  project_id: string;
  parent_id?: string;
  name: string;
  current_state?: string;
  pending_state?: string;
  default?: boolean;
  protected?: boolean;
  created_at?: string;
  updated_at?: string;
  primary?: boolean;
  cpu_used_sec?: number;
  logical_size?: number;
  [k: string]: any;
}

export interface NeonDatabase {
  id: number;
  name: string;
  owner_name: string;
  branch_id: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: any;
}

export interface NeonRole {
  branch_id: string;
  name: string;
  protected?: boolean;
  created_at?: string;
  updated_at?: string;
  [k: string]: any;
}

export interface NeonEndpoint {
  id: string;
  project_id: string;
  branch_id: string;
  host: string;
  type: "read_write" | "read_only" | string;
  current_state?: string;
  pending_state?: string;
  autoscaling_limit_min_cu?: number;
  autoscaling_limit_max_cu?: number;
  region_id?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: any;
}

export interface NeonOperation {
  id: string;
  project_id: string;
  branch_id?: string;
  endpoint_id?: string;
  action: string;
  status: "scheduling" | "running" | "finished" | "failed" | "error" | "cancelled" | "skipped" | string;
  failures_count?: number;
  error?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: any;
}

export interface NeonOrganization {
  id: string;
  name: string;
  handle?: string;
  plan?: string;
  created_at?: string;
  [k: string]: any;
}

export interface NeonApiKey {
  id: number | string;
  name: string;
  created_at?: string;
  last_used_at?: string;
  [k: string]: any;
}

export interface NeonConsumption {
  [k: string]: any;
}

export interface NeonDataApi {
  url?: string;
  status?: string;
  [k: string]: any;
}
