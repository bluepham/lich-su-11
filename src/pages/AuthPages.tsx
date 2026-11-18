import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/authSession';

export function StudentRegisterPage() {
  const { classes, activateStudentSession, refreshAuth, refreshBootstrap } = useApp();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('11A1');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/student/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          className,
          username,
          password,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Đăng ký không thành công.');
        setSubmitting(false);
        return;
      }
      if (data.student) {
        activateStudentSession(data.student, data.sessionToken);
      }
      await Promise.all([refreshAuth(), refreshBootstrap()]);
      navigate('/dashboard');
    } catch {
      setError('Không thể kết nối máy chủ. Vui lòng thử lại.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="space-y-1.5 text-center">
          <div className="w-11 h-11 rounded-xl bg-[#0B132B] text-[#E6BE68] flex items-center justify-center mx-auto mb-2">
            <UserPlus className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#141B2D]">Đăng ký Tài khoản Học sinh</h1>
          <p className="text-xs text-stone-500">
            Dành cho học sinh khối 11 · Không yêu cầu email, số điện thoại hay mã OTP
          </p>
        </div>

        {error && (
          <div
            role="alert"
            data-testid="register-error"
            className="p-3 rounded-lg bg-[#8B1E24]/10 border border-[#8B1E24]/30 text-xs font-medium text-[#8B1E24]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-fullname" className="block text-xs font-semibold text-stone-700 mb-1">
              1. Họ và tên học sinh
            </label>
            <input
              id="reg-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Minh Khôi"
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0B132B]"
            />
          </div>

          <div>
            <label htmlFor="reg-class" className="block text-xs font-semibold text-stone-700 mb-1">
              2. Lớp
            </label>
            <input
              id="reg-class"
              type="text"
              list="school-classes-list"
              required
              value={className}
              onChange={(e) => setClassName(e.target.value.toUpperCase())}
              placeholder="Ví dụ: 11A1"
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm uppercase focus:outline-none focus:border-[#0B132B]"
            />
            <datalist id="school-classes-list">
              {(classes.length > 0
                ? classes.map((c) => c.class_name)
                : ['11A1', '11A2', '11A3', '11A4', '11A5']
              ).map((cls) => (
                <option key={cls} value={cls} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="reg-username" className="block text-xs font-semibold text-stone-700 mb-1">
              3. Tên đăng nhập (viết liền, không dấu)
            </label>
            <input
              id="reg-username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ví dụ: minhkhoi11a1"
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0B132B]"
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-xs font-semibold text-stone-700 mb-1">
              4. Mật khẩu (tối thiểu 6 ký tự)
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu bảo mật"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0B132B]"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-800"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reg-confirm" className="block text-xs font-semibold text-stone-700 mb-1">
              5. Nhập lại mật khẩu
            </label>
            <input
              id="reg-confirm"
              type={showPass ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại đúng mật khẩu vừa tạo"
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0B132B]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            data-testid="register-submit-btn"
            className="w-full py-3 rounded-lg bg-[#0B132B] text-[#FAF7F0] text-sm font-bold hover:bg-[#162447] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Đang khởi tạo hồ sơ...' : 'HOÀN TẤT ĐĂNG KÝ'}
          </button>
        </form>

        <p className="text-center text-xs text-stone-600">
          Đã có tài khoản học sinh?{' '}
          <Link to="/dang-nhap" className="font-semibold text-[#8B1E24] hover:underline">
            Đăng nhập tại đây
          </Link>
        </p>
      </div>
    </div>
  );
}

export function StudentLoginPage() {
  const { activateStudentSession, refreshAuth } = useApp();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Đăng nhập không thành công.');
        setSubmitting(false);
        return;
      }
      if (data.student) {
        activateStudentSession(data.student, data.sessionToken);
      }
      await refreshAuth();
      navigate('/dashboard');
    } catch {
      setError('Không thể kết nối máy chủ.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="space-y-1.5 text-center">
          <div className="w-11 h-11 rounded-xl bg-[#0B132B] text-[#E6BE68] flex items-center justify-center mx-auto mb-2">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#141B2D]">Đăng nhập Học sinh</h1>
          <p className="text-xs text-stone-500">
            Lưu tiến độ 13 bài học, khám phá 3D, thi trực tuyến và nhận huy hiệu lịch sử
          </p>
        </div>

        {error && (
          <div
            role="alert"
            data-testid="student-login-error"
            className="p-3 rounded-lg bg-[#8B1E24]/10 border border-[#8B1E24]/30 text-xs font-medium text-[#8B1E24]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-username" className="block text-xs font-semibold text-stone-700 mb-1">
              Tên đăng nhập
            </label>
            <input
              id="login-username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập của em"
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0B132B]"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-stone-700 mb-1">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0B132B]"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-800"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            data-testid="student-login-submit"
            className="w-full py-3 rounded-lg bg-[#0B132B] text-[#FAF7F0] text-sm font-bold hover:bg-[#162447] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Đang xác thực...' : 'ĐĂNG NHẬP HỌC TẬP'}
          </button>
        </form>

        <div className="pt-3 border-t border-stone-200 space-y-2 text-center text-xs text-stone-600">
          <p>
            Chưa có tài khoản?{' '}
            <Link to="/dang-ky" className="font-semibold text-[#8B1E24] hover:underline">
              Tự đăng ký tài khoản mới
            </Link>
          </p>
          <p className="text-[11px] text-stone-500">
            Quên mật khẩu? Em hãy báo Giáo viên bộ môn để được cấp lại mật khẩu tạm thời trên trang Quản trị.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminLoginPage() {
  const { role, activateAdminSession } = useApp();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Mật khẩu quản trị không chính xác.');
        setSubmitting(false);
        return;
      }
      activateAdminSession(data.sessionToken, Boolean(data.mustChangePassword));
      navigate('/admin/dashboard', { replace: true });
    } catch {
      setError('Lỗi kết nối máy chủ xác thực.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-[#0B132B] text-[#FAF7F0] border border-[#C89B3C]/40 rounded-2xl p-7 sm:p-8 shadow-lg space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#162447] border border-[#C89B3C]/60 text-[#E6BE68] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-[#FAF7F0]">
            ĐĂNG NHẬP ADMIN – QUẢN TRỊ
          </h1>
          <p className="text-xs text-slate-300">
            Nhập mật khẩu quản trị để vào trực tiếp Bảng điều hành Hệ thống
          </p>
        </div>

        {error && (
          <div
            role="alert"
            data-testid="admin-login-error"
            className="p-3 rounded-lg bg-[#8B1E24]/30 border border-[#8B1E24] text-xs font-medium text-red-100"
          >
            {error}
          </div>
        )}

        {/* PASSWORD-ONLY ADMIN LOGIN FORM: Strictly 1 input field ("Mật khẩu quản trị") */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-only-password" className="block text-xs font-semibold text-[#E6BE68] mb-1.5">
              Mật khẩu quản trị
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-only-password"
                data-testid="admin-password-input"
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu quản trị"
                className="w-full pl-10 pr-10 py-3 rounded-lg bg-[#162447] border border-white/20 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#C89B3C]"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Ẩn mật khẩu quản trị' : 'Hiện mật khẩu quản trị'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            data-testid="admin-login-submit"
            className="w-full py-3 rounded-lg bg-[#C89B3C] text-[#0B132B] text-sm font-bold hover:bg-[#d8ab4c] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP'}
          </button>
        </form>

        <p className="text-[11px] text-slate-400 text-center leading-relaxed">
          Mật khẩu được kiểm tra trực tiếp trên máy chủ bằng thuật toán băm Argon2id và bảo vệ chống dò mật khẩu.
        </p>
      </div>
    </div>
  );
}
