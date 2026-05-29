import {
  LayoutDashboard, GitBranch, Plug, Shield, Settings, Activity, TerminalSquare,
  Table2, Database, EyeOff, Cable, MessageSquare, ListTree, Building2,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: any;
  section: "account" | "project" | "branch" | "backend";
  requires?: "organization" | "project" | "branch";
  beta?: boolean;
}

export const NAV: NavItem[] = [
  // ACCOUNT
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "account" },
  { to: "/organizations", label: "Organizations", icon: Building2, section: "account" },
  { to: "/settings", label: "Settings", icon: Settings, section: "account" },
  // PROJECT
  { to: "/branches", label: "Branches", icon: GitBranch, section: "project", requires: "project" },
  { to: "/integrations", label: "Integrations", icon: Plug, section: "project", requires: "project" },
  { to: "/auth", label: "Auth", icon: Shield, section: "project", requires: "project" },
  // BRANCH
  { to: "/branch/overview", label: "Overview", icon: ListTree, section: "branch", requires: "branch" },
  { to: "/branch/monitoring", label: "Monitoring", icon: Activity, section: "branch", requires: "project" },
  { to: "/branch/sql", label: "SQL Editor", icon: TerminalSquare, section: "branch", requires: "branch" },
  { to: "/branch/tables", label: "Tables", icon: Table2, section: "branch", requires: "branch" },
  { to: "/branch/backup", label: "Backup & Restore", icon: Database, section: "branch", requires: "branch" },
  { to: "/branch/masking", label: "Data Masking", icon: EyeOff, section: "branch", requires: "branch", beta: true },
  // BACKEND
  { to: "/backend/data-api", label: "Data API", icon: Cable, section: "backend", requires: "branch" },
  { to: "/backend/feedback", label: "Feedback", icon: MessageSquare, section: "backend" },
];

export const MOBILE_PRIMARY = ["/dashboard", "/organizations", "/branches", "/branch/sql", "/settings"];
