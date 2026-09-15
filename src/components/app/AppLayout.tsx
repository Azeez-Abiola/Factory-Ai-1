import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import ShiftStatusBanner from "./ShiftStatusBanner";
import { useTenantPermissions } from "@/hooks/useTenantPermissions";

const AppLayout = () => {
  const { can } = useTenantPermissions();
  return (
    <div className="flex min-h-screen bg-background relative">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto w-full max-w-[1680px]">
            {can("shift.view") && <ShiftStatusBanner />}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
