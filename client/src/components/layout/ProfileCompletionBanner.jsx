import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../context/LanguageContext";
import { calculateProfileCompleteness } from "../../utils/profileUtils";
import {
  AlertTriangle,
  ArrowRight,
  X,
  UserCheck,
  ShieldAlert,
} from "lucide-react";

export function ProfileCompletionBanner() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();

  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem("hide_profile_completion_banner") === "true";
  });

  // Calculate profile completeness
  const completeness = calculateProfileCompleteness(user, language);

  // Hide on profile page, or if not customer, or if profile is 100% complete, or if dismissed
  if (
    !user ||
    (user.role && user.role !== "CUSTOMER") ||
    completeness.isComplete ||
    dismissed ||
    location.pathname === "/profile"
  ) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem("hide_profile_completion_banner", "true");
    setDismissed(true);
  };

  const missingLabels = completeness.missingFields
    .map((f) => f.label)
    .join(", ");

  return (
    <div className="relative z-30 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-md transition-all duration-300">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Main Info */}
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <ShieldAlert className="h-5 w-5 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm sm:text-base">
                  {language === "vi"
                    ? "Hồ sơ cá nhân chưa hoàn thiện"
                    : "Your profile is incomplete"}
                </span>
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold tracking-wide text-white backdrop-blur-sm">
                  {completeness.percentage}%
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-100 mt-0.5 max-w-2xl">
                {language === "vi" ? (
                  <>
                    Vui lòng bổ sung{" "}
                    <strong className="text-white underline decoration-amber-300/60 underline-offset-2">
                      {missingLabels}
                    </strong>{" "}
                    để đảm bảo quyền lợi khi đặt vé và nhận hoàn tiền.
                  </>
                ) : (
                  <>
                    Please update{" "}
                    <strong className="text-white underline decoration-amber-300/60 underline-offset-2">
                      {missingLabels}
                    </strong>{" "}
                    for smooth booking & fast refund processing.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action & Close */}
          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0 mt-1 sm:mt-0">
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50 hover:shadow active:scale-95"
            >
              <span>{language === "vi" ? "Cập nhật ngay" : "Update Now"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <button
              onClick={handleDismiss}
              type="button"
              className="rounded-lg p-1.5 text-amber-100 hover:bg-white/10 hover:text-white transition focus:outline-none"
              title={
                language === "vi" ? "Tạm đóng thông báo" : "Dismiss notice"
              }
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
