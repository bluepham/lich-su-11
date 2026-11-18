import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { AboutPage, HomePage } from './pages/HomeAndAbout';
import { AdminLoginPage, StudentLoginPage, StudentRegisterPage } from './pages/AuthPages';
import { StudentPortalPage } from './pages/StudentPortal';
import { LessonDetailPage, LessonsListPage, TopicsPage } from './pages/CurriculumPages';
import {
  Explore3DRoomPage,
  HistoricalMapPage,
  MasterTimelinePage,
  Museum3DLibraryPage,
} from './pages/Explore3DAndMapPages';
import { GamesArenaPage } from './pages/GamesArenaPage';
import { OnlineExamPage, PracticeBankPage } from './pages/PracticeAndQuizPages';
import { AiHistorianPage } from './pages/AiHistorianPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AdminEntryRoute() {
  const { role, loading } = useApp();
  if (loading) {
    return <div className="p-12 text-center text-sm text-stone-500">Đang kiểm tra quyền truy cập...</div>;
  }
  if (role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (role === 'student') {
    return <AdminDashboardPage />;
  }
  return <AdminLoginPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ScrollToTop />
        <Layout>
          <Routes>
            {/* Public & Curriculum Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/gioi-thieu" element={<AboutPage />} />
            <Route path="/chu-de" element={<TopicsPage />} />
            <Route path="/bai-hoc" element={<LessonsListPage />} />
            <Route path="/bai-hoc/:id" element={<LessonDetailPage />} />

            {/* 3D Museum, Exploration Room, Map & Timeline */}
            <Route path="/thu-vien-3d" element={<Museum3DLibraryPage />} />
            <Route path="/kham-pha-3d/:id" element={<Explore3DRoomPage />} />
            <Route path="/kham-pha-3d" element={<Navigate to="/kham-pha-3d/bach-dang-938" replace />} />
            <Route path="/ban-do" element={<HistoricalMapPage />} />
            <Route path="/dong-thoi-gian" element={<MasterTimelinePage />} />

            {/* Games, Practice, Online Exam & AI Historian */}
            <Route path="/tro-choi" element={<GamesArenaPage />} />
            <Route path="/luyen-tap" element={<PracticeBankPage />} />
            <Route path="/kiem-tra" element={<OnlineExamPage />} />
            <Route path="/tro-ly-ai" element={<AiHistorianPage />} />

            {/* Student Authentication & Personal Portal */}
            <Route path="/dang-ky" element={<StudentRegisterPage />} />
            <Route path="/dang-nhap" element={<StudentLoginPage />} />
            <Route path="/dashboard" element={<StudentPortalPage />} />
            <Route path="/ket-qua" element={<StudentPortalPage />} />
            <Route path="/ho-so" element={<StudentPortalPage />} />

            {/* Password-Only Teacher Admin Login & 12-Module Admin Portal */}
            <Route path="/giao-vien" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminEntryRoute />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/hoc-sinh" element={<AdminDashboardPage />} />
            <Route path="/admin/lop-hoc" element={<AdminDashboardPage />} />
            <Route path="/admin/bai-hoc" element={<AdminDashboardPage />} />
            <Route path="/admin/mo-hinh-3d" element={<AdminDashboardPage />} />
            <Route path="/admin/tro-choi" element={<AdminDashboardPage />} />
            <Route path="/admin/cau-hoi" element={<AdminDashboardPage />} />
            <Route path="/admin/de-kiem-tra" element={<AdminDashboardPage />} />
            <Route path="/admin/cham-diem" element={<AdminDashboardPage />} />
            <Route path="/admin/thong-ke" element={<AdminDashboardPage />} />
            <Route path="/admin/khao-sat" element={<AdminDashboardPage />} />
            <Route path="/admin/tro-ly-ai" element={<AdminDashboardPage />} />
            <Route path="/admin/cai-dat" element={<AdminDashboardPage />} />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AppProvider>
    </BrowserRouter>
  );
}
