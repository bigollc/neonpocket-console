import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { NAV } from "@/layout/nav";
import { useApp } from "@/state/AppContext";
import { Lock, LogOut, Moon, Sun } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut, settings, updateSettings, forgetStoredKey, selectedOrganizationId, selectedProjectId, selectedBranchId, resetPlatformContext, playUiSound } = useApp();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const visibleNav = NAV.filter(n => {
    if (n.requires === "organization") return !!selectedOrganizationId;
    if (n.requires === "project") return !!selectedOrganizationId && !!selectedProjectId;
    if (n.requires === "branch") return !!selectedOrganizationId && !!selectedProjectId && !!selectedBranchId;
    return true;
  });

  const go = (to: string) => {
    if (to === "/dashboard") resetPlatformContext();
    playUiSound("nav");
    setOpen(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search the console…  (⌘K)" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {visibleNav.map(n => (
            <CommandItem key={n.to} value={n.label} onSelect={() => go(n.to)}>
              <n.icon className="size-3.5 mr-2 opacity-70" />{n.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" }); setOpen(false); }}>
            {settings.theme === "dark" ? <Sun className="size-3.5 mr-2" /> : <Moon className="size-3.5 mr-2" />} Toggle theme
          </CommandItem>
          <CommandItem onSelect={async () => { await forgetStoredKey(); signOut(); setOpen(false); navigate("/connect"); }}>
            <Lock className="size-3.5 mr-2" /> Forget local key
          </CommandItem>
          <CommandItem onSelect={() => { signOut(); setOpen(false); navigate("/connect"); }}>
            <LogOut className="size-3.5 mr-2" /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
