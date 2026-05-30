import { useState } from "react";
import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp, useNeonCtx } from "@/state/AppContext";
import { useBranchesQuery, useDatabasesQuery, useRolesQuery, useEndpointsQuery, useOperationsQuery } from "@/state/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusDot } from "@/components/ui/status-dot";
import { Copy, Database, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NeonService } from "@/lib/neon/service";

export default function BranchOverview() {
  const { selectedProjectId, selectedBranchId } = useApp();
  const ctx = useNeonCtx();
  const qc = useQueryClient();
  const branches = useBranchesQuery(selectedProjectId);
  const databases = useDatabasesQuery(selectedProjectId, selectedBranchId);
  const roles = useRolesQuery(selectedProjectId, selectedBranchId);
  const endpoints = useEndpointsQuery(selectedProjectId);
  const ops = useOperationsQuery(selectedProjectId);

  const branch = branches.data?.branches?.find((b: any) => b.id === selectedBranchId);
  const branchEndpoints = endpoints.data?.endpoints?.filter((e: any) => e.branch_id === selectedBranchId) ?? [];
  const branchOps = ops.data?.operations?.filter((o: any) => o.branch_id === selectedBranchId).slice(0, 10) ?? [];
  const host = branchEndpoints[0]?.host;
  const db = databases.data?.databases?.[0]?.name;
  const role = roles.data?.roles?.[0]?.name;

  const [dbName, setDbName] = useState(""); const [dbOwner, setDbOwner] = useState("");
  const [roleName, setRoleName] = useState("");
  const createDb = useMutation({
    mutationFn: () => NeonService.createDatabase({ apiKey: ctx.apiKey!, mode: ctx.mode }, selectedProjectId!, selectedBranchId!, { name: dbName, owner_name: dbOwner }),
    onSuccess: () => { toast.success("Database created"); setDbName(""); setDbOwner(""); qc.invalidateQueries({ queryKey: ["databases", selectedProjectId, selectedBranchId] }); qc.invalidateQueries({ queryKey: ["operations", selectedProjectId] }); },
    onError: (e: any) => toast.error("Could not create database", { description: `${e.status} · ${e.message}` }),
  });
  const createRole = useMutation({
    mutationFn: () => NeonService.createRole({ apiKey: ctx.apiKey!, mode: ctx.mode }, selectedProjectId!, selectedBranchId!, roleName),
    onSuccess: () => { toast.success("Role created"); setRoleName(""); qc.invalidateQueries({ queryKey: ["roles", selectedProjectId, selectedBranchId] }); },
    onError: (e: any) => toast.error("Could not create role", { description: `${e.status} · ${e.message}` }),
  });

  if (!selectedProjectId || !selectedBranchId) return <Page><EmptyState title="Select a project and branch" /></Page>;
  if (branches.error) return <Page><ErrorState error={branches.error} onRetry={() => branches.refetch()} /></Page>;

  const psql = host && db && role ? `psql "postgresql://${role}:<password>@${host}/${db}?sslmode=require"` : null;
  const cli = `neon connection-string --project-id ${selectedProjectId} --branch-id ${selectedBranchId}${db ? ` --database-name ${db}` : ""}`;

  return (
    <Page>
      <PageHeader title="Branch Overview" description={branch?.name} />

      <div className="grid grid-cols-3 gap-3 overflow-x-auto pb-1">
        <Stat label="State" value={<span className="inline-flex items-center gap-1.5"><StatusDot status={branch?.current_state} />{branch?.current_state || "—"}</span>} />
        <Stat label="Databases" value={databases.data?.databases?.length ?? "—"} />
        <Stat label="Roles" value={roles.data?.roles?.length ?? "—"} />
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <Panel title="Databases" actions={
          <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="size-4 mr-1" />New</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create database</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input value={dbName} onChange={e => setDbName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Owner role</Label><Input value={dbOwner} onChange={e => setDbOwner(e.target.value)} placeholder="e.g. neondb_owner" /></div>
              </div>
              <DialogFooter><Button onClick={() => createDb.mutate()} disabled={!dbName || !dbOwner || createDb.isPending}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }>
          {databases.isLoading ? <Skeleton className="h-16" /> : databases.error ? <ErrorState error={databases.error} /> :
            !databases.data?.databases?.length ? <EmptyState icon={Database} title="No databases" /> :
            <ul className="text-sm divide-y divide-border">
              {databases.data.databases.map((d: any) => (
                <li key={d.id} className="py-2 flex justify-between"><span className="mono">{d.name}</span><span className="text-xs text-muted-foreground">owner: {d.owner_name}</span></li>
              ))}
            </ul>}
        </Panel>
        <Panel title="Roles" actions={
          <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="size-4 mr-1" />New</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create role</DialogTitle></DialogHeader>
              <div className="space-y-1.5"><Label>Role name</Label><Input value={roleName} onChange={e => setRoleName(e.target.value)} /></div>
              <DialogFooter><Button onClick={() => createRole.mutate()} disabled={!roleName || createRole.isPending}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }>
          {roles.isLoading ? <Skeleton className="h-16" /> : roles.error ? <ErrorState error={roles.error} /> :
            !roles.data?.roles?.length ? <EmptyState icon={KeyRound} title="No roles" /> :
            <ul className="text-sm divide-y divide-border">
              {roles.data.roles.map((r: any) => (
                <li key={r.name} className="py-2 flex justify-between"><span className="mono">{r.name}</span>{r.protected && <span className="text-[11px] text-muted-foreground">protected</span>}</li>
              ))}
            </ul>}
        </Panel>
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <Panel title="Endpoints">
          {endpoints.isLoading ? <Skeleton className="h-16" /> : !branchEndpoints.length ? <EmptyState title="No endpoints" /> :
            branchEndpoints.map((ep: any) => (
              <div key={ep.id} className="py-2 text-sm">
                <div className="mono text-xs break-all">{ep.host}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><StatusDot status={ep.current_state} />{ep.type} · {ep.current_state}{ep.pending_state ? ` → ${ep.pending_state}` : ""}</div>
              </div>
            ))}
        </Panel>
        <Panel title="Recent operations">
          {ops.isLoading ? <Skeleton className="h-16" /> : !branchOps.length ? <EmptyState title="No operations" /> :
            <ul className="text-sm">
              {branchOps.map((o: any) => (
                <li key={o.id} className="flex items-center gap-2 py-1">
                  <StatusDot status={o.status} /><span className="mono text-xs">{o.action}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{o.status}</span>
                </li>
              ))}
            </ul>}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Connection hints">
          <div className="space-y-2">
            <Snippet label="Neon CLI" text={cli} />
            {psql ? <Snippet label="psql" text={psql} note="Passwords are not exposed by the read APIs. Replace <password> using your own credentials." /> :
              <div className="text-xs text-muted-foreground">A psql command requires at least one endpoint, database, and role on this branch.</div>}
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="hairline rounded-lg p-4 bg-card min-w-[9rem]"><div className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">{label}</div><div className="text-lg font-semibold mt-1 whitespace-nowrap">{value}</div></div>;
}
function Panel({ title, actions, children }: any) {
  return (
    <div className="hairline rounded-lg bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between"><div className="text-sm font-medium">{title}</div>{actions}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Snippet({ label, text, note }: { label: string; text: string; note?: string }) {
  return (
    <div className="hairline rounded-md">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}><Copy className="size-3.5" /></Button>
      </div>
      <pre className="p-3 text-[11px] mono overflow-x-auto whitespace-pre">{text}</pre>
      {note && <div className="px-3 pb-2 text-[11px] text-muted-foreground">{note}</div>}
    </div>
  );
}
