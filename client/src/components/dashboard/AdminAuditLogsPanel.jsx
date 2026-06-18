import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { toast } from "sonner";

/* ── Skeleton Loader Row ────────────────────────────────── */
function SkeletonRow({ cols = 6 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div
            className="h-4 bg-[#eceef0] rounded-lg"
            style={{ width: `${60 + (i % 3) * 15}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

/* ── JSON Diff Viewer for Changes ───────────────────────── */
function JSONDiffViewer({ changesJson }) {
  if (!changesJson)
    return (
      <p className="text-xs text-slate-400 italic">
        Không có chi tiết thay đổi
      </p>
    );

  try {
    const changes =
      typeof changesJson === "string" ? JSON.parse(changesJson) : changesJson;
    const entries = Object.entries(changes);

    if (entries.length === 0) {
      return <p className="text-xs text-slate-400 italic">Không có thay đổi</p>;
    }

    return (
      <div className="border border-[#bec7d4]/30 rounded-xl overflow-hidden text-xs bg-slate-50">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="px-4 py-2 font-semibold text-slate-700 w-1/3">
                Trường
              </th>
              <th className="px-4 py-2 font-semibold text-slate-700">
                Giá trị thay đổi / Chi tiết
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono">
            {entries.map(([key, val]) => {
              let displayVal = "";
              if (val === null) {
                displayVal = (
                  <span className="text-slate-400 italic">null</span>
                );
              } else if (typeof val === "object") {
                displayVal = JSON.stringify(val);
              } else if (typeof val === "boolean") {
                displayVal = val ? (
                  <span className="text-green-600 font-bold">TRUE</span>
                ) : (
                  <span className="text-red-600 font-bold">FALSE</span>
                );
              } else {
                displayVal = String(val);
              }

              // Special rendering for common keys
              if (key.toLowerCase().includes("password")) {
                displayVal = (
                  <span className="text-amber-600">
                    ****** (Đã mã hóa/thay đổi)
                  </span>
                );
              }

              return (
                <tr key={key} className="hover:bg-slate-100/50">
                  <td className="px-4 py-2 font-bold text-slate-600">{key}</td>
                  <td className="px-4 py-2 text-slate-800 break-all">
                    {displayVal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  } catch {
    return (
      <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-xs font-mono max-h-60">
        {String(changesJson)}
      </pre>
    );
  }
}

/* ── Log Details Modal ──────────────────────────────────── */
function LogDetailsModal({ isOpen, onClose, log, logType }) {
  if (!isOpen || !log) return null;

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const isSystemLog = logType === "SYSTEM";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,98,157,0.15)] border border-[#bec7d4]/20 w-full max-w-2xl overflow-hidden transform transition-all scale-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#bec7d4]/10 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-headline-md text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00629d]">
              {isSystemLog ? "info" : "shield_lock"}
            </span>
            Chi Tiết Nhật Ký {isSystemLog ? "Hệ Thống" : "Bảo Mật"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer border-none bg-transparent"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh] text-left">
          {/* Basic Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">
                Thời gian ghi nhận
              </p>
              <p className="mt-0.5 font-semibold text-slate-800">
                {formatDate(log.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">
                Địa chỉ IP
              </p>
              <p className="mt-0.5 font-semibold text-slate-800 font-mono">
                {log.ipAddress || "Không rõ"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">
                {isSystemLog
                  ? "Quản trị viên thực hiện"
                  : "Người dùng liên quan"}
              </p>
              <p className="mt-0.5 font-semibold text-[#00629d]">
                {isSystemLog
                  ? `${log.admin?.fullName || "Hệ thống"} (${log.admin?.email || "N/A"})`
                  : log.user
                    ? `${log.user.fullName} (${log.user.email})`
                    : "Khách vãng lai / Chưa đăng nhập"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">
                {isSystemLog
                  ? "Loại hành động & Đối tượng"
                  : "Sự kiện & Trạng thái"}
              </p>
              <div className="mt-1 flex gap-2">
                {isSystemLog ? (
                  <>
                    <span className="px-2 py-0.5 bg-[#cfe5ff] text-[#004a77] text-xs font-bold rounded">
                      {log.action}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded">
                      {log.entity}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-2 py-0.5 bg-violet-100 text-violet-800 text-xs font-bold rounded">
                      {log.eventType}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded ${
                        log.status === "SUCCESS"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {log.status === "SUCCESS" ? "THÀNH CÔNG" : "THẤT BẠI"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">
              Mô tả chi tiết
            </p>
            <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-xl text-slate-800 text-sm font-medium leading-relaxed">
              {log.description || "Không có mô tả"}
            </div>
          </div>

          {/* User Agent (Security Log only) */}
          {!isSystemLog && log.userAgent && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">
                Thiết bị & Trình duyệt (User Agent)
              </p>
              <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-xl text-slate-600 text-xs font-mono break-all leading-normal">
                {log.userAgent}
              </div>
            </div>
          )}

          {/* Changes JSON (System Log only) */}
          {isSystemLog && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">
                Thông tin thay đổi dữ liệu (Changes JSON)
              </p>
              <JSONDiffViewer changesJson={log.changes} />
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex pt-4 border-t border-[#bec7d4]/10 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all active:scale-95 border-none cursor-pointer"
            >
              Đóng chi tiết
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */
export function AdminAuditLogsPanel() {
  const [activeTab, setActiveTab] = useState("SYSTEM"); // SYSTEM (AdminLog) or SECURITY (SecurityLog)
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Advanced filters state
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Detail Modal state
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debouncing search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeTab, actionFilter, entityFilter, startDate, endDate]);

  /* ── React Query Fetching ───────────────────────────────── */
  // 1. Fetch Audit Logs (SYSTEM)
  const {
    data: systemLogsData,
    isLoading: systemLoading,
    refetch: refetchSystem,
  } = useQuery({
    queryKey: [
      "adminAuditLogs",
      debouncedSearch,
      actionFilter,
      entityFilter,
      startDate,
      endDate,
      page,
    ],
    queryFn: () => {
      let query = `/users/admin/audit-logs?page=${page}&limit=${limit}`;
      if (debouncedSearch)
        query += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (actionFilter) query += `&action=${actionFilter}`;
      if (entityFilter) query += `&entity=${entityFilter}`;
      if (startDate) query += `&startDate=${startDate}`;
      if (endDate) query += `&endDate=${endDate}`;
      return api.get(query).then((res) => res.data);
    },
    enabled: activeTab === "SYSTEM",
  });

  // 2. Fetch Security Logs (SECURITY)
  const {
    data: securityLogsData,
    isLoading: securityLoading,
    refetch: refetchSecurity,
  } = useQuery({
    queryKey: [
      "securityLogs",
      debouncedSearch,
      actionFilter,
      startDate,
      endDate,
      page,
    ],
    queryFn: () => {
      let query = `/users/admin/security-logs?page=${page}&limit=${limit}`;
      if (debouncedSearch)
        query += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (actionFilter) query += `&eventType=${actionFilter}`;
      if (startDate) query += `&startDate=${startDate}`;
      if (endDate) query += `&endDate=${endDate}`;
      return api.get(query).then((res) => res.data);
    },
    enabled: activeTab === "SECURITY",
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setActionFilter("");
    setEntityFilter("");
  };

  const handleClearFilters = () => {
    setSearch("");
    setActionFilter("");
    setEntityFilter("");
    setStartDate("");
    setEndDate("");
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionBadgeClass = (action) => {
    switch (action) {
      case "CREATE":
        return "bg-green-50 text-green-700 border-green-200";
      case "UPDATE":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "DELETE":
        return "bg-red-50 text-red-700 border-red-200";
      case "APPROVE":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getEventBadgeClass = (type) => {
    if (type.includes("SUCCESS"))
      return "bg-green-50 text-green-700 border-green-200";
    if (type.includes("FAILED")) return "bg-red-50 text-red-700 border-red-200";
    if (type.includes("CHANGE") || type.includes("RESET"))
      return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-violet-50 text-violet-700 border-violet-200";
  };

  const isLoading = activeTab === "SYSTEM" ? systemLoading : securityLoading;
  const logsData = activeTab === "SYSTEM" ? systemLogsData : securityLogsData;
  const logs = logsData?.logs || [];
  const pagination = logsData?.pagination || {
    total: 0,
    page: 1,
    totalPages: 1,
  };

  return (
    <div className="space-y-6 text-left">
      {/* Local App Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e] tracking-tight">
            Nhật Ký & Lịch Sử Hệ Thống
          </h2>
          <p className="text-sm text-[#3f4852] mt-1">
            Ghi nhận kiểm toán trực quan các thay đổi hệ thống và sự kiện bảo
            mật realtime.
          </p>
        </div>
        <button
          onClick={() => {
            if (activeTab === "SYSTEM") refetchSystem();
            else refetchSecurity();
            toast.success("Đã làm mới danh sách nhật ký.");
          }}
          className="flex items-center gap-1.5 bg-[#f2f4f6] hover:bg-[#eceef0] text-[#3f4852] px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border-none cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Làm mới
        </button>
      </div>

      {/* Tabs Switch */}
      <div className="flex gap-1 bg-[#f2f4f6] p-1 rounded-xl w-fit">
        <button
          onClick={() => handleTabChange("SYSTEM")}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all border-none cursor-pointer ${
            activeTab === "SYSTEM"
              ? "bg-white text-[#00629d] shadow-sm"
              : "bg-transparent text-[#3f4852] hover:text-[#191c1e]"
          }`}
        >
          Lịch Sử Hệ Thống (Audit Logs)
        </button>
        <button
          onClick={() => handleTabChange("SECURITY")}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all border-none cursor-pointer ${
            activeTab === "SECURITY"
              ? "bg-white text-[#00629d] shadow-sm"
              : "bg-transparent text-[#3f4852] hover:text-[#191c1e]"
          }`}
        >
          Nhật Ký Bảo Mật (Security Logs)
        </button>
      </div>

      {/* Bento Stats Block */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#bec7d4]/10 shadow-[0px_4px_16px_rgba(0,163,255,0.04)]">
          <p className="text-xs text-[#3f4852]/70 font-semibold uppercase">
            Tổng số bản ghi
          </p>
          <h3 className="text-2xl font-extrabold text-[#191c1e] mt-1">
            {pagination.total}
          </h3>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#bec7d4]/10 shadow-[0px_4px_16px_rgba(0,163,255,0.04)]">
          <p className="text-xs text-[#3f4852]/70 font-semibold uppercase">
            {activeTab === "SYSTEM" ? "Thao tác sửa (UPDATE)" : "Đăng nhập lỗi"}
          </p>
          <h3 className="text-2xl font-extrabold text-[#00629d] mt-1">
            {activeTab === "SYSTEM" ? "Ghi nhận tức thời" : "Giám sát 24/7"}
          </h3>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#bec7d4]/10 shadow-[0px_4px_16px_rgba(0,163,255,0.04)]">
          <p className="text-xs text-[#3f4852]/70 font-semibold uppercase">
            Địa chỉ IP giám sát
          </p>
          <h3 className="text-2xl font-extrabold text-indigo-600 mt-1">
            IPv4 / IPv6
          </h3>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#bec7d4]/10 shadow-[0px_4px_16px_rgba(0,163,255,0.04)]">
          <p className="text-xs text-[#3f4852]/70 font-semibold uppercase">
            Kiểm toán
          </p>
          <span className="inline-flex items-center gap-1 text-green-700 text-xs bg-green-100/60 px-2 rounded-full font-bold mt-2">
            Đạt chuẩn bảo mật
          </span>
        </div>
      </div>

      {/* Advanced Filter Box */}
      <div className="bg-white rounded-2xl p-5 border border-[#bec7d4]/20 shadow-[0px_10px_30px_rgba(0,163,255,0.04)] space-y-4">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[#00629d] text-[18px]">
            tune
          </span>
          Bộ lọc nâng cao
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tìm kiếm từ khóa
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mô tả, admin, IP..."
              className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#00a3ff] outline-none"
            />
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {activeTab === "SYSTEM" ? "Hành động" : "Loại sự kiện"}
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full border border-[#bec7d4]/50 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white cursor-pointer"
            >
              <option value="">Tất cả</option>
              {activeTab === "SYSTEM" ? (
                <>
                  <option value="CREATE">CREATE (Tạo mới)</option>
                  <option value="UPDATE">UPDATE (Cập nhật)</option>
                  <option value="DELETE">DELETE (Xóa)</option>
                  <option value="APPROVE">APPROVE (Duyệt)</option>
                  <option value="ACTIVATE">ACTIVATE (Kích hoạt)</option>
                  <option value="DEACTIVATE">DEACTIVATE (Tạm dừng)</option>
                </>
              ) : (
                <>
                  <option value="LOGIN_SUCCESS">
                    LOGIN_SUCCESS (Đăng nhập OK)
                  </option>
                  <option value="LOGIN_FAILED">
                    LOGIN_FAILED (Đăng nhập lỗi)
                  </option>
                  <option value="PASSWORD_RESET_REQUEST">
                    PASSWORD_RESET_REQUEST
                  </option>
                  <option value="PASSWORD_CHANGE">
                    PASSWORD_CHANGE (Đổi pass)
                  </option>
                </>
              )}
            </select>
          </div>

          {/* Entity Filter (System Log only) */}
          {activeTab === "SYSTEM" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Đối tượng (Entity)
              </label>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="w-full border border-[#bec7d4]/50 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white cursor-pointer"
              >
                <option value="">Tất cả</option>
                <option value="User">User (Người dùng)</option>
                <option value="Train">Train (Tàu hỏa)</option>
                <option value="Route">Route (Tuyến đường)</option>
                <option value="RouteTemplate">RouteTemplate (Mẫu lịch)</option>
                <option value="Schedule">Schedule (Lịch trình)</option>
                <option value="PricingPolicy">PricingPolicy (Giá vé)</option>
                <option value="Voucher">Voucher (Mã giảm giá)</option>
                <option value="Promotion">Promotion (Khuyến mãi)</option>
                <option value="Booking">Booking (Đơn đặt vé)</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Trạng thái bảo mật
              </label>
              <select
                value={entityFilter} // we reuse this as status filter in security tab
                onChange={(e) => setEntityFilter(e.target.value)}
                className="w-full border border-[#bec7d4]/50 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white cursor-pointer"
              >
                <option value="">Tất cả</option>
                <option value="SUCCESS">SUCCESS (Thành công)</option>
                <option value="FAILURE">FAILURE (Thất bại)</option>
              </select>
            </div>
          )}

          {/* From Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Từ ngày
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-[#00a3ff] outline-none cursor-pointer"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Đến ngày
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-[#00a3ff] outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Clear Filters button */}
        {(search || actionFilter || entityFilter || startDate || endDate) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold bg-red-50 hover:bg-red-100/60 px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">
                filter_alt_off
              </span>
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* Logs Table Card */}
      <div className="bg-white rounded-2xl border border-[#bec7d4]/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)] overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-[#bec7d4]/20">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                    Thời gian
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                    Đối tượng / Loại
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                    Người thực hiện
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                    Chi tiết hành động
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                    IP
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">
                    Tác vụ
                  </th>
                </tr>
              </thead>
              <tbody>
                <SkeletonRow cols={6} />
                <SkeletonRow cols={6} />
                <SkeletonRow cols={6} />
              </tbody>
            </table>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <span className="material-symbols-outlined text-5xl block mb-2 opacity-50">
              history_toggle_off
            </span>
            <p className="font-bold text-slate-600 text-sm">
              Không tìm thấy bản ghi nhật ký nào
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Thử điều chỉnh hoặc xóa các bộ lọc hiện tại.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-[#bec7d4]/20">
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Thời gian
                  </th>
                  {activeTab === "SYSTEM" ? (
                    <>
                      <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Hành động
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Đối tượng
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Admin
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Sự kiện
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Trạng thái
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Tài khoản
                      </th>
                    </>
                  )}
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Nội dung tóm tắt
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    IP
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">
                    Tác vụ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bec7d4]/10 text-sm text-slate-700">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Time */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                      {formatDate(log.createdAt)}
                    </td>

                    {/* Conditional Columns */}
                    {activeTab === "SYSTEM" ? (
                      <>
                        {/* Action */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${getActionBadgeClass(log.action)}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        {/* Entity */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-600">
                          {log.entity}
                        </td>
                        {/* Admin */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-semibold text-xs text-slate-800">
                            {log.admin?.fullName || "Hệ thống"}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {log.admin?.email || "N/A"}
                          </p>
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Event type */}
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-xs text-violet-700">
                          {log.eventType}
                        </td>
                        {/* Status */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                              log.status === "SUCCESS"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {log.status === "SUCCESS"
                              ? "THÀNH CÔNG"
                              : "THẤT BẠI"}
                          </span>
                        </td>
                        {/* User */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.user ? (
                            <>
                              <p className="font-semibold text-xs text-slate-800">
                                {log.user.fullName}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {log.user.email}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Khách vãng lai
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    {/* Summary Description */}
                    <td
                      className="px-6 py-4 max-w-xs truncate font-medium text-slate-600"
                      title={log.description}
                    >
                      {log.description}
                    </td>

                    {/* IP */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">
                      {log.ipAddress || "—"}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold">
                      <button
                        onClick={() => handleViewDetails(log)}
                        className="inline-flex items-center gap-1 text-[#00629d] hover:text-[#00527f] bg-slate-100 hover:bg-[#cfe5ff]/50 px-3 py-1.5 rounded-lg transition-all cursor-pointer border-none"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          visibility
                        </span>
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Block */}
        {!isLoading && logs.length > 0 && (
          <div className="px-6 py-4 bg-[#f2f4f6]/30 border-t border-[#bec7d4]/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 font-semibold">
              Hiển thị{" "}
              <span className="text-slate-800">{(page - 1) * limit + 1}</span> -{" "}
              <span className="text-slate-800">
                {Math.min(page * limit, pagination.total)}
              </span>{" "}
              trong số{" "}
              <span className="text-slate-800">{pagination.total}</span> bản ghi
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white border border-[#bec7d4]/50 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_left
                </span>
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === pagination.totalPages ||
                    Math.abs(p - page) <= 1,
                )
                .map((p, idx, arr) => (
                  <span key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-1.5 text-slate-400 text-xs">…</span>
                    )}
                    <button
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border transition-all cursor-pointer ${
                        p === page
                          ? "bg-[#00629d] text-white border-[#00629d]"
                          : "border-[#bec7d4]/50 hover:bg-white text-slate-600"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                ))}

              <button
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={page === pagination.totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white border border-[#bec7d4]/50 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      <LogDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedLog(null);
        }}
        log={selectedLog}
        logType={activeTab}
      />
    </div>
  );
}
