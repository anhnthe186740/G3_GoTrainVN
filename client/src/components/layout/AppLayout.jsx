import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { useAuth } from "../../hooks/useAuth";
import { ChatbotWidget } from "../ui/ChatbotWidget";

export function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const isHomePage = location.pathname === "/";
  const isFullPage =
    location.pathname === "/wallet" || location.pathname === "/dashboard";
  const isAdminDashboard =
    location.pathname === "/dashboard" && user?.role === "ADMIN";
  const isStaffDashboard =
    location.pathname === "/dashboard" && user?.role === "STAFF";

  if (isAdminDashboard || isStaffDashboard) {
    return (
      <div className="min-h-screen bg-background text-on-surface font-body-md">
        <Outlet />
        <ChatbotWidget />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isHomePage || isFullPage ? "bg-[#f7f9fb]" : "bg-slate-50"} text-slate-900`}
    >
      <Navbar />
      {isHomePage ? (
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      ) : isFullPage ? (
        <main className="min-w-0 flex-1 pt-[72px]">
          <Outlet />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 pt-[88px]">
          <Outlet />
        </main>
      )}
      <ChatbotWidget />
    </div>
  );
}
