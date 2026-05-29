import { useEffect, useMemo } from "react";
import { Building2, Check, ChevronDown, FolderGit2, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useApp } from "@/state/AppContext";
import { DEFAULT_WORKSPACE_ID, useBranchesQuery, useOrganizationsQuery, useProjectsQuery } from "@/state/queries";
import { cn } from "@/lib/utils";

export function ProjectBranchSwitcher({ compact = false }: { compact?: boolean }) {
  const {
    selectedOrganizationId,
    setSelectedOrganizationId,
    selectedProjectId,
    setSelectedProjectId,
    selectedBranchId,
    setSelectedBranchId,
  } = useApp();
  const orgs = useOrganizationsQuery();
  const projects = useProjectsQuery();
  const branches = useBranchesQuery(selectedProjectId);
  const defaultName = "Default workspace";
  const workspaces = useMemo(() => [
    { id: DEFAULT_WORKSPACE_ID, name: defaultName, isDefault: true },
    ...(orgs.data?.organizations || []),
  ], [orgs.data?.organizations, defaultName]);

  useEffect(() => {
    if (!selectedOrganizationId && !orgs.isLoading && (orgs.data?.unavailable || orgs.data?.organizations?.length === 0)) {
      setSelectedOrganizationId(DEFAULT_WORKSPACE_ID);
      return;
    }
    if (selectedOrganizationId && !workspaces.some(w => w.id === selectedOrganizationId) && !orgs.isLoading) {
      setSelectedOrganizationId(null);
    }
  }, [orgs.data, orgs.isLoading, selectedOrganizationId, setSelectedOrganizationId, workspaces]);

  useEffect(() => {
    if (selectedProjectId && projects.data?.projects && !projects.data.projects.some((p: any) => p.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [projects.data, selectedProjectId, setSelectedProjectId]);

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
  const proj = projects.data?.projects?.find((p: any) => p.id === selectedProjectId);
  const br = branches.data?.branches?.find((b: any) => b.id === selectedBranchId);

  return (
    <div className={cn("flex items-center gap-1.5", compact && "scale-95 origin-left")}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 max-w-[34vw] truncate">
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
                  <CommandItem key={org.id} value={`${org.name} ${org.id}`} onSelect={() => setSelectedOrganizationId(org.id)}>
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

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 max-w-[32vw] truncate" disabled={!selectedOrganizationId}>
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
                  <CommandItem key={p.id} value={`${p.name} ${p.id}`} onSelect={() => setSelectedProjectId(p.id)}>
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

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 max-w-[28vw] truncate" disabled={!selectedProjectId}>
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
                  <CommandItem key={b.id} value={`${b.name} ${b.id}`} onSelect={() => setSelectedBranchId(b.id)}>
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
    </div>
  );
}
