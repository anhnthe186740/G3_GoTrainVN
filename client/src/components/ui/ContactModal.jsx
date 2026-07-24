import { useState, useEffect } from "react";
import { Mail, Phone, X, Send, User, MessageSquare } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { api } from "../../services/api";
import { toast } from "sonner";

export function ContactModal({ isOpen, onClose }) {
  const { user } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill data if user is logged in
  useEffect(() => {
    if (isOpen) {
      if (user) {
        setName(user.name || user.fullName || "");
        setEmail(user.email || "");
      } else {
        setName("");
        setEmail("");
      }
      setSubject("");
      setMessage("");
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/users/contact", {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });

      if (data.success) {
        toast.success(
          "Gửi yêu cầu hỗ trợ thành công! Vui lòng kiểm tra hộp thư email của bạn.",
        );
        onClose();
      } else {
        toast.error(data.message || "Gửi yêu cầu thất bại.");
      }
    } catch (err) {
      console.error("Error submitting contact form:", err);
      toast.error(
        err.response?.data?.message ||
          "Không thể gửi tin nhắn. Vui lòng thử lại sau.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#004c7a] to-[#00629d] px-6 py-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-all"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="space-y-1 text-left">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 border border-white/20 text-[#b3d4f0] uppercase tracking-wider">
              <Mail className="w-3 h-3" />
              Hỗ trợ trực tuyến
            </span>
            <h3 className="text-xl font-extrabold tracking-tight">
              Liên Hệ GoTrain VN
            </h3>
            <p className="text-xs text-[#b3d4f0]/90">
              Gửi tin nhắn cho chúng tôi. Đội ngũ chăm sóc khách hàng sẽ phản
              hồi qua email của bạn sớm nhất.
            </p>
          </div>
        </div>

        {/* Content Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 text-left font-sans"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Họ và Tên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={loading}
                placeholder="Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {/* Email input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Email nhận phản hồi <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                disabled={loading}
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </div>

          {/* Subject input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              Chủ đề yêu cầu
            </label>
            <input
              type="text"
              disabled={loading}
              placeholder="Ví dụ: Hỏi về chính sách đổi vé tàu chạy trễ..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>

          {/* Message textarea */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Nội dung chi tiết <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              disabled={loading}
              placeholder="Nhập câu hỏi hoặc nội dung bạn cần hỗ trợ..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
            />
          </div>

          {/* Hotline Box */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl gap-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-[#cfe5ff]/40 rounded-xl">
                <Phone className="w-4 h-4 text-[#00629d]" />
              </span>
              <div>
                <p className="text-xs font-extrabold text-slate-800">
                  Hotline hỗ trợ nhanh
                </p>
                <p className="text-[10px] text-slate-500">Gọi trực tiếp 24/7</p>
              </div>
            </div>
            <a
              href="tel:0975230204"
              className="bg-[#00629d] hover:bg-[#00527f] text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all shadow-sm shrink-0"
            >
              0975 230 204
            </a>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-xs transition-all"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-[#00629d] hover:bg-[#00527f] text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Gửi yêu cầu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
