import { useEffect, useState } from "react";
import { Page, PageHeader } from "@/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/state/AppContext";
import { useDatabasesQuery, useRolesQuery, useEndpointsQuery } from "@/state/queries";
import { EmptyState } from "@/components/ui/empty-state";

const SNIPPETS = [
  { title: "Create table", sql: `CREATE TABLE public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  created_at timestamptz not null default now()
);` },
  { title: "Enable RLS", sql: `ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;` },
  { title: "Grant authenticated", sql: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;` },
  { title: "Policy: own rows", sql: `CREATE POLICY "own rows" ON public.items
FOR ALL TO authenticated
USING (user_id::text = auth.jwt() ->> 'sub')
WITH CHECK (user_id::text = auth.jwt() ->> 'sub');` },
  { title: "Inspect tables", sql: `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');` },
  { title: "Inspect policies", sql: `SELECT schemaname, tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public';` },
];

export default function SqlEditor() {
  const { selectedProjectId, selectedBranchId, settings } = useApp();
  const databases = useDatabasesQuery(selectedProjectId, selectedBranchId);
  const roles = useRolesQuery(selectedProjectId, selectedBranchId);
  const endpoints = useEndpointsQuery(selectedProjectId);
  const db = databases.data?.databases?.[0]?.name;
  const role = roles.data?.roles?.[0]?.name;
  const host = endpoints.data?.endpoints?.find((e: any) => e.branch_id === selectedBranchId)?.host;
  const psql = host && db && role ? `psql "postgresql://${role}:<password>@${host}/${db}?sslmode=require"` : null;

  const HIST_KEY = "neonpocket.sql.history.v1";
  const [sql, setSql] = useState("-- Compose SQL here. NeonPocket does not execute arbitrary SQL.\n-- Copy the connection hint below and run in psql or your editor.\n\n");
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    if (settings.localHistory) {
      try { setHistory(JSON.parse(localStorage.getItem(HIST_KEY) || "[]")); } catch { /* ignore */ }
    } else { setHistory([]); }
  }, [settings.localHistory]);
  function saveSnippet() {
    if (!settings.localHistory) return toast.error("Enable local history in Settings first");
    const next = [sql, ...history].slice(0, 20);
    setHistory(next); localStorage.setItem(HIST_KEY, JSON.stringify(next)); toast.success("Saved locally");
  }

  // REST translator state
  const [table, setTable] = useState("items");
  const [op, setOp] = useState<"select" | "insert" | "update" | "delete">("select");
  const [filter, setFilter] = useState("id=eq.<uuid>");
  const [body, setBody] = useState('{"name":"foo"}');
  const restPath = `/${table}${op === "select" ? `?${filter}` : ""}`;
  const restMethod = op === "select" ? "GET" : op === "insert" ? "POST" : op === "update" ? "PATCH" : "DELETE";

  return (
    <Page>
      <PageHeader title="SQL Editor" description="Compose SQL and Data API requests for the selected branch." />
      <Tabs defaultValue="scratch">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="scratch">Scratch SQL</TabsTrigger>
          <TabsTrigger value="snippets">Snippets</TabsTrigger>
          <TabsTrigger value="rls">RLS Helper</TabsTrigger>
          <TabsTrigger value="rest">Data API Translator</TabsTrigger>
          <TabsTrigger value="history" disabled={!settings.localHistory}>History</TabsTrigger>
        </TabsList>

        <TabsContent value="scratch" className="space-y-3">
          <Textarea value={sql} onChange={e => setSql(e.target.value)} className="font-mono text-sm min-h-[260px]" />
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(sql); toast.success("Copied"); }}><Copy className="size-3.5 mr-1.5" />Copy SQL</Button>
            <Button variant="outline" size="sm" onClick={saveSnippet}><Save className="size-3.5 mr-1.5" />Save locally</Button>
          </div>
          {psql ? <Snippet label="Run with psql" text={psql} /> :
            <EmptyState title="Need branch endpoint, database and role" description="Open Branch Overview to create resources for this branch." />}
        </TabsContent>

        <TabsContent value="snippets">
          <div className="grid md:grid-cols-2 gap-3">
            {SNIPPETS.map(s => <Snippet key={s.title} label={s.title} text={s.sql} />)}
          </div>
        </TabsContent>

        <TabsContent value="rls">
          <div className="grid md:grid-cols-2 gap-3">
            {SNIPPETS.slice(1, 4).map(s => <Snippet key={s.title} label={s.title} text={s.sql} />)}
            <Snippet label="Inspect policies" text={SNIPPETS[5].sql} />
          </div>
        </TabsContent>

        <TabsContent value="rest" className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-2 text-sm">
            <label>Table<input className="mt-1 w-full hairline rounded-md px-2 py-1.5 bg-background mono" value={table} onChange={e => setTable(e.target.value)} /></label>
            <label>Operation
              <select className="mt-1 w-full hairline rounded-md px-2 py-1.5 bg-background mono" value={op} onChange={e => setOp(e.target.value as any)}>
                <option value="select">SELECT</option><option value="insert">INSERT</option><option value="update">UPDATE</option><option value="delete">DELETE</option>
              </select>
            </label>
            <label>Filter (PostgREST)<input className="mt-1 w-full hairline rounded-md px-2 py-1.5 bg-background mono" value={filter} onChange={e => setFilter(e.target.value)} /></label>
          </div>
          {op !== "select" && (
            <label className="block text-sm">Body (JSON)
              <Textarea value={body} onChange={e => setBody(e.target.value)} className="font-mono text-sm min-h-[120px] mt-1" />
            </label>
          )}
          <Snippet label="Request preview (not executed)" text={`${restMethod} ${restPath}\n\n${op !== "select" ? body : ""}`} note="This is a generated REST preview. Send real requests from Data API → Composer (JWT required)." />
        </TabsContent>

        <TabsContent value="history">
          {history.length === 0 ? <EmptyState title="No saved entries" /> :
            <ul className="space-y-2">
              {history.map((h, i) => (
                <li key={i} className="hairline rounded-md">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs text-muted-foreground">#{i + 1}
                    <Button size="sm" variant="ghost" onClick={() => { const next = history.filter((_, j) => j !== i); setHistory(next); localStorage.setItem(HIST_KEY, JSON.stringify(next)); }}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <pre className="p-3 text-[11px] mono whitespace-pre-wrap">{h}</pre>
                </li>
              ))}
            </ul>}
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function Snippet({ label, text, note }: { label: string; text: string; note?: string }) {
  return (
    <div className="hairline rounded-md bg-card">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between"><span className="text-xs">{label}</span>
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}><Copy className="size-3.5" /></Button>
      </div>
      <pre className="p-3 text-[11px] mono whitespace-pre-wrap">{text}</pre>
      {note && <div className="px-3 pb-2 text-[11px] text-muted-foreground">{note}</div>}
    </div>
  );
}
