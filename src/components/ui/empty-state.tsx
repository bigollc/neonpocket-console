import { type LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  tone = "neutral",
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  tone?: "neutral" | "warn" | "error" | "info";
}) {
  return (
    <div className={cn("hairline rounded-lg p-8 text-center bg-card/60", className)}>
      <div className={cn(
        "mx-auto mb-4 grid size-10 place-items-center rounded-full",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "warn" && "bg-warning/10 text-warning",
        tone === "error" && "bg-destructive/10 text-destructive",
        tone === "info" && "bg-primary/10 text-primary",
      )}>
        <Icon className="size-5" />
      </div>
      <div className="font-medium">{title}</div>
      {description && <div className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">{description}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
