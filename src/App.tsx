import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PermissionRoute from "@/components/auth/PermissionRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import InviteAccept from "./pages/InviteAccept.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppLayout from "./components/app/AppLayout.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Alerts from "./pages/Alerts.tsx";
import Investigations from "./pages/Investigations.tsx";
import Cameras from "./pages/Cameras.tsx";
import FloorPlan from "./pages/FloorPlan.tsx";
import Reports from "./pages/Reports.tsx";
import ShiftReports from "./pages/ShiftReports.tsx";
import Insights from "./pages/Insights.tsx";
import InsightDetail from "./pages/InsightDetail.tsx";
import Maintenance from "./pages/Maintenance.tsx";
import MaintenanceDetail from "./pages/MaintenanceDetail.tsx";
import Help from "./pages/Help.tsx";
import Quality from "./pages/Quality.tsx";
import ReportDetail from "./pages/ReportDetail.tsx";
import AdminLayout from "./components/admin/AdminLayout.tsx";
import Tenants from "./pages/admin/Tenants.tsx";
import UserManagement from "./pages/admin/UserManagement.tsx";
import SystemMonitoring from "./pages/admin/SystemMonitoring.tsx";
import Billing from "./pages/admin/Billing.tsx";
import AuditLog from "./pages/admin/AuditLog.tsx";
import Settings from "./pages/admin/Settings.tsx";
import KpiConfig from "./pages/admin/KpiConfig.tsx";
import TenantDetail from "./pages/admin/TenantDetail.tsx";
import AuditDetail from "./pages/admin/AuditDetail.tsx";
import CameraConfig from "./pages/admin/CameraConfig.tsx";
import RulesPolicy from "./pages/admin/RulesPolicy.tsx";
import EscalationPolicies from "./pages/admin/EscalationPolicies.tsx";
import NotificationSettings from "./pages/admin/NotificationSettings.tsx";
import AIConfig from "./pages/admin/AIConfig.tsx";
import QualityDataset from "./pages/admin/QualityDataset.tsx";
import AIBudget from "./pages/admin/AIBudget.tsx";
import SiteOverview from "./pages/admin/SiteOverview.tsx";
import SiteRequests from "./pages/admin/SiteRequests.tsx";
import PortalLayout from "./components/portal/PortalLayout.tsx";
import PortalOverview from "./pages/portal/PortalOverview.tsx";
import PortalAlerts from "./pages/portal/PortalAlerts.tsx";
import PortalBudget from "./pages/portal/PortalBudget.tsx";
import PortalSiteRequests from "./pages/portal/PortalSiteRequests.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/invite/:token" element={<InviteAccept />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PermissionRoute permission="dashboard.view"><Dashboard /></PermissionRoute>} />
              <Route path="alerts" element={<PermissionRoute permission="alerts.view"><Alerts /></PermissionRoute>} />
              <Route path="investigations" element={<PermissionRoute permission="investigations.view"><Investigations /></PermissionRoute>} />
              <Route path="incidents" element={<Navigate to="/app/investigations" replace />} />
              <Route path="cameras" element={<PermissionRoute permission="cameras.view"><Cameras /></PermissionRoute>} />
              <Route path="floor-plan" element={<PermissionRoute permission="floor_plan.view"><FloorPlan /></PermissionRoute>} />
              <Route path="quality" element={<PermissionRoute permission="quality.view"><Quality /></PermissionRoute>} />

              <Route path="reports" element={<PermissionRoute permission="reports.view"><Reports /></PermissionRoute>} />
              <Route path="reports/:reportId" element={<PermissionRoute permission="reports.view"><ReportDetail /></PermissionRoute>} />
              <Route path="shift-reports" element={<PermissionRoute permission="shift.view"><ShiftReports /></PermissionRoute>} />
              <Route path="insights" element={<PermissionRoute permission="insights.view"><Insights /></PermissionRoute>} />
              <Route path="insights/:insightId" element={<PermissionRoute permission="insights.view"><InsightDetail /></PermissionRoute>} />
              <Route path="maintenance" element={<PermissionRoute permission="maintenance.view"><Maintenance /></PermissionRoute>} />
              <Route path="maintenance/:alertId" element={<PermissionRoute permission="maintenance.view"><MaintenanceDetail /></PermissionRoute>} />
              <Route path="help" element={<Help />} />
            </Route>
            <Route
              path="/portal"
              element={
                <ProtectedRoute>
                  <PortalLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PortalOverview />} />
              <Route path="alerts" element={<PortalAlerts />} />
              <Route path="budget" element={<PortalBudget />} />
              <Route path="requests" element={<PortalSiteRequests />} />
            </Route>
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireRoles={["super_admin", "tenant_admin"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PermissionRoute permission="admin_sites.manage"><Tenants /></PermissionRoute>} />
              <Route path="users" element={<PermissionRoute permission="users.manage"><UserManagement /></PermissionRoute>} />
              <Route path="system" element={<ProtectedRoute requireRoles={["super_admin"]}><SystemMonitoring /></ProtectedRoute>} />
              <Route path="billing" element={<ProtectedRoute requireRoles={["super_admin"]}><Billing /></ProtectedRoute>} />
              <Route path="audit-log" element={<PermissionRoute permission="audit.view"><AuditLog /></PermissionRoute>} />
              <Route path="onboarding" element={<Navigate to="/admin" replace />} />
              <Route path="settings" element={<PermissionRoute permission="settings.manage"><Settings /></PermissionRoute>} />
              <Route path="kpi-config" element={<PermissionRoute permission="kpis.manage"><KpiConfig /></PermissionRoute>} />
              <Route path="ai-budget/:tenantId?" element={<PermissionRoute permission="budget.manage"><AIBudget /></PermissionRoute>} />
              <Route path="sites" element={<PermissionRoute permission="admin_sites.manage"><SiteOverview /></PermissionRoute>} />
              <Route path="site-requests" element={<PermissionRoute permission="admin_sites.manage"><SiteRequests /></PermissionRoute>} />
              <Route path="tenants/:tenantId" element={<PermissionRoute permission="admin_sites.manage"><TenantDetail /></PermissionRoute>} />
              <Route path="audit-log/:auditId" element={<PermissionRoute permission="audit.view"><AuditDetail /></PermissionRoute>} />
              <Route path="cameras" element={<PermissionRoute permission="admin_ai.manage"><CameraConfig /></PermissionRoute>} />
              <Route path="rules" element={<PermissionRoute permission="rules.manage"><RulesPolicy /></PermissionRoute>} />
              <Route path="escalation" element={<PermissionRoute permission="escalation.manage"><EscalationPolicies /></PermissionRoute>} />
              <Route path="notifications" element={<PermissionRoute permission="notifications.manage"><NotificationSettings /></PermissionRoute>} />
              <Route path="ai-config" element={<PermissionRoute permission="admin_ai.manage"><AIConfig /></PermissionRoute>} />
              <Route path="quality-dataset" element={<PermissionRoute permission="admin_ai.manage"><QualityDataset /></PermissionRoute>} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
