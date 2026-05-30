import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader } from "@/layout/PageHeader";
import { useApp } from "@/state/AppContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Cloud, Lock, LogOut, RotateCw, ShieldCheck, Trash2, Volume2 } from "lucide-react";
import { removeVaultPassphrase, vaultUsesPassphrase } from "@/lib/vault";
import { clearDeviceAuth, getDeviceAuthRecord, hasDeviceAuth, setupDeviceAuth, supportsDeviceAuth, verifyDeviceAuth } from "@/lib/deviceAuth";
import { syncCloudProfile, type CloudProfileResult } from "@/lib/cloudProfile";
import { normalizeUser, useCurrentUserQuery, userEmail } from "@/state/queries";

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

const CLOUD_SYNC_STATUS_KEY = "neonpocket.cloud-profile.last-sync.v1";

type CloudSyncStatus = CloudProfileResult & { at: string };

function readCloudSyncStatus(): CloudSyncStatus | null {
  try {
    const raw = localStorage.getItem(CLOUD_SYNC_STATUS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function userNameFromPayload(user: any, email: string) {
  return user?.name || user?.login || email || "Neon user";
}

export default function Settings() {
  const { apiKey, settings, updateSettings, signOut, forgetStoredKey, hasStoredVault, diagnostics, clearDiagnostics, clearLocalCache, refreshVaultState, playUiSound } = useApp();
  const navigate = useNavigate();
  const currentUser = useCurrentUserQuery();
  const user = normalizeUser(currentUser.data);
  const email = userEmail(user);
  const userName = userNameFromPayload(user, email);
  const lastFailed = diagnostics.find(d => !d.ok);
  const [usesPassphrase, setUsesPassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [removingPassphrase, setRemovingPassphrase] = useState(false);
  const [deviceAuthEnabled, setDeviceAuthEnabled] = useState(false);
  const [deviceAuthBusy, setDeviceAuthBusy] = useState(false);
  const [cloudSyncBusy, setCloudSyncBusy] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus | null>(() => readCloudSyncStatus());

  const cloudSyncLabel = useMemo(() => {
    if (!cloudSyncStatus) return "not synced yet";
    if (cloudSyncStatus.ok && cloudSyncStatus.stored) return `stored · ${cloudSyncStatus.status}`;
    if (cloudSyncStatus.ok && !cloudSyncStatus.stored) return `not stored · ${cloudSyncStatus.reason || cloudSyncStatus.status}`;
    return `failed · ${cloudSyncStatus.status || "network"}`;
  }, [cloudSyncStatus]);

  useEffect(() => {
    vaultUsesPassphrase().then(setUsesPassphrase).catch(() => setUsesPassphrase(false));
  }, [hasStoredVault]);

  useEffect(() => {
    setDeviceAuthEnabled(!!getDeviceAuthRecord());
  }, []);

  async function removePassphrase() {
    setRemovingPassphrase(true);
    try {
      await removeVaultPassphrase(passphrase);
      setPassphrase("");
      setUsesPassphrase(false);
      await refreshVaultState();
      playUiSound("success");
      toast.success("Passphrase removed", { description: "The stored key now unlocks with this device only." });
    } catch (error: any) {
      playUiSound("warning");
      toast.error("Could not remove passphrase", { description: error?.message || "Unknown error" });
    } finally {
      setRemovingPassphrase(false);
    }
  }

  async function enableDeviceAuth() {
    setDeviceAuthBusy(true);
    try {
      await setupDeviceAuth();
      setDeviceAuthEnabled(true);
      playUiSound("success");
      toast.success("Device authentication enabled", { description: "Unlocking a stored key can now require Face ID, Touch ID, or platform authentication." });
    } catch (error: any) {
      playUiSound("warning");
      toast.error("Could not set up device authentication", { description: error?.message || "Unknown error" });
    } finally {
      setDeviceAuthBusy(false);
    }
  }

  async function testDeviceAuth() {
    setDeviceAuthBusy(true);
    try {
      await verifyDeviceAuth();
      playUiSound("success");
      toast.success("Device authentication verified");
    } catch (error: any) {
      playUiSound("warning");
      toast.error("Device authentication failed", { description: error?.message || "Unknown error" });
    } finally {
      setDeviceAuthBusy(false);
    }
  }

  function disableDeviceAuth() {
    clearDeviceAuth();
    setDeviceAuthEnabled(false);
    playUiSound("warning");
    toast.success("Device authentication disabled");
  }

  async function runCloudProfileSync(source: "manual" | "toggle" = "manual") {
    if (!apiKey) {
      playUiSound("warning");
      toast.error("Connect your Neon API key first", { description: "Cloud profile sync needs a verified in-memory key for this session." });
      return;
    }

    setCloudSyncBusy(true);
    try {
      const result = await syncCloudProfile({
        apiKey,
        userName,
        email,
        deviceAuthEnabled: hasDeviceAuth(),
        settings: {
          greetings: settings.greetings,
          sounds: settings.sounds,
          apiMode: settings.apiMode,
          localHistory: settings.localHistory,
        },
      });
      const status = { ...result, at: new Date().toISOString() };
      setCloudSyncStatus(status);
      localStorage.setItem(CLOUD_SYNC_STATUS_KEY, JSON.stringify(status));

      if (result.ok && result.stored) {
        playUiSound("success");
        toast.success("Cloud profile synced", { description: "D1 stored the profile/audit metadata successfully." });
      } else if (result.ok && !result.stored) {
        playUiSound("warning");
        toast.warning("Cloud profile endpoint responded", { description: result.reason || "D1 binding is not storing records yet." });
      } else {
        playUiSound("warning");
        toast.error("Cloud profile sync failed", { description: result.message || result.reason || `Status ${result.status}` });
      }
    } catch (error: any) {
      playUiSound("warning");
      toast.error(source === "toggle" ? "Cloud sync could not start" : "Cloud profile sync failed", { description: error?.message || "Unknown error" });
    } finally {
      setCloudSyncBusy(false);
    }
  }

  function toggleCloudProfileSync(enabled: boolean) {
    updateSettings({ cloudProfileSync: enabled });
    if (enabled) {
      setTimeout(() => void runCloudProfileSync("toggle"), 0);
    }
  }

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
        <Row title="Interface sounds" desc="Minimal Web Audio feedback for taps, navigation, inputs, and confirmations.">
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => playUiSound("enabled")} disabled={!settings.sounds} aria-label="Test sound">
              <Volume2 className="size-4" />
            </Button>
            <Switch checked={settings.sounds} onCheckedChange={v => updateSettings({ sounds: v })} />
          </div>
        </Row>
        <Row title="Greeting cards" desc="Show time-aware dashboard messages such as morning, day, evening, and night greetings.">
          <Switch checked={settings.greetings} onCheckedChange={v => updateSettings({ greetings: v })} />
        </Row>
      </div>

      <div className="hairline rounded-lg p-4 bg-card mt-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Security</div>
        <Row title="Device authentication" desc="Uses your platform authenticator: Face ID on iPhone, Touch ID on Apple devices, or Windows Hello where available.">
          <span className="text-sm mono text-muted-foreground">{deviceAuthEnabled ? "enabled" : "off"}</span>
        </Row>
        <div className="py-3 border-b border-border space-y-2">
          <div className="text-xs text-muted-foreground">
            Device authentication protects local unlocks only. Neon API keys still remain encrypted locally and are never stored in plaintext in the cloud profile database.
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {!deviceAuthEnabled ? (
              <Button size="sm" variant="outline" onClick={enableDeviceAuth} disabled={!supportsDeviceAuth() || deviceAuthBusy}>
                <ShieldCheck className="size-4 mr-1.5" />{deviceAuthBusy ? "Setting up…" : "Set up"}
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={testDeviceAuth} disabled={deviceAuthBusy}>Test</Button>
                <Button size="sm" variant="destructive" onClick={disableDeviceAuth} disabled={deviceAuthBusy}>Disable</Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="hairline rounded-lg p-4 bg-card mt-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">API & Cloud profile</div>
        <Row title="API transport" desc="Auto tries direct browser access first, then falls back to the configured Cloudflare Worker proxy when needed.">
          <Select value={settings.apiMode} onValueChange={(v: any) => updateSettings({ apiMode: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="proxy">Proxy</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row title="Cloud profile sync" desc="Optionally store profile metadata, settings, IP, user agent, and key hash/hint in Cloudflare D1. The Neon API key itself is not stored.">
          <Switch checked={settings.cloudProfileSync} onCheckedChange={toggleCloudProfileSync} />
        </Row>
        <div className="py-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Cloud sync status</div>
              <div className="text-xs text-muted-foreground mt-0.5 break-words">
                {cloudSyncLabel}{cloudSyncStatus?.at ? ` · ${new Date(cloudSyncStatus.at).toLocaleString()}` : ""}
              </div>
              {(cloudSyncStatus?.reason || cloudSyncStatus?.message) && (
                <div className="text-[11px] text-muted-foreground mt-1 break-words mono">
                  {cloudSyncStatus.reason || cloudSyncStatus.message}
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => void runCloudProfileSync("manual")} disabled={!settings.cloudProfileSync || !apiKey || cloudSyncBusy}>
              <RotateCw className={`size-4 mr-1.5 ${cloudSyncBusy ? "animate-spin" : ""}`} /> Sync now
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Cloud className="size-3.5 mt-0.5 shrink-0" />
            <span>Turning sync on now runs a live check. If D1 is not bound or the deploy still uses a placeholder database id, this status panel will show it.</span>
          </div>
        </div>
        <Row title="Local history (SQL editor)" desc="Save scratch SQL on this device only.">
          <Switch checked={settings.localHistory} onCheckedChange={v => updateSettings({ localHistory: v })} />
        </Row>
      </div>

      <div className="hairline rounded-lg p-4 bg-card mt-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Local vault</div>
        <Row title="Stored key on this device">
          <span className="text-sm mono text-muted-foreground">{hasStoredVault ? (usesPassphrase ? "present · passphrase" : "present · device") : "none"}</span>
        </Row>
        {hasStoredVault && usesPassphrase && (
          <div className="py-3 border-b border-border space-y-2">
            <div>
              <div className="text-sm font-medium">Remove passphrase</div>
              <div className="text-xs text-muted-foreground mt-0.5">Enter the current passphrase once. The key will be re-encrypted for this device without a passphrase.</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="password"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Current passphrase"
                autoComplete="current-password"
              />
              <Button variant="outline" onClick={removePassphrase} disabled={!passphrase || removingPassphrase} className="sm:w-44">
                {removingPassphrase ? "Removing…" : "Remove"}
              </Button>
            </div>
          </div>
        )}
        <Row title="Forget local key" desc="Removes the encrypted Neon API key from this device.">
          <Button variant="outline" size="sm" onClick={async () => { await forgetStoredKey(); setUsesPassphrase(false); playUiSound("warning"); toast.success("Removed"); }} disabled={!hasStoredVault}>
            <Lock className="size-4 mr-1.5" />Forget
          </Button>
        </Row>
        <Row title="Clear local cache" desc="Clears UI preferences cache, selection, and diagnostics.">
          <Button variant="outline" size="sm" onClick={() => { clearLocalCache(); playUiSound("soft"); toast.success("Cleared"); }}>
            <Trash2 className="size-4 mr-1.5" />Clear
          </Button>
        </Row>
        <Row title="Sign out" desc="Clears the in-memory API key.">
          <Button variant="destructive" size="sm" onClick={() => { signOut(); playUiSound("warning"); navigate("/connect"); }}>
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
        <Row title="Network hint" desc="Status 0 usually means direct browser access failed or the configured Cloudflare Worker proxy is unavailable.">
          <span className="text-xs text-muted-foreground">See Diagnostics</span>
        </Row>
        <Row title="Recent requests">
          <Button variant="ghost" size="sm" onClick={() => { clearDiagnostics(); playUiSound("soft"); }}>Clear log</Button>
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
