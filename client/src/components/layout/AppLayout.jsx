import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  return (
    <div
      className={`min-h-screen ${isHomePage ? "bg-[#f7f9fb]" : "bg-slate-50"} text-slate-900`}
    >
      <Navbar />
      {isHomePage ? (
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      ) : (
        <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      )}
    </div>
  );
}
