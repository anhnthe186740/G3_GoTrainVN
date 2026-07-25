import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { ProfileCompletionBanner } from "./ProfileCompletionBanner";
import { useAuth } from "../../hooks/useAuth";
import { ChatbotWidget } from "../ui/ChatbotWidget";
import { ContactModal } from "../ui/ContactModal";
import { BookingGuideModal } from "../ui/BookingGuideModal";
import { LanguageProvider } from "../../context/LanguageContext";

export function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    const handleOpenContact = () => setIsContactOpen(true);
    const handleOpenGuide = () => setIsGuideOpen(true);

    window.addEventListener("open-contact-modal", handleOpenContact);
    window.addEventListener("open-booking-guide-modal", handleOpenGuide);

    return () => {
      window.removeEventListener("open-contact-modal", handleOpenContact);
      window.removeEventListener("open-booking-guide-modal", handleOpenGuide);
    };
  }, []);

  const isHomePage = location.pathname === "/";
  const isFullPage =
    location.pathname === "/wallet" || location.pathname === "/dashboard";
  const isAdminDashboard =
    location.pathname === "/dashboard" && user?.role === "ADMIN";
  const isStaffDashboard =
    location.pathname === "/dashboard" && user?.role === "STAFF";

  const layoutContent = (() => {
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
        <div className="pt-[64px]">
          <ProfileCompletionBanner />
        </div>
        {isHomePage ? (
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        ) : isFullPage ? (
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        ) : (
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        )}
        <ChatbotWidget />
        <ContactModal
          isOpen={isContactOpen}
          onClose={() => setIsContactOpen(false)}
        />
        <BookingGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
        />
      </div>
    );
  })();

  return layoutContent;
}
