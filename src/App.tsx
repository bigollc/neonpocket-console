import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/state/AppContext";
import { Shell } from "@/layout/Shell";
import Connect from "@/pages/Connect";
import Dashboard from "@/pages/Dashboard";
import Branches from "@/pages/Branches";
import Integrations from "@/pages/Integrations";
import Auth from "@/pages/Auth";
import Settings from "@/pages/Settings";
import BranchOverview from "@/pages/BranchOverview";
import Monitoring from "@/pages/Monitoring";
import SqlEditor from "@/pages/SqlEditor";
import Tables from "@/pages/Tables";
import BackupRestore from "@/pages/BackupRestore";
import Masking from "@/pages/Masking";
import DataApi from "@/pages/DataApi";
import Feedback from "@/pages/Feedback";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } },
});

function Protected({ children }: { children: React.ReactNode }) {
  const { apiKey } = useApp();
  const location = useLocation();
  if (!apiKey) return <Navigate to="/connect" replace state={{ from: location }} />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-center" richColors closeButton />
      <BrowserRouter>
        <AppProvider>
          <Routes>
            <Route path="/connect" element={<Connect />} />
            <Route element={<Protected><Shell /></Protected>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="branches" element={<Branches />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="auth" element={<Auth />} />
              <Route path="settings" element={<Settings />} />
              <Route path="branch/overview" element={<BranchOverview />} />
              <Route path="branch/monitoring" element={<Monitoring />} />
              <Route path="branch/sql" element={<SqlEditor />} />
              <Route path="branch/tables" element={<Tables />} />
              <Route path="branch/backup" element={<BackupRestore />} />
              <Route path="branch/masking" element={<Masking />} />
              <Route path="backend/data-api" element={<DataApi />} />
              <Route path="backend/feedback" element={<Feedback />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
