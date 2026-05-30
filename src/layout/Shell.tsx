import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Command as CommandIcon, Menu, UserCircle } from "lucide-react";
import { useState } from "react";
import { NAV, MOBILE_PRIMARY } from "@/layout/nav";
import { Logo } from "@/components/Logo";
import { ProjectBranchSwitcher } from "@/layout/ProjectBranchSwitcher";
import { CommandPalette } from "@/layout/CommandPalette";
import { BetaBadge } from "@/components/ui/beta-badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/AppContext";
import { normalizeUser, useCurrentUserQuery, userEmail } from "@/state/queries";

function Sections({ onNavigate }: { onNavigate?: () => void }) {
  const { selectedOrganizationId, selectedProjectId, selectedBranchId, resetPlatformContext, playUiSound } = useApp();
  const groups = [
    { key: "account", title: "Platform" },
    { key: "project", title: "Project" },
    { key: "branch", title: "Branch" },
    { key: "backend", title: "App Backend" },
  ] as const;
  const visibleItems = NAV.filter(n => {
    if (n.requires === "organization") return !!selectedOrganizationId;
    if (n.requires === "project") return !!selectedOrganizationId && !!selectedProjectId;
    if (n.requires === "branch") return !!selectedOrganizationId && !!selectedProjectId && !!selectedBranchId;
    return true;
  });
  return (
    <nav className="flex flex-col gap-5">
      {groups.map(g => {
        const items = visibleItems.filter(n => n.section === g.key);
        if (!items.length) return null;
        return <div key={g.key}>
          <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</div>
          <div className="flex flex-col gap-0.5">
            {visibleItems.filter(n => n.section === g.key).map(n => (
              <NavLink key={n.to} to={n.to} onClick={() => {
                if (n.to === "/dashboard") resetPlatformContext();
                playUiSound("nav");
                onNavigate?.();
              }}
                className={({ isActive }) => cn(
                  "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="navActive" className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-foreground" />}
                    <n.icon className="size-4 opacity-80" />
                    <span className="truncate">{n.label}</span>
                    {n.beta && <BetaBadge className="ml-auto" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>;
      })}
    </nav>
  );
}

function UserIdentity({ compact = false }: { compact?: boolean }) {
  const currentUser = useCurrentUserQuery();
  const user = normalizeUser(currentUser.data);
  const email = userEmail(user);
  const name = user?.name || email || (currentUser.error ? "API key connected" : "Neon user");

  return (
    <div className={cn(
      "flex items-center gap-2 min-w-0 rounded-lg border bg-card/55",
      compact ? "px-2 py-1.5" : "px-2.5 py-2",
    )}>
      <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
        <UserCircle className="size-5" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-xs font-semibold text-foreground">{name}</div>
        <div className="truncate text-[10px] text-muted-foreground">{email || "Connected Neon account"}</div>
      </div>
    </div>
  );
}

export function Shell() {
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const navigate = useNavigate();
  const { settings, selectedOrganizationId, selectedProjectId, selectedBranchId, resetPlatformContext, playUiSound } = useApp();
  const variants = settings.motion === "reduced"
    ? { initial: {}, animate: {}, exit: {} }
    : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } };

  const mobileItems = MOBILE_PRIMARY
    .map(to => NAV.find(n => n.to === to)!)
    .filter(item => {
      if (item.requires === "organization") return !!selectedOrganizationId;
      if (item.requires === "project") return !!selectedOrganizationId && !!selectedProjectId;
      if (item.requires === "branch") return !!selectedOrganizationId && !!selectedProjectId && !!selectedBranchId;
      return true;
    });

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex-col">
        <div className="h-14 flex items-center gap-2 px-3 border-b border-sidebar-border">
          <Logo />
          <div className="leading-tight">
            <div className="text-sm font-semibold">NeonPocket</div>
            <div className="text-[10px] text-muted-foreground">Console</div>
          </div>
        </div>
        <div className="p-3 border-b border-sidebar-border">
          <UserIdentity />
        </div>
        <div className="p-3 overflow-y-auto flex-1">
          <Sections />
        </div>
        <div className="p-3 border-t border-sidebar-border text-[11px] text-muted-foreground space-y-3">
          <div><kbd className="px-1.5 py-0.5 rounded border border-border bg-background mono">⌘K</kbd> command palette</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky top bar */}
        <header className="sticky top-0 z-30 glass border-b border-border min-h-14 flex items-center gap-2 px-3 py-2">
          <div className="md:hidden">
            <Sheet open={drawer} onOpenChange={setDrawer}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9"><Menu className="size-4" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground">
                <div className="h-14 flex items-center gap-2 px-3 border-b border-sidebar-border">
                  <Logo />
                  <div className="text-sm font-semibold">NeonPocket</div>
                </div>
                <div className="p-3 border-b border-sidebar-border"><UserIdentity /></div>
                <div className="p-3 overflow-y-auto"><Sections onNavigate={() => setDrawer(false)} /></div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex-1 min-w-0">
            <ProjectBranchSwitcher />
          </div>
          <div className="hidden lg:block w-64 min-w-0"><UserIdentity compact /></div>
          <Button variant="outline" size="icon" className="size-9" onClick={() => {
            playUiSound("soft");
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
          }} aria-label="Command palette">
            <CommandIcon className="size-4" />
          </Button>
        </header>

        <main className={cn("flex-1 min-w-0 md:pb-6", settings.mobileBottomNav ? "pb-20" : "pb-6")}>
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.18 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom mobile nav */}
        {settings.mobileBottomNav && (
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-border safe-pb">
            <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${Math.max(1, mobileItems.length)}, minmax(0, 1fr))` }}>
              {mobileItems.map(item => {
                const active = location.pathname.startsWith(item.to);
                return (
                  <button key={item.to} onClick={() => {
                    if (item.to === "/dashboard") resetPlatformContext();
                    playUiSound("nav");
                    navigate(item.to);
                  }} className={cn(
                    "relative flex min-w-0 flex-col items-center justify-center gap-0.5 py-2 text-[10px]",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}>
                    <item.icon className="size-5" />
                    <span className="truncate max-w-full px-1">{item.label}</span>
                    {active && <span className="absolute -bottom-[1px] block h-0.5 w-8 rounded-full bg-foreground" />}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      <CommandPalette />
    </div>
  );
}
