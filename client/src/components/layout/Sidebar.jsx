import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/login", label: "Login" },
  { to: "/register", label: "Register" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <nav className="card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Navigation
        </p>
        <div className="space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
}
