import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Calendar,
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
const HERO_SLIDES = [
  { src: "/assets/hero-bg.jpg", alt: "Hà Nội" },
  { src: "/assets/hcmc.jpg", alt: "Thành phố Hồ Chí Minh" },
  { src: "/assets/danang.jpg", alt: "Đà Nẵng" },
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDQ5Xajf7mAtz_KfO6j1nNYU6Gl2Ny9UHhksIUer32EoNV1qzgM2acR7OEP0_kY6Cc6PrObB4TX0XxzDiMlOdRMFu8JCnqcymHMAR23ph0FbYkpOUVAZtiQJlASOaO5FxY7XoJsHnOGMTZ12aI_ra4iVxJKlXfYbbCBK6iEoVggaPh5YjxE7dN_nK8F4L2-SsIHKYiSgOWhqhAZ4f-hA00jGPe3D0SqY3jvxGiQN-CWWjFzfRVKDopprohqOGCVMq78EiVhNDfqskkX",
    alt: "Huế",
  },
];

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
  const [fromStation, setFromStation] = useState("");
  const [fromStationId, setFromStationId] = useState("");
  const [toStation, setToStation] = useState("");
  const [toStationId, setToStationId] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [tripType, setTripType] = useState("one-way"); // 'one-way' or 'round-trip'

  const [stations, setStations] = useState([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");

  // Live tracking progress bar logic
  const [progress, setProgress] = useState(66.05);

  const [promotionsList, setPromotionsList] = useState([]);
  const [loadingPromotions, setLoadingPromotions] = useState(true);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
          // Start with empty selections
        }
      })
      .catch((err) => {
        console.error("Lỗi khi tải danh sách ga từ API:", err);
        toast.error("Không thể tải danh sách ga đang hoạt động.");
      });
  }, []);

  const [blogs, setBlogs] = useState([]);
  const [loadingBlogs, setLoadingBlogs] = useState(true);
  const [selectedBlog, setSelectedBlog] = useState(null);

  useEffect(() => {
    api
      .get("/blogs")
      .then(({ data }) => {
        setBlogs(data.posts || []);
      })
      .catch((err) => {
        console.error("Lỗi khi tải bài viết chia sẻ:", err);
      })
      .finally(() => {
        setLoadingBlogs(false);
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
    const query = fromSearch.trim().toLowerCase();
    if (!query) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.city.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query),
    );
  }, [fromSearch, stations]);

  const filteredToSuggestions = useMemo(() => {
    const query = toSearch.trim().toLowerCase();
    if (!query) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.city.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query),
    );
  }, [toSearch, stations]);

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
      <section className="relative min-h-[680px] flex items-center">
        <div className="absolute inset-0 z-0 overflow-hidden">
          {HERO_SLIDES.map((slide, index) => (
            <img
              key={slide.src}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
                index === activeHeroSlide ? "opacity-100" : "opacity-0"
              }`}
              alt={slide.alt}
              src={slide.src}
              aria-hidden={index !== activeHeroSlide}
            />
          ))}
          <div className="absolute inset-0 bg-white/20"></div>
        </div>

        <div className="relative z-10 px-container-margin max-w-[1200px] mx-auto w-full pt-16 pb-28 md:pb-36 flex flex-col items-center">
          <div className="text-center w-full flex flex-col items-center">
            <div className="mb-10">
              <h1 className="text-[40px] md:text-[56px] font-semibold mb-sm leading-tight tracking-tight drop-shadow-md text-slate-900">
                Hành trình mới,{" "}
                <span className="text-[#007aff]">trải nghiệm vượt trội</span>
              </h1>
            </div>

            {/* Search Card */}
            <div className="bg-slate-300/75 backdrop-blur-xl border border-white/20 p-6 md:p-8 rounded-[28px] shadow-[0_24px_50px_rgba(0,0,0,0.12)] w-full transition-all duration-300">
              <form onSubmit={handleSearch}>
                <div
                  className={`grid grid-cols-1 gap-md items-end ${tripType === "round-trip" ? "md:grid-cols-5" : "md:grid-cols-4"}`}
                >
                  {/* Station Fields Container */}
                  <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] gap-md md:gap-3 relative">
                    {/* Ga Đi */}
                    <div
                      className={`flex flex-col gap-xs relative text-left ${showFromSuggestions ? "z-30" : "z-0"}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-2 block">
                        Ga Đi
                      </label>
                      <div
                        className="flex items-center justify-between gap-2 px-4 border border-slate-200/85 rounded-xl hover:border-primary-container focus-within:border-primary-container hover:shadow-[0_0_12px_rgba(0,163,255,0.15)] transition-all bg-white h-[52px] cursor-pointer w-full select-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFromSuggestions(!showFromSuggestions);
                          setShowToSuggestions(false);
                          setFromSearch(""); // Reset search query on open
                        }}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <MapPin className="h-5 w-5 text-[#007aff] shrink-0" />
                          <span
                            className={`text-sm truncate ${fromStation ? "text-slate-800 font-bold" : "text-slate-400 font-medium"}`}
                          >
                            {fromStation ? `Ga ${fromStation}` : "Chọn ga đi"}
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">
                          keyboard_arrow_down
                        </span>
                      </div>

                      {/* Suggestions Dropdown */}
                      {showFromSuggestions && (
                        <div className="absolute left-0 top-[105%] w-full md:w-[320px] bg-white border border-slate-200 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] z-30 p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus-within:bg-white focus-within:border-primary transition-all h-[36px]">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">
                              search
                            </span>
                            <input
                              type="text"
                              className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none text-xs font-semibold"
                              placeholder="Tìm ga đi..."
                              value={fromSearch}
                              onChange={(e) => setFromSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {fromSearch && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFromSearch("");
                                }}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="max-h-[240px] overflow-y-auto divide-y divide-slate-50 scrollbar-thin">
                            {filteredFromSuggestions.length > 0 ? (
                              filteredFromSuggestions.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setFromStation(s.name);
                                    setFromStationId(s.id);
                                    setShowFromSuggestions(false);
                                  }}
                                  className={`w-full text-left px-3 py-2.5 hover:bg-blue-50/50 flex items-center justify-between transition-colors border-l-4 rounded-lg cursor-pointer group ${
                                    fromStationId === s.id
                                      ? "border-primary bg-blue-50/30 font-bold"
                                      : "border-transparent"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        fromStationId === s.id
                                          ? "bg-blue-100 text-primary"
                                          : "bg-slate-50 text-slate-400 group-hover:bg-blue-100/50 group-hover:text-primary"
                                      }`}
                                    >
                                      <MapPin className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p
                                        className={`text-xs ${fromStationId === s.id ? "text-primary font-bold" : "text-slate-800 font-semibold"}`}
                                      >
                                        {s.name.toLowerCase().startsWith("ga")
                                          ? s.name
                                          : `Ga ${s.name}`}
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-semibold">
                                        {s.city}
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border transition-colors ${
                                      fromStationId === s.id
                                        ? "bg-blue-100 text-primary border-blue-200"
                                        : "bg-slate-50 text-slate-500 border-slate-100 group-hover:bg-blue-50 group-hover:text-primary group-hover:border-blue-200"
                                    }`}
                                  >
                                    {s.code}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="py-4 text-center text-xs text-slate-400 font-semibold">
                                Không tìm thấy ga phù hợp
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Swap Button */}
                    <button
                      type="button"
                      onClick={handleSwapStations}
                      className="hidden h-11 w-11 self-end mb-1 md:flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-[#007aff] shadow-sm transition-all duration-200 hover:border-[#007aff] hover:bg-[#007aff] hover:text-white hover:shadow-md active:scale-95 cursor-pointer"
                      title="Đảo chiều ga"
                      aria-label="Đảo chiều ga đi và ga đến"
                    >
                      <ArrowLeftRight className="h-5 w-5" />
                    </button>

                    {/* Ga Đến */}
                    <div
                      className={`flex flex-col gap-xs relative text-left ${showToSuggestions ? "z-30" : "z-0"}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-2 block">
                        Ga Đến
                      </label>
                      <div
                        className="flex items-center justify-between gap-2 px-4 border border-slate-200/85 rounded-xl hover:border-primary-container focus-within:border-primary-container hover:shadow-[0_0_12px_rgba(0,163,255,0.15)] transition-all bg-white h-[52px] cursor-pointer w-full select-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowToSuggestions(!showToSuggestions);
                          setShowFromSuggestions(false);
                          setToSearch(""); // Reset search query on open
                        }}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Navigation className="h-5 w-5 text-[#007aff] rotate-45 shrink-0" />
                          <span
                            className={`text-sm truncate ${toStation ? "text-slate-800 font-bold" : "text-slate-400 font-medium"}`}
                          >
                            {toStation ? `Ga ${toStation}` : "Chọn ga đến"}
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">
                          keyboard_arrow_down
                        </span>
                      </div>

                      {/* Suggestions Dropdown */}
                      {showToSuggestions && (
                        <div className="absolute left-0 top-[105%] w-full md:w-[320px] bg-white border border-slate-200 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] z-30 p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus-within:bg-white focus-within:border-primary transition-all h-[36px]">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">
                              search
                            </span>
                            <input
                              type="text"
                              className="w-full border-none p-0 focus:ring-0 font-body-md bg-transparent text-on-surface outline-none text-xs font-semibold"
                              placeholder="Tìm ga đến..."
                              value={toSearch}
                              onChange={(e) => setToSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {toSearch && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setToSearch("");
                                }}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="max-h-[240px] overflow-y-auto divide-y divide-slate-50 scrollbar-thin">
                            {filteredToSuggestions.length > 0 ? (
                              filteredToSuggestions.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setToStation(s.name);
                                    setToStationId(s.id);
                                    setShowToSuggestions(false);
                                  }}
                                  className={`w-full text-left px-3 py-2.5 hover:bg-blue-50/50 flex items-center justify-between transition-colors border-l-4 rounded-lg cursor-pointer group ${
                                    toStationId === s.id
                                      ? "border-primary bg-blue-50/30 font-bold"
                                      : "border-transparent"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        toStationId === s.id
                                          ? "bg-blue-100 text-primary"
                                          : "bg-slate-50 text-slate-400 group-hover:bg-blue-100/50 group-hover:text-primary"
                                      }`}
                                    >
                                      <MapPin className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p
                                        className={`text-xs ${toStationId === s.id ? "text-primary font-bold" : "text-slate-800 font-semibold"}`}
                                      >
                                        {s.name.toLowerCase().startsWith("ga")
                                          ? s.name
                                          : `Ga ${s.name}`}
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-semibold">
                                        {s.city}
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border transition-colors ${
                                      toStationId === s.id
                                        ? "bg-blue-100 text-primary border-blue-200"
                                        : "bg-slate-50 text-slate-500 border-slate-100 group-hover:bg-blue-50 group-hover:text-primary group-hover:border-blue-200"
                                    }`}
                                  >
                                    {s.code}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="py-4 text-center text-xs text-slate-400 font-semibold">
                                Không tìm thấy ga phù hợp
                              </div>
                            )}
                          </div>
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
                          <label className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-2 block">
                            Ngày Đi
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setTripType("round-trip");
                              setReturnDate(getNextDay(departureDate));
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-[#007aff] hover:text-[#005bb5] cursor-pointer transition-colors"
                            title="Chọn vé khứ hồi"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>Khứ hồi?</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-3 px-4 border border-slate-200/80 rounded-xl focus-within:border-primary-container focus-within:shadow-[0_0_12px_rgba(0,163,255,0.15)] transition-all bg-white h-[52px]">
                          <Calendar className="h-5 w-5 text-[#007aff] shrink-0" />
                          <input
                            className="w-full border-none p-0 focus:ring-0 text-slate-800 bg-transparent text-sm font-semibold outline-none cursor-pointer"
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
                          <label className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-2 block">
                            Ngày Đi
                          </label>
                          <div className="flex items-center gap-3 px-4 border border-slate-200/80 rounded-xl focus-within:border-primary-container focus-within:shadow-[0_0_12px_rgba(0,163,255,0.15)] transition-all bg-white h-[52px]">
                            <Calendar className="h-5 w-5 text-[#007aff] shrink-0" />
                            <input
                              className="w-full border-none p-0 focus:ring-0 text-slate-800 bg-transparent text-sm font-semibold outline-none cursor-pointer"
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
                            <label className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-2 block">
                              Ngày Về
                            </label>
                            <button
                              type="button"
                              onClick={() => setTripType("one-way")}
                              className="text-slate-500 hover:text-red-500 transition-colors font-bold text-xs cursor-pointer"
                              title="Hủy khứ hồi"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-3 px-4 border border-slate-200/80 rounded-xl focus-within:border-primary-container focus-within:shadow-[0_0_12px_rgba(0,163,255,0.15)] transition-all bg-white h-[52px]">
                            <Calendar className="h-5 w-5 text-[#007aff] shrink-0" />
                            <input
                              className="w-full border-none p-0 focus:ring-0 text-slate-800 bg-transparent text-sm font-semibold outline-none cursor-pointer"
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
                    className="bg-[#007aff] text-white h-[52px] rounded-xl text-sm font-bold shadow-[0_8px_24px_rgba(0,122,255,0.25)] hover:bg-[#0062cc] hover:shadow-[0_8px_28px_rgba(0,122,255,0.35)] hover:scale-[1.02] active:scale-95 transition-all w-full flex items-center justify-center cursor-pointer md:col-span-1"
                  >
                    Tìm Chuyến Tàu
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2"
          role="tablist"
          aria-label="Chọn ảnh banner"
        >
          {HERO_SLIDES.map((slide, index) => (
            <button
              key={slide.alt}
              type="button"
              onClick={() => setActiveHeroSlide(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === activeHeroSlide
                  ? "w-8 bg-[#007aff]"
                  : "w-2.5 bg-white/80 hover:bg-white"
              }`}
              aria-label={`Hiển thị ảnh ${slide.alt}`}
              aria-selected={index === activeHeroSlide}
              role="tab"
            />
          ))}
        </div>
      </section>

      {/* 3. Popular Routes ("Điểm Đến Phổ Biến") */}
      <section className="py-xl max-w-[1200px] mx-auto px-container-margin">
        <div className="flex justify-between items-end mb-lg text-left">
          <div>
            <span className="text-[12px] uppercase tracking-wider text-[#007aff] font-bold mb-1 block">
              Khám phá
            </span>
            <h2 className="font-headline-lg text-[28px] md:text-[32px] font-bold text-slate-800">
              Điểm đến phổ biến
            </h2>
          </div>
          <button
            onClick={() => handleRouteSelect("Hà Nội", "Sài Gòn")}
            className="text-primary font-bold flex items-center gap-xs hover:gap-sm transition-all"
          >
            Tất cả <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1 - Hà Nội (Large) */}
          <div
            className="group relative bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 cursor-pointer h-[300px] md:h-auto"
            onClick={() => handleRouteSelect("Hà Nội", "Sài Gòn")}
          >
            <img
              className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
              alt="Hà Nội"
              src="/assets/hero-bg.jpg"
            />
            <div className="absolute bottom-0 left-0 p-6 text-left">
              <h3 className="font-bold text-2xl text-white mb-1">Hà Nội</h3>
              <p className="text-white/80 font-medium text-sm">
                Giá vé chỉ từ{" "}
                <span className="font-bold text-white">450.000đ</span>
              </p>
            </div>
          </div>

          {/* Right Side Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* TP.HCM */}
            <div
              className="group relative bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 cursor-pointer h-[160px] md:h-[200px]"
              onClick={() => handleRouteSelect("Sài Gòn", "Hà Nội")}
            >
              <img
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                alt="TP HCM"
                src="/assets/hcmc.jpg"
              />
              <div className="absolute bottom-0 left-0 p-4 text-left">
                <h3 className="font-bold text-lg text-white mb-0.5">TP.HCM</h3>
                <p className="text-white/80 font-medium text-xs">
                  Chỉ từ <span className="font-bold text-[#007aff]">520k</span>
                </p>
              </div>
            </div>

            {/* Đà Nẵng */}
            <div
              className="group relative bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 cursor-pointer h-[160px] md:h-[200px]"
              onClick={() => handleRouteSelect("Đà Nẵng", "Huế")}
            >
              <img
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                alt="Đà Nẵng"
                src="/assets/danang.jpg"
              />
              <div className="absolute bottom-0 left-0 p-4 text-left">
                <h3 className="font-bold text-lg text-white mb-0.5">Đà Nẵng</h3>
                <p className="text-white/80 font-medium text-xs">
                  Chỉ từ <span className="font-bold text-[#007aff]">350k</span>
                </p>
              </div>
            </div>

            {/* Huế */}
            <div
              className="group relative bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-350 cursor-pointer col-span-2 h-[160px] md:h-[200px]"
              onClick={() => handleRouteSelect("Huế", "Đà Nẵng")}
            >
              <img
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                alt="Huế"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQ5Xajf7mAtz_KfO6j1nNYU6Gl2Ny9UHhksIUer32EoNV1qzgM2acR7OEP0_kY6Cc6PrObB4TX0XxzDiMlOdRMFu8JCnqcymHMAR23ph0FbYkpOUVAZtiQJlASOaO5FxY7XoJsHnOGMTZ12aI_ra4iVxJKlXfYbbCBK6iEoVggaPh5YjxE7dN_nK8F4L2-SsIHKYiSgOWhqhAZ4f-hA00jGPe3D0SqY3jvxGiQN-CWWjFzfRVKDopprohqOGCVMq78EiVhNDfqskkX"
              />
              <div className="absolute bottom-0 left-0 p-4 text-left">
                <h3 className="font-bold text-lg text-white mb-0.5">Huế</h3>
                <p className="text-white/80 font-medium text-xs">
                  Chỉ từ <span className="font-bold text-[#007aff]">280k</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Promotions Section */}
      <section className="bg-[#f7f9fb] py-xl">
        <div className="max-w-[1200px] mx-auto px-container-margin text-center">
          <h2 className="font-headline-lg text-[28px] md:text-[32px] font-bold text-slate-800 mb-lg">
            Ưu đãi hấp dẫn
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
      <section className="bg-white py-xl">
        <div className="max-w-[1200px] mx-auto px-container-margin">
          <div className="text-center mb-12">
            <h2 className="text-[28px] md:text-[32px] font-bold text-slate-800 mb-4">
              Tại sao chọn GoTrain?
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              Chúng tôi mang đến giải pháp đặt vé tàu hiện đại, nhanh chóng và
              an toàn nhất cho mọi hành trình của bạn.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="h-6 w-6 text-slate-700" />
              </div>
              <h3 className="font-bold text-lg mb-3">Thanh toán tức thì</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Xác nhận vé ngay lập tức sau khi thanh toán thành công qua nhiều
                phương thức linh hoạt.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <Headphones className="h-6 w-6 text-slate-700" />
              </div>
              <h3 className="font-bold text-lg mb-3">Hỗ trợ tận tâm</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Đội ngũ chăm sóc khách hàng 24/7 luôn sẵn sàng giải quyết mọi
                thắc mắc và sự cố của bạn.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-8 bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <Tag className="h-6 w-6 text-slate-700" />
              </div>
              <h3 className="font-bold text-lg mb-3">Giá tốt nhất</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Cam kết giá vé minh bạch, không phí ẩn và luôn có các chương
                trình ưu đãi độc quyền.
              </p>
            </div>
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

      {/* 6. Travel Blogs Section */}
      <section className="py-xl bg-[#f7f9fb] border-t border-slate-100">
        <div className="max-w-[1200px] mx-auto px-container-margin">
          <div className="text-center mb-12">
            <h2 className="text-[28px] md:text-[32px] font-bold text-slate-800">
              Cẩm Nang & Trải Nghiệm Hành Trình
            </h2>
            <p className="text-slate-500 text-sm mt-2 max-w-xl mx-auto">
              Những bài viết chia sẻ kinh nghiệm đi tàu hỏa, cẩm nang du lịch và
              câu chuyện hành trình từ cộng đồng khách hàng GoTrain VN.
            </p>
          </div>

          {loadingBlogs ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-[#00629d] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">Đang tải các bài viết...</p>
            </div>
          ) : blogs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {blogs.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedBlog(post)}
                  className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-md border border-slate-100 hover:border-primary/20 transition-all duration-300 text-left relative flex flex-col justify-between cursor-pointer group min-h-[260px]"
                >
                  <div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#cfe5ff]/40 text-[#00629d] mb-3">
                      Bài viết chia sẻ
                    </span>
                    <h3 className="font-bold text-slate-800 group-hover:text-primary transition-colors text-sm line-clamp-2 mb-2">
                      {post.title}
                    </h3>
                    <p className="text-slate-600 text-xs leading-relaxed mb-6 line-clamp-3">
                      {post.summary || post.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-auto border-t border-slate-100 pt-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                      {(post.author?.fullName || "HK")
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">
                        {post.author?.fullName || "Hành khách"}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {new Date(post.createdAt).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Mock Travel Blog 1 */}
              <div
                onClick={() =>
                  setSelectedBlog({
                    title: "Kinh nghiệm du lịch Sa Pa bằng tàu hỏa từ Hà Nội",
                    content:
                      "Sa Pa luôn là điểm đến hấp dẫn với sương mù huyền ảo và cảnh sắc núi rừng trùng điệp. Thay vì đi xe khách giường nằm, trải nghiệm di chuyển bằng tàu hỏa đến ga Lào Cai rồi bắt xe bus lên Sa Pa mang lại một góc nhìn hoàn toàn khác biệt.\n\nTàu hỏa chạy êm ái qua các tỉnh trung du, bạn có thể chọn khoang giường nằm điều hòa để nghỉ ngơi thoải mái qua đêm. Sáng sớm thức dậy tại ga Lào Cai, không khí trong lành mát mẻ sẽ chào đón bạn.\n\nMột số lưu ý khi đi tàu hỏa Hà Nội - Lào Cai:\n1. Nên đặt vé sớm vào các dịp cuối tuần để chọn được giường tầng 1 dễ di chuyển.\n2. Chuẩn bị sẵn một chiếc áo khoác mỏng vì điều hòa trên tàu khá lạnh về đêm.\n3. Đừng quên thử món phở nóng hổi ngay tại ga Lào Cai trước khi lên Sa Pa du hí nhé!",
                    createdAt: new Date(),
                    author: { fullName: "Trần Thu Thủy" },
                  })
                }
                className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-md border border-slate-100 hover:border-primary/20 transition-all duration-300 text-left relative flex flex-col justify-between cursor-pointer group min-h-[260px]"
              >
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 mb-3">
                    Cẩm nang du lịch
                  </span>
                  <h3 className="font-bold text-slate-800 group-hover:text-primary transition-colors text-sm line-clamp-2 mb-2">
                    Kinh nghiệm du lịch Sa Pa bằng tàu hỏa từ Hà Nội
                  </h3>
                  <p className="text-slate-600 text-xs leading-relaxed mb-6 line-clamp-3">
                    Sa Pa luôn là điểm đến hấp dẫn. Cùng khám phá hành trình di
                    chuyển bằng tàu hỏa leo núi đầy thú vị và những lưu ý để có
                    chuyến đi trọn vẹn nhất.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-auto border-t border-slate-100 pt-4">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center font-bold text-amber-700 text-sm shrink-0">
                    TT
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">
                      Trần Thu Thủy
                    </h4>
                    <p className="text-[10px] text-slate-400">18/07/2026</p>
                  </div>
                </div>
              </div>

              {/* Mock Travel Blog 2 */}
              <div
                onClick={() =>
                  setSelectedBlog({
                    title:
                      "Trải nghiệm tàu di sản Huế - Đà Nẵng qua đèo Hải Vân",
                    content:
                      "Cung đường sắt Hải Vân nối liền Thừa Thiên Huế và Đà Nẵng được vinh danh là một trong những tuyến đường sắt đẹp nhất hành tinh. Khi đoàn tàu uốn lượn quanh sườn núi, bạn sẽ được chiêm ngưỡng bức tranh thiên nhiên tuyệt mỹ: một bên là vách đá dựng đứng, một bên là vịnh Lăng Cô xanh ngắt với bãi cát vàng trải dài.\n\nHệ thống tàu di sản 'Kết nối di sản miền Trung' mới được đưa vào hoạt động có khoang nội thất sang trọng, cửa sổ kính rộng và có cả khoang sinh hoạt cộng đồng phục vụ ca Huế trực tiếp.\n\nKinh nghiệm săn ảnh đẹp trên tàu:\n- Hãy chọn ghế ngồi bên phía cửa sổ nhìn ra hướng biển (phía tay trái nếu đi từ Huế vào, và phía tay phải nếu đi từ Đà Nẵng ra).\n- Chuẩn bị máy ảnh/điện thoại ở chế độ quay chuyển động chậm (Slow-motion) để bắt trọn khoảnh khắc tàu đi qua các cung đèo uốn cong ấn tượng.",
                    createdAt: new Date(),
                    author: { fullName: "Nguyễn Văn Hải" },
                  })
                }
                className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-md border border-slate-100 hover:border-primary/20 transition-all duration-300 text-left relative flex flex-col justify-between cursor-pointer group min-h-[260px]"
              >
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 mb-3">
                    Khám phá di sản
                  </span>
                  <h3 className="font-bold text-slate-800 group-hover:text-primary transition-colors text-sm line-clamp-2 mb-2">
                    Trải nghiệm tàu Huế - Đà Nẵng qua đèo Hải Vân
                  </h3>
                  <p className="text-slate-600 text-xs leading-relaxed mb-6 line-clamp-3">
                    Tuyến đường sắt kết nối Huế và Đà Nẵng qua đèo Hải Vân được
                    mệnh danh là một trong những cung đường sắt đẹp nhất thế
                    giới. Cùng ngắm nhìn biển xanh.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-auto border-t border-slate-100 pt-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center font-bold text-emerald-700 text-sm shrink-0">
                    VH
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">
                      Nguyễn Văn Hải
                    </h4>
                    <p className="text-[10px] text-slate-400">17/07/2026</p>
                  </div>
                </div>
              </div>

              {/* Mock Travel Blog 3 */}
              <div
                onClick={() =>
                  setSelectedBlog({
                    title: "5 lưu ý khi chuẩn bị hành lý đi tàu hỏa đường dài",
                    content:
                      "Những chuyến đi tàu dài từ Bắc vào Nam kéo dài hơn 24 tiếng sẽ vô cùng thú vị nếu bạn chuẩn bị chu đáo. Dưới đây là 5 mẹo nhỏ bỏ túi giúp hành trình của bạn êm ái hơn nhiều:\n\n1. Chọn vali kéo cỡ vừa hoặc balo lớn để dễ dàng cất dưới gầm ghế hoặc trên giá để hành lý phía trên đầu.\n2. Chuẩn bị một túi nhỏ đựng đồ vệ sinh cá nhân, khăn giấy ướt, bàn chải đánh răng để tiện dùng ngay trong toa toilet của tàu.\n3. Mang theo sạc dự phòng dung lượng lớn và dây sạc dài. Mặc dù các toa tàu thế hệ mới có cổng sạc USB tại giường, sạc dự phòng vẫn giúp bạn chủ động hơn.\n4. Đồ ăn nhẹ như hạt, hoa quả sấy, sữa hộp và nước suối là vị cứu tinh tuyệt vời giữa đêm khuya khi căn tin tàu đã đóng cửa.\n5. Tải sẵn phim offline hoặc mang theo một cuốn sách yêu thích để giải trí khi tàu đi qua các khu vực sóng điện thoại yếu.",
                    createdAt: new Date(),
                    author: { fullName: "Phạm Minh Hoàng" },
                  })
                }
                className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-md border border-slate-100 hover:border-primary/20 transition-all duration-300 text-left relative flex flex-col justify-between cursor-pointer group min-h-[260px]"
              >
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 mb-3">
                    Mẹo đi tàu
                  </span>
                  <h3 className="font-bold text-slate-800 group-hover:text-primary transition-colors text-sm line-clamp-2 mb-2">
                    5 lưu ý khi chuẩn bị hành lý đi tàu hỏa đường dài
                  </h3>
                  <p className="text-slate-600 text-xs leading-relaxed mb-6 line-clamp-3">
                    Để chuyến đi tàu dài ngày thoải mái nhất, việc chuẩn bị hành
                    lý gọn nhẹ, các vật dụng cá nhân cần thiết và đồ ăn nhẹ là
                    vô cùng quan trọng.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-auto border-t border-slate-100 pt-4">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center font-bold text-purple-700 text-sm shrink-0">
                    MH
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">
                      Phạm Minh Hoàng
                    </h4>
                    <p className="text-[10px] text-slate-400">15/07/2026</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal đọc chi tiết blog trên trang chủ */}
      {selectedBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#cfe5ff]/40 text-[#00629d]">
                  Cẩm nang & Chia sẻ
                </span>
                <h3 className="font-extrabold text-[#191c1e] text-lg leading-snug mt-1 text-left">
                  {selectedBlog.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-[#6f7883] mt-1 font-medium font-sans">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary/20 flex items-center justify-center" />
                    {selectedBlog.author?.fullName || "Hành khách"}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(selectedBlog.createdAt).toLocaleString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBlog(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-[#6f7883] shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-slate-700 text-left leading-relaxed text-sm whitespace-pre-wrap max-h-[50vh] font-sans">
              {selectedBlog.content}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedBlog(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2 rounded-xl font-bold text-xs transition-all"
              >
                Đóng bài viết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Footer */}
      <footer className="w-full bg-[#f7f9fb] py-16 text-left border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 px-container-margin max-w-[1200px] mx-auto">
          <div className="flex flex-col gap-4 col-span-2">
            <div className="flex items-center gap-2 text-[#007aff] font-bold text-xl">
              <Train className="h-6 w-6" />
              GoTrain VN
            </div>
            <p className="text-slate-500 text-sm max-w-sm mt-2">
              © 2024 GoTrain VN. Hành trình bình yên, kết nối mọi miền.
              <br />
              Ứng dụng đặt vé tàu hỏa hàng đầu Việt Nam.
            </p>
            <div className="flex gap-4 mt-2">
              <button className="text-slate-400 hover:text-slate-700 transition-colors">
                <span className="font-bold text-xs">FB</span>
              </button>
              <button className="text-slate-400 hover:text-slate-700 transition-colors">
                <span className="font-bold text-xs">YT</span>
              </button>
              <button className="text-slate-400 hover:text-slate-700 transition-colors">
                <span className="font-bold text-xs">IN</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">
              Khám phá
            </h4>
            <Link
              className="text-slate-500 hover:text-[#007aff] transition-colors text-sm underline decoration-slate-300 underline-offset-4"
              to="/privacy"
            >
              Chính sách bảo mật
            </Link>
            <Link
              className="text-slate-500 hover:text-[#007aff] transition-colors text-sm underline decoration-slate-300 underline-offset-4"
              to="/terms"
            >
              Điều khoản sử dụng
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">
              Hỗ trợ
            </h4>
            <a
              className="text-slate-500 hover:text-[#007aff] transition-colors text-sm underline decoration-slate-300 underline-offset-4"
              href="#"
            >
              Thông tin liên hệ
            </a>
            <a
              className="text-slate-500 hover:text-[#007aff] transition-colors text-sm underline decoration-slate-300 underline-offset-4"
              href="#"
            >
              Hướng dẫn đặt vé
            </a>
          </div>
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
