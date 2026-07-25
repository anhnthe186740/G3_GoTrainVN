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
          {userNavLinks.map((link) => (
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
          {/* Language Switcher */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 shadow-sm">
            <button
              onClick={() => {
                if (language !== "vi") {
                  changeLanguage("vi");
                  toast.success("Đã chuyển sang Tiếng Việt!");
                }
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer border-none flex items-center gap-1 ${
                language === "vi"
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-800 bg-transparent"
              }`}
            >
              <span className="text-[14px]">🇻🇳</span>
              <span>VN</span>
            </button>
            <button
              onClick={() => {
                if (language !== "en") {
                  changeLanguage("en");
                  toast.success("Switched to English!");
                }
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer border-none flex items-center gap-1 ${
                language === "en"
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-800 bg-transparent"
              }`}
            >
              <span className="text-[14px]">🇬🇧</span>
              <span>EN</span>
            </button>
          </div>

          {user ? (
            <>
              <Link
                to="/profile"
                className="flex items-center gap-sm cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-full bg-secondary-fixed border-2 border-primary/20 overflow-hidden flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">
                    {user.fullName || user.name || t("guest")}
                  </span>
                  <span className="text-[10px] text-primary uppercase font-bold tracking-tighter">
                    {membershipRank}
                  </span>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-xs text-on-surface-variant hover:text-red-600 transition-colors duration-300 font-semibold text-sm cursor-pointer border-none bg-transparent"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden md:inline">{t("nav_logout")}</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2"
              >
                {t("nav_login")}
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-primary hover:bg-primary-container px-4 py-2 text-sm font-semibold text-white transition shadow-sm"
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
