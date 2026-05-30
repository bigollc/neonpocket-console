import { useState } from "react";
import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp, useNeonCtx } from "@/state/AppContext";
import { useBranchesQuery } from "@/state/queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Database, History } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callNeon } from "@/lib/neon/client";
import { neonPathSegment as seg } from "@/lib/neon/path";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function BackupRestore() {
  const ctx = useNeonCtx();
  const { selectedProjectId, selectedBranchId } = useApp();
  const branches = useBranchesQuery(selectedProjectId);
  const branch = branches.data?.branches?.find((b: any) => b.id === selectedBranchId);
  const qc = useQueryClient();
  const [ts, setTs] = useState<string>(new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16));
  const [err, setErr] = useState<any>(null);

  const restorePit = useMutation({
    mutationFn: async () => {
      const body = { source_branch_id: selectedBranchId, source_timestamp: new Date(ts).toISOString(), preserve_under_name: `${branch?.name || "branch"}-pre-restore` };
      return callNeon(`/projects/${seg(selectedProjectId)}/branches/${seg(selectedBranchId)}/restore`, { ...ctx as any, method: "POST", body });
    },
    onSuccess: () => { toast.success("Restore scheduled"); qc.invalidateQueries({ queryKey: ["operations", selectedProjectId] }); setErr(null); },
    onError: (e: any) => { setErr(e); toast.error("Restore failed", { description: `${e.status} · ${e.message}` }); },
  });

  if (!selectedProjectId || !selectedBranchId) return <Page><EmptyState title="Select a project and branch" /></Page>;

  return (
    <Page>
      <PageHeader title="Backup & Restore" description="Time-travel restore using Neon's branch restore API." />
      <div className="hairline rounded-lg p-5 bg-card space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><History className="size-4" />Point-in-time restore</div>
        <p className="text-xs text-muted-foreground">
          This calls <span className="mono">POST /projects/{`{id}`}/branches/{`{id}`}/restore</span>. Availability and retention depend on your plan and branch settings.
        </p>
        <div className="space-y-1.5 max-w-full sm:max-w-xs">
          <Label>Restore to (local time)</Label>
          <Input type="datetime-local" value={ts} onChange={e => setTs(e.target.value)} className="w-full max-w-full min-w-0" />
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive"><Database className="size-4 mr-2" />Restore branch</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore "{branch?.name}" to {new Date(ts).toLocaleString()}?</AlertDialogTitle>
              <AlertDialogDescription>The current state will be preserved under a backup branch. This action is real and cannot be undone in-place.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => restorePit.mutate()} disabled={restorePit.isPending}>{restorePit.isPending ? "Submitting…" : "Restore"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {err && <ErrorState error={err} />}
      </div>
      <div className="mt-4">
        <EmptyState title="No fabricated restore points shown" description="NeonPocket does not render mock backup history. Use the operations timeline in Monitoring to follow restore progress." />
      </div>
    </Page>
  );
}
