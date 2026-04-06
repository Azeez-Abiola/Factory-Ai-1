import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppLayout from "./components/app/AppLayout.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Alerts from "./pages/Alerts.tsx";
import Cameras from "./pages/Cameras.tsx";
import Reports from "./pages/Reports.tsx";
import ShiftReports from "./pages/ShiftReports.tsx";
import Insights from "./pages/Insights.tsx";
import InsightDetail from "./pages/InsightDetail.tsx";
import Maintenance from "./pages/Maintenance.tsx";
import MaintenanceDetail from "./pages/MaintenanceDetail.tsx";
import Help from "./pages/Help.tsx";
import ReportDetail from "./pages/ReportDetail.tsx";
import AdminLayout from "./components/admin/AdminLayout.tsx";
import Tenants from "./pages/admin/Tenants.tsx";
import UserManagement from "./pages/admin/UserManagement.tsx";
import SystemMonitoring from "./pages/admin/SystemMonitoring.tsx";
import Billing from "./pages/admin/Billing.tsx";
import AuditLog from "./pages/admin/AuditLog.tsx";
import Onboarding from "./pages/admin/Onboarding.tsx";
import Settings from "./pages/admin/Settings.tsx";
import KpiConfig from "./pages/admin/KpiConfig.tsx";
import TenantDetail from "./pages/admin/TenantDetail.tsx";
import AuditDetail from "./pages/admin/AuditDetail.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="cameras" element={<Cameras />} />
            <Route path="reports" element={<Reports />} />
            <Route path="reports/:reportId" element={<ReportDetail />} />
            <Route path="shift-reports" element={<ShiftReports />} />
            <Route path="insights" element={<Insights />} />
            <Route path="insights/:insightId" element={<InsightDetail />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="maintenance/:alertId" element={<MaintenanceDetail />} />
            <Route path="help" element={<Help />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Tenants />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="system" element={<SystemMonitoring />} />
            <Route path="billing" element={<Billing />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="settings" element={<Settings />} />
            <Route path="kpi-config" element={<KpiConfig />} />
            <Route path="tenants/:tenantId" element={<TenantDetail />} />
            <Route path="audit-log/:auditId" element={<AuditDetail />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
