import { Link } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { Button } from "../ui/Button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          Project Name
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" aria-label="Open menu">
            <Menu size={18} />
          </Button>
          <Button variant="secondary">
            <LogOut size={16} className="mr-2" /> Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
