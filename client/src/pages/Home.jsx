import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Calendar,
  RotateCw,
  Users,
  Train,
  ArrowRight,
  ChevronRight,
  Zap,
  Headphones,
  Tag,
  Star,
  Plus,
  Minus,
  Home as HomeIcon,
  CalendarDays,
  Ticket,
  Wallet,
  User as UserIcon,
  ArrowLeftRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

const DEFAULT_FROM_STATION = "Hà Nội";
const DEFAULT_TO_STATION = "Đà Nẵng";

export function Home() {
  const navigate = useNavigate();

  const getTodayDateStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getNextDay = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  // Search parameters
  const [fromStation, setFromStation] = useState(DEFAULT_FROM_STATION);
  const [fromStationId, setFromStationId] = useState("");
  const [toStation, setToStation] = useState(DEFAULT_TO_STATION);
  const [toStationId, setToStationId] = useState("");
  const [departureDate, setDepartureDate] = useState(getTodayDateStr());
  const [returnDate, setReturnDate] = useState("");
  const [tripType, setTripType] = useState("one-way"); // 'one-way' or 'round-trip'

  const [stations, setStations] = useState([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);

  // Live tracking progress bar logic
  const [progress, setProgress] = useState(66.05);

  const [promotionsList, setPromotionsList] = useState([]);
  const [loadingPromotions, setLoadingPromotions] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev + 0.05) % 100);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch active stations from server on load
  useEffect(() => {
    api
      .get("/stations")
      .then(({ data }) => {
        if (data && data.stations) {
          const formatted = data.stations.map((s) => ({
            id: s.id,
            code: s.stationCode,
            name: s.stationName.replace(/^Ga\s+/i, ""),
            city: s.city,
          }));
          setStations(formatted);
          setFromStationId(
            formatted.find((station) => station.name === DEFAULT_FROM_STATION)
              ?.id || "",
          );
          setToStationId(
            formatted.find((station) => station.name === DEFAULT_TO_STATION)
              ?.id || "",
          );
        }
      })
      .catch((err) => {
        console.error("Lỗi khi tải danh sách ga từ API:", err);
        toast.error("Không thể tải danh sách ga đang hoạt động.");
      });
  }, []);

  // Fetch active promotions & vouchers from server on load
  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        setLoadingPromotions(true);
        const { data } = await api.get("/promotions");
        const list = [];
        if (data) {
          // Map vouchers
          if (Array.isArray(data.vouchers)) {
            data.vouchers.forEach((v) => {
              list.push({
                id: `voucher-${v.id}`,
                code: v.voucherCode,
                title: `Mã giảm giá ${v.voucherCode}`,
                description:
                  v.description ||
                  `Giảm ngay ${v.discountType === "PERCENTAGE" ? `${v.discountValue}%` : `${v.discountValue.toLocaleString("vi-VN")}đ`}`,
                discount:
                  v.discountType === "PERCENTAGE"
                    ? `${v.discountValue}%`
                    : `${v.discountValue / 1000}k`,
                isVoucher: true,
              });
            });
          }
          // Map promotions
          if (Array.isArray(data.promotions)) {
            data.promotions.forEach((p) => {
              list.push({
                id: `promo-${p.id}`,
                code: "Tự động áp dụng",
                title: p.title,
                description:
                  p.description ||
                  "Ưu đãi tự động áp dụng trực tiếp cho các chặng/chuyến tàu đủ điều kiện.",
                discount:
                  p.discountType === "PERCENTAGE"
                    ? `${p.discountValue}%`
                    : p.discountType === "FREE_UPGRADE"
                      ? "Nâng hạng"
                      : `${p.discountValue / 1000}k`,
                isVoucher: false,
              });
            });
          }
        }
        setPromotionsList(list);
      } catch (err) {
        console.error("Lỗi khi tải danh sách khuyến mãi trên trang chủ:", err);
      } finally {
        setLoadingPromotions(false);
      }
    };
    fetchPromotions();
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleCloseSuggestions = () => {
      setShowFromSuggestions(false);
      setShowToSuggestions(false);
    };
    window.addEventListener("click", handleCloseSuggestions);
    return () => window.removeEventListener("click", handleCloseSuggestions);
  }, []);

  const handleSwapStations = () => {
    const temp = fromStation;
    const tempId = fromStationId;
    setFromStation(toStation);
    setFromStationId(toStationId);
    setToStation(temp);
    setToStationId(tempId);
    toast.success("Đã đổi Ga đi và Ga đến!");
  };

  const filteredFromSuggestions = useMemo(() => {
    const query = fromStation.trim().toLowerCase();
    if (!query) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.city.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query),
    );
  }, [fromStation, stations]);

  const filteredToSuggestions = useMemo(() => {
    const query = toStation.trim().toLowerCase();
    if (!query) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.city.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query),
    );
  }, [toStation, stations]);

  const handleSearch = (e) => {
    e.preventDefault();

    const fromTrimmed = fromStation.trim();
    const toTrimmed = toStation.trim();

    if (!fromTrimmed) {
      toast.error("Vui lòng nhập Ga đi!");
      return;
    }
    if (!toTrimmed) {
      toast.error("Vui lòng nhập Ga đến!");
      return;
    }

    // Match exact station name from database/mock
    const validFrom = stations.find(
      (s) =>
        s.id === fromStationId &&
        s.name.toLowerCase() === fromTrimmed.toLowerCase(),
    );
    const validTo = stations.find(
      (s) =>
        s.id === toStationId &&
        s.name.toLowerCase() === toTrimmed.toLowerCase(),
    );

    if (!validFrom) {
      toast.error(
        `Ga đi "${fromTrimmed}" không tồn tại trong hệ thống. Vui lòng chọn ga từ danh sách!`,
      );
      return;
    }
    if (!validTo) {
      toast.error(
        `Ga đến "${toTrimmed}" không tồn tại trong hệ thống. Vui lòng chọn ga từ danh sách!`,
      );
      return;
    }

    if (validFrom.name === validTo.name) {
      toast.error("Ga đi và Ga đến không được trùng nhau!");
      return;
    }

    if (!departureDate) {
      toast.error("Vui lòng chọn ngày đi!");
      return;
    }

    const todayStr = getTodayDateStr();
    if (departureDate < todayStr) {
      toast.error("Ngày đi không được ở quá khứ!");
      return;
    }

    if (tripType === "round-trip") {
      if (!returnDate) {
        toast.error("Vui lòng chọn ngày về cho vé khứ hồi!");
        return;
      }
      if (returnDate < departureDate) {
        toast.error("Ngày về không được trước ngày đi!");
        return;
      }
    }

    toast.success(
      `Đang tìm kiếm chuyến tàu từ ${validFrom.name} đi ${validTo.name}...`,
    );

    const params = new URLSearchParams({
      fromStationId: validFrom.id,
      toStationId: validTo.id,
      from: validFrom.name,
      to: validTo.name,
      departureDate,
      trip: tripType,
    });
    if (tripType === "round-trip") params.set("returnDate", returnDate);
    navigate(`/schedule?${params.toString()}`);
  };

  const handleCopyVoucher = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(`Đã sao chép mã khuyến mãi: ${code}`);
  };

  const handleRouteSelect = (from, to) => {
    const selectedFrom = stations.find((station) => station.name === from);
    const selectedTo = stations.find((station) => station.name === to);

    if (!selectedFrom || !selectedTo) {
      toast.error("Chặng này hiện chưa có trong danh sách ga đang hoạt động.");
      return;
    }

    setFromStation(from);
    setFromStationId(selectedFrom.id);
    setToStation(to);
    setToStationId(selectedTo.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info(`Đã chọn chặng phổ biến: ${from} ↔ ${to}`);
  };

  return (
    <div className="text-on-surface bg-[#f7f9fb] min-h-screen pb-16 md:pb-0 pt-16">
      {/* 1. Hero Section */}
      <section className="relative min-h-[680px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-full object-cover"
            alt="A high-speed modern train speeding through a lush green Vietnamese landscape during a clear, bright morning."
            data-alt="A high-speed modern train speeding through a lush green Vietnamese landscape during a clear, bright morning. The visual style is premium and minimalist, with a high-key lighting that emphasizes a clean and airy atmosphere."
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAiYOE4xZ1rXlui1yAL0kL5_fTQ5bavpG-CRTAn8v9i5l1pDWxd8TWP7hPmf-bMRWaGNqVLoREfl3h_ironj-UeZeoWitlNnWcu2X-BD4UkmtwiBtrR71ofm12azr8auyNb8Y7O-7sAEXRZp3sKzkji-2TerV9Ps0z9yBwpReSW0lH9ADmL8LkxcQOYJinqGvR4BJGzOeiCgArzVfpkOr4L8uYZd5YmepxmcyaIFDyzy0Icm3CpjIf4QiYsRL0x3aleFv13tgtQW6M0"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent"></div>
        </div>

        <div className="relative z-10 px-container-margin max-w-[1200px] mx-auto w-full pt-16 pb-28 md:pb-36">
          <div className="text-left w-full">
            <div className="max-w-2xl mb-lg">
              <h1 className="font-display-lg text-display-lg md:text-[56px] text-primary mb-md leading-tight">
                Hành Trình Mới,
                <br />
                Trải Nghiệm Mới
              </h1>
              <p className="font-body-lg text-body-lg text-secondary">
                Đặt vé tàu nhanh chóng, an toàn và tiện lợi cùng GoTrain VN.
                Khám phá vẻ đẹp Việt Nam qua từng ô cửa sổ.
              </p>
            </div>

            {/* Search Card */}
            <div className="bg-white p-lg rounded-[24px] shadow-[0px_20px_50px_rgba(0,163,255,0.12)] border border-surface-container max-w-5xl w-full">
              <form onSubmit={handleSearch}>
                <div
                  className={`grid grid-cols-1 gap-md items-end ${tripType === "round-trip" ? "md:grid-cols-5" : "md:grid-cols-4"}`}
                >
                  {/* Station Fields Container */}
                  <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-md relative">
                    {/* Ga Đi */}
                    <div
                      className="flex flex-col gap-xs relative text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="font-label-md text-label-md text-secondary">
                        Ga Đi
                      </label>
                      <div className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all bg-white h-[48px]">
                        <MapPin className="h-5 w-5 text-primary shrink-0" />
                        <input
                          className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none text-xs font-semibold"
                          placeholder="Hà Nội"
                          type="text"
                          value={fromStation}
                          onChange={(e) => {
                            setFromStation(e.target.value);
                            setFromStationId("");
                            setShowFromSuggestions(true);
                          }}
                          onFocus={() => {
                            setShowFromSuggestions(true);
                            setShowToSuggestions(false);
                          }}
                        />
                      </div>
                      {/* Suggestions Dropdown */}
                      {showFromSuggestions &&
                        filteredFromSuggestions.length > 0 && (
                          <div className="absolute left-0 top-[95%] w-full md:w-[320px] bg-white border border-slate-100 rounded-b-2xl rounded-t-lg shadow-[0_12px_36px_rgba(0,0,0,0.12)] z-30 max-h-[320px] overflow-y-auto divide-y divide-slate-50">
                            {filteredFromSuggestions.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setFromStation(s.name);
                                  setFromStationId(s.id);
                                  setShowFromSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50/50 flex items-center justify-between transition-colors border-l-4 border-transparent hover:border-primary cursor-pointer group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-blue-100/50 group-hover:text-primary transition-colors">
                                    <MapPin className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">
                                      {s.name.toLowerCase().startsWith("ga")
                                        ? s.name
                                        : `Ga ${s.name}`}
                                    </p>
                                    <p className="text-xs text-slate-400 font-semibold">
                                      {s.city}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[11px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-md border border-slate-100 group-hover:bg-blue-50 group-hover:text-primary group-hover:border-blue-200 transition-colors">
                                  {s.code}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>

                    {/* Swap Button */}
                    <button
                      type="button"
                      onClick={handleSwapStations}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[20%] z-10 bg-white border border-outline-variant rounded-full p-2 text-primary hover:rotate-180 transition-transform duration-500 shadow-sm hidden md:flex items-center justify-center cursor-pointer"
                      title="Đảo chiều ga"
                    >
                      <RotateCw className="h-5 w-5" />
                    </button>

                    {/* Ga Đến */}
                    <div
                      className="flex flex-col gap-xs relative text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="font-label-md text-label-md text-secondary">
                        Ga Đến
                      </label>
                      <div className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all bg-white h-[48px]">
                        <Navigation className="h-5 w-5 text-primary rotate-45 shrink-0" />
                        <input
                          className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none text-xs font-semibold"
                          placeholder="Đà Nẵng"
                          type="text"
                          value={toStation}
                          onChange={(e) => {
                            setToStation(e.target.value);
                            setToStationId("");
                            setShowToSuggestions(true);
                          }}
                          onFocus={() => {
                            setShowToSuggestions(true);
                            setShowFromSuggestions(false);
                          }}
                        />
                      </div>
                      {/* Suggestions Dropdown */}
                      {showToSuggestions &&
                        filteredToSuggestions.length > 0 && (
                          <div className="absolute right-0 top-[95%] w-full md:w-[320px] bg-white border border-slate-100 rounded-b-2xl rounded-t-lg shadow-[0_12px_36px_rgba(0,0,0,0.12)] z-30 max-h-[320px] overflow-y-auto divide-y divide-slate-50">
                            {filteredToSuggestions.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setToStation(s.name);
                                  setToStationId(s.id);
                                  setShowToSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50/50 flex items-center justify-between transition-colors border-l-4 border-transparent hover:border-primary cursor-pointer group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-blue-100/50 group-hover:text-primary transition-colors">
                                    <MapPin className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">
                                      {s.name.toLowerCase().startsWith("ga")
                                        ? s.name
                                        : `Ga ${s.name}`}
                                    </p>
                                    <p className="text-xs text-slate-400 font-semibold">
                                      {s.city}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[11px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-md border border-slate-100 group-hover:bg-blue-50 group-hover:text-primary group-hover:border-blue-200 transition-colors">
                                  {s.code}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Ngày Đi / Ngày Về Container */}
                  <div
                    className={`col-span-1 text-left ${tripType === "round-trip" ? "md:col-span-2" : "md:col-span-1"}`}
                  >
                    {tripType === "one-way" ? (
                      <div className="flex flex-col gap-xs text-left w-full">
                        <div className="flex justify-between items-center">
                          <label className="font-label-md text-label-md text-secondary">
                            Ngày Đi
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setTripType("round-trip");
                              setReturnDate(getNextDay(departureDate));
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary-container cursor-pointer transition-colors"
                            title="Chọn vé khứ hồi"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>Khứ hồi?</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all bg-white h-[48px]">
                          <Calendar className="h-5 w-5 text-primary shrink-0" />
                          <input
                            className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none cursor-pointer text-xs font-semibold"
                            type="date"
                            min={getTodayDateStr()}
                            value={departureDate}
                            onChange={(e) => {
                              setDepartureDate(e.target.value);
                              if (returnDate && returnDate < e.target.value) {
                                setReturnDate(e.target.value);
                              }
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-md w-full">
                        {/* Ngày Đi */}
                        <div className="col-span-1 flex flex-col gap-xs text-left">
                          <label className="font-label-md text-label-md text-secondary">
                            Ngày Đi
                          </label>
                          <div className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all bg-white h-[48px]">
                            <Calendar className="h-5 w-5 text-primary shrink-0" />
                            <input
                              className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none cursor-pointer text-xs font-semibold"
                              type="date"
                              min={getTodayDateStr()}
                              value={departureDate}
                              onChange={(e) => {
                                setDepartureDate(e.target.value);
                                if (returnDate && returnDate < e.target.value) {
                                  setReturnDate(e.target.value);
                                }
                              }}
                            />
                          </div>
                        </div>

                        {/* Ngày Về */}
                        <div className="col-span-1 flex flex-col gap-xs text-left relative">
                          <div className="flex justify-between items-center">
                            <label className="font-label-md text-label-md text-secondary">
                              Ngày Về
                            </label>
                            <button
                              type="button"
                              onClick={() => setTripType("one-way")}
                              className="text-slate-400 hover:text-red-500 transition-colors font-bold text-xs cursor-pointer"
                              title="Hủy khứ hồi"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-xs px-md py-sm border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all bg-white h-[48px]">
                            <Calendar className="h-5 w-5 text-primary shrink-0" />
                            <input
                              className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none cursor-pointer text-xs font-semibold"
                              type="date"
                              min={departureDate || getTodayDateStr()}
                              value={returnDate}
                              onChange={(e) => setReturnDate(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="bg-primary-container text-white h-[48px] rounded-xl font-label-md text-label-md font-bold shadow-[0px_8px_24px_rgba(0,163,255,0.3)] hover:scale-[1.02] active:scale-95 transition-all w-full flex items-center justify-center cursor-pointer md:col-span-1"
                  >
                    Tìm Chuyến Tàu
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Live Tracking Preview */}
      <div className="max-w-[1200px] mx-auto px-container-margin -mt-8 relative z-20">
        <div className="bg-white/90 backdrop-blur-md border border-white/50 p-md rounded-2xl shadow-lg flex items-center gap-lg">
          <div className="flex flex-col text-left shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-secondary font-bold">
              Trạng thái trực tiếp
            </span>
            <span className="font-label-md text-primary font-bold">
              Tàu SE1 - Đang đến ga Huế
            </span>
          </div>

          <div className="flex-grow h-[4px] bg-secondary-fixed rounded-full relative overflow-visible">
            <div
              className="absolute h-full bg-primary-container rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            ></div>
            <div
              className="absolute -top-2 transition-all duration-1000"
              style={{ left: `${progress}%`, transform: "translateX(-50%)" }}
            >
              <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-white shadow-sm border border-primary-container/20">
                <Train className="h-[12px] w-[12px] text-primary-container" />
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="font-label-sm text-secondary block text-xs">
              Dự kiến
            </span>
            <span className="font-semibold text-xl text-on-surface">14:30</span>
          </div>
        </div>
      </div>

      {/* 3. Popular Routes ("Điểm Đến Phổ Biến") */}
      <section className="py-xl max-w-[1200px] mx-auto px-container-margin">
        <div className="flex justify-between items-end mb-lg text-left">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary">
              Điểm Đến Phổ Biến
            </h2>
            <p className="text-secondary font-body-md mt-2">
              Gợi ý những hành trình tuyệt vời nhất dành cho bạn
            </p>
          </div>
          <button
            onClick={() => handleRouteSelect("Hà Nội", "Sài Gòn")}
            className="text-primary font-bold flex items-center gap-xs hover:gap-sm transition-all"
          >
            Tất cả <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
          {/* Card 1 */}
          <div className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 border border-surface-container">
            <div className="h-48 overflow-hidden relative">
              <img
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                alt="A beautiful wide shot of the Ho Chi Minh City skyline at sunset."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAweNCnj57N4GRaZWAQ0l2ZLaML4vybSWJHAwBLCjB7TAhnZrSjBBWVLVvOkTOegNRIRDzcuqVT6nFlgOhQwJeOEc9aV5rTWmQWpFoDvSApZlyNr-g40TjtApnq-abzCK2PQAkwPZgIA4QN21lTpEdwZdKt6EflqO8ZXED7W4_G5Vu0lYJF4IxJl-We8d_ve_PyisrUyxLu4a1rd4Ymssw22XqmaENtsgWs_lPINAF4Uq9hI7euGEimxV5guLmzvOc0ZqlH7gqft8YA"
              />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-md py-xs rounded-full shadow-sm">
                <span className="text-primary font-bold text-label-md">
                  Từ 750k
                </span>
              </div>
            </div>
            <div className="p-md text-left">
              <h3 className="font-bold text-lg text-on-surface">
                Hà Nội - TP. Hồ Chí Minh
              </h3>
              <p className="text-on-surface-variant font-body-sm mt-1">
                Hành trình xuyên Việt lý tưởng
              </p>
              <div className="mt-md flex justify-between items-center">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    HN
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    SG
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-slate-600">
                    +12
                  </div>
                </div>
                <button
                  onClick={() => handleRouteSelect("Hà Nội", "Sài Gòn")}
                  className="p-2 bg-secondary-fixed text-primary rounded-xl group-hover:bg-primary-container group-hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 border border-surface-container">
            <div className="h-48 overflow-hidden relative">
              <img
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                alt="The iconic Dragon Bridge in Da Nang, Vietnam, captured at night."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXu7f-cze-QF82_JvN-Oa2CdGsppGAx6-X1sBMEaYbg77NcLfFgCRti6BhSUyt-HNUo7Y2nSrK9rHyDweCWUN0KU_5GdJP1O-AuaxD9UUa6gKd20_8_Ciu4pA6TMsjqqqdrmX15YTaqloFxxqq1Ma1trLmrIG40nALnbVHrMkSzZ7w1pAn-nIuSESK3FyAEdl8uMZ4Bhwa9YbPMHSd9U-pRJ96z3NXXEao13fwKUTZdpuCnCq9-LU3nb_C4xiICMm-OnpfX4y97_N4UQ"
              />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-md py-xs rounded-full shadow-sm">
                <span className="text-primary font-bold text-label-md">
                  Từ 350k
                </span>
              </div>
            </div>
            <div className="p-md text-left">
              <h3 className="font-bold text-lg text-on-surface">
                Đà Nẵng - Huế
              </h3>
              <p className="text-on-surface-variant font-body-sm mt-1">
                Ngắm nhìn đèo Hải Vân hùng vĩ
              </p>
              <div className="mt-md flex justify-between items-center">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    DN
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    H
                  </div>
                </div>
                <button
                  onClick={() => handleRouteSelect("Đà Nẵng", "Huế")}
                  className="p-2 bg-secondary-fixed text-primary rounded-xl group-hover:bg-primary-container group-hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 border border-surface-container">
            <div className="h-48 overflow-hidden relative">
              <img
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                alt="A peaceful coastal scene in Nha Trang, Vietnam."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQ5Xajf7mAtz_KfO6j1nNYU6Gl2Ny9UHhksIUer32EoNV1qzgM2acR7OEP0_kY6Cc6PrObB4TX0XxzDiMlOdRMFu8JCnqcymHMAR23ph0FbYkpOUVAZtiQJlASOaO5FxY7XoJsHnOGMTZ12aI_ra4iVxJKlXfYbbCBK6iEoVggaPh5YjxE7dN_nK8F4L2-SsIHKYiSgOWhqhAZ4f-hA00jGPe3D0SqY3jvxGiQN-CWWjFzfRVKDopprohqOGCVMq78EiVhNDfqskkX"
              />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-md py-xs rounded-full shadow-sm">
                <span className="text-primary font-bold text-label-md">
                  Từ 420k
                </span>
              </div>
            </div>
            <div className="p-md text-left">
              <h3 className="font-bold text-lg text-on-surface">
                TP. HCM - Nha Trang
              </h3>
              <p className="text-on-surface-variant font-body-sm mt-1">
                Chuyến đi biển cuối tuần thú vị
              </p>
              <div className="mt-md flex justify-between items-center">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    SG
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600">
                    NT
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-surface-container-highest flex items-center justify-center text-[10px] font-bold text-slate-600">
                    +5
                  </div>
                </div>
                <button
                  onClick={() => handleRouteSelect("Sài Gòn", "Nha Trang")}
                  className="p-2 bg-secondary-fixed text-primary rounded-xl group-hover:bg-primary-container group-hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Promotions Section */}
      <section className="bg-primary-fixed/30 py-xl">
        <div className="max-w-[1200px] mx-auto px-container-margin text-left">
          <h2 className="font-headline-lg text-headline-lg text-primary mb-lg">
            Khuyến Mãi Hấp Dẫn
          </h2>

          <div className="flex overflow-x-auto gap-md pb-md scrollbar-none w-full">
            {loadingPromotions ? (
              <div className="flex gap-md w-full">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-full md:w-[570px] bg-slate-200/50 animate-pulse h-[180px] rounded-[24px]"
                  />
                ))}
              </div>
            ) : promotionsList.length === 0 ? (
              <div className="w-full bg-white p-lg rounded-[24px] border border-surface-container text-center py-xl shadow-sm">
                <p className="text-on-surface-variant font-medium">
                  Hiện tại không có chương trình khuyến mãi nào đang diễn ra.
                </p>
              </div>
            ) : (
              promotionsList.map((promo, idx) => {
                const isEven = idx % 2 === 0;
                const bgClass = isEven
                  ? "bg-gradient-to-br from-primary-container to-primary"
                  : "bg-gradient-to-br from-tertiary-container to-tertiary";
                const btnTextClass = isEven ? "text-primary" : "text-tertiary";

                return (
                  <div
                    key={promo.id}
                    className={`flex-shrink-0 w-full md:w-[570px] ${bgClass} p-lg rounded-[24px] text-white flex justify-between items-start relative overflow-hidden`}
                  >
                    <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px] pr-[120px]">
                      <div>
                        <span className="bg-white/20 px-sm py-1 rounded-full text-[11px] font-bold mb-xs inline-block">
                          {promo.isVoucher
                            ? `Mã: ${promo.code}`
                            : "Khuyến mãi hệ thống"}
                        </span>
                        <h3 className="text-xl md:text-2xl font-bold text-white mb-xs line-clamp-1">
                          {promo.title}
                        </h3>
                        <p className="text-xs md:text-sm text-white/80 line-clamp-2 leading-relaxed">
                          {promo.description}
                        </p>
                      </div>
                      <div className="mt-md">
                        {promo.isVoucher ? (
                          <button
                            onClick={() => handleCopyVoucher(promo.code)}
                            className="bg-white hover:bg-slate-50 text-primary px-lg py-sm rounded-xl font-bold transition active:scale-95 cursor-pointer text-sm shadow-sm"
                          >
                            Sao chép mã
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              window.scrollTo({ top: 0, behavior: "smooth" });
                              toast.info(
                                "Vui lòng chọn chặng đi/đến ở phía trên để tìm vé!",
                              );
                            }}
                            className={`bg-white hover:bg-slate-50 ${btnTextClass} px-lg py-sm rounded-xl font-bold transition active:scale-95 cursor-pointer text-sm shadow-sm`}
                          >
                            Khám Phá
                          </button>
                        )}
                      </div>
                    </div>
                    {promo.isVoucher ? (
                      <Ticket className="h-[120px] w-[120px] text-white opacity-20 absolute -right-4 -bottom-4 rotate-12 shrink-0" />
                    ) : (
                      <Wallet className="h-[120px] w-[120px] text-white opacity-20 absolute -right-4 -bottom-4 rotate-12 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* 5. System Advantages */}
      <section className="py-xl max-w-[1200px] mx-auto px-container-margin">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-xl">
          <div className="flex flex-col items-center text-center p-md">
            <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center text-primary mb-md shadow-sm">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-sm">Thanh toán nhanh</h3>
            <p className="text-on-surface-variant font-body-sm text-sm">
              Hỗ trợ đa dạng phương thức thanh toán an toàn, bảo mật tuyệt đối.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-md">
            <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center text-primary mb-md shadow-sm">
              <Headphones className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-sm">Hỗ trợ 24/7</h3>
            <p className="text-on-surface-variant font-body-sm text-sm">
              Đội ngũ chăm sóc khách hàng tận tâm, sẵn sàng giải đáp mọi thắc
              mắc.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-md">
            <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center text-primary mb-md shadow-sm">
              <Tag className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-sm">Giá tốt nhất</h3>
            <p className="text-on-surface-variant font-body-sm text-sm">
              Cam kết giá vé minh bạch, nhiều chương trình ưu đãi độc quyền.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Customer Feedback */}
      <section className="py-xl bg-surface-container-lowest">
        <div className="max-w-[1200px] mx-auto px-container-margin">
          <div className="text-center mb-xl">
            <h2 className="font-headline-lg text-primary">
              Khách Hàng Nói Gì?
            </h2>
            <div className="flex justify-center gap-xs mt-sm text-primary-container">
              <Star className="h-5 w-5 fill-current text-primary-container" />
              <Star className="h-5 w-5 fill-current text-primary-container" />
              <Star className="h-5 w-5 fill-current text-primary-container" />
              <Star className="h-5 w-5 fill-current text-primary-container" />
              <Star className="h-5 w-5 fill-current text-primary-container" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {/* Feedback 1 */}
            <div className="bg-white p-lg rounded-[24px] shadow-sm border border-surface-container text-left flex flex-col justify-between">
              <p className="text-on-surface-variant italic font-body-md mb-lg text-sm">
                "Ứng dụng tuyệt vời, giao diện rất mượt và dễ sử dụng. Mình đã
                đặt vé thành công chỉ trong 2 phút."
              </p>
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-sm">
                  VA
                </div>
                <div>
                  <h4 className="font-bold text-sm text-on-surface">
                    Nguyễn Văn An
                  </h4>
                  <p className="text-[10px] text-secondary uppercase tracking-tighter">
                    Hành khách thân thiết
                  </p>
                </div>
              </div>
            </div>

            {/* Feedback 2 */}
            <div className="bg-white p-lg rounded-[24px] shadow-sm border border-surface-container text-left flex flex-col justify-between">
              <p className="text-on-surface-variant italic font-body-md mb-lg text-sm">
                "Tôi thích cách GoTrain hiển thị lộ trình tàu chạy. Rất chuyên
                nghiệp và hiện đại hơn hẳn các nền tảng khác."
              </p>
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-sm">
                  LM
                </div>
                <div>
                  <h4 className="font-bold text-sm text-on-surface">
                    Lê Thị Mai
                  </h4>
                  <p className="text-[10px] text-secondary uppercase tracking-tighter">
                    Doanh nhân
                  </p>
                </div>
              </div>
            </div>

            {/* Feedback 3 */}
            <div className="bg-white p-lg rounded-[24px] shadow-sm border border-surface-container text-left flex flex-col justify-between">
              <p className="text-on-surface-variant italic font-body-md mb-lg text-sm">
                "Hỗ trợ viên rất nhiệt tình khi mình cần đổi vé. Một trải nghiệm
                dịch vụ khách hàng đáng khen ngợi."
              </p>
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-sm">
                  TT
                </div>
                <div>
                  <h4 className="font-bold text-sm text-on-surface">
                    Trần Minh Tâm
                  </h4>
                  <p className="text-[10px] text-secondary uppercase tracking-tighter">
                    Du khách tự túc
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="w-full rounded-t-xl bg-surface-container-high py-xl text-left">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-md px-container-margin py-xl max-w-[1200px] mx-auto">
          <div className="flex flex-col gap-md">
            <div className="font-headline-md text-headline-md text-primary font-bold text-xl">
              GoTrain VN
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant text-sm">
              Kiến tạo những hành trình tàu hỏa hiện đại, kết nối mọi miền đất
              nước bằng công nghệ và sự tận tâm.
            </p>
          </div>

          <div className="flex flex-col gap-sm">
            <h4 className="font-bold text-primary text-sm">Khám phá</h4>
            <a
              className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors text-sm"
              href="#"
            >
              Về Chúng Tôi
            </a>
            <a
              className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors text-sm"
              href="#"
            >
              Chính Sách
            </a>
            <a
              className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors text-sm"
              href="#"
            >
              Hỗ Trợ
            </a>
          </div>

          <div className="flex flex-col gap-sm">
            <h4 className="font-bold text-primary text-sm">Pháp lý</h4>
            <a
              className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors text-sm"
              href="#"
            >
              Điều Khoản
            </a>
            <a
              className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors text-sm"
              href="#"
            >
              Bảo mật
            </a>
            <a
              className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors text-sm"
              href="#"
            >
              Liên Hệ
            </a>
          </div>

          <div className="flex flex-col gap-md">
            <h4 className="font-bold text-primary text-sm">Theo dõi</h4>
            <div className="flex gap-md">
              <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm hover:scale-110 transition-transform cursor-pointer border border-slate-100">
                <span className="font-bold text-xs">FB</span>
              </button>
              <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm hover:scale-110 transition-transform cursor-pointer border border-slate-100">
                <span className="font-bold text-xs">YT</span>
              </button>
              <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm hover:scale-110 transition-transform cursor-pointer border border-slate-100">
                <span className="font-bold text-xs">IN</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-container-margin pt-lg border-t border-surface-container-highest text-center">
          <p className="font-label-sm text-label-sm text-on-surface-variant opacity-80 text-xs">
            © 2024 GoTrain VN. Tất cả quyền được bảo lưu.
          </p>
        </div>
      </footer>

      {/* 8. Bottom Nav for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-surface-container flex justify-around items-center py-sm z-50 shadow-lg">
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            toast.info("Trang Chủ");
          }}
          className="flex flex-col items-center gap-1 text-primary cursor-pointer"
        >
          <HomeIcon className="h-5 w-5" />
          <span className="text-[10px] font-bold">Trang Chủ</span>
        </button>

        <button
          onClick={() => {
            navigate("/schedule");
            toast.info("Đang mở Lịch Trình...");
          }}
          className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
        >
          <CalendarDays className="h-5 w-5" />
          <span className="text-[10px]">Lịch Trình</span>
        </button>

        <button
          onClick={() => {
            navigate("/dashboard");
            toast.info("Đang mở Vé Của Tôi...");
          }}
          className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
        >
          <Ticket className="h-5 w-5" />
          <span className="text-[10px]">Vé Của Tôi</span>
        </button>

        <button
          onClick={() => {
            navigate("/dashboard");
            toast.info("Đang mở Cá Nhân...");
          }}
          className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
        >
          <UserIcon className="h-5 w-5" />
          <span className="text-[10px]">Cá Nhân</span>
        </button>
      </div>
    </div>
  );
}
