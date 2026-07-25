import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2, Train } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useLanguage } from "../context/LanguageContext";

export function ForgotPassword() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    const toastId = toast.loading(
      language === "vi"
        ? "Đang gửi yêu cầu khôi phục mật khẩu..."
        : "Sending password reset request...",
    );
    try {
      await api.post("/auth/forgot-password", data);
      toast.success(
        language === "vi"
          ? "Đã gửi email khôi phục thành công!"
          : "Reset email sent successfully!",
        { id: toastId },
      );
      setSubmitted(true);
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        (language === "vi"
          ? "Gửi yêu cầu thất bại. Vui lòng kiểm tra lại địa chỉ email!"
          : "Request failed. Please check your email address!");
      toast.error(errorMsg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-left">
      {/* Decorative Brand presentation banner on desktop */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-emerald-950 opacity-90" />
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-500/30">
            <Train className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-wider">GoTrain VN</span>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {language === "vi" ? "Quên mật khẩu?" : "Forgot Password?"}
          </h1>
          <p className="text-lg text-slate-300">
            {language === "vi"
              ? "Đừng lo lắng, chúng tôi sẽ giúp bạn khôi phục lại mật khẩu tài khoản một cách nhanh chóng và an toàn."
              : "Don't worry, we'll help you recover your account password quickly and securely."}
          </p>
        </div>

        <div className="relative z-10 text-sm text-slate-400">
          © {new Date().getFullYear()} GoTrain VN.{" "}
          {language === "vi"
            ? "Thiết kế giao diện Modern UI Redesign."
            : "Modern UI Redesign interface."}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-8 bg-slate-50">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="flex flex-col items-center lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/30">
              <Train className="h-7 w-7 text-white" />
            </div>
            <h2 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
              GoTrain VN
            </h2>
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              {language === "vi" ? "Khôi phục mật khẩu" : "Reset Password"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {language === "vi"
                ? "Nhập email đăng ký của bạn bên dưới để nhận hướng dẫn đặt lại mật khẩu."
                : "Enter your registered email below to receive password reset instructions."}
            </p>
          </div>

          {!submitted ? (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  {language === "vi" ? "Địa chỉ Email" : "Email Address"}
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    disabled={loading}
                    {...register("email", {
                      required:
                        language === "vi"
                          ? "Email là bắt buộc"
                          : "Email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message:
                          language === "vi"
                            ? "Địa chỉ email không hợp lệ"
                            : "Invalid email address",
                      },
                    })}
                    placeholder="name@example.com"
                    className={`block w-full rounded-xl border ${
                      errors.email
                        ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                        : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                    } bg-white py-3 pl-10 pr-4 text-slate-900 outline-none transition focus:ring-4`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs font-medium text-red-600 mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 py-3.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-75 shadow-md shadow-slate-900/10 cursor-pointer border-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {language === "vi"
                      ? "Đang gửi yêu cầu..."
                      : "Sending request..."}
                  </>
                ) : language === "vi" ? (
                  "Gửi link khôi phục"
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-emerald-50 p-6 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <span className="material-symbols-outlined text-emerald-600 text-[28px] block">
                  mark_email_read
                </span>
              </div>
              <h3 className="text-lg font-bold text-emerald-900">
                {language === "vi"
                  ? "Kiểm tra hộp thư của bạn"
                  : "Check your inbox"}
              </h3>
              <p className="text-sm text-emerald-700 leading-relaxed">
                {language === "vi"
                  ? "Chúng tôi đã gửi link đặt lại mật khẩu đến hộp thư của bạn. Vui lòng mở email và làm theo hướng dẫn để khôi phục mật khẩu."
                  : "We have sent a password reset link to your email. Please open the email and follow instructions to recover your password."}
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-900 underline bg-transparent border-none cursor-pointer"
              >
                {language === "vi"
                  ? "Không nhận được email? Gửi lại"
                  : "Didn't receive email? Resend"}
              </button>
            </div>
          )}

          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-500 transition text-decoration-none"
            >
              <ArrowLeft className="h-4 w-4" />
              {language === "vi" ? "Quay lại đăng nhập" : "Back to login"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
