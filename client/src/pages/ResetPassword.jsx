import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, Train, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useLanguage } from "../context/LanguageContext";

export function ResetPassword() {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const newPassword = watch("password");

  const onSubmit = async (data) => {
    if (!token) {
      toast.error(
        language === "vi"
          ? "Mã khôi phục mật khẩu không tìm thấy trong đường dẫn!"
          : "Password reset token not found in URL!",
      );
      return;
    }

    setLoading(true);
    const toastId = toast.loading(
      language === "vi"
        ? "Đang cập nhật mật khẩu mới..."
        : "Updating your new password...",
    );
    try {
      await api.post("/auth/reset-password", {
        token,
        password: data.password,
      });
      toast.success(
        language === "vi"
          ? "Đặt lại mật khẩu thành công!"
          : "Password reset successfully!",
        { id: toastId },
      );
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        (language === "vi"
          ? "Cập nhật mật khẩu thất bại. Mã khôi phục có thể đã hết hạn hoặc không hợp lệ!"
          : "Failed to update password. Reset token may have expired or is invalid!");
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
            {language === "vi" ? "Tạo mật khẩu mới" : "Create New Password"}
          </h1>
          <p className="text-lg text-slate-300">
            {language === "vi"
              ? "Đặt mật khẩu mới mạnh hơn để đảm bảo tính an toàn và bảo mật cao nhất cho tài khoản của bạn."
              : "Set a stronger new password to ensure maximum security for your account."}
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
              {language === "vi" ? "Đặt lại mật khẩu" : "Reset Password"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {language === "vi"
                ? "Nhập mật khẩu mới cho tài khoản của bạn."
                : "Enter a new password for your account."}
            </p>
          </div>

          {!token ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-4">
              <span className="material-symbols-outlined text-red-600 text-[32px] block">
                warning
              </span>
              <h3 className="text-lg font-bold text-red-900">
                {language === "vi" ? "Đường dẫn không hợp lệ" : "Invalid link"}
              </h3>
              <p className="text-sm text-red-700">
                {language === "vi"
                  ? "Đường dẫn khôi phục mật khẩu thiếu mã Token hợp lệ. Vui lòng kiểm tra lại email hoặc thực hiện gửi lại yêu cầu."
                  : "Password reset link lacks a valid token. Please check your email or resubmit a request."}
              </p>
              <Link
                to="/forgot-password"
                className="inline-block px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition text-decoration-none"
              >
                {language === "vi"
                  ? "Gửi lại yêu cầu khôi phục"
                  : "Resubmit reset request"}
              </Link>
            </div>
          ) : !success ? (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  {language === "vi" ? "Mật khẩu mới" : "New Password"}
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    disabled={loading}
                    {...register("password", {
                      required:
                        language === "vi"
                          ? "Mật khẩu là bắt buộc"
                          : "Password is required",
                      minLength: {
                        value: 8,
                        message:
                          language === "vi"
                            ? "Mật khẩu phải dài tối thiểu 8 ký tự"
                            : "Password must be at least 8 characters long",
                      },
                    })}
                    placeholder="••••••••"
                    className={`block w-full rounded-xl border ${
                      errors.password
                        ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                        : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                    } bg-white py-3 pl-10 pr-10 text-slate-900 outline-none transition focus:ring-4`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition border-none bg-transparent cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs font-medium text-red-600 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  {language === "vi"
                    ? "Xác nhận mật khẩu mới"
                    : "Confirm New Password"}
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    disabled={loading}
                    {...register("confirmPassword", {
                      required:
                        language === "vi"
                          ? "Xác nhận mật khẩu là bắt buộc"
                          : "Confirm password is required",
                      validate: (val) => {
                        if (val !== newPassword) {
                          return language === "vi"
                            ? "Mật khẩu nhập lại không trùng khớp"
                            : "Passwords do not match";
                        }
                      },
                    })}
                    placeholder="••••••••"
                    className={`block w-full rounded-xl border ${
                      errors.confirmPassword
                        ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                        : "border-slate-300 focus:border-slate-900 focus:ring-slate-200"
                    } bg-white py-3 pl-10 pr-10 text-slate-900 outline-none transition focus:ring-4`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition border-none bg-transparent cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs font-medium text-red-600 mt-1">
                    {errors.confirmPassword.message}
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
                    {language === "vi" ? "Đang thiết lập..." : "Setting up..."}
                  </>
                ) : language === "vi" ? (
                  "Cập nhật mật khẩu"
                ) : (
                  "Update Password"
                )}
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-emerald-50 p-6 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-emerald-900">
                {language === "vi" ? "Thành công!" : "Success!"}
              </h3>
              <p className="text-sm text-emerald-700 leading-relaxed">
                {language === "vi"
                  ? "Mật khẩu của bạn đã được cập nhật thành công. Hệ thống đang chuyển hướng bạn về trang đăng nhập..."
                  : "Your password has been successfully updated. Redirecting you to login page..."}
              </p>
            </div>
          )}

          <div className="text-center">
            <Link
              to="/login"
              className="text-sm font-semibold text-blue-600 hover:text-blue-500 transition text-decoration-none"
            >
              {language === "vi" ? "Quay lại đăng nhập" : "Back to login"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
