import { Train, ArrowRight, Clock, Star, MapPin } from "lucide-react";

export function ScheduleCard({ schedule, onSelect }) {
  const formatTime = (timeStr) => {
    const d = new Date(timeStr);
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timeStr) => {
    const d = new Date(timeStr);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const formatDuration = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const minPrice = Math.min(...schedule.pricing.map((p) => p.price));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-all hover:border-slate-300 flex flex-col md:flex-row justify-between items-stretch gap-6 text-left">
      {/* Cột trái: Thông tin tàu & Hành trình */}
      <div className="flex-1 flex flex-col justify-between gap-4">
        {/* Hàng đầu: Tên tàu & Đánh giá */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/8 rounded-full text-primary font-bold text-xs">
            <Train className="h-3.5 w-3.5" />
            <span>{schedule.trainCode}</span>
          </div>
          <span className="text-sm font-semibold text-slate-700">
            {schedule.trainName}
          </span>
          <div className="flex items-center gap-1 text-amber-500 text-xs">
            <Star className="h-3 w-3 fill-current" />
            <span className="font-bold">4.8</span>
          </div>
        </div>

        {/* Hàng giữa: Trục thời gian */}
        <div className="flex items-center gap-6 py-2">
          {/* Giờ xuất phát */}
          <div className="text-left shrink-0">
            <p className="text-xl font-bold text-slate-800 leading-none">
              {formatTime(schedule.departureTime)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-semibold">
              {formatDate(schedule.departureTime)}
            </p>
            <p className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-0.5">
              <MapPin className="h-3 w-3 text-slate-400" />
              {schedule.startStationName}
            </p>
          </div>

          {/* Đường nối */}
          <div className="flex-grow flex flex-col items-center relative py-1">
            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(schedule.duration)}
            </span>
            <div className="w-full flex items-center justify-between mt-1.5">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-white"></div>
              <div className="flex-1 border-t border-dashed border-slate-300 mx-1"></div>
              <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="flex-1 border-t border-dashed border-slate-300 mx-1"></div>
              <div className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-primary"></div>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold uppercase mt-1">
              Đi thẳng
            </span>
          </div>

          {/* Giờ đến */}
          <div className="text-left shrink-0">
            <p className="text-xl font-bold text-slate-800 leading-none">
              {formatTime(schedule.arrivalTime)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-semibold">
              {formatDate(schedule.arrivalTime)}
            </p>
            <p className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-0.5">
              <MapPin className="h-3 w-3 text-slate-400" />
              {schedule.endStationName}
            </p>
          </div>
        </div>

        {/* Hàng cuối: Các loại ghế hiện có */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
          {schedule.pricing.map((opt) => (
            <div
              key={opt.carriageType}
              className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-semibold text-slate-600 flex items-center gap-1.5"
            >
              <span>{opt.carriageTypeName}</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-800 font-bold">
                {formatPrice(opt.price)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cột phải: Giá vé tối thiểu & Action */}
      <div className="md:w-48 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-center items-start md:items-end gap-3 shrink-0 text-left md:text-right">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Giá vé từ
          </span>
          <p className="text-2xl font-extrabold text-primary leading-tight mt-0.5">
            {formatPrice(minPrice)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Mỗi hành khách (đã gồm thuế)
          </span>
        </div>
        <button
          onClick={() => onSelect(schedule)}
          className="w-full bg-primary-container text-white py-2.5 rounded-xl font-bold text-xs hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm mt-1"
        >
          Chọn chuyến
        </button>
      </div>
    </div>
  );
}
