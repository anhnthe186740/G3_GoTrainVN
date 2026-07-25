import { Link, NavLink, useNavigate } from "react-router-dom";
import { Train, LogOut, User, Wallet } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { toast } from "sonner";
import { useLanguage } from "../../context/LanguageContext";

export function Navbar() {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();
  const { language, changeLanguage, t } = useLanguage();

  const loyaltyPoints = user?.loyaltyPoints || 0;
  const membershipRank = (() => {
    if (user?.role === "ADMIN") return t("member_admin");
    if (user?.role === "STAFF") return t("member_staff");
    if (loyaltyPoints >= 2000) return t("member_diamond");
    if (loyaltyPoints >= 500) return t("member_gold");
    if (loyaltyPoints >= 100) return t("member_silver");
    return t("member_bronze");
  })();

  const handleLogout = () => {
    clearAuth();
    toast.success(
      language === "vi" ? "Đăng xuất thành công!" : "Logged out successfully!",
    );
    navigate("/");
  };

  const navLinks = [
    { to: "/", label: t("nav_home") },
    { to: "/tra-cuu-ve", label: t("nav_lookup") },
    { to: "/promotions", label: t("nav_promotions") },
    { to: "/quy-dinh", label: t("nav_regulations") },
  ];

  const userNavLinks = user
    ? [
        {
          to: "/dashboard",
          label: user.role === "ADMIN" ? t("nav_admin") : t("nav_my_tickets"),
        },
        { to: "/wallet", label: t("nav_wallet") },
      ]
    : [];

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md shadow-[0px_10px_30px_rgba(0,163,255,0.08)] border-b border-slate-200/80">
      <div className="flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3.5 max-w-7xl mx-auto">
        {/* Logo */}
        <Link
          to="/"
          className="text-2xl font-bold text-primary select-none flex items-center gap-2 tracking-wide font-display-lg shrink-0"
        >
          <Train className="h-7 w-7 text-primary" />
          <span>GoTrain VN</span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden lg:flex items-center gap-5">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `font-label-md text-sm transition-colors duration-300 pb-1 ${
                  isActive
                    ? "text-primary font-bold border-b-2 border-primary"
                    : "text-slate-600 font-medium hover:text-primary"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          {userNavLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `font-label-md text-sm transition-colors duration-300 pb-1 ${
                  isActive
                    ? "text-primary font-bold border-b-2 border-primary"
                    : "text-slate-600 font-medium hover:text-primary"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* Auth profile / actions */}
        <div className="flex items-center gap-3.5 shrink-0">
          {/* Language Switcher */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200/80 shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => {
                if (language !== "vi") {
                  changeLanguage("vi");
                  toast.success("Đã chuyển sang Tiếng Việt!");
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer border-none flex items-center gap-1 shrink-0 ${
                language === "vi"
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-800 bg-transparent"
              }`}
            >
              <span className="text-[13px]">🇻🇳</span>
              <span>VN</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (language !== "en") {
                  changeLanguage("en");
                  toast.success("Switched to English!");
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer border-none flex items-center gap-1 shrink-0 ${
                language === "en"
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-800 bg-transparent"
              }`}
            >
              <span className="text-[13px]">🇬🇧</span>
              <span>EN</span>
            </button>
          </div>

          {user ? (
            <>
              <Link
                to="/profile"
                className="flex items-center gap-2 cursor-pointer group shrink-0"
              >
                <div className="w-9 h-9 rounded-full bg-cyan-50 border-2 border-primary/20 overflow-hidden flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="font-semibold text-xs text-slate-800 group-hover:text-primary transition-colors max-w-[130px] truncate">
                    {user.fullName || user.name || t("guest")}
                  </span>
                  <span className="text-[10px] text-primary uppercase font-bold tracking-tighter">
                    {membershipRank}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-slate-500 hover:text-red-600 transition-colors duration-300 font-semibold text-xs cursor-pointer border-none bg-transparent shrink-0 pl-1"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">{t("nav_logout")}</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/login"
                className="text-xs font-bold text-slate-700 hover:text-primary px-3 py-1.5 transition"
              >
                {t("nav_login")}
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-primary hover:bg-primary/90 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-sm"
              >
                {t("nav_register")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
