import { useState } from "react";
import {
  X,
  Search,
  Grid,
  UserCheck,
  CreditCard,
  QrCode,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

const STEPS_VI = [
  {
    title: "1. Tìm hành trình",
    label: "Tìm hành trình",
    icon: Search,
    color: "from-blue-500 to-[#007aff]",
    description:
      "Lựa chọn ga đi, ga đến, ngày khởi hành và số lượng hành khách phù hợp với nhu cầu di chuyển của bạn.",
    details: [
      "Nhập ga khởi hành và ga đến tại ô tìm kiếm ở trang chủ.",
      "Lựa chọn loại vé một chiều hoặc khứ hồi (chọn thêm ngày về).",
      "Hệ thống sẽ lọc ra danh sách tất cả các chuyến tàu chạy trong ngày.",
    ],
  },
  {
    title: "2. Chọn ghế & toa",
    label: "Chọn ghế & toa",
    icon: Grid,
    color: "from-purple-500 to-indigo-600",
    description:
      "Lựa chọn toa tàu (Toa ghế ngồi mềm điều hòa, Toa giường nằm) và số ghế trống trực quan trên sơ đồ tàu.",
    details: [
      "Mỗi toa tàu có ký hiệu màu sắc khác nhau đại diện cho loại ghế/giường.",
      "Nhấp vào số ghế trống (màu trắng) để giữ chỗ, ghế chuyển sang màu xanh dương.",
      "Bạn có thể chọn tối đa 4 ghế trong một lần đặt vé.",
    ],
  },
  {
    title: "3. Điền thông tin",
    label: "Điền thông tin",
    icon: UserCheck,
    color: "from-amber-500 to-orange-600",
    description:
      "Nhập thông tin cá nhân của hành khách đi tàu để làm cơ sở in vé điện tử và kiểm soát tại ga.",
    details: [
      "Điền chính xác Họ tên, Số CCCD/Hộ chiếu cho từng hành khách.",
      "Lựa chọn đúng đối tượng (Trẻ em, Sinh viên, Người cao tuổi) để được áp dụng giảm giá.",
      "Nhập Email và Số điện thoại chính xác để nhận mã vé điện tử.",
    ],
  },
  {
    title: "4. Thanh toán",
    label: "Thanh toán",
    icon: CreditCard,
    color: "from-rose-500 to-red-600",
    description:
      "Hoàn tất thanh toán trong vòng 10 phút giữ chỗ bằng mã QR ngân hàng qua PayOS hoặc Ví điện tử GoTrain.",
    details: [
      "Quét mã QR PayOS bằng bất kỳ ứng dụng ngân hàng nào (hỗ trợ VietQR).",
      "Hoặc chọn thanh toán trừ trực tiếp từ số dư Ví GoTrain VN của bạn.",
      "Sau 10 phút nếu không thanh toán, hệ thống sẽ tự động hủy giữ chỗ.",
    ],
  },
  {
    title: "5. Nhận vé & Đi tàu",
    label: "Nhận vé & Đi tàu",
    icon: QrCode,
    color: "from-emerald-500 to-teal-600",
    description:
      "Nhận mã QR vé điện tử tức thời qua email và sử dụng mã này để quét soát vé lên tàu tại ga.",
    details: [
      "Mã vé điện tử (dạng QR) được gửi trực tiếp tới email đặt vé.",
      "Bạn chỉ cần chụp màn hình mã QR này hoặc lưu trong mục 'Vé của tôi'.",
      "Có mặt tại ga trước 30 phút, quét QR tại cửa soát vé tự động để lên tàu.",
    ],
  },
];

const STEPS_EN = [
  {
    title: "1. Search journey",
    label: "Search journey",
    icon: Search,
    color: "from-blue-500 to-[#007aff]",
    description:
      "Select departure station, destination, departure date, and number of passengers according to your travel needs.",
    details: [
      "Enter departure and destination stations in the search bar on the homepage.",
      "Choose one-way or round-trip ticket types (select return date).",
      "The system will filter all train journeys operating during the day.",
    ],
  },
  {
    title: "2. Choose Carriage & Seat",
    label: "Choose Carriage & Seat",
    icon: Grid,
    color: "from-purple-500 to-indigo-600",
    description:
      "Select your train carriage (Air-conditioned Soft Seats, Sleeper compartments) and empty seats visually on the carriage layout.",
    details: [
      "Each carriage has color-coded signs representing ticket/seat classes.",
      "Click on an empty seat (white) to hold; it will change to blue.",
      "You can select up to 4 seats per booking transaction.",
    ],
  },
  {
    title: "3. Enter Information",
    label: "Enter Info",
    icon: UserCheck,
    color: "from-amber-500 to-orange-600",
    description:
      "Enter personal details of passengers to generate e-tickets and clear security checks at the station.",
    details: [
      "Fill in exact Full Name, Citizen ID/Passport number for each passenger.",
      "Select correct discount criteria (Child, Student, Senior Citizen) if applicable.",
      "Enter correct email address and phone number to receive electronic ticket details.",
    ],
  },
  {
    title: "4. Complete Payment",
    label: "Payment",
    icon: CreditCard,
    color: "from-rose-500 to-red-600",
    description:
      "Complete payment within 10 minutes of reserving your seats using PayOS VietQR or GoTrain E-Wallet.",
    details: [
      "Scan PayOS QR code with any mobile banking application (VietQR compatible).",
      "Or pay directly using your GoTrain VN e-wallet balance.",
      "If unpaid after 10 minutes, the system automatically cancels the seat reservation.",
    ],
  },
  {
    title: "5. Get Tickets & Board",
    label: "Get Tickets & Board",
    icon: QrCode,
    color: "from-emerald-500 to-teal-600",
    description:
      "Receive your QR e-ticket instantly via email and scan it at the station boarding gate.",
    details: [
      "E-ticket QR codes are delivered directly to the booking email.",
      "Take a screenshot of the QR code or view it under 'My Tickets'.",
      "Arrive at the station 30 minutes early, scan the QR at the gate, and board.",
    ],
  },
];

export function BookingGuideModal({ isOpen, onClose }) {
  const [activeStep, setActiveStep] = useState(0);
  const { t, language } = useLanguage();
  const steps = language === "vi" ? STEPS_VI : STEPS_EN;

  if (!isOpen) return null;

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const currentStep = steps[activeStep];
  const StepIcon = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#004c7a] to-[#00629d] px-8 py-6 text-white text-left">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all border-none cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-xl font-extrabold tracking-tight">
              {t("guide_header")}
            </h3>
            <p className="text-xs text-[#b3d4f0]/90 mt-1">{t("guide_sub")}</p>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-8 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === activeStep;
            const isCompleted = idx < activeStep;
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center relative"
              >
                <button
                  onClick={() => setActiveStep(idx)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer border-none ${
                    isActive
                      ? "bg-[#00629d] text-white ring-4 ring-[#00629d]/20 scale-110"
                      : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </button>
                <span
                  className={`text-[10px] mt-1.5 hidden sm:inline font-bold transition-all ${
                    isActive ? "text-[#00629d]" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
                {idx < steps.length - 1 && (
                  <div
                    className={`absolute top-4 left-[calc(50%+18px)] w-[calc(100%-36px)] h-1 -translate-y-1/2 z-0 hidden sm:block ${
                      isCompleted ? "bg-emerald-400" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Detail Content */}
        <div className="p-8 flex flex-col md:flex-row gap-6 items-start text-left min-h-[220px]">
          {/* Step Icon Card */}
          <div
            className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${currentStep.color} text-white flex items-center justify-center shrink-0 shadow-lg`}
          >
            <StepIcon className="w-10 h-10" />
          </div>

          {/* Description details */}
          <div className="space-y-4 flex-1">
            <div>
              <h4 className="text-lg font-extrabold text-slate-800">
                {currentStep.title}
              </h4>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                {currentStep.description}
              </p>
            </div>

            <ul className="space-y-2.5 font-sans pl-0">
              {currentStep.details.map((detail, dIdx) => (
                <li key={dIdx} className="flex gap-2 text-sm text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00629d] mt-2 shrink-0" />
                  <span className="leading-relaxed">{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between font-sans">
          {/* Progress label */}
          <span className="text-xs font-bold text-slate-400">
            {language === "vi" ? "Bước" : "Step"} {activeStep + 1} /{" "}
            {steps.length}
          </span>

          <div className="flex gap-2">
            <button
              onClick={handleBack}
              disabled={activeStep === 0}
              className="flex items-center gap-1 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("guide_prev")}
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1 bg-[#00629d] hover:bg-[#00527f] text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer border-none"
            >
              {activeStep === steps.length - 1
                ? t("guide_finish")
                : t("guide_next")}
              {activeStep < steps.length - 1 && (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
