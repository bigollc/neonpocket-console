import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp } from "@/state/AppContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, LogOut, Trash2 } from "lucide-react";

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-b-0 min-w-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
      </div>
      <div className="min-w-0 max-w-[60%] shrink-0 text-right">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { settings, updateSettings, signOut, forgetStoredKey, hasStoredVault, diagnostics, clearDiagnostics, clearLocalCache } = useApp();
  const navigate = useNavigate();
  const lastFailed = diagnostics.find(d => !d.ok);

  return (
    <Page>
      <PageHeader title="Settings" />
      <div className="hairline rounded-lg p-4 bg-card">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Appearance</div>
        <Row title="Theme">
          <Select value={settings.theme} onValueChange={(v: any) => updateSettings({ theme: v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row title="Motion" desc="Reduces animations across the app.">
          <Select value={settings.motion} onValueChange={(v: any) => updateSettings({ motion: v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="full">Full</SelectItem><SelectItem value="reduced">Reduced</SelectItem></SelectContent>
          </Select>
        </Row>
        <Row title="Interface sounds" desc="Subtle UI sounds (off by default).">
          <Switch checked={settings.sounds} onCheckedChange={v => updateSettings({ sounds: v })} />
        </Row>
      </div>

      <div className="hairline rounded-lg p-4 bg-card mt-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">API</div>
        <Row title="API transport" desc="Auto tries direct browser access, then proxy, then iOS Shortcut Bridge on iPhone/iPad Safari when CORS blocks the browser.">
          <Select value={settings.apiMode} onValueChange={(v: any) => updateSettings({ apiMode: v })}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="proxy">Proxy</SelectItem>
              <SelectItem value="shortcut">Shortcut Bridge</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row title="Local history (SQL editor)" desc="Save scratch SQL on this device only.">
          <Switch checked={settings.localHistory} onCheckedChange={v => updateSettings({ localHistory: v })} />
        </Row>
      </div>

      <div className="hairline rounded-lg p-4 bg-card mt-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Local vault</div>
        <Row title="Stored key on this device">
          <span className="text-sm mono text-muted-foreground">{hasStoredVault ? "present" : "none"}</span>
        </Row>
        <Row title="Forget local key" desc="Removes the encrypted Neon API key from this device.">
          <Button variant="outline" size="sm" onClick={async () => { await forgetStoredKey(); toast.success("Removed"); }} disabled={!hasStoredVault}>
            <Lock className="size-4 mr-1.5" />Forget
          </Button>
        </Row>
        <Row title="Clear local cache" desc="Clears UI preferences cache, selection, and diagnostics.">
          <Button variant="outline" size="sm" onClick={() => { clearLocalCache(); toast.success("Cleared"); }}>
            <Trash2 className="size-4 mr-1.5" />Clear
          </Button>
        </Row>
        <Row title="Sign out" desc="Clears the in-memory API key.">
          <Button variant="destructive" size="sm" onClick={() => { signOut(); navigate("/connect"); }}>
            <LogOut className="size-4 mr-1.5" />Sign out
          </Button>
        </Row>
      </div>

      <div className="hairline rounded-lg p-4 bg-card mt-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Diagnostics</div>
        <Row title="Last API status">
          <span className="block text-sm mono break-words">{diagnostics[0] ? `${diagnostics[0].status} · ${diagnostics[0].route}` : "—"}</span>
        </Row>
        <Row title="Last failed route">
          <span className="block text-sm mono break-words">{lastFailed ? `${lastFailed.status} · ${lastFailed.route}` : "—"}</span>
        </Row>
        <Row title="Network hint" desc="Status 0 typically indicates browser CORS, unavailable proxy, or an unfinished Shortcut Bridge handoff.">
          <span className="text-xs text-muted-foreground">See Diagnostics</span>
        </Row>
        <Row title="Recent requests">
          <Button variant="ghost" size="sm" onClick={clearDiagnostics}>Clear log</Button>
        </Row>
        <div className="mt-2 max-h-56 overflow-auto hairline rounded-md text-[11px] mono">
          {diagnostics.length === 0 ? <div className="p-3 text-muted-foreground">No requests yet.</div> :
            diagnostics.map((d, i) => (
              <div key={i} className={`px-2 py-1 border-b last:border-b-0 border-border flex gap-2 min-w-0 ${d.ok ? "" : "text-destructive"}`}>
                <span className="w-12 shrink-0">{d.status}</span><span className="w-12 shrink-0">{d.ms}ms</span><span className="min-w-0 break-words">{d.route}</span>
              </div>
            ))
          }
        </div>
      </div>
    </Page>
  );
}
