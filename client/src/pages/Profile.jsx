import { useState, useEffect } from "react";

import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { seatSelectionApi } from "../services/seatSelectionApi";
import {
  clearPendingBooking,
  getPendingBooking,
} from "../services/pendingBooking";
import { toast } from "sonner";
import { CancellationPolicyModal } from "../components/booking/CancellationPolicyModal";
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

export function Profile() {
  const { user, setAuth } = useAuth();
  const navigate = useNavigate();

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
    "Thay đổi lịch trình cá nhân",
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
        console.log("Không có ví hoặc lỗi khi lấy số dư ví:", wErr);
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
      console.error("Lỗi khi tải thông tin hồ sơ:", err);
      if (!silent) toast.error("Không thể tải thông tin hồ sơ cá nhân.");
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
      console.error("Lỗi khi tải lịch sử đặt vé:", err);
      toast.error("Không thể tải lịch sử đặt vé của bạn.");
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

  // Compute membership status and parameters
  const loyaltyPoints = profileData.loyaltyPoints;
  const membership = (() => {
    if (loyaltyPoints >= 2000) {
      return {
        name: "Hạng Kim Cương",
        badgeColor: "from-blue-600 to-indigo-900 text-white",
        iconColor: "text-blue-400",
        nextRankPoints: 0,
        percentageToNext: 100,
        cardBg: "from-slate-900 via-indigo-950 to-slate-900",
        benefits:
          "Giảm 10% mọi giá vé, ưu tiên chọn toa và phòng chờ thương gia.",
      };
    } else if (loyaltyPoints >= 500) {
      return {
        name: "Hạng Vàng",
        badgeColor: "from-amber-400 to-amber-600 text-amber-950",
        iconColor: "text-amber-500",
        nextRankPoints: 2000,
        percentageToNext: Math.min(
          100,
          Math.round((loyaltyPoints / 2000) * 100),
        ),
        cardBg: "from-amber-600 via-amber-700 to-amber-900",
        benefits: "Giảm 5% mọi giá vé, miễn phí đổi vé trước 12 tiếng.",
      };
    } else if (loyaltyPoints >= 100) {
      return {
        name: "Hạng Bạc",
        badgeColor: "from-slate-300 to-slate-400 text-slate-800",
        iconColor: "text-slate-400",
        nextRankPoints: 500,
        percentageToNext: Math.min(
          100,
          Math.round((loyaltyPoints / 500) * 100),
        ),
        cardBg: "from-slate-600 via-slate-700 to-slate-800",
        benefits: "Ưu tiên đặt vé mùa cao điểm, tích lũy điểm x1.2.",
      };
    } else {
      return {
        name: "Hạng Đồng",
        badgeColor: "from-orange-400 to-amber-700 text-white",
        iconColor: "text-orange-500",
        nextRankPoints: 100,
        percentageToNext: Math.min(
          100,
          Math.round((loyaltyPoints / 100) * 100),
        ),
        cardBg: "from-orange-800 via-stone-800 to-orange-950",
        benefits: "Tích lũy điểm đổi quà, hỗ trợ dịch vụ khẩn cấp.",
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
        name: "Trẻ em (Dưới 6 tuổi)",
        discount: "Miễn phí vé đi kèm người lớn",
        badge: "Miễn phí vé",
      };
    } else if (age >= 6 && age <= 10) {
      return {
        name: "Trẻ em (Từ 6 - 10 tuổi)",
        discount: "Giảm 50% giá vé ghế/giường",
        badge: "Giảm 50% vé",
      };
    } else if (age >= 60) {
      return {
        name: "Người cao tuổi (Từ 60 tuổi)",
        discount: "Giảm 15% giá vé theo luật đường sắt",
        badge: "Giảm 15% vé",
      };
    } else {
      return {
        name: "Người lớn",
        discount: "Tự động áp dụng giảm 20% nếu chọn loại vé Sinh viên khi đặt",
        badge: "Giá tiêu chuẩn",
      };
    }
  })();

  // Form input change handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle Form Submission (Save Profile)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validations
    if (!profileData.fullName.trim()) {
      toast.error("Vui lòng nhập Họ và tên.");
      return;
    }
    if (!profileData.phoneNumber.trim()) {
      toast.error("Vui lòng nhập Số điện thoại.");
      return;
    }
    const phoneRegex = /^[0-9]{9,11}$/;
    if (!phoneRegex.test(profileData.phoneNumber.trim())) {
      toast.error("Số điện thoại không hợp lệ (9 đến 11 chữ số).");
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
      }));

      // Update authStore to sync local state
      setAuth({
        user: {
          ...user,
          name: data.user.fullName,
          loyaltyPoints: data.user.loyaltyPoints || 0,
        },
      });

      toast.success("Cập nhật thông tin hồ sơ thành công!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật hồ sơ.");
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
        message: "Tàu đã khởi hành. Không thể hoàn/hủy vé.",
        rate: 0,
        refund: 0,
      };
    } else if (diffHours < 4) {
      return {
        allowed: false,
        message:
          "Không thể hoàn/hủy vé trực tuyến sát giờ khởi hành (dưới 4 tiếng). Vui lòng ra ga để được hỗ trợ.",
        rate: 0,
        refund: 0,
      };
    } else if (diffHours >= 4 && diffHours < 24) {
      return {
        allowed: true,
        message: "Hoàn tiền 50% (Hủy từ 4h đến dưới 24h trước giờ tàu chạy).",
        rate: 50,
        refund: price * 0.5,
      };
    } else {
      return {
        allowed: true,
        message: "Hoàn tiền 80% (Hủy trên 24h trước giờ tàu chạy).",
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
      toast.success(response.data.message || "Hủy vé và hoàn tiền thành công!");

      setSelectedCancelBooking(null);
      // Reload both bookings list and user balance/points silently
      fetchBookings();
      fetchProfile(true);
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Lỗi khi thực hiện yêu cầu hủy vé.",
      );
    } finally {
      setCancelLoading(false);
    }
  };

  // Format date & time helper
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("vi-VN", {
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
          Đã hủy / Hoàn tiền
        </span>
      );
    }
    if (paymentStatus === "COMPLETED" || bookingStatus === "CONFIRMED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
          <CheckCircle className="w-3.5 h-3.5" />
          Đã thanh toán
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
        <Clock className="w-3.5 h-3.5" />
        Chờ thanh toán
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
      <div className="bg-[#f7f9fb] min-h-[70vh] flex flex-col items-center justify-center p-6">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-sm">
          Đang tải hồ sơ cá nhân...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto pb-12">
      {/* Page Header */}
      <div className="text-left mb-6">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <UserIcon className="h-7 w-7 text-primary" />
          Hồ Sơ Cá Nhân
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Quản lý thông tin định danh đi tàu, điểm tích lũy và tra cứu lịch sử
          hành trình.
        </p>
      </div>

      {pendingBooking && (
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-slate-800">
                  Bạn có {pendingSeatCount} ghế đang được giữ
                </h2>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-xs font-black text-amber-700">
                  {pendingTimer}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-600">
                Phiên {isPendingExchange ? "đổi vé" : "đặt vé"} chưa hoàn tất.
                Hãy quay lại thanh toán trước khi thời gian giữ ghế kết thúc.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(pendingBooking.resumePath)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/15 transition hover:bg-primary/90 active:scale-95"
          >
            Tiếp tục thanh toán
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs Selector */}
      <div className="flex gap-6 border-b border-slate-200 mb-8">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserIcon className="w-4 h-4" />
          Thông tin cá nhân & Thành viên
        </button>
        <button
          onClick={() => setActiveTab("bookings")}
          className={`pb-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "bookings"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <History className="w-4 h-4" />
          Lịch sử đặt vé
        </button>
      </div>

      {/* TAB 1: Profile Details & Membership Card */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN: Membership Card & Ranks */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Glassmorphic Membership Card */}
            <div
              className={`bg-gradient-to-br ${membership.cardBg} rounded-3xl p-6 text-white shadow-xl relative overflow-hidden h-[220px] flex flex-col justify-between border border-white/10 group`}
            >
              <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/5 group-hover:scale-125 transition-transform duration-700 blur-xl" />
              <div className="absolute left-10 -bottom-12 w-28 h-28 rounded-full bg-primary/10 group-hover:scale-150 transition-transform duration-700 blur-lg" />

              <div className="flex justify-between items-start relative z-10">
                <div className="text-left">
                  <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold block">
                    Thẻ thành viên liên kết
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
                  Chủ thẻ / Passenger
                </span>
                <span className="text-xl font-bold tracking-wide block truncate">
                  {profileData.fullName || user?.name || "KHÁCH HÀNG"}
                </span>
              </div>

              <div className="flex justify-between items-end border-t border-white/10 pt-4 relative z-10">
                <div className="text-left">
                  <span className="text-[9px] uppercase tracking-widest text-white/50 block font-bold">
                    Số dư ví ảo
                  </span>
                  <span className="text-lg font-black text-blue-300">
                    {profileData.walletBalance.toLocaleString("vi-VN")}{" "}
                    <span className="text-xs font-semibold">VND</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-widest text-white/50 block font-bold">
                    Điểm tích lũy
                  </span>
                  <span className="text-xl font-black text-amber-300 flex items-center justify-end gap-1">
                    <Award className="h-5 w-5 text-amber-300 shrink-0" />
                    {loyaltyPoints}{" "}
                    <span className="text-xs font-bold text-white/70">đt</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Points progress and benefits */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4 text-left">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Tiến trình thăng hạng
                </span>
                {membership.nextRankPoints > 0 ? (
                  <>
                    <div className="flex justify-between items-end mt-2">
                      <span className="text-sm font-extrabold text-slate-700">
                        Tích lũy {loyaltyPoints} / {membership.nextRankPoints}{" "}
                        đt
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
                      Cần thêm {membership.nextRankPoints - loyaltyPoints} điểm
                      để nâng cấp hạng thành viên tiếp theo.
                    </p>
                  </>
                ) : (
                  <div className="mt-2 text-sm font-extrabold text-indigo-600 flex items-center gap-1.5">
                    <Award className="h-5 w-5" />
                    <span>Chúc mừng! Bạn đã đạt hạng Kim Cương tối đa.</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Quyền lợi hạng của bạn:
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
                  Phân Loại Đối Tượng Đường Sắt
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
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Chính sách giảm giá: {ageCategory.discount}. Hệ thống sẽ tự
                    động đối soát thông tin này dựa vào ngày sinh khi bán vé.
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
              <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary shrink-0" />
                Thông tin chi tiết hồ sơ
              </h2>

              {/* Email (Readonly) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Địa chỉ Email
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
                <span className="text-[10px] text-slate-400 font-semibold">
                  Email này dùng làm định danh đăng nhập và nhận vé tàu điện tử,
                  không được phép thay đổi.
                </span>
              </div>

              {/* Họ tên & Số điện thoại */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Họ và tên hành khách
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
                      placeholder="Nhập họ và tên đầy đủ"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Số điện thoại
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
                      placeholder="Nhập số điện thoại"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Ngày sinh & Giới tính */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Ngày sinh
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
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Giới tính
                  </label>
                  <select
                    name="gender"
                    value={profileData.gender}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm cursor-pointer"
                  >
                    <option value="MALE">Nam (Male)</option>
                    <option value="FEMALE">Nữ (Female)</option>
                    <option value="OTHER">Khác (Other)</option>
                  </select>
                </div>
              </div>

              {/* Loại giấy tờ & Số định danh */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Loại giấy tờ cá nhân
                  </label>
                  <select
                    name="nationalIdType"
                    value={profileData.nationalIdType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm cursor-pointer"
                  >
                    <option value="CCCD">Căn cước công dân (CCCD)</option>
                    <option value="PASSPORT">Hộ chiếu (Passport)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Số định danh (CCCD/Passport)
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
                      placeholder="Nhập số CCCD hoặc Số Hộ chiếu"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Địa chỉ liên hệ */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Địa chỉ liên hệ
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
                    placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện, tỉnh/TP"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm"
                  />
                </div>
              </div>

              {/* Submit Actions */}
              <div className="flex justify-end gap-3 mt-2 border-t border-slate-100 pt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary hover:bg-primary/95 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-primary/10 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none text-sm"
                >
                  {saving ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4.5 w-4.5" />
                      <span>Lưu thay đổi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Bookings History */}
      {activeTab === "bookings" && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-left min-h-[400px]">
          <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-2 mb-6">
            <Ticket className="h-5 w-5 text-primary shrink-0" />
            Lịch sử giao dịch đặt vé
          </h2>

          {bookingsLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-500 font-bold text-xs">
                Đang tải danh sách vé...
              </p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-4">
                <Ticket className="h-6 w-6 text-slate-400" />
              </div>
              <h4 className="text-base font-bold text-slate-800">
                Không tìm thấy vé nào
              </h4>
              <p className="text-slate-400 text-xs mt-1 max-w-[320px]">
                Bạn chưa thực hiện giao dịch đặt vé nào trên hệ thống GoTrainVN.
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
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="px-3 py-1.5 bg-primary/10 rounded-xl text-primary text-xs font-black">
                          Tàu {booking.schedule?.train?.trainName || "N/A"}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase leading-none mb-1">
                            Mã đặt chỗ
                          </span>
                          <span className="text-sm font-extrabold text-slate-800 leading-none">
                            {booking.bookingCode}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getStatusBadge(booking.status, booking.paymentStatus)}
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4 py-1">
                      <div className="md:col-span-4 text-left">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">
                          Ga đi (Boarding)
                        </span>
                        <span className="text-sm font-black text-slate-700 block mt-0.5">
                          {booking.fromStation?.stationName ||
                            booking.schedule?.startStation?.stationName ||
                            "Ga đi"}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 mt-1">
                          <Calendar className="w-3.5 h-3.5 opacity-70" />
                          {formatDate(depDate)}
                          <span className="text-slate-300">|</span>
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                          {formatTime(depDate)}
                        </span>
                      </div>

                      <div className="md:col-span-4 flex flex-col items-center justify-center py-2 md:py-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                          Hành trình
                        </span>
                        <div className="w-full flex items-center gap-2 px-6">
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          <div className="flex-1 border-t-2 border-dashed border-slate-200 relative" />
                          <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                          <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                        </div>
                        <span className="text-[11px] text-slate-500 font-bold mt-1">
                          {booking.bookingType === "ROUND_TRIP"
                            ? "Vé Khứ Hồi"
                            : "Vé Một Chiều"}
                        </span>
                      </div>

                      <div className="md:col-span-4 text-left md:text-right">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">
                          Ga đến (Alighting)
                        </span>
                        <span className="text-sm font-black text-slate-700 block mt-0.5">
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
                      <div className="bg-white/60 rounded-2xl p-3 border border-slate-100 flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          Thông tin vé & Hành khách:
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
                                ? "Người lớn"
                                : p.passengerType === "CHILD"
                                  ? "Trẻ em"
                                  : p.passengerType === "STUDENT"
                                    ? "Sinh viên"
                                    : "Cao tuổi"}
                              )
                              {p.ticketCode && (
                                <Link
                                  to={`/tra-cuu-ve?ticketCode=${p.ticketCode}&contactInfo=${booking.confirmationEmail || user?.email || ""}`}
                                  className="bg-primary/10 hover:bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors hover:underline"
                                  title="Nhấp để xem Boarding Pass và mã QR"
                                >
                                  {p.ticketCode}
                                </Link>
                              )}
                              {p.carriageNumber && (
                                <span className="text-[10px] text-slate-500 font-bold">
                                  Toa {p.carriageNumber}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer Row: Cost & Action */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100/60 pt-3.5">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-500 font-semibold">
                          Tổng chi phí thanh toán:
                        </span>
                        <span className="text-base font-black text-primary ml-1">
                          {booking.totalAmount.toLocaleString("vi-VN")} VND
                        </span>
                      </div>

                      {booking.cancellationRequest?.status === "PENDING" ? (
                        <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700">
                          Yêu cầu hủy đang chờ Admin duyệt
                        </span>
                      ) : canCancel ? (
                        <button
                          onClick={() => setPolicyBooking(booking)}
                          className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer hover:-translate-y-0.5 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hủy vé & Hoàn tiền
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
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                Xác nhận hủy đặt vé
              </h3>
              <button
                onClick={() => setSelectedCancelBooking(null)}
                className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCancelSubmit}
              className="p-6 flex flex-col gap-5"
            >
              {/* Ticket Details summary */}
              <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 text-xs font-semibold text-slate-700 flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Mã đặt chỗ:</span>
                  <span className="font-extrabold text-slate-800">
                    {selectedCancelBooking.bookingCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tuyến tàu:</span>
                  <span className="font-bold text-slate-800">
                    {selectedCancelBooking.fromStation?.stationName || "Ga đi"}{" "}
                    ➔ {selectedCancelBooking.toStation?.stationName || "Ga đến"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Khởi hành:</span>
                  <span className="font-bold text-slate-800">
                    {formatTime(selectedCancelBooking.schedule?.departureTime)}{" "}
                    -{" "}
                    {formatDate(selectedCancelBooking.schedule?.departureTime)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-red-100 pt-2 mt-1">
                  <span className="text-slate-400">Giá trị giao dịch gốc:</span>
                  <span className="font-extrabold text-slate-800">
                    {selectedCancelBooking.totalAmount.toLocaleString("vi-VN")}{" "}
                    VND
                  </span>
                </div>
              </div>

              {/* Policy Estimate calculations */}
              {(() => {
                const policy = calculateRefundPolicy(selectedCancelBooking);
                if (!policy) return null;

                return (
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Chính sách áp dụng
                    </span>
                    <div
                      className={`p-4 rounded-2xl border ${
                        policy.allowed
                          ? "bg-blue-50/50 border-blue-100 text-blue-800"
                          : "bg-red-50/50 border-red-100 text-red-800"
                      }`}
                    >
                      <p className="text-xs font-bold leading-relaxed">
                        {policy.message}
                      </p>
                      {policy.allowed && (
                        <div className="flex justify-between items-center mt-3 border-t border-blue-100 pt-2 text-sm font-black text-slate-800">
                          <span>Số tiền hoàn trả ước tính:</span>
                          <span className="text-base text-primary font-black">
                            {policy.refund.toLocaleString("vi-VN")} VND
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
                  Lý do hủy vé
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm cursor-pointer"
                >
                  <option value="Thay đổi lịch trình cá nhân">
                    Thay đổi lịch trình cá nhân
                  </option>
                  <option value="Lỡ chuyến tàu hoặc đổi tàu khác">
                    Lỡ chuyến tàu hoặc đổi tàu khác
                  </option>
                  <option value="Gặp vấn đề về sức khỏe/việc bận đột xuất">
                    Gặp vấn đề về sức khỏe/việc bận đột xuất
                  </option>
                  <option value="Không đồng ý với chính sách phụ thu">
                    Không đồng ý với chính sách phụ thu
                  </option>
                </select>
              </div>

              {/* Refund Method selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Phương thức nhận tiền hoàn
                </label>
                <select
                  value={cancelMethod}
                  onChange={(e) => setCancelMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 outline-none rounded-2xl text-slate-800 font-bold transition-all text-sm cursor-pointer"
                >
                  <option value="WALLET">
                    Ví điện tử cá nhân (Hoàn tiền tức thì)
                  </option>
                  <option value="BANK_TRANSFER">
                    Chuyển khoản ngân hàng (1 - 3 ngày làm việc)
                  </option>
                </select>
              </div>

              {/* Warning box */}
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-2.5 text-amber-700 text-[11px] font-bold">
                <Info className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <span>
                  Lưu ý: Yêu cầu hủy vé sau khi xác nhận sẽ được xử lý tự động
                  ngay lập tức. Vé của bạn sẽ được giải phóng cho hành khách
                  khác. Hành động này không thể hoàn tác.
                </span>
              </div>

              {/* Actions submit */}
              <div className="flex justify-end gap-3 mt-2 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setSelectedCancelBooking(null)}
                  className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition text-sm cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-red-600/10 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 text-sm"
                >
                  {cancelLoading ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Xác nhận hủy vé</span>
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
