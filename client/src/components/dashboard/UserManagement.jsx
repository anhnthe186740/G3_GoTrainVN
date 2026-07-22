import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { toast } from "sonner";
import { useAuthStore } from "../../store/authStore";

/* ── Reusable Skeleton Component ────────────────────────── */
function SkeletonRow({ cols = 5 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div
            className="h-4 bg-[#eceef0] rounded-lg"
            style={{ width: `${50 + i * 10}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

/* ── Modal Nhập Lý Do Khóa Tài Khoản ────────────────────────── */
function LockReasonModal({ isOpen, onClose, user, onConfirm, loading }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do khóa tài khoản");
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,98,157,0.15)] border border-[#bec7d4]/20 w-full max-w-md overflow-hidden transform transition-all scale-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#bec7d4]/10 bg-slate-50/50 flex justify-between items-center text-left">
          <h3 className="font-headline-md text-base font-bold text-[#ba1a1a]">
            Khóa Tài Khoản Người Dùng
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          <p className="text-sm text-slate-600 leading-relaxed">
            Bạn đang thực hiện khóa tài khoản của thành viên{" "}
            <strong className="text-slate-800">{user.fullName}</strong> (
            {user.email}). Người dùng này sẽ không thể đăng nhập vào hệ thống
            sau khi bị khóa.
          </p>

          {/* Lý do khóa */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Lý do khóa tài khoản *
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) setError("");
              }}
              rows={3}
              className={`w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#00a3ff] text-sm bg-white resize-none ${
                error ? "border-red-500" : "border-[#bec7d4]/60"
              }`}
              placeholder="Nhập lý do chi tiết (ví dụ: Vi phạm điều khoản, spam đặt vé...)..."
            />
            {error && (
              <span className="text-red-500 text-[11px] mt-0.5 block font-semibold">
                {error}
              </span>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#bec7d4]/10 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#bec7d4]/60 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#ba1a1a] hover:bg-red-600 text-white text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {loading && (
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
              )}
              Khóa tài khoản
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Modal Thêm Nhân Viên Mới ────────────────────────────── */
function CreateStaffModal({ isOpen, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    password: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setForm({
        fullName: "",
        email: "",
        phoneNumber: "",
        password: "",
      });
      setErrors({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const err = {};
    if (!form.fullName.trim()) err.fullName = "Họ tên không được để trống";
    if (!form.email.trim()) {
      err.email = "Email không được để trống";
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      err.email = "Email không hợp lệ";
    }
    if (!form.phoneNumber.trim()) {
      err.phoneNumber = "Số điện thoại không được để trống";
    } else if (!/^\d{9,11}$/.test(form.phoneNumber.trim())) {
      err.phoneNumber = "SĐT phải chứa từ 9 đến 11 chữ số";
    }
    if (!form.password) {
      err.password = "Mật khẩu không được để trống";
    } else if (form.password.length < 6) {
      err.password = "Mật khẩu phải từ 6 ký tự trở lên";
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(form);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,98,157,0.15)] border border-[#bec7d4]/20 w-full max-w-md overflow-hidden transform transition-all scale-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#bec7d4]/10 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-headline-md text-base font-bold text-[#191c1e]">
            Thêm Nhân Viên Điều Hành Mới
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          {/* Họ tên */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Họ và Tên *
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className={`w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#00a3ff] text-sm ${
                errors.fullName ? "border-red-500" : "border-[#bec7d4]/60"
              }`}
              placeholder="Nhập họ và tên nhân viên..."
            />
            {errors.fullName && (
              <span className="text-red-500 text-[11px] mt-0.5 block font-semibold">
                {errors.fullName}
              </span>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={`w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#00a3ff] text-sm ${
                errors.email ? "border-red-500" : "border-[#bec7d4]/60"
              }`}
              placeholder="Nhập địa chỉ email..."
            />
            {errors.email && (
              <span className="text-red-500 text-[11px] mt-0.5 block font-semibold">
                {errors.email}
              </span>
            )}
          </div>

          {/* Số điện thoại */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Số Điện Thoại *
            </label>
            <input
              type="text"
              value={form.phoneNumber}
              onChange={(e) =>
                setForm({ ...form, phoneNumber: e.target.value })
              }
              className={`w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#00a3ff] text-sm ${
                errors.phoneNumber ? "border-red-500" : "border-[#bec7d4]/60"
              }`}
              placeholder="Ví dụ: 0901234567..."
            />
            {errors.phoneNumber && (
              <span className="text-red-500 text-[11px] mt-0.5 block font-semibold">
                {errors.phoneNumber}
              </span>
            )}
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mật khẩu *
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={`w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#00a3ff] text-sm ${
                errors.password ? "border-red-500" : "border-[#bec7d4]/60"
              }`}
              placeholder="Tối thiểu 6 ký tự..."
            />
            {errors.password && (
              <span className="text-red-500 text-[11px] mt-0.5 block font-semibold">
                {errors.password}
              </span>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#bec7d4]/10 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#bec7d4]/60 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#00629d] hover:bg-[#00a3ff] text-white text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {loading && (
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
              )}
              Tạo nhân viên
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Modal Đặt Lại Mật Khẩu ────────────────────────────── */
function ResetPasswordModal({ isOpen, onClose, user, onConfirm, loading }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setError("");
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Vui lòng nhập mật khẩu mới");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu mới phải từ 8 ký tự trở lên");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    onConfirm(password.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,98,157,0.15)] border border-[#bec7d4]/20 w-full max-w-md overflow-hidden transform transition-all scale-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#bec7d4]/10 bg-slate-50/50 flex justify-between items-center text-left">
          <h3 className="font-headline-md text-base font-bold text-[#191c1e] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#00629d] text-[20px]">
              key
            </span>
            Đặt Lại Mật Khẩu
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          <p className="text-sm text-slate-600 leading-relaxed">
            Bạn đang đặt lại mật khẩu cho thành viên{" "}
            <strong className="text-slate-800">{user.fullName}</strong> (
            {user.email}). Mật khẩu mới phải có độ dài ít nhất 8 ký tự.
          </p>

          {/* Mật khẩu mới */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mật khẩu mới *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="w-full px-3 py-2 pr-10 border border-[#bec7d4]/60 rounded-xl outline-none focus:ring-2 focus:ring-[#00a3ff] text-sm bg-white"
                placeholder="Nhập mật khẩu mới..."
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Xác nhận mật khẩu *
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError("");
              }}
              className="w-full px-3 py-2 border border-[#bec7d4]/60 rounded-xl outline-none focus:ring-2 focus:ring-[#00a3ff] text-sm bg-white"
              placeholder="Xác nhận mật khẩu mới..."
            />
          </div>

          {error && (
            <span className="text-red-500 text-[11px] mt-0.5 block font-semibold">
              {error}
            </span>
          )}

          {/* Modal Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#bec7d4]/10 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#bec7d4]/60 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#00629d] hover:bg-[#00a3ff] text-white text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {loading && (
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
              )}
              Xác nhận
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Component Chính ─────────────────────────────────── */
export function UserManagement() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL"); // ALL, CUSTOMER, STAFF
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
  });

  // Modal State
  const [lockConfirmUser, setLockConfirmUser] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);

  // Debouncing search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setFilters((f) => ({ ...f, page: 1 }));
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Handle Tab Switch
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFilters((f) => ({ ...f, page: 1 }));
  };

  /* ── TanStack Queries ───────────────────────────────── */
  // 1. Fetch Users List
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["adminUsers", debouncedSearch, activeTab, filters.page],
    queryFn: () => {
      let typeParam = "";
      if (activeTab === "CUSTOMER") typeParam = "&userType=CUSTOMER";
      if (activeTab === "STAFF") typeParam = "&userType=STAFF";
      if (activeTab === "ADMIN") typeParam = "&userType=ADMIN";

      return api
        .get(
          `/users/admin/list?search=${debouncedSearch}${typeParam}&page=${filters.page}&limit=${filters.limit}`,
        )
        .then((res) => res.data);
    },
  });

  // 2. Fetch Roles Stats for Bento Grid
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["adminUsersStats"],
    queryFn: () => api.get("/users/admin/roles-stats").then((res) => res.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  /* ── TanStack Mutations ─────────────────────────────── */
  // Create staff user mutation
  const createStaffMutation = useMutation({
    mutationFn: (newStaff) =>
      api.post("/users/admin/create", {
        ...newStaff,
        userType: "STAFF",
        isActive: true,
      }),
    onSuccess: (res) => {
      toast.success(res.data.message || "Tạo tài khoản nhân sự thành công!");
      setIsCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["adminUsersStats"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Tạo tài khoản thất bại!");
    },
  });

  // Toggle active status (includes lockReason when locking)
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive, lockReason }) =>
      api.put(`/users/admin/update/${id}`, { isActive, lockReason }),
    onSuccess: (res) => {
      toast.success(res.data.message || "Cập nhật trạng thái thành công!");
      setActiveDropdown(null);
      setLockConfirmUser(null);
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["adminUsersStats"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Cập nhật thất bại!");
    },
  });

  // Admin reset password mutation
  const resetPasswordByAdminMutation = useMutation({
    mutationFn: ({ id, password }) =>
      api.put(`/users/admin/update/${id}`, { password }),
    onSuccess: (res) => {
      toast.success(res.data.message || "Đặt lại mật khẩu thành công!");
      setResetPasswordUser(null);
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Đặt lại mật khẩu thất bại!");
    },
  });

  const handleToggleActiveClick = (user) => {
    if (user.isActive) {
      // If active, open lock reason modal
      setLockConfirmUser(user);
    } else {
      // If already locked, unlock directly (passes isActive: true)
      toggleActiveMutation.mutate({ id: user.id, isActive: true });
    }
  };

  // Close dropdowns on window click
  useEffect(() => {
    const handleClose = () => setActiveDropdown(null);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, []);

  const stats = statsData?.stats;
  const isMutating =
    toggleActiveMutation.isPending ||
    createStaffMutation.isPending ||
    resetPasswordByAdminMutation.isPending;

  // Initials Avatar generator
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Roles Metadata for styling
  const ROLE_META = {
    ADMIN: {
      label: "QUẢN TRỊ VIÊN",
      cls: "bg-[#cfe5ff] text-[#004a77] border border-[#cfe5ff]",
    },
    STAFF: {
      label: "NHÂN VIÊN",
      cls: "bg-[#d0e7ea] text-[#364a4d] border border-[#d0e7ea]",
    },
    CUSTOMER: {
      label: "KHÁCH HÀNG",
      cls: "bg-blue-50 text-blue-600 border border-blue-100",
    },
  };

  return (
    <div className="space-y-8 pb-10 text-left">
      {/* Top Header Card */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0px_10px_30px_rgba(0,163,255,0.02)] flex flex-col md:flex-row justify-between items-center gap-4 text-left">
        <div>
          <h2 className="font-headline-lg text-2xl font-bold text-[#191c1e]">
            Quản Lý Người Dùng
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Xem danh sách, phân quyền vai trò và khóa tài khoản thành viên hệ
            thống.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <div className="relative flex-1 md:flex-initial">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200/80 focus:border-[#00a3ff] focus:bg-white outline-none text-sm transition-all w-full md:w-64"
              placeholder="Tìm kiếm người dùng..."
            />
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#00629d] hover:bg-[#00a3ff] text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-label-md text-sm transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              person_add
            </span>
            Thêm Nhân Viên
          </button>
        </div>
      </section>

      {/* Tabs & Quick Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200/50">
          <button
            onClick={() => handleTabChange("ALL")}
            className={`px-5 py-2 rounded-xl font-label-md text-xs transition-all ${
              activeTab === "ALL"
                ? "bg-white shadow-sm text-[#00629d] font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Tất cả ({statsLoading ? "—" : stats?.total || 0})
          </button>
          <button
            onClick={() => handleTabChange("CUSTOMER")}
            className={`px-5 py-2 rounded-xl font-label-md text-xs transition-all ${
              activeTab === "CUSTOMER"
                ? "bg-white shadow-sm text-[#00629d] font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Khách hàng ({statsLoading ? "—" : stats?.customer || 0})
          </button>
          <button
            onClick={() => handleTabChange("STAFF")}
            className={`px-5 py-2 rounded-xl font-label-md text-xs transition-all ${
              activeTab === "STAFF"
                ? "bg-white shadow-sm text-[#00629d] font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Nhân viên ({statsLoading ? "—" : stats?.staff || 0})
          </button>
          <button
            onClick={() => handleTabChange("ADMIN")}
            className={`px-5 py-2 rounded-xl font-label-md text-xs transition-all ${
              activeTab === "ADMIN"
                ? "bg-white shadow-sm text-[#00629d] font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Quản trị viên ({statsLoading ? "—" : stats?.admin || 0})
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => toast.info("Bộ lọc nâng cao đang được phát triển")}
            className="px-4 py-2 border border-slate-200 rounded-xl flex items-center gap-1.5 text-slate-600 font-label-sm text-xs hover:bg-slate-50 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              filter_list
            </span>
            Bộ lọc
          </button>
        </div>
      </div>

      {/* Notion-Style Table */}
      <section className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-[0px_10px_30px_rgba(0,163,255,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80">
                <th className="px-6 py-4 font-label-md text-slate-500 text-xs uppercase tracking-wider">
                  Họ tên / Email
                </th>
                <th className="px-6 py-4 font-label-md text-slate-500 text-xs uppercase tracking-wider">
                  Số điện thoại
                </th>
                <th className="px-6 py-4 font-label-md text-slate-500 text-xs uppercase tracking-wider">
                  Vai trò
                </th>
                <th className="px-6 py-4 font-label-md text-slate-500 text-xs uppercase tracking-wider">
                  Lịch sử đặt vé
                </th>
                <th className="px-6 py-4 font-label-md text-slate-500 text-xs uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} cols={6} />
                ))
              ) : !usersData?.users?.length ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <span className="material-symbols-outlined text-[32px] text-slate-400">
                          group_off
                        </span>
                      </div>
                      <p className="font-label-md text-slate-600 font-semibold">
                        Không tìm thấy người dùng
                      </p>
                      <p className="text-xs text-slate-400">
                        Thử điều chỉnh từ khóa tìm kiếm hoặc đổi danh mục lọc.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                usersData.users.map((user) => {
                  const role = ROLE_META[user.userType] || ROLE_META.CUSTOMER;
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Name & Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#cfe5ff] text-[#00629d] font-bold text-xs flex items-center justify-center shrink-0">
                            {getInitials(user.fullName)}
                          </div>
                          <div>
                            <p className="font-label-md text-sm font-semibold text-slate-900 leading-snug">
                              {user.fullName}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4 text-slate-600 text-xs whitespace-nowrap">
                        {user.phoneNumber}
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${role.cls}`}
                        >
                          {role.label}
                        </span>
                      </td>

                      {/* Booking History */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5 text-xs text-slate-700">
                          {user.latestBookingRoute ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00a3ff] shrink-0" />
                              <span className="font-semibold truncate max-w-[150px]">
                                {user.latestBookingRoute}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">
                              Không có dữ liệu
                            </span>
                          )}
                          {user.totalBookings > 0 && (
                            <span className="text-[10px] text-slate-400 font-bold ml-3">
                              Tổng: {user.totalBookings} vé
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold w-fit ${
                              user.isActive
                                ? "bg-green-50 text-green-700 border border-green-100"
                                : "bg-red-50 text-red-600 border border-red-100"
                            }`}
                          >
                            <span
                              className={`w-1 h-1 rounded-full ${
                                user.isActive ? "bg-green-500" : "bg-red-500"
                              }`}
                            />
                            {user.isActive ? "HOẠT ĐỘNG" : "BỊ KHÓA"}
                          </span>
                          {!user.isActive && user.lockReason && (
                            <span
                              className="text-[11px] text-slate-400 italic max-w-[180px] truncate block"
                              title={user.lockReason}
                            >
                              Lý do: {user.lockReason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        {currentUser?.id !== user.id && (
                          <div className="relative inline-block text-left">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(
                                  activeDropdown === user.id ? null : user.id,
                                );
                              }}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                more_vert
                              </span>
                            </button>

                            {/* Dropdown Menu */}
                            {activeDropdown === user.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200/80 rounded-xl shadow-lg z-20 py-1 text-left animate-fade-in"
                              >
                                <button
                                  onClick={() => handleToggleActiveClick(user)}
                                  className="w-full px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-slate-400">
                                    {user.isActive ? "lock" : "lock_open"}
                                  </span>
                                  {user.isActive
                                    ? "Khóa tài khoản"
                                    : "Mở khóa tài khoản"}
                                </button>
                                {user.userType === "STAFF" && (
                                  <button
                                    onClick={() => {
                                      setResetPasswordUser(user);
                                      setActiveDropdown(null);
                                    }}
                                    className="w-full px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-t border-slate-100"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-slate-400">
                                      key
                                    </span>
                                    Đặt lại mật khẩu
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {usersData?.pagination?.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <p className="text-slate-500 text-xs">
              Hiển thị{" "}
              <span className="font-semibold text-slate-800">
                {(filters.page - 1) * filters.limit + 1}–
                {Math.min(
                  filters.page * filters.limit,
                  usersData.pagination.total,
                )}
              </span>{" "}
              trong tổng{" "}
              <span className="font-semibold text-slate-800">
                {usersData.pagination.total}
              </span>{" "}
              thành viên
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                disabled={filters.page <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-white disabled:opacity-50 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_left
                </span>
              </button>

              {Array.from(
                { length: usersData.pagination.totalPages },
                (_, i) => i + 1,
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilters((f) => ({ ...f, page: p }))}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg font-label-sm text-xs transition-all ${
                    p === filters.page
                      ? "bg-[#00629d] text-white font-bold"
                      : "border border-slate-200 hover:bg-white cursor-pointer"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                disabled={filters.page >= usersData.pagination.totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-white disabled:opacity-50 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Permissions Bento Grid */}
      <section className="space-y-4">
        <h3 className="font-headline-md text-base font-bold text-[#191c1e] flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">
            security
          </span>
          Phân Quyền & Vai Trò
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Admin */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 hover:shadow-md transition-all group flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#cfe5ff]/40 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">
                  admin_panel_settings
                </span>
              </div>
              <span className="text-slate-400 font-label-sm text-xs">
                {statsLoading ? "—" : stats?.admin || 0} nhân sự
              </span>
            </div>
            <div>
              <h4 className="font-label-md text-slate-800 text-sm mb-1 font-semibold">
                Quản Trị Viên (Admin)
              </h4>
              <p className="text-slate-500 text-xs leading-relaxed">
                Toàn quyền truy cập hệ thống, quản lý tài khoản người dùng và
                doanh thu.
              </p>
            </div>
          </div>

          {/* Card 2: Staff */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 hover:shadow-md transition-all group flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#d0e7ea] flex items-center justify-center text-teal-700">
                <span className="material-symbols-outlined text-[24px]">
                  support_agent
                </span>
              </div>
              <span className="text-slate-400 font-label-sm text-xs">
                {statsLoading ? "—" : stats?.staff || 0} nhân sự
              </span>
            </div>
            <div>
              <h4 className="font-label-md text-slate-800 text-sm mb-1 font-semibold">
                Nhân Viên (Staff)
              </h4>
              <p className="text-slate-500 text-xs leading-relaxed">
                Quản lý lịch trình tàu chạy, xử lý yêu cầu hủy/hoàn vé và hỗ trợ
                khách hàng.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Modals & Dialogs */}
      <LockReasonModal
        isOpen={!!lockConfirmUser}
        onClose={() => setLockConfirmUser(null)}
        user={lockConfirmUser}
        onConfirm={(reason) =>
          toggleActiveMutation.mutate({
            id: lockConfirmUser.id,
            isActive: false,
            lockReason: reason,
          })
        }
        loading={isMutating}
      />

      <CreateStaffModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={(form) => createStaffMutation.mutate(form)}
        loading={isMutating}
      />

      <ResetPasswordModal
        isOpen={!!resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        user={resetPasswordUser}
        onConfirm={(newPassword) => {
          resetPasswordByAdminMutation.mutate({
            id: resetPasswordUser.id,
            password: newPassword,
          });
        }}
        loading={resetPasswordByAdminMutation.isPending}
      />
    </div>
  );
}
