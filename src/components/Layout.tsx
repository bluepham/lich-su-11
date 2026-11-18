import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Compass,
  GraduationCap,
  Landmark,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const PRIMARY_NAV = [
  { to: '/', label: 'Trung tâm 3D', end: true },
  { to: '/thu-vien-3d', label: 'Bảo tàng & Cổ phục 3D' },
  { to: '/chu-de', label: 'Chương trình 11' },
  { to: '/ban-do', label: 'Bản đồ lịch sử' },
  { to: '/dong-thoi-gian', label: 'Dòng thời gian' },
  { to: '/tro-choi', label: 'Trò chơi' },
  { to: '/kiem-tra', label: 'Luyện tập – Kiểm tra' },
  { to: '/tro-ly-ai', label: 'Trợ lý AI' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { role, student, siteConfig, logout } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F0] text-[#141B2D]">
      {/* Institutional Top Navigation */}
      <header className="sticky top-0 z-40 bg-[#0B132B] text-[#FAF7F0] border-b border-[#C89B3C]/30 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 shrink-0 group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#162447] border border-[#C89B3C]/60 flex items-center justify-center text-[#E6BE68] group-hover:bg-[#C89B3C] group-hover:text-[#0B132B] transition-colors">
              <Landmark className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <span className="block font-display font-bold text-sm tracking-wide text-[#FAF7F0]">
                LỊCH SỬ 11 3D
              </span>
              <span className="block text-[10px] text-[#E6BE68] truncate max-w-[180px] sm:max-w-none">
                THPT Hòa Minh · Vĩnh Long
              </span>
            </div>
          </Link>

          {/* Single-row Desktop Navigation */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden xl:flex items-center gap-1 overflow-x-auto"
          >
            {PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[#C89B3C] text-[#0B132B] font-semibold'
                      : 'text-slate-200 hover:text-[#E6BE68] hover:bg-white/5'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right User / Role Actions */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {role === 'guest' && (
              <>
                <Link
                  to="/dang-nhap"
                  data-testid="nav-student-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#C89B3C] text-[#0B132B] text-xs font-semibold hover:bg-[#d8ab4c] transition-colors whitespace-nowrap"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  HỌC SINH
                </Link>
                <Link
                  to="/giao-vien"
                  data-testid="nav-teacher-btn"
                  aria-label="Admin Quản trị Giáo viên"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#C89B3C]/70 text-[#E6BE68] text-xs font-semibold hover:bg-[#162447] transition-colors whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  ADMIN · QUẢN TRỊ
                </Link>
              </>
            )}

            {role === 'student' && student && (
              <>
                <Link
                  to="/dashboard"
                  data-testid="nav-student-dashboard"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#162447] border border-[#C89B3C]/50 text-[#FAF7F0] text-xs font-medium hover:border-[#C89B3C] whitespace-nowrap"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-[#E6BE68]" />
                  <span>{student.fullName}</span>
                  <span className="text-[#E6BE68]">· {student.className}</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  data-testid="nav-logout-btn"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-white/20 text-xs text-slate-200 hover:bg-white/10 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Đăng xuất
                </button>
              </>
            )}

            {role === 'admin' && (
              <>
                <Link
                  to="/admin/dashboard"
                  data-testid="nav-admin-dashboard"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#C89B3C] text-[#0B132B] text-xs font-semibold hover:bg-[#d8ab4c] whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  BẢNG QUẢN TRỊ GV
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  data-testid="nav-logout-btn"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-white/20 text-xs text-slate-200 hover:bg-white/10 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Đăng xuất
                </button>
              </>
            )}
          </div>

          {/* Mobile Drawer Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            className="xl:hidden p-2 rounded-md border border-white/15 text-slate-200 hover:bg-white/10"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile / Tablet Navigation Drawer */}
        {mobileOpen && (
          <div className="xl:hidden bg-[#0F1B3D] border-t border-white/10 px-4 py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {PRIMARY_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium ${
                      isActive
                        ? 'bg-[#C89B3C] text-[#0B132B] font-semibold'
                        : 'text-slate-200 hover:bg-white/5'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                to="/gioi-thieu"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium ${
                    isActive ? 'bg-[#C89B3C] text-[#0B132B] font-semibold' : 'text-slate-200 hover:bg-white/5'
                  }`
                }
              >
                Giới thiệu dự án
              </NavLink>
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
              {role === 'guest' && (
                <>
                  <Link
                    to="/dang-nhap"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2 px-3 rounded-md bg-[#C89B3C] text-[#0B132B] text-xs font-semibold"
                  >
                    HỌC SINH ĐĂNG NHẬP
                  </Link>
                  <Link
                    to="/dang-ky"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2 px-3 rounded-md bg-[#162447] border border-white/20 text-white text-xs font-semibold"
                  >
                    ĐĂNG KÝ HỌC SINH
                  </Link>
                  <Link
                    to="/giao-vien"
                    onClick={() => setMobileOpen(false)}
                    className="w-full text-center py-2 px-3 rounded-md border border-[#C89B3C]/70 text-[#E6BE68] text-xs font-semibold"
                  >
                    ADMIN · QUẢN TRỊ GIÁO VIÊN
                  </Link>
                </>
              )}
              {role === 'student' && student && (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2 px-3 rounded-md bg-[#C89B3C] text-[#0B132B] text-xs font-semibold"
                  >
                    Góc học tập: {student.fullName} ({student.className})
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="py-2 px-3 rounded-md border border-white/20 text-xs text-slate-200"
                  >
                    Đăng xuất
                  </button>
                </>
              )}
              {role === 'admin' && (
                <>
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2 px-3 rounded-md bg-[#C89B3C] text-[#0B132B] text-xs font-semibold"
                  >
                    Bảng Quản trị Giáo viên
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="py-2 px-3 rounded-md border border-white/20 text-xs text-slate-200"
                  >
                    Đăng xuất
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Clean Institutional Footer */}
      <footer className="bg-[#0B132B] text-slate-300 border-t border-[#C89B3C]/30 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <p className="font-display font-bold text-base text-[#FAF7F0]">{siteConfig.appName}</p>
            <p className="text-xs text-[#E6BE68] italic">“{siteConfig.slogan}”</p>
            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              {siteConfig.schoolName} · {siteConfig.subjectName}. Biên soạn bám sát SGK{' '}
              <em>{siteConfig.textbookName}</em>.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#E6BE68]">
              Không gian học tập số
            </h3>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <Link to="/chu-de" className="hover:text-white">
                6 Chủ đề – 13 Bài học
              </Link>
              <Link to="/thu-vien-3d" className="hover:text-white">
                Bảo tàng Mô hình GLB 3D
              </Link>
              <Link to="/ban-do" className="hover:text-white">
                Bản đồ Lịch sử Tương tác
              </Link>
              <Link to="/dong-thoi-gian" className="hover:text-white">
                Trục Dòng Thời Gian
              </Link>
              <Link to="/tro-choi" className="hover:text-white">
                Đấu trường Lịch sử 11
              </Link>
              <Link to="/kiem-tra" className="hover:text-white">
                Luyện tập & Kiểm tra
              </Link>
              <Link to="/tro-ly-ai" className="hover:text-white">
                Sử Gia AI 11
              </Link>
              <Link to="/gioi-thieu" className="hover:text-white">
                Giới thiệu sáng kiến
              </Link>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#E6BE68]">
              Học liệu mở & Quy chuẩn sử liệu
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Các mô hình 3D định dạng chuẩn nhị phân <code className="text-slate-200">.glb</code> phục vụ mục đích
              trực quan hóa không gian lịch sử; phân biệt rõ yếu tố sử liệu gốc và yếu tố phục dựng minh họa học tập.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#E6BE68]">
              <a
                href="/models/HUONG_DAN_BLENDER_GLB.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Box className="w-3.5 h-3.5" /> Hướng dẫn Blender GLB
              </a>
              <span className="text-slate-600">·</span>
              <Link to="/thu-vien-3d" className="inline-flex items-center gap-1 hover:underline">
                <Compass className="w-3.5 h-3.5" /> Khám phá ngay
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-[11px] text-slate-400 px-4">
          {siteConfig.authorInfo} · Hệ sinh thái học tập Lịch sử 11 3D
        </div>
      </footer>
    </div>
  );
}
