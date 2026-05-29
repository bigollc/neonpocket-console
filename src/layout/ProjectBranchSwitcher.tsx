import { useEffect } from "react";
import { Check, ChevronDown, FolderGit2, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useApp } from "@/state/AppContext";
import { useProjectsQuery, useBranchesQuery } from "@/state/queries";
import { cn } from "@/lib/utils";

export function ProjectBranchSwitcher({ compact = false }: { compact?: boolean }) {
  const { selectedProjectId, setSelectedProjectId, selectedBranchId, setSelectedBranchId, setSelectedDatabase } = useApp();
  const projects = useProjectsQuery();
  const branches = useBranchesQuery(selectedProjectId);

  // Auto-select first project/branch if none yet
  useEffect(() => {
    if (!selectedProjectId && projects.data?.projects?.length) {
      setSelectedProjectId(projects.data.projects[0].id);
    }
  }, [projects.data, selectedProjectId, setSelectedProjectId]);
  useEffect(() => {
    if (selectedProjectId && branches.data?.branches?.length) {
      const exists = branches.data.branches.some((b: any) => b.id === selectedBranchId);
      if (!exists) {
        const primary = branches.data.branches.find((b: any) => b.primary || b.default) || branches.data.branches[0];
        setSelectedBranchId(primary.id);
        setSelectedDatabase(null);
      }
    }
  }, [branches.data, selectedProjectId, selectedBranchId, setSelectedBranchId, setSelectedDatabase]);

  const proj = projects.data?.projects?.find((p: any) => p.id === selectedProjectId);
  const br = branches.data?.branches?.find((b: any) => b.id === selectedBranchId);

  return (
    <div className={cn("flex items-center gap-1.5", compact && "scale-95 origin-left")}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 max-w-[40vw] truncate">
            <FolderGit2 className="size-3.5 mr-1.5 shrink-0" />
            <span className="truncate text-xs">{proj?.name || "Select project"}</span>
            <ChevronDown className="size-3 ml-1 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-[280px]">
          <Command>
            <CommandInput placeholder="Search projects…" />
            <CommandList>
              <CommandEmpty>{projects.isLoading ? "Loading…" : "No projects"}</CommandEmpty>
              <CommandGroup>
                {projects.data?.projects?.map((p: any) => (
                  <CommandItem key={p.id} value={p.name} onSelect={() => { setSelectedProjectId(p.id); setSelectedBranchId(null); setSelectedDatabase(null); }}>
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
          <Button variant="outline" size="sm" className="h-8 max-w-[36vw] truncate" disabled={!selectedProjectId}>
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
                  <CommandItem key={b.id} value={b.name} onSelect={() => { setSelectedBranchId(b.id); setSelectedDatabase(null); }}>
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
