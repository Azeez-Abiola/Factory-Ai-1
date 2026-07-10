import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

const AppLayout = () => {
  return (
    <div className="flex min-h-screen bg-background relative">
      {/* Ambient background: grid + radial glow (matches landing) */}
      <div className="pointer-events-none fixed inset-0 -z-10 grid-bg opacity-[0.35]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,hsl(190_80%_55%/0.06),transparent_60%)]" />

      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
