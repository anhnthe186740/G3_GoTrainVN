import { useState } from "react";
import {
  ShieldCheck,
  Users,
  Ticket,
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
  Baby,
  GraduationCap,
  HeartHandshake,
  CheckCircle2,
  AlertTriangle,
  IdCard,
} from "lucide-react";

export function BookingConstraintsCard({ defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState("pricing"); // "pricing" | "quantity" | "documents"

  return (
    <div className="overflow-hidden rounded-[26px] border border-cyan-200/80 bg-gradient-to-br from-white via-cyan-50/30 to-[#f4fbfd] shadow-[0_10px_30px_rgba(7,59,76,0.06)] transition-all duration-300">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3.5 sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#073b4c] text-cyan-300 shadow-md">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-md text-base font-bold text-[#073b4c] sm:text-lg">
                Quy Định Đặt Vé & Chính Sách Ưu Đãi
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-extrabold text-[#087a91]">
                <Info className="h-3 w-3" /> Cần biết
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Vui lòng xem kỹ thông tin độ tuổi, mức giảm giá và quy định giấy
              tờ trước khi xác nhận đơn.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-cyan-300/60 bg-white px-4 py-2 text-xs font-bold text-[#087a91] shadow-sm transition hover:bg-cyan-50 hover:text-[#073b4c]"
        >
          {isExpanded ? (
            <>
              <span>Thu gọn quy định</span>
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              <span>Xem chi tiết quy định</span>
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* Quick Summary Badges (Always visible) */}
      <div className="grid grid-cols-2 gap-2 border-t border-cyan-100 bg-white/70 px-5 py-3 sm:grid-cols-4 sm:px-6">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <Clock className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Giữ ghế: <strong>10 phút</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <Users className="h-4 w-4 shrink-0 text-[#087a91]" />
          <span>
            Tối đa: <strong>4 ghế/đơn</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <Baby className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Trẻ &lt;6t (không ghế): <strong>Miễn phí</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <Ticket className="h-4 w-4 shrink-0 text-purple-600" />
          <span>
            Giảm giá: <strong>10% - 25%</strong>
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-cyan-100/80 bg-white p-5 sm:p-6">
          {/* Tab Navigation */}
          <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("pricing")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === "pricing"
                  ? "bg-[#073b4c] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Ticket className="h-4 w-4" />
              1. Vé & Chính Sách Ưu Đãi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("quantity")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === "quantity"
                  ? "bg-[#073b4c] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Users className="h-4 w-4" />
              2. Quy Định Số Lượng & Đi Kèm
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("documents")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === "documents"
                  ? "bg-[#073b4c] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <IdCard className="h-4 w-4" />
              3. Giấy Tờ & Giữ Ghế
            </button>
          </div>

          {/* Tab 1: Pricing & Discounts */}
          {activeTab === "pricing" && (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Adult */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
                      <Users className="h-4 w-4" />
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Người lớn
                    </h3>
                  </div>
                  <span className="rounded-lg bg-slate-200 px-2 py-0.5 text-xs font-extrabold text-slate-800">
                    100% giá vé
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-600 leading-relaxed">
                  Độ tuổi từ <strong>10 đến 59 tuổi</strong>. Áp dụng giá vé
                  tiêu chuẩn. Bắt buộc nhập đầy đủ họ tên, CCCD/Hộ chiếu, SĐT và
                  Email.
                </p>
              </div>

              {/* Child under 6 */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 transition hover:border-emerald-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Baby className="h-4 w-4" />
                    </span>
                    <h3 className="font-bold text-emerald-950 text-sm">
                      Trẻ em dưới 6 tuổi
                    </h3>
                  </div>
                  <span className="rounded-lg bg-emerald-600 px-2 py-0.5 text-xs font-extrabold text-white">
                    MIỄN PHÍ / Giảm 25%
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-emerald-900">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                    <span>
                      <strong>Không ghế (đi kèm):</strong> Miễn phí 100%, ngồi
                      chung ghế với người lớn.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                    <span>
                      <strong>Có ghế riêng:</strong> Tính theo vé Trẻ em (giảm
                      25% giá vé).
                    </span>
                  </li>
                </ul>
              </div>

              {/* Child 6-9 */}
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 transition hover:border-cyan-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-100 text-[#087a91]">
                      <Baby className="h-4 w-4" />
                    </span>
                    <h3 className="font-bold text-[#073b4c] text-sm">
                      Trẻ em (6 – 9 tuổi)
                    </h3>
                  </div>
                  <span className="rounded-lg bg-[#087a91] px-2 py-0.5 text-xs font-extrabold text-white">
                    Giảm 25%
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-700 leading-relaxed">
                  Độ tuổi từ <strong>6 đến dưới 10 tuổi</strong>. Bắt buộc có
                  ghế riêng, không cần số CCCD. Được tự động giảm 25% giá vé
                  theo ngày sinh.
                </p>
              </div>

              {/* Student */}
              <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 transition hover:border-purple-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                      <GraduationCap className="h-4 w-4" />
                    </span>
                    <h3 className="font-bold text-purple-950 text-sm">
                      Sinh viên
                    </h3>
                  </div>
                  <span className="rounded-lg bg-purple-600 px-2 py-0.5 text-xs font-extrabold text-white">
                    Giảm 10%
                  </span>
                </div>
                <p className="mt-2 text-xs text-purple-900 leading-relaxed">
                  Áp dụng cho học sinh, sinh viên các trường ĐH, CĐ, TCCN. Bắt
                  buộc nhập CCCD và xuất trình{" "}
                  <strong>Thẻ sinh viên hợp lệ</strong> khi lên tàu.
                </p>
              </div>

              {/* Senior */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 transition hover:border-amber-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <HeartHandshake className="h-4 w-4" />
                    </span>
                    <h3 className="font-bold text-amber-950 text-sm">
                      Người cao tuổi
                    </h3>
                  </div>
                  <span className="rounded-lg bg-amber-600 px-2 py-0.5 text-xs font-extrabold text-white">
                    Giảm 15%
                  </span>
                </div>
                <p className="mt-2 text-xs text-amber-900 leading-relaxed">
                  Từ <strong>60 tuổi trở lên</strong> (tính theo ngày sinh). Tự
                  động giảm 15% giá vé khi chọn ngày sinh hợp lệ. Bắt buộc nhập
                  CCCD/Hộ chiếu.
                </p>
              </div>

              {/* Account holder note */}
              <div className="flex flex-col justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Tự động giảm giá theo tuổi</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Hệ thống tự động kiểm tra ngày sinh và áp dụng ưu đãi chính
                  xác nhất cho hành khách.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Quantity & Companion Rules */}
          {activeTab === "quantity" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">
                      Giới hạn số ghế mỗi giao dịch
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Mỗi đơn hàng chỉ được đặt tối đa{" "}
                      <strong>4 hành khách có ghế riêng</strong>. Mỗi đơn được
                      chọn tổng tối đa 8 hành khách (bao gồm cả trẻ đi kèm không
                      ghế).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <Users className="h-5 w-5 shrink-0 text-[#087a91] mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">
                      Quy định người đi cùng trẻ em
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Trẻ em <strong>dưới 10 tuổi</strong> bắt buộc phải đi cùng
                      ít nhất 1 người lớn, sinh viên hoặc người cao tuổi có ghế
                      riêng trong cùng đơn.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <Baby className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">
                      Quy định Trẻ em dưới 6 tuổi đi kèm (Lap Child)
                    </h4>
                    <ul className="mt-1 list-disc pl-4 space-y-1 text-xs text-slate-600">
                      <li>
                        Chỉ áp dụng cho trẻ em <strong>dưới 6 tuổi</strong>{" "}
                        (tính đến ngày khởi hành).
                      </li>
                      <li>
                        Mỗi ghế của người lớn chỉ được đi kèm{" "}
                        <strong>tối đa 1 trẻ dưới 6 tuổi</strong> ngồi chung.
                      </li>
                      <li>
                        Trẻ đi kèm không cần ghế riêng được miễn phí 100% và
                        không cần điền số CCCD/Hộ chiếu.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: ID Documents & Session */}
          {activeTab === "documents" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <IdCard className="h-4 w-4 text-[#087a91]" />
                    <span>Quy định giấy tờ tùy thân</span>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                    <li className="flex items-start gap-1.5">
                      <span className="text-slate-400">•</span>
                      <span>
                        <strong>CCCD:</strong> Phải đủ đúng 12 chữ số.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-slate-400">•</span>
                      <span>
                        <strong>Hộ chiếu (HCDC):</strong> Từ 6 đến 12 ký tự chữ
                        và số.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-slate-400">•</span>
                      <span>
                        <strong>Không trùng lặp:</strong> Mỗi số giấy tờ chỉ
                        dùng cho 1 hành khách trong đơn.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span>Thời hạn giữ ghế & Thanh toán</span>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                    <li className="flex items-start gap-1.5">
                      <span className="text-slate-400">•</span>
                      <span>
                        <strong>Thời gian giữ ghế:</strong> Ghế được tạm giữ{" "}
                        <strong>10 phút</strong> kể từ khi chọn.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-slate-400">•</span>
                      <span>
                        <strong>Thanh toán:</strong> Quét QR PayOS (ngân hàng)
                        hoặc trừ Ví GoTrain.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-slate-400">•</span>
                      <span>
                        Vé điện tử sẽ được phát hành ngay sau khi hệ thống ghi
                        nhận thanh toán.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
