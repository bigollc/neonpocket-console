import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NormalizedError } from "@/lib/errors";

export function ErrorState({ error, onRetry, title }: { error: NormalizedError | Error; onRetry?: () => void; title?: string }) {
  const e = error as any;
  const status = typeof e?.status === "number" ? e.status : undefined;
  const message = e?.message || "Unknown error";
  const route = e?.route;
  const reqId = e?.requestId;
  return (
    <div className="hairline rounded-lg p-5 bg-card/60">
      <div className="flex items-start gap-3">
        <div className="size-9 grid place-items-center rounded-full bg-destructive/10 text-destructive shrink-0">
          <AlertTriangle className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {title ?? "Request failed"}{status !== undefined ? ` · ${status}` : ""}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5 break-words">{message}</div>
          <div className="text-[11px] text-muted-foreground/80 mono mt-2 break-all">
            {route && <>route: {route}</>}{reqId && <>  ·  request: {reqId}</>}
          </div>
          {status === 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              This is typically a browser network/CORS failure or an unavailable configured proxy. Open Diagnostics to copy the request log.
            </div>
          )}
          {onRetry && (
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="size-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
