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
import Maintenance from "./pages/Maintenance.tsx";
import Help from "./pages/Help.tsx";
import AdminLayout from "./components/admin/AdminLayout.tsx";
import Tenants from "./pages/admin/Tenants.tsx";
import UserManagement from "./pages/admin/UserManagement.tsx";
import SystemMonitoring from "./pages/admin/SystemMonitoring.tsx";
import Billing from "./pages/admin/Billing.tsx";
import AuditLog from "./pages/admin/AuditLog.tsx";
import Onboarding from "./pages/admin/Onboarding.tsx";
import Settings from "./pages/admin/Settings.tsx";

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
            <Route path="shift-reports" element={<ShiftReports />} />
            <Route path="insights" element={<Insights />} />
            <Route path="maintenance" element={<Maintenance />} />
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
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
