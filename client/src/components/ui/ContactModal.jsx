import { useState, useEffect } from "react";
import { Mail, Phone, X, Send, User, MessageSquare } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { api } from "../../services/api";
import { toast } from "sonner";
import { useLanguage } from "../../context/LanguageContext";

export function ContactModal({ isOpen, onClose }) {
  const { user } = useAuthStore();
  const { t, language } = useLanguage();
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
      toast.error(
        language === "vi"
          ? "Vui lòng điền đầy đủ thông tin bắt buộc."
          : "Please fill in all required fields.",
      );
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
          language === "vi"
            ? "Gửi yêu cầu hỗ trợ thành công! Vui lòng kiểm tra hộp thư email của bạn."
            : "Support request sent successfully! Please check your email inbox.",
        );
        onClose();
      } else {
        toast.error(
          data.message ||
            (language === "vi"
              ? "Gửi yêu cầu thất bại."
              : "Submission failed."),
        );
      }
    } catch (err) {
      console.error("Error submitting contact form:", err);
      toast.error(
        err.response?.data?.message ||
          (language === "vi"
            ? "Không thể gửi tin nhắn. Vui lòng thử lại sau."
            : "Could not send message. Please try again later."),
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
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-all border-none cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="space-y-1 text-left">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 border border-white/20 text-[#b3d4f0] uppercase tracking-wider">
              <Mail className="w-3 h-3" />
              {language === "vi" ? "Hỗ trợ trực tuyến" : "Online Support"}
            </span>
            <h3 className="text-xl font-extrabold tracking-tight">
              {t("contact_header")}
            </h3>
            <p className="text-xs text-[#b3d4f0]/90">{t("contact_sub")}</p>
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
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 text-left justify-start">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {t("contact_name")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={loading}
                placeholder={
                  language === "vi" ? "Nguyễn Văn A" : "E.g. John Doe"
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {/* Email input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 text-left justify-start">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {t("contact_email")} <span className="text-red-500">*</span>
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
          <div className="space-y-1 text-left">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1 text-left justify-start">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              {t("contact_subject")}
            </label>
            <input
              type="text"
              disabled={loading}
              placeholder={t("contact_subject_placeholder")}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>

          {/* Message textarea */}
          <div className="space-y-1 text-left">
            <label className="text-xs font-bold text-slate-700 text-left justify-start block">
              {t("contact_message")} <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              disabled={loading}
              placeholder={t("contact_message_placeholder")}
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
                  {t("contact_hotline_box")}
                </p>
                <p className="text-[10px] text-slate-500">
                  {t("contact_hotline_sub")}
                </p>
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
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer bg-white"
            >
              {t("contact_cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-[#00629d] hover:bg-[#00527f] text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer border-none"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {loading ? t("contact_sending") : t("contact_submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
