import { Link, NavLink, useNavigate } from "react-router-dom";
import { Train, LogOut, User, Wallet } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { toast } from "sonner";

export function Navbar() {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();

  const loyaltyPoints = user?.loyaltyPoints || 0;
  const membershipRank = (() => {
    if (user?.role === "ADMIN") return "Quản trị viên";
    if (user?.role === "STAFF") return "Nhân viên ga";
    if (loyaltyPoints >= 2000) return "Thành viên Kim Cương";
    if (loyaltyPoints >= 500) return "Thành viên Vàng";
    if (loyaltyPoints >= 100) return "Thành viên Bạc";
    return "Thành viên Đồng";
  })();

  const handleLogout = () => {
    clearAuth();
    toast.success("Đăng xuất thành công!");
    navigate("/");
  };

  const navLinks = [
    { to: "/", label: "Trang Chủ" },
    { to: "/schedule", label: "Lịch Trình" },
    { to: "/promotions", label: "Khuyến Mãi" },
    { to: "/tra-cuu-ve", label: "Tra Cứu Vé" },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md shadow-[0px_10px_30px_rgba(0,163,255,0.08)] border-b border-surface-container/50">
      <div className="flex justify-between items-center px-container-margin py-4 max-w-[1200px] mx-auto">
        {/* Logo */}
        <Link
          to="/"
          className="text-[28px] font-bold text-primary select-none flex items-center gap-2 tracking-wide font-display-lg"
        >
          <Train className="h-7 w-7 text-primary" />
          <span>GoTrain VN</span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-lg">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `font-label-md text-sm transition-colors duration-300 pb-1 ${
                  isActive
                    ? "text-primary font-bold border-b-2 border-primary"
                    : "text-on-surface-variant font-medium hover:text-primary"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* Auth profile / actions */}
        <div className="flex items-center gap-md">
          {user ? (
            <>
              {user.role !== "ADMIN" && (
                <Link
                  to="/wallet"
                  className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors px-3 py-2 rounded-xl hover:bg-primary/8"
                  style={{ "--tw-bg-opacity": 1 }}
                >
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">Ví</span>
                </Link>
              )}
              <Link
                to="/profile"
                className="flex items-center gap-sm cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-full bg-secondary-fixed border-2 border-primary/20 overflow-hidden flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
                    {user.fullName || user.name || "Khách"}
                  </span>
                  <span className="text-[10px] text-primary uppercase font-bold tracking-tighter">
                    {membershipRank}
                  </span>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-xs text-on-surface-variant hover:text-red-600 transition-colors duration-300 font-semibold text-sm cursor-pointer"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden md:inline">Đăng xuất</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-primary hover:bg-primary-container px-4 py-2 text-sm font-semibold text-white transition shadow-sm"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
