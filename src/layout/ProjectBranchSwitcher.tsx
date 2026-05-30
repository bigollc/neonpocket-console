import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, Check, ChevronDown, FolderGit2, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useApp } from "@/state/AppContext";
import { useBranchesQuery, useOrganizationsQuery, useProjectsQuery } from "@/state/queries";
import { cn } from "@/lib/utils";

export function ProjectBranchSwitcher({ compact = false }: { compact?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    selectedOrganizationId,
    setSelectedOrganizationId,
    selectedProjectId,
    setSelectedProjectId,
    selectedBranchId,
    setSelectedBranchId,
    resetProjectContext,
    playUiSound,
  } = useApp();
  const orgs = useOrganizationsQuery();
  const projects = useProjectsQuery();
  const branches = useBranchesQuery(selectedProjectId);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const isProjectRoute = location.pathname.startsWith("/project") || location.pathname.startsWith("/branches") || location.pathname.startsWith("/integrations") || location.pathname.startsWith("/auth");
  const isBranchRoute = location.pathname.startsWith("/branch") || location.pathname.startsWith("/backend/data-api");
  const showProjectPicker = isProjectRoute || isBranchRoute || !!selectedProjectId;
  const showBranchPicker = isBranchRoute || !!selectedBranchId;
  const canSelectProject = !!selectedOrganizationId;
  const canSelectBranch = !!selectedOrganizationId && !!selectedProjectId;
  const workspaces = useMemo(() => (orgs.data?.organizations || []), [orgs.data?.organizations]);

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
  const selectedItemClass = "!bg-accent !text-accent-foreground";

  return (
    <div className={cn("flex items-center gap-1.5", compact && "scale-95 origin-left")}>
      <Popover open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 max-w-[46vw] truncate">
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
              <CommandGroup heading="Organizations">
                {workspaces.map((org: any) => {
                  const selected = org.id === selectedOrganizationId;
                  return (
                    <CommandItem key={org.id} value={`${org.name} ${org.id}`} className={cn(selected && selectedItemClass)} onSelect={() => {
                      setSelectedOrganizationId(org.id);
                      resetProjectContext();
                      setWorkspaceOpen(false);
                      navigate("/dashboard");
                      playUiSound("nav");
                    }}>
                      <Building2 className="size-3.5 mr-2 opacity-70" />
                      <span className="truncate">{org.name}</span>
                      {org.plan && <span className="ml-2 rounded bg-muted px-1 text-[10px] text-muted-foreground">{org.plan}</span>}
                      {selected && <Check className="size-3.5 ml-auto" />}
                    </CommandItem>
                  );
                })}
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
                  {projects.data?.projects?.map((p: any) => {
                    const selected = p.id === selectedProjectId;
                    return (
                      <CommandItem key={p.id} value={`${p.name} ${p.id}`} className={cn(selected && selectedItemClass)} onSelect={() => {
                        setSelectedProjectId(p.id);
                        setProjectOpen(false);
                        if (!location.pathname.startsWith("/project")) navigate("/project/dashboard");
                        playUiSound("nav");
                      }}>
                        <FolderGit2 className="size-3.5 mr-2 opacity-70" />
                        <span className="truncate">{p.name}</span>
                        <span className="ml-auto text-[10px] mono text-muted-foreground">{p.region_id}</span>
                        {selected && <Check className="size-3.5 ml-2" />}
                      </CommandItem>
                    );
                  })}
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
                  {branches.data?.branches?.map((b: any) => {
                    const selected = b.id === selectedBranchId;
                    return (
                      <CommandItem key={b.id} value={`${b.name} ${b.id}`} className={cn(selected && selectedItemClass)} onSelect={() => {
                        setSelectedBranchId(b.id);
                        setBranchOpen(false);
                        if (!location.pathname.startsWith("/branch")) navigate("/branch/overview");
                        playUiSound("nav");
                      }}>
                        <GitBranch className="size-3.5 mr-2 opacity-70" />
                        <span className="truncate">{b.name}</span>
                        {(b.primary || b.default) && <span className="ml-2 text-[10px] px-1 rounded bg-muted text-muted-foreground">primary</span>}
                        {selected && <Check className="size-3.5 ml-auto" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
