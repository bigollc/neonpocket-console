import { cn } from "@/lib/utils";
export function BetaBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
      "bg-beta/15 text-beta border border-beta/30", className)}>
      Beta
    </span>
  );
}
