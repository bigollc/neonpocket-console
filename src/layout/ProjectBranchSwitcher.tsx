import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Building2, Check, ChevronDown, FolderGit2, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useApp } from "@/state/AppContext";
import { DEFAULT_WORKSPACE_ID, useBranchesQuery, useOrganizationsQuery, useProjectsQuery } from "@/state/queries";
import { cn } from "@/lib/utils";

export function ProjectBranchSwitcher({ compact = false }: { compact?: boolean }) {
  const location = useLocation();
  const {
    selectedOrganizationId,
    setSelectedOrganizationId,
    selectedProjectId,
    setSelectedProjectId,
    selectedBranchId,
    setSelectedBranchId,
    playUiSound,
  } = useApp();
  const orgs = useOrganizationsQuery();
  const projects = useProjectsQuery();
  const branches = useBranchesQuery(selectedProjectId);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const defaultName = "Default workspace";
  const isMainDashboard = location.pathname === "/dashboard";
  const canSelectProject = !!selectedOrganizationId;
  const canSelectBranch = !!selectedOrganizationId && !!selectedProjectId;
  const showProjectPicker = !isMainDashboard || canSelectProject;
  const showBranchPicker = !isMainDashboard || canSelectBranch;
  const workspaces = useMemo(() => [
    { id: DEFAULT_WORKSPACE_ID, name: defaultName, isDefault: true },
    ...(orgs.data?.organizations || []),
  ], [orgs.data?.organizations, defaultName]);

  useEffect(() => {
    if (selectedOrganizationId && !workspaces.some(w => w.id === selectedOrganizationId) && !orgs.isLoading) {
      setSelectedOrganizationId(null);
    }
  }, [orgs.isLoading, selectedOrganizationId, setSelectedOrganizationId, workspaces]);

  useEffect(() => {
    if (selectedProjectId && !selectedOrganizationId) {
      setSelectedProjectId(null);
      return;
    }
    if (selectedProjectId && projects.data?.projects && !projects.data.projects.some((p: any) => p.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [projects.data, selectedOrganizationId, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && branches.data?.branches?.length) {
      const exists = branches.data.branches.some((b: any) => b.id === selectedBranchId);
      if (!exists) {
        const primary = branches.data.branches.find((b: any) => b.primary || b.default) || branches.data.branches[0];
        setSelectedBranchId(primary.id);
      }
    }
  }, [branches.data, selectedProjectId, selectedBranchId, setSelectedBranchId]);

  const workspace = workspaces.find(w => w.id === selectedOrganizationId);
  const proj = selectedOrganizationId ? projects.data?.projects?.find((p: any) => p.id === selectedProjectId) : undefined;
  const br = selectedOrganizationId && selectedProjectId ? branches.data?.branches?.find((b: any) => b.id === selectedBranchId) : undefined;

  return (
    <div className={cn("flex items-center gap-1.5", compact && "scale-95 origin-left")}>
      <Popover open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 max-w-[44vw] truncate">
            <Building2 className="size-3.5 mr-1.5 shrink-0" />
            <span className="truncate text-xs">{workspace?.name || "Select organization"}</span>
            <ChevronDown className="size-3 ml-1 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-[300px]">
          <Command>
            <CommandInput placeholder="Search organizations…" />
            <CommandList>
              <CommandEmpty>{orgs.isLoading ? "Loading…" : "No organizations"}</CommandEmpty>
              <CommandGroup heading="Workspaces">
                {workspaces.map((org: any) => (
                  <CommandItem key={org.id} value={`${org.name} ${org.id}`} onSelect={() => {
                    setSelectedOrganizationId(org.id);
                    setWorkspaceOpen(false);
                    playUiSound("nav");
                  }}>
                    <Building2 className="size-3.5 mr-2 opacity-70" />
                    <span className="truncate">{org.name}</span>
                    {org.isDefault && <span className="ml-2 rounded bg-muted px-1 text-[10px] text-muted-foreground">default</span>}
                    {org.id === selectedOrganizationId && <Check className="size-3.5 ml-auto" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showProjectPicker && (
        <Popover open={projectOpen} onOpenChange={setProjectOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 max-w-[32vw] truncate" disabled={!canSelectProject}>
              <FolderGit2 className="size-3.5 mr-1.5 shrink-0" />
              <span className="truncate text-xs">{proj?.name || "Select project"}</span>
              <ChevronDown className="size-3 ml-1 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0 w-[300px]">
            <Command>
              <CommandInput placeholder="Search projects…" />
              <CommandList>
                <CommandEmpty>{projects.isLoading ? "Loading…" : "No projects"}</CommandEmpty>
                <CommandGroup>
                  {projects.data?.projects?.map((p: any) => (
                    <CommandItem key={p.id} value={`${p.name} ${p.id}`} onSelect={() => {
                      setSelectedProjectId(p.id);
                      setProjectOpen(false);
                      playUiSound("nav");
                    }}>
                      <FolderGit2 className="size-3.5 mr-2 opacity-70" />
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto text-[10px] mono text-muted-foreground">{p.region_id}</span>
                      {p.id === selectedProjectId && <Check className="size-3.5 ml-2" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {showBranchPicker && (
        <Popover open={branchOpen} onOpenChange={setBranchOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 max-w-[28vw] truncate" disabled={!canSelectBranch}>
              <GitBranch className="size-3.5 mr-1.5 shrink-0" />
              <span className="truncate text-xs">{br?.name || "Branch"}</span>
              <ChevronDown className="size-3 ml-1 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0 w-[260px]">
            <Command>
              <CommandInput placeholder="Search branches…" />
              <CommandList>
                <CommandEmpty>{branches.isLoading ? "Loading…" : "No branches"}</CommandEmpty>
                <CommandGroup>
                  {branches.data?.branches?.map((b: any) => (
                    <CommandItem key={b.id} value={`${b.name} ${b.id}`} onSelect={() => {
                      setSelectedBranchId(b.id);
                      setBranchOpen(false);
                      playUiSound("nav");
                    }}>
                      <GitBranch className="size-3.5 mr-2 opacity-70" />
                      <span className="truncate">{b.name}</span>
                      {(b.primary || b.default) && <span className="ml-2 text-[10px] px-1 rounded bg-muted text-muted-foreground">primary</span>}
                      {b.id === selectedBranchId && <Check className="size-3.5 ml-auto" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
