import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  IdCard,
  LoaderCircle,
  LockKeyhole,
  Mail,
  QrCode,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  TrainFront,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { bookingApi } from "../../services/bookingApi";
import { seatSelectionApi } from "../../services/seatSelectionApi";
import { walletApi } from "../../services/walletApi";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";

const PASSENGER_TYPES = [
  {
    value: "ADULT",
    label: "Người lớn",
    description: "Giá vé tiêu chuẩn",
  },
  {
    value: "CHILD",
    label: "Trẻ em",
    description: "Theo chính sách độ tuổi",
  },
  {
    value: "STUDENT",
    label: "Sinh viên",
    description: "Mang theo thẻ khi đi tàu",
  },
  {
    value: "SENIOR",
    label: "Người cao tuổi",
    description: "Theo chính sách hiện hành",
  },
];

const EMPTY_PASSENGER = {
  fullName: "",
  nationalIdType: "CCCD",
  nationalId: "",
  phoneNumber: "",
  email: "",
  dateOfBirth: "",
  passengerType: "ADULT",
};

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function countdown(expiresAt, now) {
  const seconds = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 1000),
  );
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function ageFromDateOfBirth(value, today = new Date()) {
  if (!value) return null;
  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()) || birthDate >= today) return null;
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

function passengerTypeFromAge(age, currentType) {
  if (age == null) return currentType;
  if (age < 10) return "CHILD";
  if (age >= 60) return "SENIOR";
  return currentType === "STUDENT" ? "STUDENT" : "ADULT";
}

function validatePassenger(passenger) {
  const errors = {};
  if (passenger.fullName.trim().length < 2) {
    errors.fullName = "Nhập họ và tên như trên giấy tờ.";
  }
  const birthDate = new Date(`${passenger.dateOfBirth}T00:00:00`);
  if (
    !passenger.dateOfBirth ||
    Number.isNaN(birthDate.getTime()) ||
    birthDate >= new Date()
  ) {
    errors.dateOfBirth = "Chọn ngày sinh hợp lệ.";
  }
  if (passenger.passengerType !== "CHILD") {
    const document = passenger.nationalId.trim().toUpperCase();
    if (passenger.nationalIdType === "CCCD" && !/^\d{12}$/.test(document)) {
      errors.nationalId = "CCCD gồm đúng 12 chữ số.";
    }
    if (
      passenger.nationalIdType === "HCDC" &&
      !/^[A-Z0-9]{6,12}$/.test(document)
    ) {
      errors.nationalId = "Số hộ chiếu gồm 6-12 ký tự.";
    }
    if (!/^(0|\+84)\d{9,10}$/.test(passenger.phoneNumber.replace(/\s/g, ""))) {
      errors.phoneNumber = "Nhập số điện thoại Việt Nam hợp lệ.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passenger.email.trim())) {
      errors.email = "Nhập địa chỉ email hợp lệ.";
    }
  }
  return errors;
}

function duplicateDocumentMessages(passengers) {
  const messages = passengers.map(() => "");
  const documentOwners = new Map();

  passengers.forEach((passenger, index) => {
    if (passenger.passengerType === "CHILD") return;
    const document = passenger.nationalId.trim().toUpperCase();
    const validDocument =
      (passenger.nationalIdType === "CCCD" && /^\d{12}$/.test(document)) ||
      (passenger.nationalIdType === "HCDC" &&
        /^[A-Z0-9]{6,12}$/.test(document));
    if (!validDocument) return;
    const key = `${passenger.nationalIdType}:${document}`;
    const indexes = documentOwners.get(key) || [];
    indexes.push(index);
    documentOwners.set(key, indexes);
  });

  for (const indexes of documentOwners.values()) {
    if (indexes.length < 2) continue;
    for (const index of indexes) {
      const others = indexes
        .filter((otherIndex) => otherIndex !== index)
        .map((otherIndex) => otherIndex + 1)
        .join(", ");
      messages[index] = `Giấy tờ bị trùng với hành khách ${others}.`;
    }
  }

  return messages;
}

function validatePassengerList(passengers) {
  const errors = passengers.map(validatePassenger);
  duplicateDocumentMessages(passengers).forEach((message, index) => {
    if (message) errors[index].nationalId = message;
  });
  return errors;
}

function passengerRuleError(passengers) {
  if (passengers.length === 0 || passengers.length > 4) {
    return "Mỗi giao dịch chỉ được đặt từ 1 đến 4 hành khách.";
  }
  const hasChild = passengers.some(
    (passenger) => passenger.passengerType === "CHILD",
  );
  const hasCompanion = passengers.some((passenger) =>
    ["ADULT", "STUDENT", "SENIOR"].includes(passenger.passengerType),
  );
  if (hasChild && !hasCompanion) {
    return "Trẻ em dưới 10 tuổi phải đi cùng ít nhất một người lớn, sinh viên hoặc người cao tuổi.";
  }
  return "";
}

function Field({
  label,
  error,
  required = true,
  hint,
  children,
  className = "",
}) {
  return (
    <label className={`block ${className}`}>
      <span className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
        <span>
          {label}
          {required && <span className="ml-1 text-rose-500">*</span>}
        </span>
        {hint && <span className="font-medium text-slate-400">{hint}</span>}
      </span>
      <div className="mt-2">{children}</div>
      {error && (
        <span className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-rose-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </span>
      )}
    </label>
  );
}

function RailInput({ error, className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-xl border bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-300 focus:ring-4 ${
        error
          ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
          : "border-slate-200 focus:border-[#087a91] focus:ring-cyan-50"
      } ${className}`}
      {...props}
    />
  );
}

// eslint-disable-next-line no-unused-vars
function FakeQr({ payload }) {
  const size = 21;
  const seed = [...payload].reduce(
    (value, character) =>
      (Math.imul(value, 31) + character.charCodeAt(0)) >>> 0,
    2166136261,
  );
  const inFinder = (row, column, startRow, startColumn) => {
    const y = row - startRow;
    const x = column - startColumn;
    if (x < 0 || x > 6 || y < 0 || y > 6) return false;
    return (
      x === 0 ||
      x === 6 ||
      y === 0 ||
      y === 6 ||
      (x >= 2 && x <= 4 && y >= 2 && y <= 4)
    );
  };
  const cells = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const column = index % size;
    const finder =
      inFinder(row, column, 0, 0) ||
      inFinder(row, column, 0, size - 7) ||
      inFinder(row, column, size - 7, 0);
    const bit =
      finder ||
      ((Math.imul(index + 17, seed | 1) ^ (seed >>> (index % 16))) & 3) === 0;
    return (
      <span
        key={index}
        className={bit ? "bg-[#071a2b]" : "bg-white"}
        aria-hidden="true"
      />
    );
  });

  return (
    <div className="rounded-[28px] bg-white p-4 shadow-[0_18px_50px_rgba(7,26,43,0.18)]">
      <div
        className="grid h-52 w-52 gap-[1px] bg-white p-1"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        aria-label="Mã QR thanh toán thử nghiệm"
      >
        {cells}
      </div>
    </div>
  );
}

function CompletionView({ result }) {
  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-[30px] border border-emerald-200 bg-white shadow-[0_24px_80px_rgba(15,118,110,0.12)]">
      <div className="bg-[#073b4c] px-6 py-10 text-center text-white sm:px-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-[#073b4c]">
          <TicketCheck className="h-8 w-8" />
        </span>
        <p className="mt-5 font-utility-mono text-xs uppercase tracking-[0.2em] text-cyan-200">
          Thanh toán hoàn tất
        </p>
        <h1 className="mt-2 font-headline-md text-3xl font-bold">
          Vé của bạn đã sẵn sàng
        </h1>
        <p className="mt-3 text-sm text-cyan-50/75">
          Thông tin vé điện tử đã được ghi nhận và đang chờ gửi đến email liên
          hệ.
        </p>
      </div>

      <div className="relative px-6 py-7 sm:px-10">
        <div className="absolute inset-x-0 top-0 border-t-2 border-dashed border-slate-200" />
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Mã đặt chỗ
            </p>
            <p className="mt-1 font-utility-mono text-2xl font-bold text-[#073b4c]">
              {result.booking.bookingCode}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.passengers?.map((passenger) => (
                <span
                  key={passenger.id}
                  className="rounded-full bg-cyan-50 px-3 py-1.5 font-utility-mono text-xs font-bold text-[#087a91]"
                >
                  {passenger.ticketCode}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-5 py-4 text-right">
            <p className="text-xs font-semibold text-slate-500">
              Tổng thanh toán
            </p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">
              {money(result.booking.totalAmount)}
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            to="/tra-cuu-ve"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#087a91] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#066478] focus:outline-none focus:ring-4 focus:ring-cyan-100"
          >
            Tra cứu vé điện tử
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PassengerDetailsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isHydrating } = useAuthStore();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [errors, setErrors] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selfPassengerIndex, setSelfPassengerIndex] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_QR");
  const [walletBalance, setWalletBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [paymentResult, setPaymentResult] = useState(null);
  const [completedResult, setCompletedResult] = useState(null);
  const [ruleError, setRuleError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("Không tìm thấy phiên giữ ghế.");
      setLoading(false);
      return;
    }
    seatSelectionApi
      .getSession(sessionId)
      .then(({ data }) => {
        if (
          data.session.status !== "ACTIVE" ||
          new Date(data.session.expiresAt).getTime() <= Date.now()
        ) {
          setError("Phiên giữ ghế đã hết hạn. Vui lòng chọn lại ghế.");
          return;
        }
        const count = data.session.holds.filter(
          (hold) => hold.scheduleId === data.session.outboundScheduleId,
        ).length;
        if (count < 1 || count > 4) {
          setError("Mỗi giao dịch chỉ được đặt tối đa 4 hành khách.");
          return;
        }
        setSession(data.session);
        setPassengers(
          Array.from({ length: count }, () => ({ ...EMPTY_PASSENGER })),
        );
        setErrors(Array.from({ length: count }, () => ({})));
      })
      .catch((requestError) =>
        setError(
          requestError.response?.data?.message ||
            "Không thể tải thông tin giữ chỗ.",
        ),
      )
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (!session) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!user || isHydrating) return;
    api
      .get("/users/profile")
      .then(({ data }) => setProfile(data.user))
      .catch(() => setProfile(null));
    walletApi
      .getWallet()
      .then(({ data }) => setWalletBalance(data.wallet.balance))
      .catch(() => setWalletBalance(null));
  }, [isHydrating, user]);

  const pairedSeats = useMemo(() => {
    if (!session) return [];
    const outbound = session.holds.filter(
      (hold) => hold.scheduleId === session.outboundScheduleId,
    );
    const inbound = session.returnScheduleId
      ? session.holds.filter(
          (hold) => hold.scheduleId === session.returnScheduleId,
        )
      : [];
    return outbound.map((outboundHold, index) => ({
      outbound: outboundHold,
      return: inbound[index] || null,
    }));
  }, [session]);

  const passengerTypes = passengers.map((passenger) => passenger.passengerType);
  const passengerDocuments = passengers
    .map(
      (passenger) =>
        `${passenger.passengerType}:${passenger.nationalIdType}:${passenger.nationalId}`,
    )
    .join("|");

  useEffect(() => {
    const duplicateMessages = duplicateDocumentMessages(passengers);
    setErrors((current) =>
      current.map((item, index) => {
        const currentMessage = item.nationalId;
        const wasDuplicate =
          typeof currentMessage === "string" &&
          currentMessage.startsWith("Giấy tờ bị trùng");
        return {
          ...item,
          nationalId:
            duplicateMessages[index] ||
            (wasDuplicate ? undefined : currentMessage),
        };
      }),
    );
    // Only re-check when document identity fields change.
  }, [passengerDocuments]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session || passengerTypes.length === 0) return;
    let active = true;
    setQuoteLoading(true);
    bookingApi
      .quote({
        sessionId: session.id,
        passengerTypes,
        voucherCode: appliedVoucher || undefined,
      })
      .then(({ data }) => {
        if (active) setQuote(data.quote);
      })
      .catch((requestError) => {
        if (!active) return;
        if (appliedVoucher) {
          setAppliedVoucher("");
          toast.error(
            requestError.response?.data?.message ||
              "Không thể áp dụng mã giảm giá.",
          );
        } else {
          toast.error(
            requestError.response?.data?.message ||
              "Không thể cập nhật giá vé.",
          );
        }
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });
    return () => {
      active = false;
    };
    // The joined key keeps the quote synchronized with every passenger type.
  }, [appliedVoucher, passengerTypes.join("|"), session]);

  const expired = session && new Date(session.expiresAt).getTime() <= now;
  const timerText = session ? countdown(session.expiresAt, now) : "10:00";
  const timerUrgent = timerText <= "02:00";

  const updatePassenger = (index, field, value) => {
    setPassengers((current) =>
      current.map((passenger, passengerIndex) =>
        passengerIndex === index
          ? (() => {
              const updated = { ...passenger, [field]: value };
              if (field === "dateOfBirth") {
                updated.passengerType = passengerTypeFromAge(
                  ageFromDateOfBirth(value),
                  passenger.passengerType,
                );
              }
              if (
                updated.passengerType === "CHILD" &&
                passenger.passengerType !== "CHILD"
              ) {
                updated.nationalId = "";
                updated.nationalIdType = "";
                updated.phoneNumber = "";
                updated.email = "";
              }
              if (
                field === "dateOfBirth" &&
                updated.passengerType !== "CHILD" &&
                passenger.passengerType === "CHILD"
              ) {
                updated.nationalIdType = "CCCD";
              }
              if (
                field === "passengerType" &&
                value !== "CHILD" &&
                !updated.nationalIdType
              ) {
                updated.nationalIdType = "CCCD";
              }
              return updated;
            })()
          : passenger,
      ),
    );
    setRuleError("");
    setErrors((current) =>
      current.map((item, passengerIndex) =>
        passengerIndex === index
          ? {
              ...item,
              [field]: undefined,
              ...(field === "dateOfBirth"
                ? {
                    nationalId: undefined,
                    phoneNumber: undefined,
                    email: undefined,
                  }
                : {}),
            }
          : item,
      ),
    );
  };

  const toggleSelfPassenger = (index) => {
    if (selfPassengerIndex === index) {
      setSelfPassengerIndex(null);
      return;
    }
    if (selfPassengerIndex != null) {
      toast.error(
        `Chủ tài khoản đã được chọn cho hành khách ${selfPassengerIndex + 1}.`,
      );
      return;
    }
    if (!profile) return;
    setSelfPassengerIndex(index);
    const profileDateOfBirth = toDateInput(profile.dateOfBirth);
    const profilePassengerType = passengerTypeFromAge(
      ageFromDateOfBirth(profileDateOfBirth),
      passengers[index]?.passengerType || "ADULT",
    );
    setPassengers((current) =>
      current.map((passenger, passengerIndex) =>
        passengerIndex === index
          ? {
              ...passenger,
              fullName: profile.fullName || "",
              phoneNumber:
                profilePassengerType === "CHILD"
                  ? ""
                  : profile.phoneNumber || "",
              email:
                profilePassengerType === "CHILD" ? "" : profile.email || "",
              nationalId:
                profilePassengerType === "CHILD"
                  ? ""
                  : profile.nationalId || "",
              nationalIdType:
                profilePassengerType === "CHILD"
                  ? ""
                  : profile.nationalIdType || "CCCD",
              dateOfBirth: profileDateOfBirth,
              passengerType: profilePassengerType,
            }
          : passenger,
      ),
    );
  };

  const copyContact = () => {
    const contactPassenger = passengers.find(
      (passenger) =>
        passenger.passengerType !== "CHILD" &&
        passenger.phoneNumber &&
        passenger.email,
    );
    if (!contactPassenger) {
      toast.error("Nhập số điện thoại và email của một người đi kèm trước.");
      return;
    }
    setPassengers((current) =>
      current.map((passenger) =>
        passenger.passengerType === "CHILD"
          ? passenger
          : {
              ...passenger,
              phoneNumber: contactPassenger.phoneNumber,
              email: contactPassenger.email,
            },
      ),
    );
    toast.success("Đã dùng cùng thông tin nhận vé cho các hành khách.");
  };

  const applyVoucher = () => {
    if (!voucherInput.trim()) {
      setAppliedVoucher("");
      return;
    }
    setAppliedVoucher(voucherInput.trim().toUpperCase());
  };

  const handleCheckout = async () => {
    const nextRuleError = passengerRuleError(passengers);
    setRuleError(nextRuleError);
    if (nextRuleError) {
      toast.error(nextRuleError);
      return;
    }
    const nextErrors = validatePassengerList(passengers);
    setErrors(nextErrors);
    if (nextErrors.some((item) => Object.keys(item).length > 0)) {
      toast.error("Kiểm tra lại các trường được đánh dấu.");
      document
        .querySelector("[aria-invalid='true']")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (expired) {
      toast.error("Phiên giữ ghế đã hết hạn.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await bookingApi.checkout({
        sessionId: session.id,
        passengers: passengers.map((passenger, index) => ({
          ...passenger,
          isAccountHolder: selfPassengerIndex === index,
        })),
        voucherCode: appliedVoucher || undefined,
        paymentMethod,
      });
      if (data.booking.paymentStatus === "COMPLETED") {
        setCompletedResult(data);
        toast.success("Đặt vé và thanh toán thành công.");
      } else {
        setPaymentResult(data);
      }
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.message ||
          "Không thể tạo đơn đặt vé. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmQr = async () => {
    if (!paymentResult) return;
    setSubmitting(true);
    try {
      const { data } = await bookingApi.paymentStatus(paymentResult.booking.id);
      if (data.booking.paymentStatus !== "COMPLETED") {
        toast.info("Dang cho PayOS xac nhan giao dich.");
        return;
      }
      setCompletedResult({
        ...paymentResult,
        booking: data.booking,
      });
      setPaymentResult(null);
      toast.success("Đã xác nhận thanh toán.");
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.message ||
          "Không thể xác nhận thanh toán.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!paymentResult || completedResult) return undefined;
    let active = true;
    const checkPayment = async () => {
      try {
        const { data } = await bookingApi.paymentStatus(
          paymentResult.booking.id,
        );
        if (!active) return;
        if (data.booking.paymentStatus === "COMPLETED") {
          setCompletedResult({
            ...paymentResult,
            booking: data.booking,
          });
          setPaymentResult(null);
          toast.success("Thanh toan da duoc PayOS xac nhan.");
          return;
        }
      } catch {
        // Keep the QR visible; the next polling cycle can recover.
      }
    };
    checkPayment();
    const timer = setInterval(checkPayment, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [completedResult, paymentResult]);

  if (completedResult) {
    return <CompletionView result={completedResult} />;
  }

  if (loading || isHydrating) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="h-32 animate-pulse rounded-[28px] bg-white" />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="h-[620px] animate-pulse rounded-[28px] bg-white" />
          <div className="h-96 animate-pulse rounded-[28px] bg-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-[28px] border border-rose-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Không thể tiếp tục đặt vé
        </h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-6 rounded-xl bg-[#087a91] px-5 py-3 text-sm font-bold text-white"
        >
          Tìm chuyến khác
        </button>
      </div>
    );
  }

  if (paymentResult) {
    const payosInfo = paymentResult.payos || {};
    const checkoutUrl =
      payosInfo.checkoutUrl || paymentResult.booking.payosCheckoutUrl;
    const qrValue =
      payosInfo.qrCode ||
      paymentResult.qrPayload ||
      paymentResult.booking.payosQrCode;
    return (
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[30px] border border-cyan-100 bg-white shadow-[0_30px_90px_rgba(7,26,43,0.16)] lg:grid-cols-[1fr_0.9fr]">
        <div className="flex flex-col items-center justify-center border-b border-dashed border-slate-200 bg-[#f4fbfd] p-7 lg:border-b-0 lg:border-r">
          <p className="font-utility-mono text-[0px] uppercase tracking-[0.2em] text-[#087a91]">
            <span className="text-xs">QR PayOS</span>
            QR thanh toán thử nghiệm
          </p>
          <div className="mt-5 rounded-[28px] bg-white p-4 shadow-[0_18px_50px_rgba(7,26,43,0.12)]">
            {qrValue ? (
              <QRCodeSVG
                value={qrValue}
                size={224}
                level="M"
                marginSize={4}
                bgColor="#ffffff"
                fgColor="#071a2b"
                title="Ma QR thanh toan PayOS"
                className="rounded-2xl bg-white"
              />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs font-semibold leading-5 text-slate-500">
                Khong the hien thi QR. Vui long mo trang thanh toan PayOS.
              </div>
            )}
          </div>
          <p className="mt-5 max-w-sm text-center text-[0px] leading-5 text-slate-500">
            <span className="text-xs">
              Quet ma bang ung dung ngan hang. He thong se tu phat hanh ve sau
              khi PayOS gui xac nhan thanh toan.
            </span>
            Mã này minh họa luồng QR trong môi trường chưa kết nối ngân hàng.
            Sau khi mô phỏng quét, nhấn xác nhận để hoàn tất ngay.
          </p>
        </div>

        <div className="p-7 text-slate-900 sm:p-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#087a91] text-white">
            <QrCode className="h-6 w-6" />
          </span>
          <h1 className="mt-6 font-headline-md text-[0px] font-bold">
            <span className="text-2xl">Cho xac nhan thanh toan</span>
            Xác nhận giao dịch
          </h1>
          <p className="mt-2 text-[0px] leading-6 text-slate-500">
            <span className="text-sm">
              Noi dung chuyen khoan da gan voi don{" "}
              <strong className="text-slate-950">
                {paymentResult.booking.bookingCode}
              </strong>
              .
            </span>
            Nội dung chuyển khoản đã gắn với đơn{" "}
            <strong className="text-slate-950">
              {paymentResult.booking.bookingCode}
            </strong>
            .
          </p>

          <dl className="mt-7 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">So tien</dt>
              <dd className="text-lg font-extrabold text-[#087a91]">
                {money(paymentResult.booking.totalAmount)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Han thanh toan</dt>
              <dd className="font-utility-mono font-bold">
                {countdown(paymentResult.paymentExpiresAt, now)}
              </dd>
            </div>
            {payosInfo.description && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Noi dung</dt>
                <dd className="font-utility-mono font-bold">
                  {payosInfo.description}
                </dd>
              </div>
            )}
          </dl>

          <dl className="hidden">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Số tiền</dt>
              <dd className="text-lg font-extrabold text-cyan-300">
                {money(paymentResult.booking.totalAmount)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Hạn thanh toán</dt>
              <dd className="font-utility-mono font-bold">
                {countdown(paymentResult.paymentExpiresAt, now)}
              </dd>
            </div>
          </dl>

          {checkoutUrl && (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#087a91] px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#066478] focus:outline-none focus:ring-4 focus:ring-cyan-100"
            >
              Mo trang thanh toan PayOS
              <ExternalLink className="h-4 w-4" />
            </a>
          )}

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-xs font-semibold leading-5 text-amber-800">
              Dang doi PayOS doi soat. Ve chi duoc kich hoat khi server nhan
              webhook hop le.
            </p>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={confirmQr}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[0px] font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span className="text-sm">Kiem tra trang thai thanh toan</span>
            Tôi đã quét QR, xác nhận thanh toán
          </button>
          <p className="mt-3 text-center text-[0px] text-slate-400">
            <span className="text-[11px]">
              He thong tu dong cap nhat khi PayOS xac nhan giao dich.
            </span>
            Nút xác nhận dùng cho giai đoạn thử nghiệm, chưa kết nối cổng ngân
            hàng thực.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-28 lg:pb-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#087a91]"
        >
          <ArrowLeft className="h-4 w-4" />
          Chọn lại ghế
        </button>
        <div className="hidden items-center gap-2 text-xs font-bold text-slate-400 sm:flex">
          <span className="text-emerald-600">Chọn chuyến</span>
          <span>•</span>
          <span className="text-emerald-600">Chọn ghế</span>
          <span>•</span>
          <span className="text-[#087a91]">Hành khách & thanh toán</span>
        </div>
      </div>

      <header className="relative overflow-hidden rounded-[28px] bg-[#073b4c] px-5 py-6 text-white shadow-[0_20px_55px_rgba(7,59,76,0.16)] sm:px-7">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[28px] border-cyan-300/10" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-300 text-[#073b4c]">
              <TrainFront className="h-6 w-6" />
            </span>
            <div>
              <p className="font-utility-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">
                UC-12 · Thông tin xuất vé
              </p>
              <h1 className="mt-1 font-headline-md text-2xl font-bold sm:text-3xl">
                Ai sẽ đi trên chuyến tàu này?
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50/70">
                Nhập đúng thông tin trên giấy tờ tùy thân. Mỗi ghế tương ứng với
                một hành khách và một vé điện tử.
              </p>
            </div>
          </div>

          <div
            className={`min-w-[220px] rounded-2xl border px-5 py-4 ${
              timerUrgent
                ? "border-amber-300/40 bg-amber-300/10"
                : "border-cyan-200/20 bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center justify-between gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/65">
                  Ghế được giữ thêm
                </p>
                <p className="mt-1 font-utility-mono text-3xl font-bold tracking-wider">
                  {timerText}
                </p>
              </div>
              <Clock3
                className={`h-7 w-7 ${
                  timerUrgent ? "text-amber-300" : "text-cyan-300"
                }`}
              />
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full transition-all ${
                  timerUrgent ? "bg-amber-300" : "bg-cyan-300"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (Math.max(0, new Date(session.expiresAt).getTime() - now) /
                      600000) *
                      100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {!user && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm leading-5 text-amber-900">
              Bạn đang đặt vé với tư cách Guest. Có thể thanh toán QR, nhưng
              không dùng ví, mã giảm giá hoặc lịch sử đặt vé.
            </p>
          </div>
          <Link
            to="/login"
            state={{ from: `/booking/passengers?sessionId=${session.id}` }}
            className="shrink-0 text-sm font-extrabold text-amber-800 underline decoration-amber-400 underline-offset-4"
          >
            Đăng nhập
          </Link>
        </div>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_350px]">
        <div className="space-y-5">
          {passengers.length > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Mail className="h-4 w-4 text-[#087a91]" />
                Dùng một email và số điện thoại để nhận tất cả vé
              </div>
              <button
                type="button"
                onClick={copyContact}
                className="flex items-center gap-1.5 text-xs font-extrabold text-[#087a91]"
              >
                <Copy className="h-3.5 w-3.5" />
                Sao chép từ khách 1
              </button>
            </div>
          )}

          {ruleError && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-5 text-rose-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              {ruleError}
            </div>
          )}

          {pairedSeats.map((seatPair, index) => {
            const passenger = passengers[index];
            const passengerError = errors[index] || {};
            const quotedItem = quote?.items?.[index];
            return (
              <section
                key={seatPair.outbound.id}
                className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm"
              >
                <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-[#087a91]" />
                <div className="border-b border-dashed border-slate-200 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 font-utility-mono text-sm font-extrabold text-[#087a91]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h2 className="font-headline-md text-lg font-bold text-slate-900">
                          Hành khách {index + 1}
                        </h2>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          Lượt đi · Toa{" "}
                          {seatPair.outbound.seat.carriage.carriageNumber} · Ghế{" "}
                          {seatPair.outbound.seat.seatNumber}
                          {seatPair.return &&
                            `  |  Lượt về · Toa ${seatPair.return.seat.carriage.carriageNumber} · Ghế ${seatPair.return.seat.seatNumber}`}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-50 px-3 py-1.5 text-sm font-extrabold text-slate-800">
                      {quoteLoading ? "Đang tính..." : money(quotedItem?.total)}
                    </span>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  {user && (
                    <button
                      type="button"
                      disabled={
                        selfPassengerIndex != null &&
                        selfPassengerIndex !== index
                      }
                      onClick={() => toggleSelfPassenger(index)}
                      className={`mb-5 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        selfPassengerIndex === index
                          ? "border-cyan-300 bg-cyan-50"
                          : selfPassengerIndex != null
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-50"
                            : "border-slate-200 bg-slate-50 hover:border-cyan-200"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <UserRound className="h-5 w-5 text-[#087a91]" />
                        <span>
                          <strong className="block text-sm text-slate-800">
                            Đặt ghế này cho tôi
                          </strong>
                          <span className="text-xs text-slate-500">
                            {selfPassengerIndex != null &&
                            selfPassengerIndex !== index
                              ? `Đã chọn cho hành khách ${selfPassengerIndex + 1}`
                              : "Tự động điền từ hồ sơ, vẫn có thể chỉnh sửa"}
                          </span>
                        </span>
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          selfPassengerIndex === index
                            ? "border-[#087a91] bg-[#087a91] text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {selfPassengerIndex === index && (
                          <Check className="h-3 w-3" />
                        )}
                      </span>
                    </button>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Họ và tên hành khách"
                      error={passengerError.fullName}
                    >
                      <RailInput
                        value={passenger.fullName}
                        onChange={(event) =>
                          updatePassenger(index, "fullName", event.target.value)
                        }
                        placeholder="Nguyễn Văn A"
                        autoComplete="name"
                        error={passengerError.fullName}
                        aria-invalid={Boolean(passengerError.fullName)}
                      />
                    </Field>

                    <Field
                      label="Ngày sinh"
                      error={passengerError.dateOfBirth}
                      hint="Tự động xác định loại vé"
                    >
                      <RailInput
                        type="date"
                        value={passenger.dateOfBirth}
                        max={new Date(Date.now() - 86400000)
                          .toISOString()
                          .slice(0, 10)}
                        onChange={(event) =>
                          updatePassenger(
                            index,
                            "dateOfBirth",
                            event.target.value,
                          )
                        }
                        error={passengerError.dateOfBirth}
                        aria-invalid={Boolean(passengerError.dateOfBirth)}
                      />
                    </Field>

                    {passenger.passengerType === "CHILD" ? (
                      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 sm:col-span-2">
                        <p className="flex items-center gap-2 text-sm font-bold text-[#087a91]">
                          <BadgeCheck className="h-4 w-4" />
                          Vé trẻ em · dưới 10 tuổi
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          Không cần CCCD, hộ chiếu, số điện thoại hoặc email
                          riêng. Vé sẽ được gửi theo thông tin người đi kèm.
                        </p>
                      </div>
                    ) : (
                      <>
                        <Field
                          label="Loại hành khách"
                          hint={
                            ageFromDateOfBirth(passenger.dateOfBirth) >= 60
                              ? "Tự động theo độ tuổi"
                              : "Sinh viên chọn thủ công"
                          }
                        >
                          <select
                            value={passenger.passengerType}
                            disabled={
                              ageFromDateOfBirth(passenger.dateOfBirth) >= 60
                            }
                            onChange={(event) =>
                              updatePassenger(
                                index,
                                "passengerType",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#087a91] focus:ring-4 focus:ring-cyan-50 disabled:bg-slate-50 disabled:text-slate-500"
                          >
                            {PASSENGER_TYPES.filter(
                              (type) => type.value !== "CHILD",
                            ).map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label} · {type.description}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Loại giấy tờ">
                          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                            {[
                              ["CCCD", "CCCD"],
                              ["HCDC", "Hộ chiếu"],
                            ].map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => {
                                  updatePassenger(
                                    index,
                                    "nationalIdType",
                                    value,
                                  );
                                  updatePassenger(index, "nationalId", "");
                                }}
                                className={`rounded-lg px-3 py-2.5 text-xs font-bold transition ${
                                  passenger.nationalIdType === value
                                    ? "bg-white text-[#087a91] shadow-sm"
                                    : "text-slate-500"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </Field>

                        <Field
                          label={
                            passenger.nationalIdType === "CCCD"
                              ? "Số CCCD"
                              : "Số hộ chiếu"
                          }
                          error={passengerError.nationalId}
                        >
                          <div className="relative">
                            <IdCard className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                            <RailInput
                              value={passenger.nationalId}
                              onChange={(event) =>
                                updatePassenger(
                                  index,
                                  "nationalId",
                                  event.target.value.toUpperCase(),
                                )
                              }
                              placeholder={
                                passenger.nationalIdType === "CCCD"
                                  ? "012345678901"
                                  : "B1234567"
                              }
                              className="pl-10"
                              error={passengerError.nationalId}
                              aria-invalid={Boolean(passengerError.nationalId)}
                            />
                          </div>
                        </Field>

                        <Field
                          label="Số điện thoại"
                          error={passengerError.phoneNumber}
                        >
                          <RailInput
                            type="tel"
                            value={passenger.phoneNumber}
                            onChange={(event) =>
                              updatePassenger(
                                index,
                                "phoneNumber",
                                event.target.value,
                              )
                            }
                            placeholder="0912 345 678"
                            autoComplete="tel"
                            error={passengerError.phoneNumber}
                            aria-invalid={Boolean(passengerError.phoneNumber)}
                          />
                        </Field>

                        <Field
                          label="Email nhận vé"
                          error={passengerError.email}
                          className="sm:col-span-2"
                        >
                          <RailInput
                            type="email"
                            value={passenger.email}
                            onChange={(event) =>
                              updatePassenger(
                                index,
                                "email",
                                event.target.value,
                              )
                            }
                            placeholder="hanhkhach@example.com"
                            autoComplete="email"
                            error={passengerError.email}
                            aria-invalid={Boolean(passengerError.email)}
                          />
                        </Field>
                      </>
                    )}
                  </div>
                </div>
              </section>
            );
          })}

          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-xs leading-5 text-slate-600">
              Thông tin hành khách phải chính xác và trung thực để đối soát tại
              ga. Dữ liệu định danh chỉ được dùng cho việc xuất và kiểm soát vé.
            </p>
          </div>
        </div>

        <aside className="sticky top-24 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="bg-[#071a2b] px-5 py-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-utility-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                  Cuống vé
                </p>
                <h2 className="mt-1 text-lg font-bold">Thanh toán</h2>
              </div>
              <TicketCheck className="h-6 w-6 text-cyan-300" />
            </div>
          </div>

          <div className="space-y-5 p-5">
            {user && (
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Mã giảm giá
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={voucherInput}
                    onChange={(event) =>
                      setVoucherInput(event.target.value.toUpperCase())
                    }
                    placeholder="GOTRAIN10"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 font-utility-mono text-xs font-bold uppercase outline-none focus:border-[#087a91]"
                  />
                  <button
                    type="button"
                    onClick={applyVoucher}
                    className="rounded-xl bg-cyan-50 px-3 text-xs font-extrabold text-[#087a91]"
                  >
                    Áp dụng
                  </button>
                </div>
                {appliedVoucher && quote?.voucher && (
                  <p className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Đã áp dụng {quote.voucher.code}
                  </p>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-slate-700">
                Phương thức thanh toán
              </p>
              <div className="mt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("BANK_QR")}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    paymentMethod === "BANK_QR"
                      ? "border-cyan-300 bg-cyan-50"
                      : "border-slate-200"
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#087a91] shadow-sm">
                    <QrCode className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm text-slate-800">
                      QR ngân hàng
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Xác nhận nhanh trong bản thử nghiệm
                    </span>
                  </span>
                  {paymentMethod === "BANK_QR" && (
                    <CheckCircle2 className="h-5 w-5 text-[#087a91]" />
                  )}
                </button>

                {user && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("WALLET")}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      paymentMethod === "WALLET"
                        ? "border-cyan-300 bg-cyan-50"
                        : "border-slate-200"
                    }`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#087a91] shadow-sm">
                      <WalletCards className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm text-slate-800">
                        Ví GoTrain
                      </strong>
                      <span className="text-[11px] text-slate-500">
                        Số dư {money(walletBalance)}
                      </span>
                    </span>
                    {paymentMethod === "WALLET" && (
                      <CheckCircle2 className="h-5 w-5 text-[#087a91]" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 border-t border-dashed border-slate-200 pt-4 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Giá trước ưu đãi</span>
                <span>{money(quote?.subtotal)}</span>
              </div>
              {quote?.passengerDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Ưu đãi hành khách</span>
                  <span>-{money(quote.passengerDiscount)}</span>
                </div>
              )}
              {quote?.voucherDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Mã giảm giá</span>
                  <span>-{money(quote.voucherDiscount)}</span>
                </div>
              )}
              <div className="flex items-end justify-between border-t border-slate-100 pt-4">
                <span className="font-bold text-slate-800">Tổng cộng</span>
                <span className="text-xl font-extrabold text-[#073b4c]">
                  {quoteLoading ? "..." : money(quote?.totalAmount)}
                </span>
              </div>
            </div>

            {paymentMethod === "WALLET" &&
              walletBalance != null &&
              walletBalance < (quote?.totalAmount || 0) && (
                <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-700">
                  Số dư ví chưa đủ. Hãy chọn QR ngân hàng hoặc nạp thêm tiền.
                </p>
              )}

            <button
              type="button"
              disabled={
                submitting ||
                quoteLoading ||
                !quote ||
                expired ||
                (paymentMethod === "WALLET" &&
                  walletBalance < quote.totalAmount)
              }
              onClick={handleCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087a91] px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#066478] focus:outline-none focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : paymentMethod === "BANK_QR" ? (
                <QrCode className="h-4 w-4" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {paymentMethod === "BANK_QR"
                ? "Tạo QR thanh toán"
                : "Thanh toán bằng ví"}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <LockKeyhole className="h-3.5 w-3.5" />
              Thông tin được bảo vệ trong quá trình đặt vé
            </p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-500">Tổng thanh toán</p>
            <p className="text-lg font-extrabold text-[#073b4c]">
              {quoteLoading ? "Đang tính..." : money(quote?.totalAmount)}
            </p>
          </div>
          <button
            type="button"
            disabled={
              submitting ||
              quoteLoading ||
              !quote ||
              expired ||
              (paymentMethod === "WALLET" && walletBalance < quote.totalAmount)
            }
            onClick={handleCheckout}
            className="flex items-center gap-2 rounded-xl bg-[#087a91] px-4 py-3 text-xs font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-500"
          >
            Tiếp tục
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expired && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[26px] bg-white p-7 text-center shadow-2xl">
            <Clock3 className="mx-auto h-10 w-10 text-amber-500" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              Thời gian giữ ghế đã kết thúc
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ghế đã được trả về hệ thống. Thông tin vừa nhập chưa tạo thành đơn
              hàng.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-6 w-full rounded-xl bg-[#087a91] px-5 py-3 text-sm font-bold text-white"
            >
              Tìm chuyến mới
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
