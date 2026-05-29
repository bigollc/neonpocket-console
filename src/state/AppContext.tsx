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
  theme: "system", motion: "full", sounds: false, apiMode: "direct", localHistory: false,
};

const Ctx = createContext<AppState | null>(null);

function loadSettings(): Settings {
  try { return { ...defaultSettings, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")) }; } catch { return defaultSettings; }
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(sel.projectId ?? null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(sel.branchId ?? null);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(sel.database ?? null);
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);

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
    localStorage.setItem(SELECT_KEY, JSON.stringify({ projectId: selectedProjectId, branchId: selectedBranchId, database: selectedDatabase }));
  }, [selectedProjectId, selectedBranchId, selectedDatabase]);

  // Diagnostics ring buffer
  useEffect(() => { const off = onDiagnostic(e => setDiagnostics(d => [e, ...d].slice(0, 100))); return () => { off(); }; }, []);

  // Vault presence
  const refreshVaultState = useCallback(async () => { setHasStoredVault(await hasVault()); }, []);
  useEffect(() => { refreshVaultState(); }, [refreshVaultState]);

  const setApiKey = useCallback((k: string | null) => setApiKeyState(k), []);
  const signOut = useCallback(() => {
    setApiKeyState(null);
    setSelectedProjectId(null); setSelectedBranchId(null); setSelectedDatabase(null);
  }, []);
  const forgetStoredKey = useCallback(async () => {
    await forgetKey(); await refreshVaultState();
  }, [refreshVaultState]);

  const updateSettings = useCallback((s: Partial<Settings>) => setSettings(prev => ({ ...prev, ...s })), []);
  const clearDiagnostics = useCallback(() => setDiagnostics([]), []);
  const clearLocalCache = useCallback(() => {
    localStorage.removeItem(SELECT_KEY);
    setDiagnostics([]);
    setSelectedProjectId(null); setSelectedBranchId(null); setSelectedDatabase(null);
  }, []);

  const value = useMemo<AppState>(() => ({
    apiKey, setApiKey, signOut,
    hasStoredVault, refreshVaultState, forgetStoredKey,
    selectedProjectId, setSelectedProjectId,
    selectedBranchId, setSelectedBranchId,
    selectedDatabase, setSelectedDatabase,
    settings, updateSettings,
    diagnostics, clearDiagnostics, clearLocalCache,
  }), [apiKey, hasStoredVault, selectedProjectId, selectedBranchId, selectedDatabase, settings, diagnostics, setApiKey, signOut, refreshVaultState, forgetStoredKey, updateSettings, clearDiagnostics, clearLocalCache]);

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
