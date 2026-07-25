import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  LoaderCircle,
  ReceiptText,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { staffSearchApi } from "../../services/staffSearchApi";

function stationLabel(station) {
  if (!station) return "";
  return station.stationName || station.name || station.city || "";
}

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function dateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function dateOnly(value) {
  if (!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
  }).format(new Date(value));
}

function display(value) {
  return value || "Chưa có";
}

function activeDetails(passenger) {
  return (passenger.bookingDetails || []).filter(
    (detail) => detail.status !== "CANCELLED",
  );
}

function passengerAmount(passenger) {
  return activeDetails(passenger).reduce(
    (sum, detail) => sum + Number(detail.finalPrice || 0),
    0,
  );
}

function passengerStatus(passenger, booking) {
  if (
    (passenger.bookingDetails || []).length > 0 &&
    activeDetails(passenger).length === 0
  ) {
    return "CANCELLED";
  }
  return booking?.status || "CONFIRMED";
}

function routeLabel(booking) {
  const from =
    stationLabel(booking?.fromStation) ||
    stationLabel(booking?.schedule?.startStation);
  const to =
    stationLabel(booking?.toStation) ||
    stationLabel(booking?.schedule?.endStation);
  return `${from || "Ga đi"} → ${to || "Ga đến"}`;
}

function passengerTypeLabel(type) {
  const labels = {
    ADULT: "Người lớn",
    CHILD: "Trẻ em",
    STUDENT: "Sinh viên",
    SENIOR: "Người cao tuổi",
  };
  return labels[type] || type || "Chưa rõ";
}

function InfoItem({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#6f7883]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold text-[#191c1e]">
        {value}
      </p>
    </div>
  );
}

export function StaffTicketDetailModal({ booking, onClose, onCancelled }) {
  const navigate = useNavigate();

  const [localBooking, setLocalBooking] = useState(booking);
  const [editingPassenger, setEditingPassenger] = useState(null);
  const [upgradingPassenger, setUpgradingPassenger] = useState(null);
  const [invalidatingPassenger, setInvalidatingPassenger] = useState(null);

  // States for sub-form operations
  const [editForm, setEditForm] = useState({
    fullName: "",
    nationalId: "",
    dateOfBirth: "",
  });
  const [upgradePaymentMethod, setUpgradePaymentMethod] = useState("CASH");
  const [invalidateReason, setInvalidateReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedPassengerIds, setSelectedPassengerIds] = useState([]);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);

  useEffect(() => {
    setLocalBooking(booking);
  }, [booking]);

  const refreshBooking = async () => {
    try {
      const res = await staffSearchApi.globalSearch(localBooking.bookingCode);
      if (res.data?.bookings?.length > 0) {
        setLocalBooking(res.data.bookings[0]);
      }
    } catch (err) {
      console.error("Lỗi khi tải lại thông tin booking:", err);
    }
  };

  const handleOpenCorrectModal = (passenger) => {
    setEditingPassenger(passenger);
    setEditForm({
      fullName: passenger.fullName,
      nationalId: passenger.nationalId || "",
      dateOfBirth: passenger.dateOfBirth
        ? new Date(passenger.dateOfBirth).toISOString().split("T")[0]
        : "",
    });
  };

  const handleSaveCorrection = async (e) => {
    e.preventDefault();
    if (!editingPassenger) return;
    setActionLoading(true);
    try {
      await staffSearchApi.correctInfo({
        ticketCode: editingPassenger.ticketCode,
        fullName: editForm.fullName,
        nationalId: editForm.nationalId,
        dateOfBirth: editForm.dateOfBirth,
      });
      toast.success("Đính chính thông tin hành khách thành công.");
      setEditingPassenger(null);
      await refreshBooking();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Không thể đính chính thông tin.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenUpgradeModal = (passenger) => {
    setUpgradingPassenger(passenger);
    setUpgradePaymentMethod("CASH");
  };

  const handleConfirmUpgrade = async () => {
    if (!upgradingPassenger) return;
    setActionLoading(true);
    try {
      await staffSearchApi.exchangeType({
        ticketCode: upgradingPassenger.ticketCode,
        paymentMethod: upgradePaymentMethod,
      });
      toast.success(
        "Đã thu hồi ưu đãi và nâng cấp vé sang loại Người lớn thành công.",
      );
      setUpgradingPassenger(null);
      await refreshBooking();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể nâng cấp loại vé.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenInvalidateModal = (passenger) => {
    setInvalidatingPassenger(passenger);
    setInvalidateReason("");
  };

  const handleConfirmInvalidate = async () => {
    if (!invalidatingPassenger || !invalidateReason.trim()) {
      toast.error("Vui lòng nhập lý do hủy vi phạm.");
      return;
    }
    setActionLoading(true);
    try {
      await staffSearchApi.invalidate({
        ticketCode: invalidatingPassenger.ticketCode,
        reason: invalidateReason.trim(),
      });
      toast.success("Đã vô hiệu hóa và hủy vé vi phạm thành công.");
      setInvalidatingPassenger(null);
      await refreshBooking();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể hủy vé vi phạm.");
    } finally {
      setActionLoading(false);
    }
  };

  const passengers = localBooking?.passengers || [];
  const customer = localBooking?.user || null;
  const isGuestBooking = !customer?.id;
  const refundMethods = isGuestBooking
    ? [["CASH", "Tiền mặt"]]
    : [
        ["CASH", "Tiền mặt"],
        ["WALLET", "Ví của khách"],
      ];

  const activePassengers = useMemo(
    () =>
      passengers.filter(
        (passenger) => passengerStatus(passenger, localBooking) !== "CANCELLED",
      ),
    [localBooking, passengers],
  );

  useEffect(() => {
    if (isGuestBooking && refundMethod !== "CASH") {
      setRefundMethod("CASH");
    }
  }, [isGuestBooking, refundMethod]);

  if (!localBooking) return null;

  const schedule = localBooking.schedule;
  const selectedCount = selectedPassengerIds.length;

  const canExchange =
    localBooking.status === "CONFIRMED" &&
    localBooking.paymentStatus === "COMPLETED" &&
    schedule?.departureTime &&
    new Date(schedule.departureTime).getTime() > Date.now();

  const handleExchange = () => {
    const firstPassenger = localBooking.passengers?.[0];
    const ticket = firstPassenger
      ? { ...firstPassenger, booking: localBooking }
      : null;
    onClose();
    navigate("/doi-ve", { state: { ticket, staffMode: true } });
  };

  const togglePassenger = (passengerId) => {
    setQuote(null);
    setSelectedPassengerIds((current) =>
      current.includes(passengerId)
        ? current.filter((id) => id !== passengerId)
        : [...current, passengerId],
    );
  };

  const selectAllActive = () => {
    setQuote(null);
    setSelectedPassengerIds(activePassengers.map((passenger) => passenger.id));
  };

  const requestQuote = async () => {
    if (selectedPassengerIds.length === 0) {
      toast.error("Chọn ít nhất một vé cần hủy.");
      return;
    }
    setQuoteLoading(true);
    setQuote(null);
    try {
      const { data } = await staffSearchApi.cancellationQuote({
        bookingId: localBooking.id,
        passengerIds: selectedPassengerIds,
      });
      setQuote(data.quote);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Không thể tính mức hoàn tiền.",
      );
    } finally {
      setQuoteLoading(false);
    }
  };

  const confirmCancellation = async () => {
    if (!quote?.eligible) {
      toast.error("Cần tính hoàn tiền và có ít nhất một vé đủ điều kiện hủy.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do hủy vé.");
      return;
    }
    if (!identityVerified) {
      toast.error("Phải xác minh danh tính hành khách trước khi hủy vé.");
      return;
    }
    setConfirming(true);
    try {
      const { data } = await staffSearchApi.cancellationConfirm({
        bookingId: booking.id,
        passengerIds: selectedPassengerIds,
        refundMethod,
        reason: reason.trim(),
      });
      toast.success(
        `Đã hủy ${data.cancelledPassengerIds?.length || 0} vé, hoàn ${money(
          data.refundAmount,
        )}.`,
      );
      onCancelled?.();
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Không thể xác nhận hủy vé.",
      );
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071a2b]/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#bec7d4]/30 p-5">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#00629d]">
              Chi tiết vé tại quầy
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-[#191c1e]">
              {booking.bookingCode}
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#6f7883]">
              {routeLabel(booking)} · {schedule?.train?.trainName || "Tàu"} ·{" "}
              {dateTime(schedule?.departureTime)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canExchange && (
              <button
                type="button"
                onClick={handleExchange}
                className="flex items-center gap-2 rounded-xl border border-[#00629d]/40 bg-[#cfe5ff]/40 px-3 py-2 text-xs font-bold text-[#00629d] transition hover:bg-[#cfe5ff]"
                title="Đổi sang chuyến khác"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Đổi vé
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#bec7d4]/60 text-[#3f4852] transition hover:border-[#00629d] hover:text-[#00629d]"
              title="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid max-h-[calc(92vh-92px)] overflow-y-auto lg:grid-cols-[1fr_380px]">
          <section className="min-w-0 space-y-4 p-5">
            <div className="rounded-xl border border-[#bec7d4]/35 bg-[#f7f9fb] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#cfe5ff] text-[#00629d]">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-[#00629d]">
                      Người đặt vé
                    </p>
                    <h3 className="mt-0.5 truncate font-extrabold text-[#191c1e]">
                      {customer?.fullName || "Khách vãng lai"}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[#6f7883]">
                      {isGuestBooking
                        ? "Không có tài khoản khách hàng, chỉ hoàn tiền mặt."
                        : "Có thể đối chiếu thông tin tài khoản và hoàn về ví."}
                    </p>
                  </div>
                </div>
                {!isGuestBooking && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <Wallet className="h-3.5 w-3.5" />
                    Ví: {money(customer.wallet?.balance || 0)}
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <InfoItem label="SĐT" value={display(customer?.phoneNumber)} />
                <InfoItem
                  label="CCCD/Hộ chiếu"
                  value={display(customer?.nationalId)}
                />
                <InfoItem
                  label="Ngày sinh"
                  value={dateOnly(customer?.dateOfBirth)}
                />
                <InfoItem label="Email" value={display(customer?.email)} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-[#191c1e]">
                  Chủ vé trong booking
                </h3>
                <p className="text-xs font-semibold text-[#6f7883]">
                  Đối chiếu SĐT, CCCD và ngày sinh trước khi hủy vé.
                </p>
              </div>
              <button
                type="button"
                onClick={selectAllActive}
                disabled={activePassengers.length === 0}
                className="rounded-xl border border-[#bec7d4]/60 px-3 py-2 text-xs font-bold text-[#3f4852] transition hover:border-[#00629d] hover:text-[#00629d] disabled:opacity-50"
              >
                Chọn tất cả vé còn hiệu lực
              </button>
            </div>

            <div className="space-y-4">
              {passengers.map((passenger) => {
                const status = passengerStatus(passenger, localBooking);
                const cancelled = status === "CANCELLED";
                const boarded = !!passenger.boardingAt;
                const departureTime = schedule?.departureTime
                  ? new Date(schedule.departureTime)
                  : null;
                const isMissed =
                  !boarded &&
                  departureTime &&
                  departureTime.getTime() < Date.now();
                const locked = cancelled || boarded || isMissed;
                const selected = selectedPassengerIds.includes(passenger.id);
                return (
                  <div
                    key={passenger.id}
                    className="rounded-xl border border-[#bec7d4]/35 bg-white p-3 hover:border-[#00629d]/60 transition space-y-3"
                  >
                    <label
                      className={`block ${locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={locked}
                          onChange={() => togglePassenger(passenger.id)}
                          className="mt-1 h-4 w-4 rounded border-[#bec7d4] text-[#00629d]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-extrabold text-[#191c1e]">
                              {passenger.fullName}
                            </p>
                            {cancelled && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                                Đã hủy
                              </span>
                            )}
                            {!cancelled && boarded && (
                              <span className="rounded-full bg-[#cfe5ff] px-2 py-0.5 text-[11px] font-bold text-[#00629d] border border-[#cfe5ff]/50">
                                Đã lên tàu
                              </span>
                            )}
                            {!cancelled && !boarded && isMissed && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                Trễ tàu (Không check-in)
                              </span>
                            )}
                            {!cancelled && !boarded && !isMissed && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                Còn hiệu lực
                              </span>
                            )}
                            <span className="rounded-full bg-[#f7f9fb] px-2 py-0.5 text-[11px] font-bold text-[#3f4852]">
                              {passengerTypeLabel(passenger.passengerType)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-[#6f7883]">
                            {passenger.ticketCode || "Chưa có mã vé"} · Ghế{" "}
                            {passenger.seat?.seatNumber || "--"} · Toa{" "}
                            {passenger.seat?.carriage?.carriageNumber ||
                              passenger.carriageNumber ||
                              "--"}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-extrabold text-[#191c1e]">
                          {money(passengerAmount(passenger))}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 rounded-lg bg-[#f7f9fb] p-3 sm:grid-cols-3">
                        <InfoItem
                          label="SĐT chủ vé"
                          value={display(passenger.phoneNumber)}
                        />
                        <InfoItem
                          label="CCCD/Hộ chiếu"
                          value={display(passenger.nationalId)}
                        />
                        <InfoItem
                          label="Ngày sinh"
                          value={dateOnly(passenger.dateOfBirth)}
                        />
                      </div>
                    </label>

                    {/* Hành động tại quầy */}
                    {!cancelled && (
                      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => handleOpenCorrectModal(passenger)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-[#00629d] hover:text-[#00629d] transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            edit
                          </span>
                          Đính chính thông tin
                        </button>

                        {passenger.passengerType === "STUDENT" && (
                          <button
                            type="button"
                            onClick={() => handleOpenUpgradeModal(passenger)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#00629d]/25 bg-[#cfe5ff]/35 px-2.5 py-1 text-[11px] font-bold text-[#00629d] hover:bg-[#cfe5ff] transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              upgrade
                            </span>
                            Thu hồi ưu đãi (Sinh viên ➔ Người lớn)
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenInvalidateModal(passenger)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            block
                          </span>
                          Hủy vé vi phạm
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="border-t border-[#bec7d4]/30 bg-[#f7f9fb] p-5 lg:border-l lg:border-t-0">
            <div className="rounded-xl border border-[#bec7d4]/35 bg-white p-4">
              <div className="flex items-center gap-3">
                <ReceiptText className="h-5 w-5 text-[#00629d]" />
                <div>
                  <p className="font-extrabold text-[#191c1e]">
                    Hủy vé và hoàn tiền
                  </p>
                  <p className="text-xs font-semibold text-[#6f7883]">
                    {selectedCount} vé đang được chọn
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={requestQuote}
                disabled={quoteLoading || selectedCount === 0}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00629d] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#00527f] disabled:opacity-60"
              >
                {quoteLoading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Banknote className="h-4 w-4" />
                )}
                Tính hoàn tiền
              </button>

              {quote && (
                <div className="mt-4 space-y-3">
                  <div
                    className={`rounded-xl p-3 text-xs font-semibold ${
                      quote.eligible
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    <div className="flex gap-2">
                      {quote.eligible ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                      )}
                      <span>{quote.policy?.message}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {quote.items?.map((item) => (
                      <div
                        key={item.passengerId}
                        className="rounded-lg bg-[#f7f9fb] p-2 text-xs"
                      >
                        <div className="flex justify-between gap-2 font-bold text-[#191c1e]">
                          <span>{item.fullName}</span>
                          <span>{money(item.refundAmount)}</span>
                        </div>
                        <p className="mt-1 font-semibold text-[#6f7883]">
                          {item.eligible ? "Đủ điều kiện" : item.reason}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#bec7d4]/35 pt-3">
                    <span className="text-sm font-bold text-[#3f4852]">
                      Tổng hoàn
                    </span>
                    <span className="text-lg font-extrabold text-[#00629d]">
                      {money(quote.totalRefundAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-[#bec7d4]/35 bg-white p-4">
              <label className="text-xs font-bold text-[#3f4852]">
                Phương thức hoàn tiền
              </label>
              <select
                value={refundMethod}
                onChange={(event) => setRefundMethod(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#bec7d4]/60 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#00629d]"
              >
                {refundMethods.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {isGuestBooking && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Khách vãng lai không có ví, quầy chỉ được hoàn tiền mặt.
                </p>
              )}

              <label className="mt-3 block text-xs font-bold text-[#3f4852]">
                Lý do hủy{" "}
                <span className="font-semibold text-rose-500">(bắt buộc)</span>
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Ví dụ: khách đổi lịch trình"
                className="mt-2 w-full resize-none rounded-xl border border-[#bec7d4]/60 px-3 py-2 text-sm font-semibold outline-none focus:border-[#00629d]"
              />

              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#bec7d4]/40 bg-[#f7f9fb] p-3">
                <input
                  type="checkbox"
                  checked={identityVerified}
                  onChange={(event) =>
                    setIdentityVerified(event.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#bec7d4] text-[#00629d]"
                />
                <span className="text-xs font-semibold leading-relaxed text-[#3f4852]">
                  Tôi đã xác minh danh tính hành khách — SĐT, CCCD/hộ chiếu và
                  ngày sinh khớp với thông tin trên vé.
                </span>
              </label>

              <button
                type="button"
                onClick={confirmCancellation}
                disabled={
                  confirming ||
                  !quote?.eligible ||
                  !identityVerified ||
                  !reason.trim()
                }
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {confirming ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Xác nhận hủy vé
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Edit Info Modal */}
      {editingPassenger && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Đính chính thông tin
              </h3>
              <button
                type="button"
                onClick={() => setEditingPassenger(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCorrection} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">
                  Họ và tên
                </label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, fullName: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[#bec7d4]/60 px-3 py-2 text-sm font-semibold outline-none focus:border-[#00629d]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">
                  Số CCCD/Hộ chiếu
                </label>
                <input
                  type="text"
                  value={editForm.nationalId}
                  onChange={(e) =>
                    setEditForm({ ...editForm, nationalId: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[#bec7d4]/60 px-3 py-2 text-sm font-semibold outline-none focus:border-[#00629d]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={(e) =>
                    setEditForm({ ...editForm, dateOfBirth: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[#bec7d4]/60 px-3 py-2 text-sm font-semibold outline-none focus:border-[#00629d]"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPassenger(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-[#00629d] px-4 py-2 text-sm font-bold text-white hover:bg-[#00527f] disabled:opacity-50"
                >
                  {actionLoading ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upgrade Student to Adult Modal */}
      {upgradingPassenger && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Thu hồi ưu đãi (Student ➔ Adult)
              </h3>
              <button
                type="button"
                onClick={() => setUpgradingPassenger(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <p className="text-slate-600 leading-relaxed">
                Hành khách <strong>{upgradingPassenger.fullName}</strong> không
                xuất trình được thẻ sinh viên hợp lệ. Hệ thống sẽ nâng cấp vé
                sang loại Người lớn và thu thêm các khoản sau:
              </p>

              <div className="rounded-xl bg-slate-50 p-4 space-y-2 font-semibold text-slate-700">
                <div className="flex justify-between">
                  <span>Tiền ưu đãi thu hồi (10%):</span>
                  <span>
                    {money(
                      activeDetails(upgradingPassenger)[0]?.discountAmount || 0,
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Phí phạt/Phí xử lý tại quầy:</span>
                  <span>{money(50000)}</span>
                </div>
                <div className="border-t border-slate-200 my-2 pt-2 flex justify-between font-bold text-[#00629d]">
                  <span>Tổng cộng thu thêm:</span>
                  <span>
                    {money(
                      (activeDetails(upgradingPassenger)[0]?.discountAmount ||
                        0) + 50000,
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Phương thức thanh toán
                </label>
                <select
                  value={upgradePaymentMethod}
                  onChange={(e) => setUpgradePaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-[#bec7d4]/60 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#00629d]"
                >
                  <option value="CASH">Tiền mặt (CASH)</option>
                  {!isGuestBooking && (
                    <option value="WALLET">Ví của khách (WALLET)</option>
                  )}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUpgradingPassenger(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpgrade}
                  disabled={actionLoading}
                  className="rounded-xl bg-[#00629d] px-4 py-2 text-sm font-bold text-white hover:bg-[#00527f] disabled:opacity-50"
                >
                  {actionLoading ? "Đang xử lý..." : "Xác nhận & Cấp vé mới"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invalidate Modal */}
      {invalidatingPassenger && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-rose-700">
                Hủy vé do vi phạm
              </h3>
              <button
                type="button"
                onClick={() => setInvalidatingPassenger(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Bạn đang thực hiện hủy và vô hiệu hóa vé của hành khách{" "}
                <strong>{invalidatingPassenger.fullName}</strong>. Vé sẽ bị hủy
                ngay lập tức và KHÔNG hoàn tiền.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Lý do hủy vi phạm (bắt buộc)
                </label>
                <textarea
                  required
                  rows={3}
                  value={invalidateReason}
                  onChange={(e) => setInvalidateReason(e.target.value)}
                  placeholder="Ví dụ: Giả mạo danh tính, sử dụng vé người khác..."
                  className="mt-1 w-full resize-none rounded-xl border border-[#bec7d4]/60 px-3 py-2 text-sm font-semibold outline-none focus:border-[#00629d]"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setInvalidatingPassenger(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInvalidate}
                  disabled={actionLoading || !invalidateReason.trim()}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {actionLoading ? "Đang hủy..." : "Xác nhận hủy vé"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
