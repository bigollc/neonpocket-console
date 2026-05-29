import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp, useNeonCtx } from "@/state/AppContext";
import { useDatabasesQuery } from "@/state/queries";
import { NeonService } from "@/lib/neon/service";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, RefreshCw, Table2 } from "lucide-react";
import { toast } from "sonner";

export default function Tables() {
  const ctx = useNeonCtx();
  const { selectedProjectId, selectedBranchId, selectedDatabase, setSelectedDatabase } = useApp();
  const databases = useDatabasesQuery(selectedProjectId, selectedBranchId);
  const [jwt, setJwt] = useState("");
  const [selectedTable, setSelectedTable] = useState("");

  useEffect(() => {
    if (!selectedDatabase && databases.data?.databases?.length) setSelectedDatabase(databases.data.databases[0].name);
  }, [databases.data, selectedDatabase, setSelectedDatabase]);

  const dataApi = useQuery({
    queryKey: ["data-api", selectedProjectId, selectedBranchId, selectedDatabase],
    enabled: !!ctx.apiKey && !!selectedProjectId && !!selectedBranchId && !!selectedDatabase,
    queryFn: ({ signal }) => NeonService.getDataApi({ apiKey: ctx.apiKey!, mode: ctx.mode, signal }, selectedProjectId!, selectedBranchId!, selectedDatabase!),
  });

  const apiUrl = (dataApi.data as any)?.url || (dataApi.data as any)?.data_api?.url;

  // OpenAPI introspection via PostgREST root
  const schema = useQuery({
    queryKey: ["schema", apiUrl],
    enabled: !!apiUrl,
    queryFn: async ({ signal }) => {
      const res = await fetch(apiUrl!, { headers: { Accept: "application/openapi+json" }, signal });
      if (!res.ok) throw new Error(`Schema fetch failed: HTTP ${res.status}`);
      return res.json();
    },
  });
  const tables = useMemo(() => {
    const defs = (schema.data as any)?.definitions || (schema.data as any)?.components?.schemas || {};
    return Object.keys(defs);
  }, [schema.data]);

  const rows = useQuery({
    queryKey: ["rows", apiUrl, selectedTable, jwt],
    enabled: !!apiUrl && !!selectedTable && !!jwt,
    queryFn: async ({ signal }) => {
      const res = await fetch(`${apiUrl!.replace(/\/$/, "")}/${selectedTable}?limit=50`, {
        headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json" }, signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} · ${text}`);
      return JSON.parse(text);
    },
  });

  if (!selectedProjectId || !selectedBranchId) return <Page><EmptyState title="Select a project and branch" /></Page>;

  return (
    <Page>
      <PageHeader title="Tables" description="Browse rows via the Neon Data API. RLS is always respected." actions={
        <Button size="sm" variant="outline" onClick={() => { dataApi.refetch(); schema.refetch(); }}>
          <RefreshCw className="size-3.5 mr-1.5" />Refresh
        </Button>
      } />

      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Database</Label>
          <Select value={selectedDatabase ?? ""} onValueChange={setSelectedDatabase}>
            <SelectTrigger><SelectValue placeholder="Select database" /></SelectTrigger>
            <SelectContent>{databases.data?.databases?.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label>JWT (required for Data API)</Label>
          <Input type="password" value={jwt} onChange={e => setJwt(e.target.value)} placeholder="eyJhbGciOi…" autoComplete="off" className="mono" />
        </div>
      </div>

      <div className="mt-5">
        {dataApi.isLoading ? <Skeleton className="h-16" /> :
         dataApi.error ? <ErrorState error={dataApi.error as any} onRetry={() => dataApi.refetch()} /> :
         !apiUrl ? <EmptyState icon={Lock} tone="warn" title="Data API not configured"
           description="Configure the Neon Data API for this branch/database before browsing tables." /> :
         (
          <div className="hairline rounded-lg bg-card">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 font-medium"><Table2 className="size-4" />Tables</div>
              <span className="mono text-[11px] text-muted-foreground truncate max-w-[40vw]">{apiUrl}</span>
            </div>
            {schema.isLoading ? <div className="p-4"><Skeleton className="h-20" /></div> :
              schema.error ? <div className="p-4"><ErrorState error={{ status: 0, message: (schema.error as any)?.message || "Schema unavailable", route: "GET <data-api>", timestamp: "", retryable: false } as any} /></div> :
              !tables.length ? <div className="p-4"><EmptyState title="No tables discovered" description="The schema introspection returned no resources." /></div> :
              (
                <div className="grid md:grid-cols-[220px_1fr]">
                  <ul className="border-r border-border max-h-[60vh] overflow-y-auto">
                    {tables.map(t => (
                      <li key={t}><button onClick={() => setSelectedTable(t)} className={`w-full text-left px-3 py-2 text-sm mono hover:bg-accent/40 ${t === selectedTable ? "bg-accent/60 text-foreground" : ""}`}>{t}</button></li>
                    ))}
                  </ul>
                  <div className="p-4 min-w-0">
                    {!selectedTable ? <EmptyState title="Pick a table" /> :
                     !jwt ? <EmptyState icon={Lock} tone="warn" title="JWT required" description="Provide a JWT to query rows. RLS will be enforced." /> :
                     rows.isLoading ? <Skeleton className="h-24" /> :
                     rows.error ? <ErrorState error={{ status: 0, message: (rows.error as any)?.message, route: `GET /${selectedTable}`, timestamp: "", retryable: false } as any} onRetry={() => rows.refetch()} /> :
                     !Array.isArray(rows.data) || !rows.data.length ? <EmptyState title="No rows visible" description="The Data API returned no rows. RLS may scope this set to your JWT subject." /> :
                     (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs mono">
                          <thead>
                            <tr className="text-left text-muted-foreground">{Object.keys(rows.data[0]).map(k => <th key={k} className="font-medium px-2 py-1.5 border-b border-border">{k}</th>)}</tr>
                          </thead>
                          <tbody>
                            {rows.data.map((r: any, i: number) => (
                              <tr key={i} className="border-b border-border/60">
                                {Object.keys(rows.data[0]).map(k => <td key={k} className="px-2 py-1.5 align-top max-w-[260px] truncate">{stringify(r[k])}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                     )}
                  </div>
                </div>
              )}
          </div>
         )}
      </div>
    </Page>
  );
}

function stringify(v: any) { if (v == null) return ""; if (typeof v === "object") return JSON.stringify(v); return String(v); }
