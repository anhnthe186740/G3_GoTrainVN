import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2, Train, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

export function ResetPassword() {
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
      toast.error("Mã khôi phục mật khẩu không tìm thấy trong đường dẫn!");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Đang cập nhật mật khẩu mới...");
    try {
      await api.post("/auth/reset-password", {
        token,
        password: data.password,
      });
      toast.success("Đặt lại mật khẩu thành công!", { id: toastId });
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        "Cập nhật mật khẩu thất bại. Mã khôi phục có thể đã hết hạn hoặc không hợp lệ!";
      toast.error(errorMsg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
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
            Tạo mật khẩu mới
          </h1>
          <p className="text-lg text-slate-300">
            Đặt mật khẩu mới mạnh hơn để đảm bảo tính an toàn và bảo mật cao
            nhất cho tài khoản của bạn.
          </p>
        </div>

        <div className="relative z-10 text-sm text-slate-400">
          © {new Date().getFullYear()} GoTrain VN. Thiết kế giao diện Modern UI
          Redesign.
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
              Đặt lại mật khẩu
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Nhập mật khẩu mới cho tài khoản của bạn.
            </p>
          </div>

          {!token ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-4">
              <span className="material-symbols-outlined text-red-600 text-[32px]">
                warning
              </span>
              <h3 className="text-lg font-bold text-red-900">
                Đường dẫn không hợp lệ
              </h3>
              <p className="text-sm text-red-700">
                Đường dẫn khôi phục mật khẩu thiếu mã Token hợp lệ. Vui lòng
                kiểm tra lại email hoặc thực hiện gửi lại yêu cầu.
              </p>
              <Link
                to="/forgot-password"
                className="inline-block px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition"
              >
                Gửi lại yêu cầu khôi phục
              </Link>
            </div>
          ) : !success ? (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Mật khẩu mới
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    disabled={loading}
                    {...register("password", {
                      required: "Mật khẩu là bắt buộc",
                      minLength: {
                        value: 8,
                        message: "Mật khẩu phải dài tối thiểu 8 ký tự",
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
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs font-medium text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    disabled={loading}
                    {...register("confirmPassword", {
                      required: "Xác nhận mật khẩu là bắt buộc",
                      validate: (val) => {
                        if (val !== newPassword) {
                          return "Mật khẩu nhập lại không trùng khớp";
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
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs font-medium text-red-600">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 py-3.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-75 shadow-md shadow-slate-900/10 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang thiết lập...
                  </>
                ) : (
                  "Cập nhật mật khẩu"
                )}
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-emerald-50 p-6 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-emerald-900">
                Thành công!
              </h3>
              <p className="text-sm text-emerald-700 leading-relaxed">
                Mật khẩu của bạn đã được cập nhật thành công. Hệ thống đang
                chuyển hướng bạn về trang đăng nhập...
              </p>
            </div>
          )}

          <div className="text-center">
            <Link
              to="/login"
              className="text-sm font-semibold text-blue-600 hover:text-blue-500 transition"
            >
              Quay lại đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
