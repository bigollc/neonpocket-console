import {
  LayoutDashboard, GitBranch, Plug, Shield, Settings, Activity, TerminalSquare,
  Table2, Database, EyeOff, Cable, MessageSquare, ListTree,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: any;
  section: "project" | "branch" | "backend";
  beta?: boolean;
}

export const NAV: NavItem[] = [
  // PROJECT
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "project" },
  { to: "/branches", label: "Branches", icon: GitBranch, section: "project" },
  { to: "/integrations", label: "Integrations", icon: Plug, section: "project" },
  { to: "/auth", label: "Auth", icon: Shield, section: "project" },
  { to: "/settings", label: "Settings", icon: Settings, section: "project" },
  // BRANCH
  { to: "/branch/overview", label: "Overview", icon: ListTree, section: "branch" },
  { to: "/branch/monitoring", label: "Monitoring", icon: Activity, section: "branch" },
  { to: "/branch/sql", label: "SQL Editor", icon: TerminalSquare, section: "branch" },
  { to: "/branch/tables", label: "Tables", icon: Table2, section: "branch" },
  { to: "/branch/backup", label: "Backup & Restore", icon: Database, section: "branch" },
  { to: "/branch/masking", label: "Data Masking", icon: EyeOff, section: "branch", beta: true },
  // BACKEND
  { to: "/backend/data-api", label: "Data API", icon: Cable, section: "backend" },
  { to: "/backend/feedback", label: "Feedback", icon: MessageSquare, section: "backend" },
];

export const MOBILE_PRIMARY = ["/dashboard", "/branches", "/branch/sql", "/backend/data-api", "/settings"];
