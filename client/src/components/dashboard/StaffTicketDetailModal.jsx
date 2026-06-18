import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
  const [selectedPassengerIds, setSelectedPassengerIds] = useState([]);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  const passengers = booking?.passengers || [];
  const customer = booking?.user || null;
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
        (passenger) => passengerStatus(passenger, booking) !== "CANCELLED",
      ),
    [booking, passengers],
  );

  useEffect(() => {
    if (isGuestBooking && refundMethod !== "CASH") {
      setRefundMethod("CASH");
    }
  }, [isGuestBooking, refundMethod]);

  if (!booking) return null;

  const schedule = booking.schedule;
  const selectedCount = selectedPassengerIds.length;

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
        bookingId: booking.id,
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
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#bec7d4]/60 text-[#3f4852] transition hover:border-[#00629d] hover:text-[#00629d]"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
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

            <div className="space-y-2">
              {passengers.map((passenger) => {
                const status = passengerStatus(passenger, booking);
                const cancelled = status === "CANCELLED";
                const selected = selectedPassengerIds.includes(passenger.id);
                return (
                  <label
                    key={passenger.id}
                    className={`block cursor-pointer rounded-xl border p-3 transition ${
                      selected
                        ? "border-[#00629d] bg-[#cfe5ff]/45"
                        : "border-[#bec7d4]/35 bg-white hover:border-[#00629d]/60"
                    } ${cancelled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={cancelled}
                        onChange={() => togglePassenger(passenger.id)}
                        className="mt-1 h-4 w-4 rounded border-[#bec7d4] text-[#00629d]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-extrabold text-[#191c1e]">
                            {passenger.fullName}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              cancelled
                                ? "bg-rose-50 text-rose-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {cancelled ? "Đã hủy" : "Còn hiệu lực"}
                          </span>
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
                Lý do hủy
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Ví dụ: khách đổi lịch trình"
                className="mt-2 w-full resize-none rounded-xl border border-[#bec7d4]/60 px-3 py-2 text-sm font-semibold outline-none focus:border-[#00629d]"
              />

              <button
                type="button"
                onClick={confirmCancellation}
                disabled={confirming || !quote?.eligible}
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
    </div>
  );
}
