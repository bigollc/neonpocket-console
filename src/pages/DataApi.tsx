import { useEffect, useState } from "react";
import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp, useNeonCtx } from "@/state/AppContext";
import { useDatabasesQuery } from "@/state/queries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NeonService } from "@/lib/neon/service";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Cable, Lock, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DataApi() {
  const ctx = useNeonCtx();
  const qc = useQueryClient();
  const { selectedProjectId, selectedBranchId, selectedDatabase, setSelectedDatabase } = useApp();
  const databases = useDatabasesQuery(selectedProjectId, selectedBranchId);

  useEffect(() => {
    if (!selectedDatabase && databases.data?.databases?.length) setSelectedDatabase(databases.data.databases[0].name);
  }, [databases.data, selectedDatabase, setSelectedDatabase]);

  const dataApi = useQuery({
    queryKey: ["data-api", selectedProjectId, selectedBranchId, selectedDatabase],
    enabled: !!ctx.apiKey && !!selectedProjectId && !!selectedBranchId && !!selectedDatabase,
    queryFn: ({ signal }) => NeonService.getDataApi({ apiKey: ctx.apiKey!, mode: ctx.mode, signal }, selectedProjectId!, selectedBranchId!, selectedDatabase!),
  });
  const apiUrl = (dataApi.data as any)?.url || (dataApi.data as any)?.data_api?.url;

  const refresh = useMutation({
    mutationFn: () => NeonService.refreshDataApiCache({ apiKey: ctx.apiKey!, mode: ctx.mode }, selectedProjectId!, selectedBranchId!, selectedDatabase!),
    onSuccess: () => { toast.success("Schema cache refresh requested"); qc.invalidateQueries({ queryKey: ["data-api", selectedProjectId, selectedBranchId, selectedDatabase] }); },
    onError: (e: any) => toast.error("Refresh failed", { description: `${e.status} · ${e.message}` }),
  });

  // Composer
  const [method, setMethod] = useState<"GET" | "POST" | "PATCH" | "DELETE">("GET");
  const [path, setPath] = useState("/items");
  const [query, setQuery] = useState("limit=10");
  const [body, setBody] = useState('{"name":"foo"}');
  const [jwt, setJwt] = useState("");
  const [resp, setResp] = useState<{ status: number; body: string; headers: Record<string,string> } | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!apiUrl) return toast.error("Data API URL not available");
    if (!jwt) return toast.error("JWT is required");
    if (!isSafeDataApiPath(path)) return toast.error("Path must start with / and cannot contain traversal, query/hash, or URL syntax");
    setSending(true); setResp(null);
    try {
      const u = new URL(apiUrl.replace(/\/$/, "") + path);
      if (query) new URLSearchParams(query).forEach((v, k) => u.searchParams.append(k, v));
      const res = await fetch(u.toString(), {
        method,
        headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json", ...(method !== "GET" && method !== "DELETE" ? { "Content-Type": "application/json" } : {}) },
        body: method !== "GET" && method !== "DELETE" ? body : undefined,
      });
      const txt = await res.text();
      const headers: Record<string,string> = {};
      ["content-type", "content-range", "x-postgrest-version"].forEach(h => { const v = res.headers.get(h); if (v) headers[h] = v; });
      setResp({ status: res.status, body: txt, headers });
    } catch (e: any) {
      setResp({ status: 0, body: e?.message || "Network error or CORS blocked", headers: {} });
    } finally { setSending(false); }
  }

  if (!selectedProjectId || !selectedBranchId) return <Page><EmptyState title="Select a project and branch" /></Page>;

  return (
    <Page>
      <PageHeader title="Data API" description="Manage and compose requests to the Neon Data API (PostgREST). RLS is enforced — never bypassed." actions={
        <Button size="sm" variant="outline" onClick={() => refresh.mutate()} disabled={!selectedDatabase || refresh.isPending}>
          <RefreshCw className="size-3.5 mr-1.5" />Refresh cache
        </Button>
      } />

      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1.5"><Label>Database</Label>
          <Select value={selectedDatabase ?? ""} onValueChange={setSelectedDatabase}>
            <SelectTrigger><SelectValue placeholder="Select database" /></SelectTrigger>
            <SelectContent>{databases.data?.databases?.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 hairline rounded-md p-3 bg-card flex items-center gap-2 min-w-0">
          <Cable className="size-4 text-muted-foreground" />
          {dataApi.isLoading ? <Skeleton className="h-4 w-40" /> :
           dataApi.error ? <span className="text-xs text-destructive">{(dataApi.error as any).status} · {(dataApi.error as any).message}</span> :
           apiUrl ? <span className="mono text-xs truncate">{apiUrl}</span> :
           <span className="text-xs text-muted-foreground">Data API not configured for this database</span>}
        </div>
      </div>

      <Tabs defaultValue="compose" className="mt-4">
        <TabsList><TabsTrigger value="compose">Composer</TabsTrigger><TabsTrigger value="raw">Raw config</TabsTrigger></TabsList>

        <TabsContent value="compose" className="space-y-3">
          {!apiUrl ? (
            <EmptyState icon={Lock} tone="warn" title="Data API URL required"
              description="Configure the Data API for this branch/database before composing requests." />
          ) : (
            <>
              <div className="grid sm:grid-cols-[110px_1fr] gap-2">
                <Select value={method} onValueChange={v => setMethod(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem><SelectItem value="PATCH">PATCH</SelectItem><SelectItem value="DELETE">DELETE</SelectItem></SelectContent>
                </Select>
                <Input value={path} onChange={e => setPath(e.target.value)} placeholder="/table_name" className="mono" />
              </div>
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="PostgREST query string e.g. id=eq.uuid&select=*" className="mono" />
              <div className="space-y-1.5"><Label>JWT (Authorization: Bearer …)</Label><Input type="password" autoComplete="off" className="mono" value={jwt} onChange={e => setJwt(e.target.value)} /></div>
              {(method === "POST" || method === "PATCH") && (
                <div className="space-y-1.5"><Label>Body (JSON)</Label><Textarea value={body} onChange={e => setBody(e.target.value)} className="font-mono text-sm min-h-[120px]" /></div>
              )}
              <Button onClick={send} disabled={sending}><Send className="size-4 mr-2" />{sending ? "Sending…" : "Send"}</Button>

              {resp && (
                <div className="hairline rounded-md bg-card">
                  <div className="px-3 py-2 border-b border-border text-xs flex items-center justify-between">
                    <span className="mono">HTTP {resp.status}</span>
                    {Object.entries(resp.headers).map(([k, v]) => <span key={k} className="mono text-muted-foreground text-[11px] ml-3 truncate">{k}: {v}</span>)}
                  </div>
                  <pre className="p-3 text-[11px] mono whitespace-pre-wrap max-h-80 overflow-auto">{tryPretty(resp.body)}</pre>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="raw">
          {dataApi.isLoading ? <Skeleton className="h-32" /> : dataApi.error ? <ErrorState error={dataApi.error as any} /> :
            <pre className="hairline bg-card rounded-md p-3 text-[11px] mono">{JSON.stringify(dataApi.data, null, 2)}</pre>}
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function tryPretty(s: string) { try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; } }


function hasUnsafeDataApiPathCharacter(value: string) {
  return Array.from(value).some(char => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 || char === "\\" || char === "?" || char === "#";
  });
}

function isSafeDataApiPath(value: string) {
  if (!value.startsWith("/")) return false;
  if (hasUnsafeDataApiPathCharacter(value) || value.includes("://")) return false;
  try {
    const decoded = decodeURIComponent(value);
    return !(hasUnsafeDataApiPathCharacter(decoded) || decoded.includes("://") || decoded.split("/").some(segment => segment === "." || segment === ".."));
  } catch {
    return false;
  }
}
