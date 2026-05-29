import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp, useNeonCtx } from "@/state/AppContext";
import { callNeon } from "@/lib/neon/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { EyeOff, ExternalLink } from "lucide-react";

export default function Masking() {
  const ctx = useNeonCtx();
  const { selectedProjectId, selectedBranchId } = useApp();
  const q = useQuery({
    queryKey: ["anon", selectedProjectId, selectedBranchId],
    enabled: !!ctx.apiKey && !!selectedProjectId && !!selectedBranchId,
    queryFn: ({ signal }) => callNeon(`/projects/${selectedProjectId}/branches/${selectedBranchId}/anonymization`, { ...ctx as any, signal }),
  });
  return (
    <Page>
      <PageHeader title="Data Masking" beta description="Inspect Neon's anonymization configuration for this branch." />
      {!selectedProjectId || !selectedBranchId ? <EmptyState title="Select a project and branch" /> :
        q.isLoading ? <Skeleton className="h-32" /> :
        q.error ? (
          <EmptyState icon={EyeOff} tone="warn" title="Data Masking unavailable for this token"
            description={<>This Beta endpoint returned <span className="mono">{(q.error as any).status} · {(q.error as any).message}</span>. Your plan or token may not have access.</>}
            action={<a className="inline-flex items-center gap-1 text-xs underline" href="https://neon.com/docs/manage/data-masking" target="_blank" rel="noreferrer"><ExternalLink className="size-3" />Docs</a>}
          />
        ) : (
          <div className="hairline rounded-lg p-4 bg-card">
            <pre className="text-[11px] mono whitespace-pre-wrap">{JSON.stringify(q.data, null, 2)}</pre>
          </div>
        )}
    </Page>
  );
}
