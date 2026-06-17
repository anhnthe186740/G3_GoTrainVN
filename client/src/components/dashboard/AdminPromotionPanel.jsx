import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "../../services/api";

export function AdminPromotionPanel() {
  const [activeTab, setActiveTab] = useState("vouchers"); // vouchers or promotions

  // Data lists
  const [vouchers, setVouchers] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [trains, setTrains] = useState([]);

  // Loading & paging
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // create or edit
  const [editingItem, setEditingItem] = useState(null);

  // Form states
  const [voucherForm, setVoucherForm] = useState({
    voucherCode: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    minBookingAmount: "",
    maxDiscountAmount: "",
    maxUsageCount: "",
    validFrom: "",
    validTo: "",
    active: true,
  });

  const [promotionForm, setPromotionForm] = useState({
    title: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    routeIds: [], // array of selected route IDs
    trainIds: [], // array of selected train IDs
    validFrom: "",
    validTo: "",
    maxBudget: "",
    status: "ACTIVE",
  });

  // Fetch reference data (routes and trains)
  const fetchReferenceData = async () => {
    try {
      const [routesRes, trainsRes] = await Promise.all([
        api.get("/routes"),
        api.get("/trains"),
      ]);
      setRoutes(routesRes.data.routes || []);
      setTrains(trainsRes.data.trains || []);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu cấu hình tuyến/tàu:", err);
    }
  };

  // Fetch Vouchers (Admin)
  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(
        `/promotions/admin/vouchers?search=${searchQuery}&page=${page}&limit=10`,
      );
      setVouchers(data.vouchers || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Không thể tải danh sách Vouchers.",
      );
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page]);

  // Fetch Promotions (Admin)
  const fetchPromotions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(
        `/promotions/admin/promotions?search=${searchQuery}&page=${page}&limit=10`,
      );
      setPromotions(data.promotions || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Không thể tải danh sách Khuyến mãi.",
      );
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page]);

  // Switch tab resets paging
  useEffect(() => {
    setPage(1);
    setSearchQuery("");
  }, [activeTab]);

  // Load data based on tab & paging
  useEffect(() => {
    if (activeTab === "vouchers") {
      fetchVouchers();
    } else {
      fetchPromotions();
    }
  }, [activeTab, fetchVouchers, fetchPromotions]);

  // Load reference data on mount
  useEffect(() => {
    fetchReferenceData();
  }, []);

  // Open modal
  const handleOpenCreate = () => {
    setModalMode("create");
    setEditingItem(null);

    // Reset forms
    setVoucherForm({
      voucherCode: "",
      description: "",
      discountType: "PERCENTAGE",
      discountValue: "",
      minBookingAmount: "",
      maxDiscountAmount: "",
      maxUsageCount: "",
      validFrom: new Date().toISOString().split("T")[0],
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      active: true,
    });

    setPromotionForm({
      title: "",
      description: "",
      discountType: "PERCENTAGE",
      discountValue: "",
      routeIds: [],
      trainIds: [],
      validFrom: new Date().toISOString().split("T")[0],
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      maxBudget: "",
      status: "ACTIVE",
    });

    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setModalMode("edit");
    setEditingItem(item);

    if (activeTab === "vouchers") {
      setVoucherForm({
        voucherCode: item.voucherCode,
        description: item.description || "",
        discountType: item.discountType,
        discountValue: item.discountValue,
        minBookingAmount: item.minBookingAmount || "",
        maxDiscountAmount: item.maxDiscountAmount || "",
        maxUsageCount: item.maxUsageCount || "",
        validFrom: item.validFrom ? item.validFrom.split("T")[0] : "",
        validTo: item.validTo ? item.validTo.split("T")[0] : "",
        active: item.active,
      });
    } else {
      setPromotionForm({
        title: item.title,
        description: item.description || "",
        discountType: item.discountType,
        discountValue: item.discountValue,
        routeIds: item.routeIds || [],
        trainIds: item.trainIds || [],
        validFrom: item.validFrom ? item.validFrom.split("T")[0] : "",
        validTo: item.validTo ? item.validTo.split("T")[0] : "",
        maxBudget: item.maxBudget || "",
        status: item.status,
      });
    }

    setShowModal(true);
  };

  // Delete handler
  const handleDelete = async (id, name) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa ${activeTab === "vouchers" ? "mã voucher" : "khuyến mãi"} "${name}"?`,
      )
    ) {
      return;
    }

    try {
      const endpoint =
        activeTab === "vouchers"
          ? `/promotions/admin/vouchers/${id}`
          : `/promotions/admin/promotions/${id}`;

      await api.delete(endpoint);
      toast.success("Đã xóa thành công!");

      if (activeTab === "vouchers") fetchVouchers();
      else fetchPromotions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi xảy ra khi xóa.");
    }
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === "vouchers") {
        if (!voucherForm.voucherCode.trim() || !voucherForm.discountValue) {
          toast.error("Vui lòng nhập đầy đủ mã và giá trị giảm.");
          return;
        }

        const payload = {
          ...voucherForm,
          discountValue: Number(voucherForm.discountValue),
          minBookingAmount: voucherForm.minBookingAmount
            ? Number(voucherForm.minBookingAmount)
            : null,
          maxDiscountAmount: voucherForm.maxDiscountAmount
            ? Number(voucherForm.maxDiscountAmount)
            : null,
          maxUsageCount: voucherForm.maxUsageCount
            ? Number(voucherForm.maxUsageCount)
            : null,
        };

        if (modalMode === "create") {
          await api.post("/promotions/admin/vouchers", payload);
          toast.success("Tạo mới Voucher thành công!");
        } else {
          await api.put(
            `/promotions/admin/vouchers/${editingItem.id}`,
            payload,
          );
          toast.success("Cập nhật Voucher thành công!");
        }
        fetchVouchers();
      } else {
        if (!promotionForm.title.trim() || !promotionForm.discountValue) {
          toast.error("Vui lòng điền tiêu đề và giá trị giảm.");
          return;
        }

        const payload = {
          ...promotionForm,
          discountValue: Number(promotionForm.discountValue),
          maxBudget: promotionForm.maxBudget
            ? Number(promotionForm.maxBudget)
            : null,
        };

        if (modalMode === "create") {
          await api.post("/promotions/admin/promotions", payload);
          toast.success("Tạo khuyến mãi mới thành công!");
        } else {
          await api.put(
            `/promotions/admin/promotions/${editingItem.id}`,
            payload,
          );
          toast.success("Cập nhật khuyến mãi thành công!");
        }
        fetchPromotions();
      }
      setShowModal(false);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Lỗi xảy ra khi gửi biểu mẫu.",
      );
    }
  };

  // Toggle Toggle active status directly
  const handleToggleActive = async (item) => {
    try {
      if (activeTab === "vouchers") {
        await api.put(`/promotions/admin/vouchers/${item.id}`, {
          ...item,
          active: !item.active,
        });
        toast.success(
          `Đã ${!item.active ? "kích hoạt" : "vô hiệu hóa"} voucher.`,
        );
        fetchVouchers();
      } else {
        const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        await api.put(`/promotions/admin/promotions/${item.id}`, {
          ...item,
          status: nextStatus,
        });
        toast.success(
          `Đã ${nextStatus === "ACTIVE" ? "kích hoạt" : "vô hiệu hóa"} khuyến mãi.`,
        );
        fetchPromotions();
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Lỗi khi cập nhật trạng thái.",
      );
    }
  };

  // Helpers for multi-select routes/trains
  const handleCheckboxChange = (type, id) => {
    if (type === "route") {
      const selected = [...promotionForm.routeIds];
      const idx = selected.indexOf(id);
      if (idx > -1) selected.splice(idx, 1);
      else selected.push(id);
      setPromotionForm({ ...promotionForm, routeIds: selected });
    } else {
      const selected = [...promotionForm.trainIds];
      const idx = selected.indexOf(id);
      if (idx > -1) selected.splice(idx, 1);
      else selected.push(id);
      setPromotionForm({ ...promotionForm, trainIds: selected });
    }
  };

  const getRouteName = (id) => {
    const route = routes.find((r) => r.id === id);
    return route ? route.routeName : id;
  };

  const getTrainName = (id) => {
    const train = trains.find((t) => t.id === id);
    return train ? train.trainName : id;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e] mb-xs">
            Quản Lý Khuyến Mãi & Vouchers
          </h2>
          <p className="text-sm text-[#3f4852] mt-1">
            Thiết lập mã giảm giá (Vouchers) hoặc các chương trình tự động ưu
            đãi theo chặng bay/chuyến tàu.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary-container to-primary text-white px-md py-3 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">
            add_circle
          </span>
          Tạo Khuyến Mãi Mới
        </button>
      </div>

      {/* Tabs Selector */}
      <div className="flex gap-4 border-b border-outline-variant/30 pb-2">
        <button
          onClick={() => setActiveTab("vouchers")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "vouchers"
              ? "border-primary text-primary font-black"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            local_activity
          </span>
          Vouchers (Mã giảm giá)
        </button>
        <button
          onClick={() => setActiveTab("promotions")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "promotions"
              ? "border-primary text-primary font-black"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">stars</span>
          Khuyến mãi tự động (System-wide)
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-md items-center bg-white p-4 rounded-xl border border-outline-variant/10 shadow-[0px_4px_16px_rgba(0,163,255,0.04)]">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
            search
          </span>
          <input
            className="w-full pl-12 pr-md py-2.5 bg-surface rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary-container outline-none transition-all text-sm"
            placeholder={
              activeTab === "vouchers"
                ? "Tìm kiếm mã voucher..."
                : "Tìm kiếm tên chương trình..."
            }
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-outline-variant/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#3f4852]">
            <span className="material-symbols-outlined animate-spin text-3xl mb-2">
              progress_activity
            </span>
            <p className="text-sm font-semibold">Đang tải dữ liệu...</p>
          </div>
        ) : activeTab === "vouchers" ? (
          /* Vouchers Table */
          <div className="overflow-x-auto">
            {vouchers.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <span className="material-symbols-outlined text-4xl mb-1">
                  local_activity
                </span>
                <p className="text-sm">Chưa có mã voucher nào được tạo.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f2f4f6]/50">
                  <tr className="border-b border-outline-variant">
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Mã Code
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Loại Giảm
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Trị giá giảm
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Đơn tối thiểu
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Lượt Dùng
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Thời hạn
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Kích Hoạt
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider text-right">
                      Thao Tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {vouchers.map((v) => (
                    <tr
                      key={v.id}
                      className="hover:bg-surface/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-primary text-sm">
                        {v.voucherCode}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                        {v.discountType === "PERCENTAGE"
                          ? "Phần trăm (%)"
                          : "Số tiền cố định"}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-800">
                        {v.discountType === "PERCENTAGE"
                          ? `${v.discountValue}%`
                          : `${v.discountValue.toLocaleString()} VND`}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {v.minBookingAmount
                          ? `${v.minBookingAmount.toLocaleString()}đ`
                          : "Không có"}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold">
                        <span className="text-primary font-bold">
                          {v.currentUsageCount}
                        </span>
                        {v.maxUsageCount
                          ? ` / ${v.maxUsageCount}`
                          : " (Vô hạn)"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {formatDate(v.validFrom)} - {formatDate(v.validTo)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(v)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                            v.active
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          }`}
                        >
                          {v.active ? "Đang chạy" : "Vô hiệu"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(v)}
                            className="p-1.5 text-slate-500 hover:text-primary transition rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="Sửa"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              edit
                            </span>
                          </button>
                          <button
                            onClick={() => handleDelete(v.id, v.voucherCode)}
                            className="p-1.5 text-slate-500 hover:text-red-600 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="Xóa"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              delete
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* Promotions Table */
          <div className="overflow-x-auto">
            {promotions.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <span className="material-symbols-outlined text-4xl mb-1">
                  stars
                </span>
                <p className="text-sm">
                  Chưa có chương trình khuyến mãi tự động nào.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f2f4f6]/50">
                  <tr className="border-b border-outline-variant">
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Tiêu Đề
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Giảm Giá
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Áp dụng cho
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Hạn sử dụng
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Ngân Sách Đã Dùng
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                      Trạng Thái
                    </th>
                    <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider text-right">
                      Thao Tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {promotions.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-surface/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 text-sm block">
                          {p.title}
                        </span>
                        {p.description && (
                          <span className="text-xs text-slate-400 block max-w-xs truncate">
                            {p.description}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-800">
                        {p.discountType === "PERCENTAGE"
                          ? `${p.discountValue}%`
                          : p.discountType === "FREE_UPGRADE"
                            ? "Nâng Hạng Vé"
                            : `${p.discountValue.toLocaleString()} VND`}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 max-w-[200px] truncate">
                        {p.routeIds.length === 0 && p.trainIds.length === 0 ? (
                          "Toàn bộ tàu & chặng"
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {p.routeIds.length > 0 && (
                              <span>
                                Chặng: {p.routeIds.map(getRouteName).join(", ")}
                              </span>
                            )}
                            {p.trainIds.length > 0 && (
                              <span>
                                Tàu: {p.trainIds.map(getTrainName).join(", ")}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {formatDate(p.validFrom)} - {formatDate(p.validTo)}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="font-bold text-amber-600">
                          {(p.usedBudget || 0).toLocaleString()}đ
                        </span>
                        {p.maxBudget
                          ? ` / ${p.maxBudget.toLocaleString()}đ`
                          : " (Vô hạn)"}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                            p.status === "ACTIVE"
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          }`}
                        >
                          {p.status === "ACTIVE" ? "Đang chạy" : "Vô hiệu"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-slate-500 hover:text-primary transition rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="Sửa"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              edit
                            </span>
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.title)}
                            className="p-1.5 text-slate-500 hover:text-red-600 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="Xóa"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              delete
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="p-4 flex justify-between items-center bg-[#f2f4f6]/30 border-t border-outline-variant/30 text-xs">
            <span className="text-slate-500">
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded border border-[#bec7d4] hover:bg-white disabled:opacity-50 cursor-pointer"
              >
                Trước
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 rounded border border-[#bec7d4] hover:bg-white disabled:opacity-50 cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: CREATE OR EDIT */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-md bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/30 flex flex-col max-h-[90vh] text-left">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">
                {modalMode === "create" ? "Thêm mới" : "Chỉnh sửa"}{" "}
                {activeTab === "vouchers" ? "Voucher" : "Khuyến mãi"}
              </h3>
              <button
                className="p-2 hover:bg-slate-100 rounded-full transition text-slate-400 font-bold cursor-pointer"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {activeTab === "vouchers" ? (
                /* Voucher Form Fields */
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Mã Voucher *
                      </label>
                      <input
                        required
                        type="text"
                        disabled={modalMode === "edit"}
                        placeholder="VD: GOTRAINV20"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary disabled:bg-slate-100 uppercase font-mono font-bold"
                        value={voucherForm.voucherCode}
                        onChange={(e) =>
                          setVoucherForm({
                            ...voucherForm,
                            voucherCode: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Loại giảm giá
                      </label>
                      <select
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm bg-white outline-none focus:border-primary cursor-pointer"
                        value={voucherForm.discountType}
                        onChange={(e) =>
                          setVoucherForm({
                            ...voucherForm,
                            discountType: e.target.value,
                          })
                        }
                      >
                        <option value="PERCENTAGE">Phần trăm (%)</option>
                        <option value="FIXED_AMOUNT">
                          Số tiền cố định (VND)
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Trị giá giảm *
                      </label>
                      <input
                        required
                        type="number"
                        placeholder="VD: 20 hoặc 50000"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary font-bold"
                        value={voucherForm.discountValue}
                        onChange={(e) =>
                          setVoucherForm({
                            ...voucherForm,
                            discountValue: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Giảm tối đa (VND)
                      </label>
                      <input
                        type="number"
                        placeholder="Để trống nếu không giới hạn"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                        value={voucherForm.maxDiscountAmount}
                        onChange={(e) =>
                          setVoucherForm({
                            ...voucherForm,
                            maxDiscountAmount: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Đơn tối thiểu (VND)
                      </label>
                      <input
                        type="number"
                        placeholder="VD: 200000"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                        value={voucherForm.minBookingAmount}
                        onChange={(e) =>
                          setVoucherForm({
                            ...voucherForm,
                            minBookingAmount: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Giới hạn số lượt dùng
                      </label>
                      <input
                        type="number"
                        placeholder="Để trống nếu không giới hạn"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                        value={voucherForm.maxUsageCount}
                        onChange={(e) =>
                          setVoucherForm({
                            ...voucherForm,
                            maxUsageCount: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Có hiệu lực từ
                      </label>
                      <input
                        required
                        type="date"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                        value={voucherForm.validFrom}
                        onChange={(e) =>
                          setVoucherForm({
                            ...voucherForm,
                            validFrom: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Hết hạn vào ngày
                      </label>
                      <input
                        required
                        type="date"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                        value={voucherForm.validTo}
                        onChange={(e) =>
                          setVoucherForm({
                            ...voucherForm,
                            validTo: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">
                      Mô tả
                    </label>
                    <textarea
                      placeholder="Mô tả thông tin chương trình voucher..."
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary h-20 resize-none"
                      value={voucherForm.description}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="voucherActive"
                      className="w-4 h-4 text-primary accent-primary rounded cursor-pointer"
                      checked={voucherForm.active}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          active: e.target.checked,
                        })
                      }
                    />
                    <label
                      htmlFor="voucherActive"
                      className="text-sm font-bold text-slate-700 cursor-pointer"
                    >
                      Kích hoạt hoạt động ngay
                    </label>
                  </div>
                </>
              ) : (
                /* Promotion Form Fields */
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">
                      Tiêu đề khuyến mãi *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="VD: Ưu đãi mùa hè 2026"
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary font-bold"
                      value={promotionForm.title}
                      onChange={(e) =>
                        setPromotionForm({
                          ...promotionForm,
                          title: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Loại giảm giá
                      </label>
                      <select
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm bg-white outline-none focus:border-primary cursor-pointer"
                        value={promotionForm.discountType}
                        onChange={(e) =>
                          setPromotionForm({
                            ...promotionForm,
                            discountType: e.target.value,
                          })
                        }
                      >
                        <option value="PERCENTAGE">Phần trăm (%)</option>
                        <option value="FIXED_AMOUNT">
                          Số tiền cố định (VND)
                        </option>
                        <option value="FREE_UPGRADE">
                          Nâng hạng toa miễn phí
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Trị giá giảm *
                      </label>
                      <input
                        required
                        type="number"
                        disabled={promotionForm.discountType === "FREE_UPGRADE"}
                        placeholder="VD: 15 hoặc 50000"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary font-bold disabled:bg-slate-100"
                        value={
                          promotionForm.discountType === "FREE_UPGRADE"
                            ? "0"
                            : promotionForm.discountValue
                        }
                        onChange={(e) =>
                          setPromotionForm({
                            ...promotionForm,
                            discountValue: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Ngân sách tối đa (VND)
                      </label>
                      <input
                        type="number"
                        placeholder="Để trống nếu không giới hạn"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                        value={promotionForm.maxBudget}
                        onChange={(e) =>
                          setPromotionForm({
                            ...promotionForm,
                            maxBudget: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Trạng Thái
                      </label>
                      <select
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm bg-white outline-none focus:border-primary cursor-pointer"
                        value={promotionForm.status}
                        onChange={(e) =>
                          setPromotionForm({
                            ...promotionForm,
                            status: e.target.value,
                          })
                        }
                      >
                        <option value="ACTIVE">Kích hoạt chạy ngay</option>
                        <option value="INACTIVE">Vô hiệu hóa</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Hiệu lực từ ngày
                      </label>
                      <input
                        required
                        type="date"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                        value={promotionForm.validFrom}
                        onChange={(e) =>
                          setPromotionForm({
                            ...promotionForm,
                            validFrom: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">
                        Hết hiệu lực ngày
                      </label>
                      <input
                        required
                        type="date"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                        value={promotionForm.validTo}
                        onChange={(e) =>
                          setPromotionForm({
                            ...promotionForm,
                            validTo: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Multi-select: routes */}
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">
                      Áp dụng cho tuyến chặng (Chọn nhiều - Để trống nếu áp dụng
                      tất cả)
                    </label>
                    <div className="border border-outline-variant rounded-xl p-3 max-h-24 overflow-y-auto grid grid-cols-2 gap-2 bg-slate-50">
                      {routes.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-1.5 text-xs text-slate-700"
                        >
                          <input
                            type="checkbox"
                            id={`route-${r.id}`}
                            className="w-3.5 h-3.5 accent-primary cursor-pointer"
                            checked={promotionForm.routeIds.includes(r.id)}
                            onChange={() => handleCheckboxChange("route", r.id)}
                          />
                          <label
                            htmlFor={`route-${r.id}`}
                            className="cursor-pointer truncate"
                          >
                            {r.routeName}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Multi-select: trains */}
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">
                      Áp dụng cho mác tàu (Chọn nhiều - Để trống nếu áp dụng tất
                      cả)
                    </label>
                    <div className="border border-outline-variant rounded-xl p-3 max-h-24 overflow-y-auto grid grid-cols-2 gap-2 bg-slate-50">
                      {trains.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-1.5 text-xs text-slate-700"
                        >
                          <input
                            type="checkbox"
                            id={`train-${t.id}`}
                            className="w-3.5 h-3.5 accent-primary cursor-pointer"
                            checked={promotionForm.trainIds.includes(t.id)}
                            onChange={() => handleCheckboxChange("train", t.id)}
                          />
                          <label
                            htmlFor={`train-${t.id}`}
                            className="cursor-pointer truncate"
                          >
                            {t.trainName}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">
                      Mô tả chương trình
                    </label>
                    <textarea
                      placeholder="Mô tả chi tiết chương trình khuyến mãi tự động áp dụng..."
                      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary h-20 resize-none"
                      value={promotionForm.description}
                      onChange={(e) =>
                        setPromotionForm({
                          ...promotionForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition text-sm cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary/95 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition active:scale-95 cursor-pointer text-sm"
                >
                  Xác nhận lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
