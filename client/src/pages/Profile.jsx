import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { toast } from "sonner";
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Shield,
  Save,
  CreditCard,
  Lock,
  Sparkles,
  ChevronRight,
  Info
} from "lucide-react";

export function Profile() {
  const { user, setAuth } = useAuth();
  
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
    walletBalance: 0
  });

  // Load profile details from database on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
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
          walletBalance: balance
        });
      } catch (err) {
        console.error("Lỗi khi tải thông tin hồ sơ:", err);
        toast.error("Không thể tải thông tin hồ sơ cá nhân.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

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
        benefits: "Giảm 10% mọi giá vé, ưu tiên chọn toa và phòng chờ thương gia."
      };
    } else if (loyaltyPoints >= 500) {
      return {
        name: "Hạng Vàng",
        badgeColor: "from-amber-400 to-amber-600 text-amber-950",
        iconColor: "text-amber-500",
        nextRankPoints: 2000,
        percentageToNext: Math.min(100, Math.round((loyaltyPoints / 2000) * 100)),
        cardBg: "from-amber-600 via-amber-700 to-amber-900",
        benefits: "Giảm 5% mọi giá vé, miễn phí đổi vé trước 12 tiếng."
      };
    } else if (loyaltyPoints >= 100) {
      return {
        name: "Hạng Bạc",
        badgeColor: "from-slate-300 to-slate-400 text-slate-800",
        iconColor: "text-slate-400",
        nextRankPoints: 500,
        percentageToNext: Math.min(100, Math.round((loyaltyPoints / 500) * 100)),
        cardBg: "from-slate-600 via-slate-700 to-slate-800",
        benefits: "Ưu tiên đặt vé mùa cao điểm, tích lũy điểm x1.2."
      };
    } else {
      return {
        name: "Hạng Đồng",
        badgeColor: "from-orange-400 to-amber-700 text-white",
        iconColor: "text-orange-500",
        nextRankPoints: 100,
        percentageToNext: Math.min(100, Math.round((loyaltyPoints / 100) * 100)),
        cardBg: "from-orange-800 via-stone-800 to-orange-950",
        benefits: "Tích lũy điểm đổi quà, hỗ trợ dịch vụ khẩn cấp."
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
        badge: "Miễn phí vé"
      };
    } else if (age >= 6 && age <= 10) {
      return {
        name: "Trẻ em (Từ 6 - 10 tuổi)",
        discount: "Giảm 50% giá vé ghế/giường",
        badge: "Giảm 50% vé"
      };
    } else if (age >= 60) {
      return {
        name: "Người cao tuổi (Từ 60 tuổi)",
        discount: "Giảm 15% giá vé theo luật đường sắt",
        badge: "Giảm 15% vé"
      };
    } else {
      return {
        name: "Người lớn",
        discount: "Tự động áp dụng giảm 20% nếu chọn loại vé Sinh viên khi đặt",
        badge: "Giá tiêu chuẩn"
      };
    }
  })();

  // Form input change handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle Form Submission
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
        dateOfBirth: profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toISOString() : null,
        gender: profileData.gender
      });

      // Update authStore to sync local state (synchronizes header name immediately)
      setAuth({
        user: {
          ...user,
          name: data.user.fullName,
          loyaltyPoints: data.user.loyaltyPoints || 0
        }
      });

      toast.success("Cập nhật thông tin hồ sơ thành công!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#f7f9fb] min-h-[70vh] flex flex-col items-center justify-center p-6">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-sm">Đang tải hồ sơ khách hàng...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto pb-12">
      {/* Page Header */}
      <div className="text-left mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <UserIcon className="h-7 w-7 text-primary" />
          Hồ Sơ Cá Nhân
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Quản lý thông tin định danh đường sắt và điểm thưởng tích lũy đi tàu của bạn.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ============================================================== */}
        {/* LEFT COLUMN: Membership Card & Ranks                           */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 1. Glassmorphic Membership Card */}
          <div className={`bg-gradient-to-br ${membership.cardBg} rounded-3xl p-6 text-white shadow-xl relative overflow-hidden h-[220px] flex flex-col justify-between border border-white/10 group`}>
            {/* Background glowing shapes */}
            <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/5 group-hover:scale-125 transition-transform duration-700 blur-xl" />
            <div className="absolute left-10 -bottom-12 w-28 h-28 rounded-full bg-primary/10 group-hover:scale-150 transition-transform duration-700 blur-lg" />
            
            {/* Top row */}
            <div className="flex justify-between items-start relative z-10">
              <div className="text-left">
                <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold block">
                  Thẻ thành viên liên kết
                </span>
                <span className="text-lg font-black tracking-wide">GOTRAIN VN</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider bg-gradient-to-r ${membership.badgeColor} uppercase shadow-sm border border-white/10 flex items-center gap-1`}>
                <Sparkles className="h-3 w-3" />
                {membership.name}
              </span>
            </div>

            {/* Middle row: Name */}
            <div className="text-left relative z-10 py-1">
              <span className="text-[10px] uppercase text-white/50 block font-bold">Chủ thẻ / Passenger</span>
              <span className="text-xl font-bold tracking-wide block truncate">{profileData.fullName || user?.name || "KHÁCH HÀNG"}</span>
            </div>

            {/* Bottom row: Balance / Points */}
            <div className="flex justify-between items-end border-t border-white/10 pt-4 relative z-10">
              <div className="text-left">
                <span className="text-[9px] uppercase tracking-widest text-white/50 block font-bold">Số dư ví ảo</span>
                <span className="text-lg font-black text-blue-300">
                  {profileData.walletBalance.toLocaleString("vi-VN")} <span className="text-xs font-semibold">VND</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase tracking-widest text-white/50 block font-bold">Điểm tích lũy</span>
                <span className="text-xl font-black text-amber-300 flex items-center justify-end gap-1">
                  <Award className="h-5 w-5 text-amber-300 shrink-0" />
                  {loyaltyPoints} <span className="text-xs font-bold text-white/70">đt</span>
                </span>
              </div>
            </div>
          </div>

          {/* 2. Points progress and benefits */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4 text-left">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Tiến trình thăng hạng
              </span>
              {membership.nextRankPoints > 0 ? (
                <>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-sm font-extrabold text-slate-700">
                      Tích lũy {loyaltyPoints} / {membership.nextRankPoints} đt
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
                    Cần thêm {membership.nextRankPoints - loyaltyPoints} điểm để nâng cấp hạng thành viên tiếp theo.
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

          {/* 3. Automatic Discount Classification Preview */}
          {ageCategory && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/30 rounded-3xl p-6 border border-blue-100/50 flex flex-col gap-3 text-left">
              <span className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-4.5 w-4.5 text-primary shrink-0" />
                Phân Loại Đối Tượng Đường Sắt
              </span>
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-slate-800">{ageCategory.name}</span>
                  <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                    {ageCategory.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Chính sách giảm giá: {ageCategory.discount}. Hệ thống sẽ tự động đối soát thông tin này dựa vào ngày sinh khi bán vé.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Profile Edit Form                                */}
        {/* ============================================================== */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-left flex flex-col gap-6">
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
                Email này dùng làm định danh đăng nhập và nhận vé tàu điện tử, không được phép thay đổi.
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
    </div>
  );
}
