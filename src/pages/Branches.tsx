import { useMemo, useState } from "react";
import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp, useNeonCtx } from "@/state/AppContext";
import { useBranchesQuery, useDatabasesQuery, useRolesQuery, useEndpointsQuery, useOperationsQuery } from "@/state/queries";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusDot } from "@/components/ui/status-dot";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NeonService } from "@/lib/neon/service";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function Branches() {
  const { selectedProjectId } = useApp();
  const ctx = useNeonCtx();
  const qc = useQueryClient();
  const branches = useBranchesQuery(selectedProjectId);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [parent, setParent] = useState<string | undefined>();
  const [active, setActive] = useState<any | null>(null);

  const list = useMemo(() => {
    const arr = branches.data?.branches ?? [];
    return arr.filter((b: any) => b.name.toLowerCase().includes(filter.toLowerCase()));
  }, [branches.data, filter]);

  const createMut = useMutation({
    mutationFn: () => NeonService.createBranch({ apiKey: ctx.apiKey!, mode: ctx.mode }, selectedProjectId!, {
      branch: { name: newName || undefined, parent_id: parent || undefined },
      endpoints: [{ type: "read_write" }],
    }),
    onSuccess: () => {
      toast.success("Branch created");
      setOpen(false); setNewName(""); setParent(undefined);
      qc.invalidateQueries({ queryKey: ["branches", selectedProjectId] });
      qc.invalidateQueries({ queryKey: ["operations", selectedProjectId] });
    },
    onError: (e: any) => toast.error("Could not create branch", { description: `${e.status} · ${e.message}` }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => NeonService.deleteBranch({ apiKey: ctx.apiKey!, mode: ctx.mode }, selectedProjectId!, id),
    onSuccess: () => {
      toast.success("Branch deletion scheduled");
      qc.invalidateQueries({ queryKey: ["branches", selectedProjectId] });
      qc.invalidateQueries({ queryKey: ["operations", selectedProjectId] });
      setActive(null);
    },
    onError: (e: any) => toast.error("Could not delete branch", { description: `${e.status} · ${e.message}` }),
  });

  if (!selectedProjectId) return <Page><EmptyState title="Select a project" description="Use the project switcher in the top bar." /></Page>;

  return (
    <Page>
      <PageHeader title="Branches" description="Real branches from the Neon API." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />New branch</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create branch</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Name (optional)</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="feature-x" /></div>
              <div className="space-y-1.5">
                <Label>Parent branch</Label>
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger><SelectValue placeholder="Default (primary)" /></SelectTrigger>
                  <SelectContent>
                    {branches.data?.branches?.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">A read-write endpoint will be requested for the new branch when supported by the API.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>{createMut.isPending ? "Creating…" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search branches…" className="mb-4" />

      {branches.isLoading ? <Skeleton className="h-32 w-full" />
        : branches.error ? <ErrorState error={branches.error} onRetry={() => branches.refetch()} />
        : !list.length ? <EmptyState title={filter ? "No branches match your search" : "No branches"} />
        : (
          <div className="hairline rounded-lg bg-card divide-y divide-border">
            {list.map((b: any) => (
              <button key={b.id} onClick={() => setActive(b)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/40">
                <GitBranch className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-medium truncate">{b.name}</span>
                    {(b.primary || b.default) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">primary</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mono truncate">{b.id}</div>
                </div>
                <StatusDot status={b.current_state || "idle"} />
              </button>
            ))}
          </div>
        )}

      <Sheet open={!!active} onOpenChange={o => !o && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {active && <BranchDetail branch={active} onDelete={() => deleteMut.mutate(active.id)} deleting={deleteMut.isPending} />}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

function BranchDetail({ branch, onDelete, deleting }: { branch: any; onDelete: () => void; deleting: boolean }) {
  const { selectedProjectId } = useApp();
  const databases = useDatabasesQuery(selectedProjectId, branch.id);
  const roles = useRolesQuery(selectedProjectId, branch.id);
  const endpoints = useEndpointsQuery(selectedProjectId);
  const ops = useOperationsQuery(selectedProjectId);
  const branchEndpoints = endpoints.data?.endpoints?.filter((e: any) => e.branch_id === branch.id) ?? [];
  const branchOps = ops.data?.operations?.filter((o: any) => o.branch_id === branch.id).slice(0, 8) ?? [];

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2"><GitBranch className="size-4" />{branch.name}</SheetTitle>
        <div className="text-[11px] mono text-muted-foreground break-all">{branch.id}</div>
      </SheetHeader>
      <div className="mt-4 space-y-5 text-sm">
        <Section title="Metadata">
          <KV k="state" v={<span className="inline-flex items-center gap-1.5"><StatusDot status={branch.current_state} />{branch.current_state || "—"}</span>} />
          <KV k="parent" v={branch.parent_id || "—"} />
          <KV k="protected" v={String(!!branch.protected)} />
          <KV k="created" v={branch.created_at || "—"} />
        </Section>
        <Section title={`Databases (${databases.data?.databases?.length ?? 0})`}>
          {databases.isLoading ? <Skeleton className="h-10" /> : databases.error ? <ErrorState error={databases.error} /> :
            (databases.data?.databases?.length ? databases.data.databases.map((d: any) =>
              <div key={d.id} className="flex justify-between py-1"><span className="mono">{d.name}</span><span className="text-muted-foreground text-xs">owner: {d.owner_name}</span></div>
            ) : <EmptyState title="No databases" />)}
        </Section>
        <Section title={`Roles (${roles.data?.roles?.length ?? 0})`}>
          {roles.isLoading ? <Skeleton className="h-10" /> : roles.error ? <ErrorState error={roles.error} /> :
            (roles.data?.roles?.length ? roles.data.roles.map((r: any) =>
              <div key={r.name} className="flex justify-between py-1"><span className="mono">{r.name}</span>{r.protected && <span className="text-xs text-muted-foreground">protected</span>}</div>
            ) : <EmptyState title="No roles" />)}
        </Section>
        <Section title={`Endpoints (${branchEndpoints.length})`}>
          {branchEndpoints.length ? branchEndpoints.map((ep: any) => (
            <div key={ep.id} className="py-1">
              <div className="mono text-xs break-all">{ep.host}</div>
              <div className="text-[11px] text-muted-foreground"><StatusDot status={ep.current_state} /> {ep.type} · {ep.current_state}</div>
            </div>
          )) : <EmptyState title="No endpoints" />}
        </Section>
        <Section title="Recent operations">
          {branchOps.length ? branchOps.map((o: any) => (
            <div key={o.id} className="flex items-center gap-2 py-1 text-xs">
              <StatusDot status={o.status} /><span className="mono">{o.action}</span>
              <span className="ml-auto text-muted-foreground">{o.status}</span>
            </div>
          )) : <EmptyState title="No operations" />}
        </Section>
        {!branch.primary && !branch.default && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" className="w-full"><Trash2 className="size-4 mr-2" />Delete branch</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this branch?</AlertDialogTitle>
                <AlertDialogDescription>This calls Neon's API and cannot be undone. Endpoints attached to this branch will also be removed.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{title}</div><div className="hairline rounded-md p-3 bg-card">{children}</div></div>;
}
function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">{k}</span><span className="mono text-xs break-all text-right">{v}</span></div>;
}
