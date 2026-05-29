import { cn } from "@/lib/utils";

export function StatusDot({ status, className }: { status?: string; className?: string }) {
  const s = (status || "").toLowerCase();
  const running = s === "running" || s === "scheduling" || s === "init" || s === "starting";
  const failed = s === "failed" || s === "error";
  const finished = s === "finished" || s === "idle" || s === "active";
  const color = failed ? "text-destructive" : running ? "text-warning" : finished ? "text-success" : "text-muted-foreground";
  return (
    <span className={cn("relative inline-block size-2 rounded-full", color, running && "pulse-dot", className)} style={{ backgroundColor: "currentColor" }} aria-label={status} />
  );
}
