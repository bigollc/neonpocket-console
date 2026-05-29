import { Page, PageHeader } from "@/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Copy, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const SNIPPETS = [
  { title: "Enable RLS", sql: `ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;` },
  { title: "Grant minimal to authenticated", sql: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO authenticated;
GRANT ALL ON public.your_table TO service_role;` },
  { title: "Policy: row owner via JWT 'sub'", sql: `CREATE POLICY "own rows" ON public.your_table
FOR ALL TO authenticated
USING (user_id = auth.jwt() ->> 'sub')
WITH CHECK (user_id = auth.jwt() ->> 'sub');` },
  { title: "Inspect policies", sql: `SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';` },
  { title: "Revoke public access", sql: `REVOKE ALL ON public.your_table FROM anon;
REVOKE ALL ON public.your_table FROM PUBLIC;` },
];

export default function Auth() {
  return (
    <Page>
      <PageHeader title="Auth & RLS" description="Configuration guidance for Neon Data API authentication." />
      <div className="hairline rounded-lg p-4 bg-card space-y-2 text-sm">
        <div className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4" /> Data API requires JWT</div>
        <p className="text-muted-foreground">
          Data API requests must include a valid JWT. The JWT should carry a <span className="mono">sub</span> claim that your RLS policies use
          (typically <span className="mono">auth.jwt() ↩&gt;&gt; 'sub'</span>) to scope rows to a user. NeonPocket never bypasses RLS.
        </p>
        <a href="https://neon.com/docs/data-api/get-started" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ExternalLink className="size-3" /> Data API getting started
        </a>
      </div>

      <div className="mt-5 text-xs uppercase tracking-wider text-muted-foreground mb-2">Copyable SQL snippets</div>
      <div className="grid md:grid-cols-2 gap-3">
        {SNIPPETS.map(s => (
          <div key={s.title} className="hairline rounded-lg bg-card">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div className="text-sm font-medium">{s.title}</div>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(s.sql); toast.success("Copied"); }}>
                <Copy className="size-3.5" />
              </Button>
            </div>
            <pre className="p-3 text-[11px] mono whitespace-pre-wrap leading-relaxed">{s.sql}</pre>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">Review and run these in your own SQL environment. NeonPocket does not execute arbitrary SQL.</p>
    </Page>
  );
}
