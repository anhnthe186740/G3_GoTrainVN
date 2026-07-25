import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { seatSelectionApi } from "../services/seatSelectionApi";
import {
  clearPendingBooking,
  getPendingBooking,
} from "../services/pendingBooking";
import { toast } from "sonner";
import { CancellationPolicyModal } from "../components/booking/CancellationPolicyModal";
import { useLanguage } from "../context/LanguageContext";
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Shield,
  Save,
  Lock,
  Sparkles,
  ChevronRight,
  Info,
  Ticket,
  History,
  Coins,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { calculateProfileCompleteness } from "../utils/profileUtils";

export function Profile() {
  const { user, setAuth } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();

  // Tabs: 'profile' or 'bookings'
  const [activeTab, setActiveTab] = useState("profile");

  // Loading & full profile states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: "",
    phoneNumber: "",
    email: "",
    nationalId: "",
    nationalIdType: "CCCD",
    address: "",
    dateOfBirth: "",
    gender: "MALE",
    loyaltyPoints: 0,
    walletBalance: 0,
    bankName: "",
    bankAccount: "",
    accountHolder: "",
  });

  // Bookings list state
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [pendingNow, setPendingNow] = useState(Date.now());

  // Cancel Booking modal state
  const [selectedCancelBooking, setSelectedCancelBooking] = useState(null);
  const [policyBooking, setPolicyBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState(
    language === "vi"
      ? "Thay đổi lịch trình cá nhân"
      : "Change of personal plans",
  );
  const [cancelMethod, setCancelMethod] = useState("WALLET");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Load profile details from database
  const fetchProfile = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Get user profile data
      const profileRes = await api.get("/users/profile");
      const u = profileRes.data.user;

      // Fetch wallet balance
      let balance = 0;
      try {
        const walletRes = await api.get("/wallet");
        balance = walletRes.data.balance || 0;
      } catch (wErr) {
        console.log("No wallet or error fetching balance:", wErr);
      }

      setProfileData({
        fullName: u.fullName || "",
        phoneNumber: u.phoneNumber || "",
        email: u.email || "",
        nationalId: u.nationalId || "",
        nationalIdType: u.nationalIdType || "CCCD",
        address: u.address || "",
        dateOfBirth: u.dateOfBirth ? u.dateOfBirth.split("T")[0] : "",
        gender: u.gender || "MALE",
        loyaltyPoints: u.loyaltyPoints || 0,
        walletBalance: balance,
        bankName: u.bankName || "",
        bankAccount: u.bankAccount || "",
        accountHolder: u.accountHolder || "",
      });

      // Update auth store user details to match
      setAuth({
        user: {
          ...user,
          name: u.fullName,
          loyaltyPoints: u.loyaltyPoints || 0,
        },
      });
    } catch (err) {
      console.error("Error loading profile info:", err);
      if (!silent) {
        toast.error(
          language === "vi"
            ? "Không thể tải thông tin hồ sơ cá nhân."
            : "Failed to load profile details.",
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Fetch own bookings
  const fetchBookings = async () => {
    try {
      setBookingsLoading(true);
      const { data } = await api.get("/bookings/my");
      setBookings(data.bookings || []);
    } catch (err) {
      console.error("Error loading booking history:", err);
      toast.error(
        language === "vi"
          ? "Không thể tải lịch sử đặt vé của bạn."
          : "Failed to load booking history.",
      );
    } finally {
      setBookingsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const saved = getPendingBooking();
    if (!saved) return;

    seatSelectionApi
      .getSession(saved.sessionId)
      .then(({ data }) => {
        const session = data.session;
        if (
          session.status !== "ACTIVE" ||
          new Date(session.expiresAt).getTime() <= Date.now()
        ) {
          clearPendingBooking(saved.sessionId);
          return;
        }
        setPendingBooking({ ...saved, session });
        setPendingNow(Date.now());
      })
      .catch(() => clearPendingBooking(saved.sessionId));
  }, []);

  useEffect(() => {
    if (!pendingBooking) return;
    const interval = setInterval(() => {
      const current = Date.now();
      setPendingNow(current);
      if (new Date(pendingBooking.expiresAt).getTime() <= current) {
        clearPendingBooking(pendingBooking.sessionId);
        setPendingBooking(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingBooking]);

  // Fetch bookings when switching tabs
  useEffect(() => {
    if (activeTab === "bookings") {
      fetchBookings();
    }
  }, [activeTab]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Compute profile completeness status
  const profileCompleteness = calculateProfileCompleteness(
    profileData,
    language,
  );

  // Compute membership status and parameters
  const loyaltyPoints = profileData.loyaltyPoints;
  const membership = (() => {
    if (loyaltyPoints >= 2000) {
      return {
        name: language === "vi" ? "Hạng Kim Cương" : "Diamond Rank",
        badgeColor: "from-blue-600 to-indigo-900 text-white",
        iconColor: "text-blue-400",
        nextRankPoints: 0,
        percentageToNext: 100,
        cardBg: "from-slate-900 via-indigo-950 to-slate-900",
        benefits:
          language === "vi"
            ? "Giảm 10% mọi giá vé, ưu tiên chọn toa và phòng chờ thương gia."
            : "10% off all tickets, cabin selection priority & business lounge access.",
      };
    } else if (loyaltyPoints >= 500) {
      return {
        name: language === "vi" ? "Hạng Vàng" : "Gold Rank",
        badgeColor: "from-amber-400 to-amber-600 text-amber-950",
        iconColor: "text-amber-500",
        nextRankPoints: 2000,
        percentageToNext: Math.min(
          100,
          Math.round((loyaltyPoints / 2000) * 100),
        ),
        cardBg: "from-amber-600 via-amber-700 to-amber-900",
        benefits:
          language === "vi"
            ? "Giảm 5% mọi giá vé, miễn phí đổi vé trước 12 tiếng."
            : "5% off all tickets, free ticket exchange 12 hours prior.",
      };
    } else if (loyaltyPoints >= 100) {
      return {
        name: language === "vi" ? "Hạng Bạc" : "Silver Rank",
        badgeColor: "from-slate-300 to-slate-400 text-slate-800",
        iconColor: "text-slate-400",
        nextRankPoints: 500,
        percentageToNext: Math.min(
          100,
          Math.round((loyaltyPoints / 500) * 100),
        ),
        cardBg: "from-slate-600 via-slate-700 to-slate-800",
        benefits:
          language === "vi"
            ? "Ưu tiên đặt vé mùa cao điểm, tích lũy điểm x1.2."
            : "Peak season booking priority, 1.2x points multiplier.",
      };
    } else {
      return {
        name: language === "vi" ? "Hạng Đồng" : "Bronze Rank",
        badgeColor: "from-orange-400 to-amber-700 text-white",
        iconColor: "text-orange-500",
        nextRankPoints: 100,
        percentageToNext: Math.min(
          100,
          Math.round((loyaltyPoints / 100) * 100),
        ),
        cardBg: "from-orange-800 via-stone-800 to-orange-950",
        benefits:
          language === "vi"
            ? "Tích lũy điểm đổi quà, hỗ trợ dịch vụ khẩn cấp."
            : "Accumulate points to redeem gifts, emergency support.",
      };
    }
  })();

  // Compute passenger category and discount preview based on date of birth
  const ageCategory = (() => {
    if (!profileData.dateOfBirth) return null;
    const today = new Date();
    const dob = new Date(profileData.dateOfBirth);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 6) {
      return {
        name:
          language === "vi"
            ? "Trẻ em (Dưới 6 tuổi)"
            : "Child (Under 6 years old)",
        discount:
          language === "vi"
            ? "Miễn phí vé đi kèm người lớn"
            : "Free ticket accompanying an adult",
        badge: language === "vi" ? "Miễn phí vé" : "Free Ticket",
      };
    } else if (age >= 6 && age <= 10) {
      return {
        name:
          language === "vi"
            ? "Trẻ em (Từ 6 - 10 tuổi)"
            : "Child (6 - 10 years old)",
        discount:
          language === "vi"
            ? "Giảm 50% giá vé ghế/giường"
            : "50% off seat/berth ticket price",
        badge: language === "vi" ? "Giảm 50% vé" : "50% Off Ticket",
      };
    } else if (age >= 60) {
      return {
        name:
          language === "vi"
            ? "Người cao tuổi (Từ 60 tuổi)"
            : "Senior (60+ years old)",
        discount:
          language === "vi"
            ? "Giảm 15% giá vé theo luật đường sắt"
            : "15% off ticket price under railway regulations",
        badge: language === "vi" ? "Giảm 15% vé" : "15% Off Ticket",
      };
    } else {
      return {
        name: language === "vi" ? "Người lớn" : "Adult",
        discount:
          language === "vi"
            ? "Tự động áp dụng giảm 20% nếu chọn loại vé Sinh viên khi đặt"
            : "20% discount if Student ticket is selected during booking",
        badge: language === "vi" ? "Giá tiêu chuẩn" : "Standard Price",
      };
    }
  })();

  // Handle Form Submission (Save Profile)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validations
    if (!profileData.fullName.trim()) {
      toast.error(
        language === "vi"
          ? "Vui lòng nhập Họ và tên."
          : "Please enter your full name.",
      );
      return;
    }
    if (!profileData.phoneNumber.trim()) {
      toast.error(
        language === "vi"
          ? "Vui lòng nhập Số điện thoại."
          : "Please enter your phone number.",
      );
      return;
    }
    const phoneRegex = /^[0-9]{9,11}$/;
    if (!phoneRegex.test(profileData.phoneNumber.trim())) {
      toast.error(
        language === "vi"
          ? "Số điện thoại không hợp lệ (9 đến 11 chữ số)."
          : "Invalid phone number (must be 9 to 11 digits).",
      );
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put("/users/profile", {
        fullName: profileData.fullName.trim(),
        phoneNumber: profileData.phoneNumber.trim(),
        nationalId: profileData.nationalId.trim() || null,
        nationalIdType: profileData.nationalIdType,
        address: profileData.address.trim() || null,
        dateOfBirth: profileData.dateOfBirth
          ? new Date(profileData.dateOfBirth).toISOString()
          : null,
        gender: profileData.gender,
        bankName: profileData.bankName.trim() || null,
        bankAccount: profileData.bankAccount.trim() || null,
        accountHolder: profileData.accountHolder.trim() || null,
      });

      // Update local profile state
      setProfileData((prev) => ({
        ...prev,
        fullName: data.user.fullName,
        phoneNumber: data.user.phoneNumber,
        nationalId: data.user.nationalId || "",
        nationalIdType: data.user.nationalIdType || "CCCD",
        address: data.user.address || "",
        dateOfBirth: data.user.dateOfBirth
          ? data.user.dateOfBirth.split("T")[0]
          : "",
        gender: data.user.gender || "MALE",
        loyaltyPoints: data.user.loyaltyPoints || 0,
        bankName: data.user.bankName || "",
        bankAccount: data.user.bankAccount || "",
        accountHolder: data.user.accountHolder || "",
      }));

      // Update authStore to sync local state
      setAuth({
        user: {
          ...user,
          name: data.user.fullName,
          loyaltyPoints: data.user.loyaltyPoints || 0,
        },
      });

      toast.success(
        language === "vi"
          ? "Cập nhật thông tin hồ sơ thành công!"
          : "Profile updated successfully!",
      );
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
          (language === "vi"
            ? "Lỗi khi cập nhật hồ sơ."
            : "Error updating profile."),
      );
    } finally {
      setSaving(false);
    }
  };

  // Calculate refund policy parameters
  const calculateRefundPolicy = (booking) => {
    if (!booking || !booking.schedule) return null;
    const departureTime = new Date(booking.schedule.departureTime);
    const now = new Date();
    const diffMs = departureTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const price = booking.totalAmount || 0;

    if (diffHours < 0) {
      return {
        allowed: false,
        message:
          language === "vi"
            ? "Tàu đã khởi hành. Không thể hoàn/hủy vé."
            : "Train has already departed. Cannot cancel/refund ticket.",
        rate: 0,
        refund: 0,
      };
    } else if (diffHours < 4) {
      return {
        allowed: false,
        message:
          language === "vi"
            ? "Không thể hoàn/hủy vé trực tuyến sát giờ khởi hành (dưới 4 tiếng). Vui lòng ra ga để được hỗ trợ."
            : "Online refund not available within 4 hours of departure. Please go to the station for assistance.",
        rate: 0,
        refund: 0,
      };
    } else if (diffHours >= 4 && diffHours < 24) {
      return {
        allowed: true,
        message:
          language === "vi"
            ? "Hoàn tiền 50% (Hủy từ 4h đến dưới 24h trước giờ tàu chạy)."
            : "50% refund (cancelled between 4h and 24h before departure).",
        rate: 50,
        refund: price * 0.5,
      };
    } else {
      return {
        allowed: true,
        message:
          language === "vi"
            ? "Hoàn tiền 80% (Hủy trên 24h trước giờ tàu chạy)."
            : "80% refund (cancelled more than 24h before departure).",
        rate: 80,
        refund: price * 0.8,
      };
    }
  };

  // Perform Cancellation / Refund
  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCancelBooking) return;

    setCancelLoading(true);
    try {
      const response = await api.post(
        `/bookings/${selectedCancelBooking.id}/cancel`,
        {
          passengerIds: selectedCancelBooking.passengers?.map(
            (passenger) => passenger.id,
          ),
          reason: cancelReason,
          refundMethod: cancelMethod,
        },
      );
      toast.success(
        response.data.message ||
          (language === "vi"
            ? "Hủy vé và hoàn tiền thành công!"
            : "Ticket cancelled and refund processed successfully!"),
      );

      setSelectedCancelBooking(null);
      // Reload both bookings list and user balance/points silently
      fetchBookings();
      fetchProfile(true);
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
          (language === "vi"
            ? "Lỗi khi thực hiện yêu cầu hủy vé."
            : "Error processing ticket cancellation request."),
      );
    } finally {
      setCancelLoading(false);
    }
  };

  // Format date & time helper
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString(language === "vi" ? "vi-VN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Get ticket status badge styling
  const getStatusBadge = (bookingStatus, paymentStatus) => {
    if (
      bookingStatus === "CANCELLED" ||
      bookingStatus === "REFUNDED" ||
      paymentStatus === "REFUNDED"
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
          <XCircle className="w-3.5 h-3.5" />
          {language === "vi" ? "Đã hủy / Hoàn tiền" : "Cancelled / Refunded"}
        </span>
      );
    }
    if (paymentStatus === "COMPLETED" || bookingStatus === "CONFIRMED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
          <CheckCircle className="w-3.5 h-3.5" />
          {language === "vi" ? "Đã thanh toán" : "Paid"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
        <Clock className="w-3.5 h-3.5" />
        {language === "vi" ? "Chờ thanh toán" : "Pending"}
      </span>
    );
  };

  const pendingSeconds = pendingBooking
    ? Math.max(
        0,
        Math.ceil(
          (new Date(pendingBooking.expiresAt).getTime() - pendingNow) / 1000,
        ),
      )
    : 0;
  const pendingTimer = `${String(Math.floor(pendingSeconds / 60)).padStart(2, "0")}:${String(pendingSeconds % 60).padStart(2, "0")}`;
  const pendingSeatCount = pendingBooking?.session?.holds?.length || 0;
  const isPendingExchange =
    pendingBooking?.resumePath?.includes("mode=exchange");

  if (loading) {
    return (
      <div className="bg-[#f7f9fb] min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-sm">
          {language === "vi"
            ? "Đang tải hồ sơ cá nhân..."
            : "Loading user profile..."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto pb-12">
      {/* Page Header */}
      <div className="text-left mb-6">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2 text-left">
          <UserIcon className="h-7 w-7 text-primary" />
          {language === "vi" ? "Hồ Sơ Cá Nhân" : "My Profile"}
        </h1>
        <p className="text-slate-500 text-sm mt-1 text-left">
          {language === "vi"
            ? "Quản lý thông tin định danh đi tàu, điểm tích lũy và tra cứu lịch sử hành trình."
            : "Manage passenger identity details, loyalty points and review your travel logs."}
        </p>
      </div>

      {pendingBooking && (
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between text-left">
          <div className="flex items-start gap-3 text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-left">
                <h2 className="text-base font-black text-slate-800 text-left mb-0">
                  {language === "vi"
                    ? `Bạn có ${pendingSeatCount} ghế đang được giữ`
                    : `You have ${pendingSeatCount} seats currently held`}
                </h2>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-xs font-black text-amber-700">
                  {pendingTimer}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-600 text-left mb-0">
                {language === "vi"
                  ? `Phiên ${isPendingExchange ? "đổi vé" : "đặt vé"} chưa hoàn tất. Hãy quay lại thanh toán trước khi thời gian giữ ghế kết thúc.`
                  : `Your ${isPendingExchange ? "ticket exchange" : "ticket booking"} session is incomplete. Please finish checking out before holding timer expires.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(pendingBooking.resumePath)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/15 transition hover:bg-primary/90 active:scale-95 border-none cursor-pointer"
          >
            {language === "vi" ? "Tiếp tục thanh toán" : "Continue to Payment"}
            <ArrowRight className="h-4 w-4 text-white" />
          </button>
        </div>
      )}

      {/* Tabs Selector */}
      <div className="flex gap-6 border-b border-slate-200 mb-8 text-left">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 bg-transparent ${
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserIcon className="w-4 h-4" />
          {language === "vi"
            ? "Thông tin cá nhân & Thành viên"
            : "Personal Info & Membership"}
        </button>
        <button
          onClick={() => setActiveTab("bookings")}
          className={`pb-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 bg-transparent ${
            activeTab === "bookings"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <History className="w-4 h-4" />
          {language === "vi" ? "Lịch sử đặt vé" : "Booking History"}
        </button>
      </div>

      {/* TAB 1: Profile Details & Membership Card */}
      {activeTab === "profile" && (
        <div className="flex flex-col gap-6">
          {/* Profile Completeness Card */}
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 rounded-3xl p-6 border border-amber-200/80 shadow-sm flex flex-col gap-4 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div
                  className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black text-base shadow-sm shrink-0 ${
                    profileCompleteness.isComplete
                      ? "bg-emerald-500 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {profileCompleteness.percentage}%
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 flex flex-wrap items-center gap-2 mb-0">
                    <span>
                      {language === "vi"
                        ? "Mức độ hoàn thiện hồ sơ"
                        : "Profile Completeness"}
                    </span>
                    {profileCompleteness.isComplete ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {language === "vi" ? "Hoàn tất 100%" : "100% Completed"}
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        {language === "vi"
                          ? `Chưa hoàn thiện (${profileCompleteness.missingCount} mục còn thiếu)`
                          : `Incomplete (${profileCompleteness.missingCount} missing)`}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 mb-0">
                    {profileCompleteness.isComplete
                      ? language === "vi"
                        ? "Hồ sơ của bạn đã đầy đủ thông tin định danh mua vé."
                        : "Your profile is fully completed."
                      : language === "vi"
                        ? "Bổ sung đầy đủ các thông tin bên dưới để tự động điền khi đặt vé và bảo đảm quyền lợi hoàn tiền."
                        : "Complete all missing fields below for faster booking and smooth refund processing."}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200/70 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 rounded-full ${
                  profileCompleteness.isComplete
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-amber-500 to-orange-500"
                }`}
                style={{ width: `${profileCompleteness.percentage}%` }}
              />
            </div>

            {/* Missing fields checklist badges */}
            {!profileCompleteness.isComplete && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="text-xs font-bold text-slate-600 shrink-0">
                  {language === "vi"
                    ? "Thông tin cần bổ sung:"
                    : "Required additions:"}
                </span>
                {profileCompleteness.missingFields.map((field) => (
                  <span
                    key={field.key}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-100/90 text-amber-950 border border-amber-300/80 shadow-2xs"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                    {field.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            {/* LEFT COLUMN: Membership Card & Ranks */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Glassmorphic Membership Card */}
              <div
                className={`bg-gradient-to-br ${membership.cardBg} rounded-3xl p-6 text-white shadow-xl relative overflow-hidden h-[220px] flex flex-col justify-between border border-white/10 group`}
              >
                <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/5 group-hover:scale-125 transition-transform duration-700 blur-xl" />
                <div className="absolute left-10 -bottom-12 w-28 h-28 rounded-full bg-primary/10 group-hover:scale-150 transition-transform duration-700 blur-lg" />

                <div className="flex justify-between items-start relative z-10 text-left">
                  <div className="text-left">
                    <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold block">
                      {language === "vi"
                        ? "Thẻ thành viên liên kết"
                        : "Linked Membership Card"}
                    </span>
                    <span className="text-lg font-black tracking-wide">
                      GOTRAIN VN
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider bg-gradient-to-r ${membership.badgeColor} uppercase shadow-sm border border-white/10 flex items-center gap-1`}
                  >
                    <Sparkles className="h-3 w-3" />
                    {membership.name}
                  </span>
                </div>

                <div className="text-left relative z-10 py-1">
                  <span className="text-[10px] uppercase text-white/50 block font-bold">
                    {language === "vi"
                      ? "Chủ thẻ / Passenger"
                      : "Cardholder / Passenger"}
                  </span>
                  <span className="text-xl font-bold tracking-wide block truncate">
                    {profileData.fullName || user?.name || "KHÁCH HÀNG"}
                  </span>
                </div>

                <div className="flex justify-between items-end border-t border-white/10 pt-4 relative z-10">
                  <div className="text-left">
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block font-bold">
                      {language === "vi" ? "Số dư ví ảo" : "Wallet Balance"}
                    </span>
                    <span className="text-lg font-black text-blue-300">
                      {profileData.walletBalance.toLocaleString(
                        language === "vi" ? "vi-VN" : "en-US",
                      )}{" "}
                      <span className="text-xs font-semibold">VND</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block font-bold">
                      {language === "vi" ? "Điểm tích lũy" : "Loyalty Points"}
                    </span>
                    <span className="text-xl font-black text-amber-300 flex items-center justify-end gap-1">
                      <Award className="h-5 w-5 text-amber-300 shrink-0" />
                      {loyaltyPoints}{" "}
                      <span className="text-xs font-bold text-white/70">
                        {language === "vi" ? "đt" : "pts"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Points progress and benefits */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4 text-left">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    {language === "vi"
                      ? "Tiến trình thăng hạng"
                      : "Rank Progression"}
                  </span>
                  {membership.nextRankPoints > 0 ? (
                    <>
                      <div className="flex justify-between items-end mt-2">
                        <span className="text-sm font-extrabold text-slate-700">
                          {language === "vi"
                            ? `Tích lũy ${loyaltyPoints} / ${membership.nextRankPoints} đt`
                            : `Accumulated ${loyaltyPoints} / ${membership.nextRankPoints} pts`}
                        </span>
                        <span className="text-xs font-bold text-primary">
                          {membership.percentageToNext}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5 border border-slate-50">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-1000"
                          style={{ width: `${membership.percentageToNext}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold mt-2">
                        {language === "vi"
                          ? `Cần thêm ${membership.nextRankPoints - loyaltyPoints} điểm để nâng cấp hạng thành viên tiếp theo.`
                          : `Need ${membership.nextRankPoints - loyaltyPoints} more points to reach the next tier.`}
                      </p>
                    </>
                  ) : (
                    <div className="mt-2 text-sm font-extrabold text-indigo-600 flex items-center gap-1.5">
                      <Award className="h-5 w-5 text-indigo-600" />
                      <span>
                        {language === "vi"
                          ? "Chúc mừng! Bạn đã đạt hạng Kim Cương tối đa."
                          : "Congratulations! You have reached maximum Diamond rank."}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    {language === "vi"
                      ? "Quyền lợi hạng của bạn:"
                      : "Your Tier Benefits:"}
                  </span>
                  <div className="p-3.5 bg-blue-50/50 border border-blue-100/30 rounded-2xl flex items-start gap-2.5 text-slate-700 text-xs font-semibold">
                    <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{membership.benefits}</span>
                  </div>
                </div>
              </div>

              {/* Automatic Discount Classification Preview */}
              {ageCategory && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/30 rounded-3xl p-6 border border-blue-100/50 flex flex-col gap-3 text-left">
                  <span className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-4.5 w-4.5 text-primary shrink-0" />
                    {language === "vi"
                      ? "Phân Loại Đối Tượng Đường Sắt"
                      : "Railway Passenger Classification"}
                  </span>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-black text-slate-800">
                        {ageCategory.name}
                      </span>
                      <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                        {ageCategory.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1 mb-0 leading-relaxed">
                      {language === "vi"
                        ? `Chính sách giảm giá: ${ageCategory.discount}. Hệ thống sẽ tự động đối soát thông tin này dựa vào ngày sinh khi bán vé.`
                        : `Discount policy: ${ageCategory.discount}. The system will verify this automatically based on DOB at booking.`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Profile Edit Form */}
            <div className="lg:col-span-7">
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-left flex flex-col gap-6"
              >
                <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2 mb-0">
                  <Shield className="h-5 w-5 text-primary shrink-0" />
                  {language === "vi"
                    ? "Thông tin chi tiết hồ sơ"
                    : "Profile Details"}
                </h2>

                {/* Email (Readonly) */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {language === "vi" ? "Địa chỉ Email" : "Email Address"}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      disabled
                      value={profileData.email}
                      className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 font-semibold outline-none cursor-not-allowed text-sm"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    {language === "vi"
                      ? "Email này dùng làm định danh đăng nhập và nhận vé tàu điện tử, không được phép thay đổi."
                      : "This email is used as login ID and to receive e-tickets. It cannot be changed."}
                  </span>
                </div>

                {/* Họ tên & Số điện thoại */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {language === "vi"
                        ? "Họ và tên hành khách"
                        : "Passenger Full Name"}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <UserIcon className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        name="fullName"
                        value={profileData.fullName}
                        onChange={handleInputChange}
                        placeholder={
                          language === "vi"
                            ? "Nhập họ và tên đầy đủ"
                            : "Enter your full name"
                        }
                        className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {language === "vi" ? "Số điện thoại" : "Phone Number"}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={profileData.phoneNumber}
                        onChange={handleInputChange}
                        placeholder={
                          language === "vi"
                            ? "Nhập số điện thoại"
                            : "Enter your phone number"
                        }
                        className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Ngày sinh & Giới tính */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                      <span>
                        {language === "vi" ? "Ngày sinh" : "Date of Birth"}
                      </span>
                      {!profileData.dateOfBirth && (
                        <span className="text-[10px] text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded font-extrabold normal-case">
                          {language === "vi" ? "Cần bổ sung" : "Missing"}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Calendar className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={profileData.dateOfBirth}
                        onChange={handleInputChange}
                        className={`w-full pl-11 pr-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm cursor-pointer ${
                          !profileData.dateOfBirth
                            ? "bg-amber-50/40 border border-amber-300/90"
                            : "bg-slate-50/50 border border-slate-200"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {language === "vi" ? "Giới tính" : "Gender"}
                    </label>
                    <select
                      name="gender"
                      value={profileData.gender}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold text-sm cursor-pointer"
                    >
                      <option value="MALE">
                        {language === "vi" ? "Nam (Male)" : "Male"}
                      </option>
                      <option value="FEMALE">
                        {language === "vi" ? "Nữ (Female)" : "Female"}
                      </option>
                      <option value="OTHER">
                        {language === "vi" ? "Khác (Other)" : "Other"}
                      </option>
                    </select>
                  </div>
                </div>

                {/* Loại giấy tờ & Số định danh */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {language === "vi"
                        ? "Loại giấy tờ cá nhân"
                        : "Personal Identification Document"}
                    </label>
                    <select
                      name="nationalIdType"
                      value={profileData.nationalIdType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold text-sm cursor-pointer"
                    >
                      <option value="CCCD">
                        {language === "vi"
                          ? "Căn cước công dân (CCCD)"
                          : "Citizen ID (CCCD)"}
                      </option>
                      <option value="PASSPORT">
                        {language === "vi" ? "Hộ chiếu (Passport)" : "Passport"}
                      </option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                      <span>
                        {language === "vi"
                          ? "Số định danh (CCCD/Passport)"
                          : "Identification Number (CCCD/Passport)"}
                      </span>
                      {!profileData.nationalId && (
                        <span className="text-[10px] text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded font-extrabold normal-case">
                          {language === "vi" ? "Cần bổ sung" : "Missing"}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Shield className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        name="nationalId"
                        value={profileData.nationalId}
                        onChange={handleInputChange}
                        placeholder={
                          language === "vi"
                            ? "Nhập số CCCD hoặc Số Hộ chiếu"
                            : "Enter Citizen ID or Passport Number"
                        }
                        className={`w-full pl-11 pr-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm ${
                          !profileData.nationalId
                            ? "bg-amber-50/40 border border-amber-300/90"
                            : "bg-slate-50/50 border border-slate-200"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Địa chỉ liên hệ */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                    <span>
                      {language === "vi"
                        ? "Địa chỉ liên hệ"
                        : "Contact Address"}
                    </span>
                    {!profileData.address && (
                      <span className="text-[10px] text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded font-extrabold normal-case">
                        {language === "vi" ? "Cần bổ sung" : "Missing"}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      name="address"
                      value={profileData.address}
                      onChange={handleInputChange}
                      placeholder={
                        language === "vi"
                          ? "Nhập số nhà, tên đường, phường/xã, quận/huyện, tỉnh/TP"
                          : "Enter house number, street, ward, district, province/city"
                      }
                      className={`w-full pl-11 pr-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm ${
                        !profileData.address
                          ? "bg-amber-50/40 border border-amber-300/90"
                          : "bg-slate-50/50 border border-slate-200"
                      }`}
                    />
                  </div>
                </div>

                {/* Thông tin Ngân hàng */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                      <span>
                        {language === "vi" ? "Tên ngân hàng" : "Bank Name"}
                      </span>
                      {!profileData.bankName && (
                        <span className="text-[10px] text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded font-extrabold normal-case">
                          {language === "vi" ? "Khuyên dùng" : "Recommended"}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      name="bankName"
                      value={profileData.bankName}
                      onChange={handleInputChange}
                      placeholder={
                        language === "vi"
                          ? "VD: Vietcombank"
                          : "e.g. Vietcombank"
                      }
                      className={`w-full px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold text-sm ${
                        !profileData.bankName
                          ? "bg-amber-50/30 border border-amber-200"
                          : "bg-slate-50/50 border border-slate-200"
                      }`}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                      <span>
                        {language === "vi" ? "Số tài khoản" : "Account Number"}
                      </span>
                      {!profileData.bankAccount && (
                        <span className="text-[10px] text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded font-extrabold normal-case">
                          {language === "vi" ? "Khuyên dùng" : "Recommended"}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      name="bankAccount"
                      value={profileData.bankAccount}
                      onChange={handleInputChange}
                      placeholder={
                        language === "vi" ? "VD: 1012345678" : "e.g. 1012345678"
                      }
                      className={`w-full px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold text-sm ${
                        !profileData.bankAccount
                          ? "bg-amber-50/30 border border-amber-200"
                          : "bg-slate-50/50 border border-slate-200"
                      }`}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                      <span>
                        {language === "vi"
                          ? "Tên chủ tài khoản"
                          : "Account Owner Name"}
                      </span>
                      {!profileData.accountHolder && (
                        <span className="text-[10px] text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded font-extrabold normal-case">
                          {language === "vi" ? "Khuyên dùng" : "Recommended"}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      name="accountHolder"
                      value={profileData.accountHolder}
                      onChange={handleInputChange}
                      placeholder={
                        language === "vi"
                          ? "VD: NGUYEN VAN A"
                          : "e.g. NGUYEN VAN A"
                      }
                      className={`w-full px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold text-sm uppercase ${
                        !profileData.accountHolder
                          ? "bg-amber-50/30 border border-amber-200"
                          : "bg-slate-50/50 border border-slate-200"
                      }`}
                    />
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex justify-end gap-3 mt-2 border-t border-slate-100 pt-6">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-primary hover:bg-primary/95 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-primary/10 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none text-sm border-none"
                  >
                    {saving ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4.5 w-4.5 text-white" />
                        <span>
                          {language === "vi" ? "Lưu thay đổi" : "Save Changes"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Bookings History */}
      {activeTab === "bookings" && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-left min-h-[400px]">
          <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-2 mb-6">
            <Ticket className="h-5 w-5 text-primary shrink-0" />
            {language === "vi"
              ? "Lịch sử giao dịch đặt vé"
              : "Booking Transaction History"}
          </h2>

          {bookingsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-500 font-bold text-xs">
                {language === "vi"
                  ? "Đang tải danh sách vé..."
                  : "Loading tickets list..."}
              </p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-4">
                <Ticket className="h-6 w-6 text-slate-400" />
              </div>
              <h4 className="text-base font-bold text-slate-800">
                {language === "vi"
                  ? "Không tìm thấy vé nào"
                  : "No tickets found"}
              </h4>
              <p className="text-slate-400 text-xs mt-1 max-w-[320px] mb-0 leading-relaxed">
                {language === "vi"
                  ? "Bạn chưa thực hiện giao dịch đặt vé nào trên hệ thống GoTrainVN."
                  : "You have not made any ticket transactions on GoTrainVN yet."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {bookings.map((booking) => {
                const depDate = booking.schedule?.departureTime;
                const isUpcoming = depDate && new Date(depDate) > new Date();
                const canCancel =
                  isUpcoming &&
                  ["CONFIRMED", "COMPLETED"].includes(booking.status) &&
                  booking.cancellationRequest?.status !== "PENDING";

                return (
                  <div
                    key={booking.id}
                    className="border border-slate-100 hover:border-slate-200 rounded-3xl p-6 shadow-sm bg-slate-50/40 relative overflow-hidden flex flex-col gap-4 transition-all"
                  >
                    {/* Header info */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 text-left">
                      <div className="flex items-center gap-2.5 text-left">
                        <div className="px-3 py-1.5 bg-primary/10 rounded-xl text-primary text-xs font-black">
                          {language === "vi"
                            ? `Tàu ${booking.schedule?.train?.trainName || "N/A"}`
                            : `Train ${booking.schedule?.train?.trainName || "N/A"}`}
                        </div>
                        <div className="text-left">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase leading-none mb-1">
                            {language === "vi" ? "Mã đặt chỗ" : "Booking Code"}
                          </span>
                          <span className="text-sm font-extrabold text-slate-800 leading-none block text-left">
                            {booking.bookingCode}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getStatusBadge(booking.status, booking.paymentStatus)}
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4 py-1 text-left">
                      <div className="md:col-span-4 text-left">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">
                          {language === "vi" ? "Ga đi (Boarding)" : "Boarding"}
                        </span>
                        <span className="text-sm font-black text-slate-700 block mt-0.5 text-left">
                          {booking.fromStation?.stationName ||
                            booking.schedule?.startStation?.stationName ||
                            "Ga đi"}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 mt-1 text-left">
                          <Calendar className="w-3.5 h-3.5 opacity-70" />
                          {formatDate(depDate)}
                          <span className="text-slate-300">|</span>
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                          {formatTime(depDate)}
                        </span>
                      </div>

                      <div className="md:col-span-4 flex flex-col items-center justify-center py-2 md:py-0 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                          {language === "vi" ? "Hành trình" : "Itinerary"}
                        </span>
                        <div className="w-full flex items-center gap-2 px-6">
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          <div className="flex-1 border-t-2 border-dashed border-slate-200 relative" />
                          <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                          <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                        </div>
                        <span className="text-[11px] text-slate-500 font-bold mt-1">
                          {booking.bookingType === "ROUND_TRIP"
                            ? language === "vi"
                              ? "Vé Khứ Hồi"
                              : "Round Trip"
                            : language === "vi"
                              ? "Vé Một Chiều"
                              : "One Way"}
                        </span>
                      </div>

                      <div className="md:col-span-4 text-left md:text-right">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase md:text-right">
                          {language === "vi"
                            ? "Ga đến (Alighting)"
                            : "Alighting"}
                        </span>
                        <span className="text-sm font-black text-slate-700 block mt-0.5 md:text-right">
                          {booking.toStation?.stationName ||
                            booking.schedule?.endStation?.stationName ||
                            "Ga đến"}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold flex items-center justify-start md:justify-end gap-1.5 mt-1">
                          <Calendar className="w-3.5 h-3.5 opacity-70" />
                          {formatDate(booking.schedule?.arrivalTime)}
                          <span className="text-slate-300">|</span>
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                          {formatTime(booking.schedule?.arrivalTime)}
                        </span>
                      </div>
                    </div>

                    {/* Passenger Tags */}
                    {booking.passengers && booking.passengers.length > 0 && (
                      <div className="bg-white/60 rounded-2xl p-3 border border-slate-100 flex flex-col gap-2 text-left">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          {language === "vi"
                            ? "Thông tin vé & Hành khách:"
                            : "Ticket Info & Passenger:"}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {booking.passengers.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200/60 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-600"
                            >
                              <UserIcon className="w-3 h-3 text-slate-400" />
                              {p.fullName} (
                              {p.passengerType === "ADULT"
                                ? language === "vi"
                                  ? "Người lớn"
                                  : "Adult"
                                : p.passengerType === "CHILD"
                                  ? language === "vi"
                                    ? "Trẻ em"
                                    : "Child"
                                  : p.passengerType === "STUDENT"
                                    ? language === "vi"
                                      ? "Sinh viên"
                                      : "Student"
                                    : language === "vi"
                                      ? "Cao tuổi"
                                      : "Senior"}
                              )
                              {p.ticketCode && (
                                <Link
                                  to={`/tra-cuu-ve?ticketCode=${p.ticketCode}&contactInfo=${booking.confirmationEmail || user?.email || ""}`}
                                  className="bg-primary/10 hover:bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors hover:underline text-decoration-none"
                                  title="Nhấp để xem Boarding Pass và mã QR"
                                >
                                  {p.ticketCode}
                                </Link>
                              )}
                              {p.carriageNumber && (
                                <span className="text-[10px] text-slate-500 font-bold">
                                  {language === "vi"
                                    ? `Toa ${p.carriageNumber}`
                                    : `Carriage ${p.carriageNumber}`}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer Row: Cost & Action */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100/60 pt-3.5 text-left">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-500 font-semibold">
                          {language === "vi"
                            ? "Tổng chi phí thanh toán:"
                            : "Total paid cost:"}
                        </span>
                        <span className="text-base font-black text-primary ml-1">
                          {booking.totalAmount.toLocaleString(
                            language === "vi" ? "vi-VN" : "en-US",
                          )}{" "}
                          VND
                        </span>
                      </div>

                      {booking.cancellationRequest?.status === "PENDING" ? (
                        <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700">
                          {language === "vi"
                            ? "Vé đang được xử lý hủy và hoàn tiền"
                            : "Cancellation is being processed"}
                        </span>
                      ) : canCancel ? (
                        <button
                          onClick={() => setPolicyBooking(booking)}
                          className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer hover:-translate-y-0.5 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          {language === "vi"
                            ? "Hủy vé & Hoàn tiền"
                            : "Cancel Ticket & Refund"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CANCELLATION MODAL */}
      <CancellationPolicyModal
        open={Boolean(policyBooking)}
        audience="registered"
        onClose={() => setPolicyBooking(null)}
        onAccept={() => {
          setSelectedCancelBooking(policyBooking);
          setPolicyBooking(null);
        }}
      />

      {selectedCancelBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-slate-100 shadow-2xl animate-fade-in text-left">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between text-left">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-0">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                {language === "vi"
                  ? "Xác nhận hủy đặt vé"
                  : "Confirm Booking Cancellation"}
              </h3>
              <button
                onClick={() => setSelectedCancelBooking(null)}
                className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center cursor-pointer font-bold border-none"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCancelSubmit}
              className="p-6 flex flex-col gap-5 text-left"
            >
              {/* Ticket Details summary */}
              <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 text-xs font-semibold text-slate-700 flex flex-col gap-2 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {language === "vi" ? "Mã đặt chỗ:" : "Booking Code:"}
                  </span>
                  <span className="font-extrabold text-slate-800">
                    {selectedCancelBooking.bookingCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {language === "vi" ? "Tuyến tàu:" : "Train Route:"}
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedCancelBooking.fromStation?.stationName ||
                      (language === "vi" ? "Ga đi" : "Boarding")}{" "}
                    ➔{" "}
                    {selectedCancelBooking.toStation?.stationName ||
                      (language === "vi" ? "Ga đến" : "Alighting")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {language === "vi" ? "Khởi hành:" : "Departure:"}
                  </span>
                  <span className="font-bold text-slate-800">
                    {formatTime(selectedCancelBooking.schedule?.departureTime)}{" "}
                    -{" "}
                    {formatDate(selectedCancelBooking.schedule?.departureTime)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-red-100 pt-2 mt-1">
                  <span className="text-slate-400">
                    {language === "vi"
                      ? "Giá trị giao dịch gốc:"
                      : "Original Amount:"}
                  </span>
                  <span className="font-extrabold text-slate-800">
                    {selectedCancelBooking.totalAmount.toLocaleString(
                      language === "vi" ? "vi-VN" : "en-US",
                    )}{" "}
                    VND
                  </span>
                </div>
              </div>

              {/* Policy Estimate calculations */}
              {(() => {
                const policy = calculateRefundPolicy(selectedCancelBooking);
                if (!policy) return null;

                return (
                  <div className="flex flex-col gap-3 text-left">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {language === "vi"
                        ? "Chính sách áp dụng"
                        : "Applicable Policy"}
                    </span>
                    <div
                      className={`p-4 rounded-2xl border text-left ${
                        policy.allowed
                          ? "bg-blue-50/50 border-blue-100 text-blue-800"
                          : "bg-red-50/50 border-red-100 text-red-800"
                      }`}
                    >
                      <p className="text-xs font-bold leading-relaxed mb-0">
                        {policy.message}
                      </p>
                      {policy.allowed && (
                        <div className="flex justify-between items-center mt-3 border-t border-blue-100 pt-2 text-sm font-black text-slate-800">
                          <span>
                            {language === "vi"
                              ? "Số tiền hoàn trả ước tính:"
                              : "Estimated Refund Amount:"}
                          </span>
                          <span className="text-base text-primary font-black">
                            {policy.refund.toLocaleString(
                              language === "vi" ? "vi-VN" : "en-US",
                            )}{" "}
                            VND
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Input Reason */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {language === "vi" ? "Lý do hủy vé" : "Cancellation Reason"}
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 outline-none rounded-2xl text-slate-800 font-bold text-sm cursor-pointer"
                >
                  <option value="Thay đổi lịch trình cá nhân">
                    {language === "vi"
                      ? "Thay đổi lịch trình cá nhân"
                      : "Change of personal plans"}
                  </option>
                  <option value="Lỡ chuyến tàu hoặc đổi tàu khác">
                    {language === "vi"
                      ? "Lỡ chuyến tàu hoặc đổi tàu khác"
                      : "Missed train or changing to another train"}
                  </option>
                  <option value="Gặp vấn đề về sức khỏe/việc bận đột xuất">
                    {language === "vi"
                      ? "Gặp vấn đề về sức khỏe/việc bận đột xuất"
                      : "Medical issues / sudden emergency"}
                  </option>
                  <option value="Không đồng ý với chính sách phụ thu">
                    {language === "vi"
                      ? "Không đồng ý với chính sách phụ thu"
                      : "Disagree with additional fees policy"}
                  </option>
                </select>
              </div>

              {/* Refund Method selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {language === "vi"
                    ? "Phương thức nhận tiền hoàn"
                    : "Refund Method"}
                </label>
                <select
                  value={cancelMethod}
                  onChange={(e) => setCancelMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 outline-none rounded-2xl text-slate-800 font-bold text-sm cursor-pointer"
                >
                  <option value="WALLET">
                    {language === "vi"
                      ? "Ví điện tử cá nhân (Hoàn tiền tức thì)"
                      : "Personal E-Wallet (Instant refund)"}
                  </option>
                  <option value="BANK_TRANSFER">
                    {language === "vi"
                      ? "Chuyển khoản ngân hàng (1 - 3 ngày làm việc)"
                      : "Bank Transfer (1 - 3 business days)"}
                  </option>
                </select>
              </div>

              {/* Warning box */}
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-2.5 text-amber-700 text-[11px] font-bold text-left">
                <Info className="h-4.5 w-4.5 shrink-0 mt-0.5 text-amber-700" />
                <span>
                  {language === "vi"
                    ? "Lưu ý: Yêu cầu hủy vé sau khi xác nhận sẽ được xử lý tự động ngay lập tức. Vé của bạn sẽ được giải phóng cho hành khách khác. Hành động này không thể hoàn tác."
                    : "Note: Cancellation requests will be processed automatically and immediately. Your seats will be released for other passengers. This action is irreversible."}
                </span>
              </div>

              {/* Actions submit */}
              <div className="flex justify-end gap-3 mt-2 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setSelectedCancelBooking(null)}
                  className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition text-sm cursor-pointer bg-white"
                >
                  {language === "vi" ? "Quay lại" : "Back"}
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-red-600/10 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 text-sm border-none"
                >
                  {cancelLoading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 text-white" />
                      <span>
                        {language === "vi"
                          ? "Xác nhận hủy vé"
                          : "Confirm Cancellation"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
