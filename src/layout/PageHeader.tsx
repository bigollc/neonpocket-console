import { cn } from "@/lib/utils";
import { BetaBadge } from "@/components/ui/beta-badge";

export function PageHeader({ title, description, actions, beta, className }: {
  title: string; description?: React.ReactNode; actions?: React.ReactNode; beta?: boolean; className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 mb-5", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">{title}</h1>
          {beta && <BetaBadge />}
        </div>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-4 py-5 md:px-6 md:py-6 max-w-6xl mx-auto", className)}>{children}</div>;
}
