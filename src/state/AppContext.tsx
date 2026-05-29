import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ApiMode } from "@/lib/neon/client";
import { onDiagnostic, type DiagnosticEntry } from "@/lib/neon/client";
import { hasVault, forgetKey } from "@/lib/vault";

type Theme = "system" | "light" | "dark";
type Motion = "full" | "reduced";

interface Settings {
  theme: Theme;
  motion: Motion;
  sounds: boolean;
  apiMode: ApiMode;
  localHistory: boolean;
}

interface AppState {
  apiKey: string | null;
  setApiKey: (k: string | null) => void;
  signOut: () => void;
  hasStoredVault: boolean;
  refreshVaultState: () => Promise<void>;
  forgetStoredKey: () => Promise<void>;

  selectedOrganizationId: string | null;
  setSelectedOrganizationId: (id: string | null) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  selectedDatabase: string | null;
  setSelectedDatabase: (n: string | null) => void;

  settings: Settings;
  updateSettings: (s: Partial<Settings>) => void;

  diagnostics: DiagnosticEntry[];
  clearDiagnostics: () => void;
  clearLocalCache: () => void;
}

const SETTINGS_KEY = "neonpocket.settings.v1";
const SELECT_KEY = "neonpocket.select.v1";

const defaultSettings: Settings = {
  theme: "system", motion: "full", sounds: false, apiMode: "auto", localHistory: false,
};

const Ctx = createContext<AppState | null>(null);

function loadSettings(): Settings {
  try {
    const loaded = { ...defaultSettings, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")) };
    const apiMode = ["auto", "direct", "proxy"].includes(loaded.apiMode) ? loaded.apiMode : "auto";
    return { ...loaded, apiMode };
  } catch {
    return defaultSettings;
  }
}
function loadSelect() {
  try { return JSON.parse(localStorage.getItem(SELECT_KEY) || "{}"); } catch { return {}; }
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [hasStoredVault, setHasStoredVault] = useState(false);
  const sel = loadSelect();
  const [selectedOrganizationIdState, setSelectedOrganizationIdState] = useState<string | null>(sel.organizationId ?? null);
  const [selectedProjectIdState, setSelectedProjectIdState] = useState<string | null>(sel.projectId ?? null);
  const [selectedBranchIdState, setSelectedBranchIdState] = useState<string | null>(sel.branchId ?? null);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(sel.database ?? null);
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const selectedOrganizationId = selectedOrganizationIdState;
  const selectedProjectId = selectedProjectIdState;
  const selectedBranchId = selectedBranchIdState;
  // Theme
  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const h = () => applyTheme("system");
      mq.addEventListener("change", h);
      return () => mq.removeEventListener("change", h);
    }
  }, [settings.theme]);

  // Persist settings & selection
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    localStorage.setItem(SELECT_KEY, JSON.stringify({ organizationId: selectedOrganizationId, projectId: selectedProjectId, branchId: selectedBranchId, database: selectedDatabase }));
  }, [selectedOrganizationId, selectedProjectId, selectedBranchId, selectedDatabase]);

  // Diagnostics ring buffer
  useEffect(() => {
    const push = (e: DiagnosticEntry) => setDiagnostics(d => [e, ...d].slice(0, 100));
    const off = onDiagnostic(push);
    const onError = (event: ErrorEvent) => push({
      ts: new Date().toISOString(),
      route: event.filename || "window error",
      method: "EVENT",
      status: 0,
      ms: 0,
      ok: false,
      errorMessage: event.message,
    });
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      push({
        ts: new Date().toISOString(),
        route: "unhandled promise rejection",
        method: "EVENT",
        status: 0,
        ms: 0,
        ok: false,
        errorMessage: reason?.message || String(reason || "Unknown rejection"),
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      off();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  // Vault presence
  const refreshVaultState = useCallback(async () => { setHasStoredVault(await hasVault()); }, []);
  useEffect(() => { refreshVaultState(); }, [refreshVaultState]);

  const setSelectedOrganizationId = useCallback((id: string | null) => {
    setSelectedOrganizationIdState(id);
    setSelectedProjectIdState(null);
    setSelectedBranchIdState(null);
    setSelectedDatabase(null);
  }, []);
  const setSelectedProjectId = useCallback((id: string | null) => {
    setSelectedProjectIdState(id);
    setSelectedBranchIdState(null);
    setSelectedDatabase(null);
  }, []);
  const setSelectedBranchId = useCallback((id: string | null) => {
    setSelectedBranchIdState(id);
    setSelectedDatabase(null);
  }, []);

  const setApiKey = useCallback((k: string | null) => setApiKeyState(k), []);
  const signOut = useCallback(() => {
    setApiKeyState(null);
    setSelectedOrganizationIdState(null);
    setSelectedProjectIdState(null); setSelectedBranchIdState(null); setSelectedDatabase(null);
  }, []);
  const forgetStoredKey = useCallback(async () => {
    await forgetKey(); await refreshVaultState();
  }, [refreshVaultState]);

  const updateSettings = useCallback((s: Partial<Settings>) => setSettings(prev => ({ ...prev, ...s })), []);
  const clearDiagnostics = useCallback(() => setDiagnostics([]), []);
  const clearLocalCache = useCallback(() => {
    localStorage.removeItem(SELECT_KEY);
    setDiagnostics([]);
    setSelectedOrganizationIdState(null); setSelectedProjectIdState(null); setSelectedBranchIdState(null); setSelectedDatabase(null);
  }, []);

  const value = useMemo<AppState>(() => ({
    apiKey, setApiKey, signOut,
    hasStoredVault, refreshVaultState, forgetStoredKey,
    selectedOrganizationId, setSelectedOrganizationId,
    selectedProjectId, setSelectedProjectId,
    selectedBranchId, setSelectedBranchId,
    selectedDatabase, setSelectedDatabase,
    settings, updateSettings,
    diagnostics, clearDiagnostics, clearLocalCache,
  }), [apiKey, hasStoredVault, selectedOrganizationId, selectedProjectId, selectedBranchId, selectedDatabase, settings, diagnostics, setApiKey, signOut, refreshVaultState, forgetStoredKey, setSelectedOrganizationId, setSelectedProjectId, setSelectedBranchId, updateSettings, clearDiagnostics, clearLocalCache]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export function useNeonCtx() {
  const { apiKey, settings } = useApp();
  return { apiKey, mode: settings.apiMode };
}
