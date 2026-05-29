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
  const { selectedOrganizationId, selectedProjectId, selectedBranchId } = useApp();
  const groups = [
    { key: "account", title: "Account" },
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
              <NavLink key={n.to} to={n.to} onClick={onNavigate}
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

export function Shell() {
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const navigate = useNavigate();
  const { settings, selectedOrganizationId, selectedProjectId, selectedBranchId } = useApp();
  const currentUser = useCurrentUserQuery();
  const user = normalizeUser(currentUser.data);
  const displayName = user?.name || userEmail(user) || "Neon user";
  const displayEmail = userEmail(user);
  const variants = settings.motion === "reduced"
    ? { initial: {}, animate: {}, exit: {} }
    : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex-col">
        <div className="h-14 flex items-center gap-2 px-3 border-b border-sidebar-border">
          <Logo />
          <div className="leading-tight">
            <div className="text-sm font-semibold">NeonPocket</div>
            <div className="text-[10px] text-muted-foreground">Console</div>
          </div>
        </div>
        <div className="p-3 overflow-y-auto flex-1">
          <Sections />
        </div>
        <div className="p-3 border-t border-sidebar-border text-[11px] text-muted-foreground space-y-3">
          <div className="flex items-center gap-2 min-w-0">
            <UserCircle className="size-7 shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-sidebar-foreground text-xs font-medium">{displayName}</div>
              {displayEmail && <div className="truncate">{displayEmail}</div>}
            </div>
          </div>
          <div><kbd className="px-1.5 py-0.5 rounded border border-border bg-background mono">⌘K</kbd> command palette</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky top bar */}
        <header className="sticky top-0 z-30 glass border-b border-border h-14 flex items-center gap-2 px-3">
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
                <div className="p-3 overflow-y-auto"><Sections onNavigate={() => setDrawer(false)} /></div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex-1 min-w-0">
            <ProjectBranchSwitcher />
          </div>
          <Button variant="outline" size="icon" className="size-9" onClick={() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
          }} aria-label="Command palette">
            <CommandIcon className="size-4" />
          </Button>
        </header>

        <main className="flex-1 min-w-0 pb-20 md:pb-6">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.18 }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom mobile nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-border safe-pb">
          <div className="grid grid-cols-5">
            {MOBILE_PRIMARY.map(to => {
              const item = NAV.find(n => n.to === to)!;
              if (item.requires === "organization" && !selectedOrganizationId) return null;
              if (item.requires === "project" && (!selectedOrganizationId || !selectedProjectId)) return null;
              if (item.requires === "branch" && (!selectedOrganizationId || !selectedProjectId || !selectedBranchId)) return null;
              const active = location.pathname.startsWith(to);
              return (
                <button key={to} onClick={() => navigate(to)} className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px]",
                  active ? "text-foreground" : "text-muted-foreground"
                )}>
                  <item.icon className="size-5" />
                  <span className="truncate max-w-[60px]">{item.label}</span>
                  {active && <span className="absolute -bottom-[1px] block h-0.5 w-8 rounded-full bg-foreground" />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <CommandPalette />
    </div>
  );
}
