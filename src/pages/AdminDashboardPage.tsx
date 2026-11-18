import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Box,
  ClipboardCheck,
  Database,
  Download,
  FileQuestion,
  Gamepad2,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  School,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
  Users,
  Code2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GlbMuseumViewer } from '../components/GlbMuseumViewer';
import type { LessonItem, Model3DItem, QuestionType } from '../types';
import { apiFetch, downloadAuthenticatedFile } from '../utils/authSession';

const ADMIN_MENU = [
  { path: '/admin/dashboard', label: '1. Tổng quan hệ thống', icon: LayoutDashboard },
  { path: '/admin/hoc-sinh', label: '2. Quản lý học sinh', icon: Users },
  { path: '/admin/lop-hoc', label: '3. Quản lý lớp học', icon: School },
  { path: '/admin/bai-hoc', label: '4. Chủ đề & Bài học', icon: BookOpen },
  { path: '/admin/mo-hinh-3d', label: '5. Quản lý Mô hình 3D', icon: Box },
  { path: '/admin/tro-choi', label: '6. Quản lý Trò chơi', icon: Gamepad2 },
  { path: '/admin/cau-hoi', label: '7. Ngân hàng Câu hỏi', icon: FileQuestion },
  { path: '/admin/de-kiem-tra', label: '8. Đề thi & Chấm bài', icon: ClipboardCheck },
  { path: '/admin/thong-ke', label: '9. Thống kê Hiệu quả', icon: BarChart3 },
  { path: '/admin/khao-sat', label: '10. Khảo sát (1–5)', icon: Database },
  { path: '/admin/tro-ly-ai', label: '11. Cấu hình Sử Gia AI', icon: Sparkles },
  { path: '/admin/cai-dat', label: '12. Cài đặt & Bảo mật', icon: Settings },
];

export function AdminDashboardPage() {
  const {
    role,
    loading,
    mustChangeAdminPassword,
    siteConfig,
    lessons: publicLessons,
    logout,
    refreshBootstrap,
    refreshAuth,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath =
    location.pathname === '/admin/cham-diem' ? '/admin/de-kiem-tra' : location.pathname;

  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Module 1: Overview
  const [overview, setOverview] = useState<{
    totalStudents: number;
    activeStudents: number;
    recentActiveStudents: number;
    totalClasses: number;
    publishedLessons: number;
    activeModels: number;
    completedQuizAttempts: number;
    pendingManualGrading: number;
    total3dInteractions: number;
    classAverages: { className: string; studentCount: number; attemptCount: number; avgScore: number | null }[];
  } | null>(null);

  // Module 2: Students
  const [studentsList, setStudentsList] = useState<
    {
      id: string;
      fullName: string;
      className: string;
      username: string;
      status: string;
      completedLessons: number;
      avgScore: number | null;
      attemptCount: number;
      createdAt: string;
      lastLoginAt: string | null;
    }[]
  >([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [tempResetResult, setTempResetResult] = useState<{ username: string; tempPw: string } | null>(null);
  const [editingStudent, setEditingStudent] = useState<{ id: string; fullName: string; className: string } | null>(
    null,
  );

  // Module 3: Classes
  const [adminClasses, setAdminClasses] = useState<
    { id: string; className: string; schoolYear: string; status: string; studentCount: number; avgScore: number | null }[]
  >([]);
  const [newClassName, setNewClassName] = useState('');
  const [newSchoolYear, setNewSchoolYear] = useState('2026 - 2027');
  const [rankingClass, setRankingClass] = useState('');
  const [classRanking, setClassRanking] = useState<
    { id: string; fullName: string; username: string; attemptCount: number; avgScore: number | null; completedLessons: number }[]
  >([]);

  // Module 4: Lessons
  const [adminLessons, setAdminLessons] = useState<LessonItem[]>([]);
  const [editingLesson, setEditingLesson] = useState<LessonItem | null>(null);

  // Module 5: 3D Models (Upload .glb & Python 3 -> .glb Simulation Studio)
  const [adminModels, setAdminModels] = useState<Model3DItem[]>([]);
  const [previewModel, setPreviewModel] = useState<Model3DItem | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadLessonId, setUploadLessonId] = useState('lesson-7');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadSource, setUploadSource] = useState('');
  const [glbFileObj, setGlbFileObj] = useState<File | null>(null);
  const [uploadingGlb, setUploadingGlb] = useState(false);

  const [pyPreset, setPyPreset] = useState<
    'heritage_ecosystem' | 'naval_ambush' | 'maritime_sovereignty' | 'stone_citadel' | 'campaign_relief'
  >('heritage_ecosystem');
  const [pyModelName, setPyModelName] = useState('');
  const [pyLessonId, setPyLessonId] = useState('lesson-8');
  const [pyDesc, setPyDesc] = useState('');
  const [pyHumanCount, setPyHumanCount] = useState(2);
  const [pyVehicleCount, setPyVehicleCount] = useState(3);
  const [pyAnimalCount, setPyAnimalCount] = useState(4);
  const [pyTreeDensity, setPyTreeDensity] = useState(6);
  const [pyStakeRows, setPyStakeRows] = useState(3);
  const [pyWarshipPairs, setPyWarshipPairs] = useState(2);
  const [pyTidalAmp, setPyTidalAmp] = useState(0.34);
  const [pyIslandClusters, setPyIslandClusters] = useState(3);
  const [pyPatrolShips, setPyPatrolShips] = useState(2);
  const [pyArchCount, setPyArchCount] = useState(3);
  const [pyMountainPeaks, setPyMountainPeaks] = useState(5);
  const [generatingPyGlb, setGeneratingPyGlb] = useState(false);

  // Module 7: Question Bank
  const [adminQuestions, setAdminQuestions] = useState<
    {
      id: string;
      lessonId: string;
      questionType: QuestionType;
      content: string;
      difficulty: string;
      explanation: string;
      approved: boolean;
    }[]
  >([]);
  const [qLessonId, setQLessonId] = useState('lesson-7');
  const [qType, setQType] = useState<QuestionType>('mcq');
  const [qDifficulty, setQDifficulty] = useState('thong_hieu');
  const [qContent, setQContent] = useState('');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qCorrectIndex, setQCorrectIndex] = useState(0);
  const [qShortAnswer, setQShortAnswer] = useState('');
  const [qExplanation, setQExplanation] = useState('');

  // Module 8: Quizzes & Grading
  const [adminQuizzes, setAdminQuizzes] = useState<
    {
      id: string;
      title: string;
      lessonId: string | null;
      assignedClasses: string[];
      durationMinutes: number;
      publicationStatus: string;
      questionIds: string[];
    }[]
  >([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDuration, setQuizDuration] = useState(15);
  const [quizClassesStr, setQuizClassesStr] = useState('11A1, 11A2');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<
    {
      id: string;
      fullName: string;
      className: string;
      quizTitle: string;
      score: number;
      maxScore: number;
      submittedAt: string;
      gradingStatus: string;
      answers: {
        id: string;
        questionType: string;
        content: string;
        studentAnswer: unknown;
        awardedPoints: number;
        maxPoints: number;
        teacherFeedback: string;
        answerData: { rubric?: { criterion: string; maxPoints: number }[] };
      }[];
    }[]
  >([]);
  const [gradingDraft, setGradingDraft] = useState<Record<string, { pts: number; feedback: string }>>({});

  // Module 9: Analytics
  const [analyticsFilterClass, setAnalyticsFilterClass] = useState('');
  const [analyticsData, setAnalyticsData] = useState<{
    lessonCompletions: {
      lessonId: string;
      lessonNumber: number;
      title: string;
      completedCount: number;
      explored3dCount: number;
    }[];
    wrongByTopic: { topicId: string; topicTitle: string; totalAnswered: number; wrongCount: number }[];
    scoreDistribution: {
      under5: number | null;
      from5To65: number | null;
      from65To8: number | null;
      from8To10: number | null;
    } | null;
  } | null>(null);

  // Module 10: Surveys
  const [adminSurveys, setAdminSurveys] = useState<
    {
      id: string;
      title: string;
      surveyPhase: string;
      isActive: boolean;
      responseCount: number;
      averages: { question: string; average: number | null; count: number }[];
      responses: { id: string; fullName: string; className: string; ratings: number[]; comment: string; submittedAt: string }[];
    }[]
  >([]);

  // Module 11 & 12: Settings & Security
  const [settingsData, setSettingsData] = useState<{
    passwordChangedAt: string | null;
    aiConfigured: boolean;
    auditLogs: { id: string; actor_role: string; action: string; target_type: string; details: string; created_at: string }[];
  } | null>(null);
  const [cmsBannerSubtitle, setCmsBannerSubtitle] = useState(siteConfig.bannerSubtitle || '');
  const [cmsSlogan, setCmsSlogan] = useState(siteConfig.slogan || '');
  const [cmsAiNote, setCmsAiNote] = useState(siteConfig.aiSystemNote || '');
  const [curAdminPw, setCurAdminPw] = useState('');
  const [newAdminPw, setNewAdminPw] = useState('');
  const [confAdminPw, setConfAdminPw] = useState('');

  const notify = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
  };

  const fetchActiveModuleData = useCallback(async () => {
    if (role !== 'admin') return;
    try {
      if (currentPath === '/admin/dashboard') {
        const r = await apiFetch('/api/admin/overview');
        if (r.ok) setOverview(await r.json());
      } else if (currentPath === '/admin/hoc-sinh') {
        const params = new URLSearchParams();
        if (studentQuery) params.set('q', studentQuery);
        if (studentClassFilter) params.set('className', studentClassFilter);
        const r = await apiFetch(`/api/admin/students?${params.toString()}`);
        if (r.ok) {
          const d = await r.json();
          setStudentsList(d.students || []);
        }
      } else if (currentPath === '/admin/lop-hoc') {
        const r = await apiFetch('/api/admin/classes');
        if (r.ok) {
          const d = await r.json();
          setAdminClasses(d.classes || []);
        }
      } else if (currentPath === '/admin/bai-hoc') {
        const r = await apiFetch('/api/admin/lessons');
        if (r.ok) {
          const d = await r.json();
          setAdminLessons(d.lessons || []);
        }
      } else if (currentPath === '/admin/mo-hinh-3d') {
        const r = await apiFetch('/api/admin/models');
        if (r.ok) {
          const d = await r.json();
          setAdminModels(d.models || []);
          if (!previewModel && d.models?.[0]) setPreviewModel(d.models[0]);
        }
      } else if (currentPath === '/admin/cau-hoi') {
        const r = await apiFetch('/api/admin/questions');
        if (r.ok) {
          const d = await r.json();
          setAdminQuestions(d.questions || []);
        }
      } else if (currentPath === '/admin/de-kiem-tra') {
        const [qzRes, qRes, subRes] = await Promise.all([
          apiFetch('/api/admin/quizzes'),
          apiFetch('/api/admin/questions'),
          apiFetch('/api/admin/submissions'),
        ]);
        if (qzRes.ok) setAdminQuizzes((await qzRes.json()).quizzes || []);
        if (qRes.ok) setAdminQuestions((await qRes.json()).questions || []);
        if (subRes.ok) setSubmissions((await subRes.json()).submissions || []);
      } else if (currentPath === '/admin/thong-ke') {
        const params = new URLSearchParams();
        if (analyticsFilterClass) params.set('className', analyticsFilterClass);
        const r = await apiFetch(`/api/admin/analytics?${params.toString()}`);
        if (r.ok) setAnalyticsData(await r.json());
      } else if (currentPath === '/admin/khao-sat') {
        const r = await apiFetch('/api/admin/surveys');
        if (r.ok) setAdminSurveys((await r.json()).surveys || []);
      } else if (currentPath === '/admin/tro-ly-ai' || currentPath === '/admin/cai-dat') {
        const r = await apiFetch('/api/admin/settings');
        if (r.ok) {
          const d = await r.json();
          setSettingsData(d);
          if (d.siteConfig) {
            setCmsBannerSubtitle(d.siteConfig.bannerSubtitle || '');
            setCmsSlogan(d.siteConfig.slogan || '');
            setCmsAiNote(d.siteConfig.aiSystemNote || '');
          }
        }
      }
    } catch {
      notify('err', 'Không thể đồng bộ dữ liệu quản trị.');
    }
  }, [role, currentPath, studentQuery, studentClassFilter, analyticsFilterClass]);

  useEffect(() => {
    fetchActiveModuleData();
  }, [fetchActiveModuleData]);

  if (loading) {
    return <div className="p-12 text-center text-sm text-stone-500">Đang kiểm tra phiên quản trị...</div>;
  }

  // Strict RBAC Enforcement for Guests & Students
  if (role !== 'admin') {
    return (
      <div
        data-testid="admin-access-denied"
        className="max-w-lg mx-auto px-4 py-16 text-center space-y-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-[#8B1E24]/10 text-[#8B1E24] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-[#141B2D]">
          403 – Khu vực Giới hạn Quyền Quản trị Giáo viên
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed">
          Tài khoản Học sinh hoặc Khách tham quan không được phép truy cập hệ thống điều hành Giáo viên. Vui lòng xác thực bằng Mật khẩu quản trị.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            to="/admin/login"
            className="px-5 py-2.5 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
          >
            Đăng nhập Admin · Quản trị
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-lg border border-stone-300 bg-white text-stone-800 text-xs font-semibold"
          >
            Về Trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 12-Item Teacher Admin Left Sidebar */}
        <aside className="lg:col-span-3 bg-[#0B132B] text-[#FAF7F0] rounded-2xl p-4 border border-[#C89B3C]/40 space-y-1.5">
          <div className="px-3 py-2 border-b border-white/10 mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#E6BE68]">
              Quản trị Hệ thống
            </p>
            <p className="font-display text-base font-bold">Giáo viên Lịch sử 11</p>
          </div>

          {ADMIN_MENU.map((item) => {
            const Icon = item.icon;
            const active = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#C89B3C] text-[#0B132B] font-bold'
                    : 'text-slate-200 hover:bg-white/10 hover:text-[#E6BE68]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-2 mt-2 border-t border-white/10">
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-300 hover:bg-white/10"
            >
              <LogOut className="w-4 h-4" /> Đăng xuất Quản trị
            </button>
          </div>
        </aside>

        {/* Right Main Admin Workspace */}
        <section className="lg:col-span-9 space-y-5">
          {mustChangeAdminPassword && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-wrap items-center justify-between gap-3">
              <span>
                <strong>Khuyến nghị bảo mật:</strong> Hệ thống đang sử dụng mật khẩu quản trị khởi tạo ban đầu. Thầy/Cô nên đổi sang mật khẩu mạnh (≥ 8 ký tự) tại mục Cài đặt & Bảo mật.
              </span>
              <Link
                to="/admin/cai-dat"
                className="px-3 py-1.5 rounded bg-amber-900 text-white font-semibold shrink-0"
              >
                Đổi mật khẩu ngay
              </Link>
            </div>
          )}

          {toast && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between ${
                toast.type === 'ok'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border border-red-200 text-red-900'
              }`}
            >
              <span>{toast.text}</span>
              <button type="button" onClick={() => setToast(null)} className="px-2 font-bold">
                ✕
              </button>
            </div>
          )}

          {/* 1. OVERVIEW */}
          {currentPath === '/admin/dashboard' && overview && (
            <div data-testid="admin-overview-panel" className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                  Tổng quan Vận hành Hệ sinh thái Lịch sử 11 3D
                </h1>
                <button
                  type="button"
                  onClick={fetchActiveModuleData}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Làm mới số liệu
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-stone-500">Tổng học sinh đăng ký</p>
                  <p className="font-mono-num text-2xl font-bold text-[#0B132B] mt-1">
                    {overview.totalStudents}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Hoạt động 7 ngày qua: {overview.recentActiveStudents}
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-stone-500">Số lớp đang mở</p>
                  <p className="font-mono-num text-2xl font-bold text-[#0B132B] mt-1">
                    {overview.totalClasses}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1">Khối 11 THPT Hòa Minh</p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-stone-500">Bài học & Mô hình GLB xuất bản</p>
                  <p className="font-mono-num text-2xl font-bold text-[#8B1E24] mt-1">
                    {overview.publishedLessons} bài · {overview.activeModels} GLB
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Lượt hoàn thành 3D: {overview.total3dInteractions}
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-stone-500">Bài kiểm tra đã nộp</p>
                  <p className="font-mono-num text-2xl font-bold text-[#0B132B] mt-1">
                    {overview.completedQuizAttempts}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Chờ chấm tự luận: {overview.pendingManualGrading}
                  </p>
                </div>
              </div>

              {/* Class Averages Table */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
                <h2 className="font-display text-lg font-bold text-[#141B2D]">
                  Thống kê sĩ số & Điểm trung bình theo Lớp
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500">
                        <th className="py-2.5 pr-4">Lớp</th>
                        <th className="py-2.5 pr-4">Số học sinh đăng ký</th>
                        <th className="py-2.5 pr-4">Lượt nộp đề kiểm tra</th>
                        <th className="py-2.5">Điểm trung bình</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {overview.classAverages.map((c) => (
                        <tr key={c.className}>
                          <td className="py-2.5 pr-4 font-bold text-[#0B132B]">{c.className}</td>
                          <td className="py-2.5 pr-4 font-mono-num">{c.studentCount}</td>
                          <td className="py-2.5 pr-4 font-mono-num">{c.attemptCount}</td>
                          <td className="py-2.5 font-mono-num font-bold text-[#8B1E24]">
                            {c.avgScore ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. STUDENT MANAGEMENT */}
          {currentPath === '/admin/hoc-sinh' && (
            <div data-testid="admin-students-panel" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                  Quản lý Tài khoản Học sinh ({studentsList.length})
                </h1>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await downloadAuthenticatedFile(
                      `/api/admin/students/export/csv${
                        studentClassFilter ? `?className=${encodeURIComponent(studentClassFilter)}` : ''
                      }`,
                      'danh-sach-hoc-sinh-lich-su-11.csv',
                    );
                    if (!ok) notify('err', 'Không thể xuất tệp CSV lúc này.');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5 text-[#E6BE68]" /> Xuất danh sách CSV / Excel
                </button>
              </div>

              {tempResetResult && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-center justify-between">
                  <span>
                    Đã đặt lại mật khẩu tạm thời cho <strong>{tempResetResult.username}</strong>:{' '}
                    <code className="px-2 py-0.5 rounded bg-white border border-amber-400 font-mono-num font-bold">
                      {tempResetResult.tempPw}
                    </code>{' '}
                    (Học sinh sẽ được nhắc đổi mật khẩu khi đăng nhập lại).
                  </span>
                  <button
                    type="button"
                    onClick={() => setTempResetResult(null)}
                    className="font-bold px-2"
                  >
                    Đóng
                  </button>
                </div>
              )}

              <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Tìm theo Họ tên hoặc Tên đăng nhập..."
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-xs"
                />
                <input
                  type="text"
                  value={studentClassFilter}
                  onChange={(e) => setStudentClassFilter(e.target.value.toUpperCase())}
                  placeholder="Lọc lớp (VD: 11A1)"
                  className="w-full sm:w-40 px-3 py-2 rounded-lg border border-stone-300 text-xs uppercase"
                />
              </div>

              {editingStudent && (
                <div className="bg-white border border-[#0B132B] rounded-xl p-4 flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">Họ và tên</label>
                    <input
                      type="text"
                      value={editingStudent.fullName}
                      onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                      className="w-full px-3 py-1.5 rounded border border-stone-300 text-xs"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">Lớp</label>
                    <input
                      type="text"
                      value={editingStudent.className}
                      onChange={(e) =>
                        setEditingStudent({ ...editingStudent, className: e.target.value.toUpperCase() })
                      }
                      className="w-full px-3 py-1.5 rounded border border-stone-300 text-xs uppercase"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await apiFetch(`/api/admin/students/${editingStudent.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          fullName: editingStudent.fullName,
                          className: editingStudent.className,
                        }),
                      });
                      if (r.ok) {
                        notify('ok', 'Đã cập nhật hồ sơ học sinh.');
                        setEditingStudent(null);
                        fetchActiveModuleData();
                      }
                    }}
                    className="px-3.5 py-1.5 rounded bg-[#0B132B] text-white text-xs font-bold"
                  >
                    Lưu thay đổi
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="px-3 py-1.5 rounded border border-stone-300 text-xs"
                  >
                    Hủy
                  </button>
                </div>
              )}

              <div className="bg-white border border-stone-200 rounded-2xl p-5 overflow-x-auto">
                {studentsList.length === 0 ? (
                  <p className="text-xs text-stone-500 py-6 text-center">
                    Chưa có học sinh nào đăng ký hoặc khớp bộ lọc. (Hệ thống tuyệt đối không tạo tài khoản học sinh giả).
                  </p>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500">
                        <th className="py-2.5 pr-3">Họ và tên</th>
                        <th className="py-2.5 pr-3">Lớp</th>
                        <th className="py-2.5 pr-3">Tên đăng nhập</th>
                        <th className="py-2.5 pr-3">Tiến độ</th>
                        <th className="py-2.5 pr-3">Điểm TB</th>
                        <th className="py-2.5 pr-3">Trạng thái</th>
                        <th className="py-2.5">Thao tác quản trị</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {studentsList.map((st) => (
                        <tr key={st.id} data-testid={`admin-student-row-${st.username}`}>
                          <td className="py-3 pr-3 font-semibold text-[#141B2D]">{st.fullName}</td>
                          <td className="py-3 pr-3 font-bold text-[#0B132B]">{st.className}</td>
                          <td className="py-3 pr-3 font-mono-num">{st.username}</td>
                          <td className="py-3 pr-3 font-mono-num">{st.completedLessons}/13 bài</td>
                          <td className="py-3 pr-3 font-mono-num font-bold text-[#8B1E24]">
                            {st.avgScore ?? '—'}
                          </td>
                          <td className="py-3 pr-3">
                            {st.status === 'active' ? (
                              <span className="text-emerald-700 font-semibold">Hoạt động</span>
                            ) : (
                              <span className="text-[#8B1E24] font-semibold">Đã khóa</span>
                            )}
                          </td>
                          <td className="py-3 flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingStudent({
                                  id: st.id,
                                  fullName: st.fullName,
                                  className: st.className,
                                })
                              }
                              className="px-2 py-1 rounded border border-stone-300 hover:bg-stone-100"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const nextStatus = st.status === 'active' ? 'locked' : 'active';
                                await apiFetch(`/api/admin/students/${st.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: nextStatus }),
                                });
                                fetchActiveModuleData();
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-stone-300 hover:bg-stone-100"
                            >
                              {st.status === 'active' ? (
                                <>
                                  <Lock className="w-3 h-3" /> Khóa
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3 h-3" /> Mở
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const r = await apiFetch(`/api/admin/students/${st.id}/reset-password`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({}),
                                });
                                if (r.ok) {
                                  const d = await r.json();
                                  setTempResetResult({ username: st.username, tempPw: d.temporaryPassword });
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-stone-300 hover:bg-stone-100"
                            >
                              <KeyRound className="w-3 h-3" /> Cấp lại MK
                            </button>

                            {confirmDeleteId === st.id ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/admin/students/${st.id}`, {
                                    method: 'DELETE',
                                  });
                                  setConfirmDeleteId(null);
                                  fetchActiveModuleData();
                                  refreshBootstrap();
                                }}
                                className="px-2 py-1 rounded bg-[#8B1E24] text-white font-bold"
                              >
                                Xác nhận xóa
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(st.id)}
                                className="p-1 rounded text-[#8B1E24] hover:bg-red-50"
                                aria-label={`Xóa tài khoản ${st.username}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 3. CLASSES MANAGEMENT */}
          {currentPath === '/admin/lop-hoc' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-[#141B2D]">Quản lý Lớp học Khối 11</h1>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await apiFetch('/api/admin/classes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ className: newClassName, schoolYear: newSchoolYear }),
                  });
                  const d = await r.json();
                  if (!r.ok) {
                    notify('err', d.error || 'Không thể thêm lớp.');
                    return;
                  }
                  setNewClassName('');
                  notify('ok', 'Đã tạo lớp học mới.');
                  fetchActiveModuleData();
                  refreshBootstrap();
                }}
                className="bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-end gap-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Tên lớp mới</label>
                  <input
                    type="text"
                    required
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value.toUpperCase())}
                    placeholder="VD: 11A5"
                    className="px-3 py-2 rounded-lg border border-stone-300 text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Năm học</label>
                  <input
                    type="text"
                    value={newSchoolYear}
                    onChange={(e) => setNewSchoolYear(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-stone-300 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm lớp học
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminClasses.map((c) => (
                  <div key={c.id} className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#0B132B]">{c.className}</h2>
                      <p className="text-xs text-stone-500">
                        Năm học: {c.schoolYear} · Sĩ số ĐK: <strong>{c.studentCount}</strong> · Điểm TB:{' '}
                        <strong>{c.avgScore ?? '—'}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setRankingClass(c.className);
                        const r = await apiFetch(`/api/admin/classes/${encodeURIComponent(c.className)}/ranking`);
                        if (r.ok) setClassRanking((await r.json()).ranking || []);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#FAF7F0] border border-stone-300 text-xs font-semibold hover:border-[#0B132B]"
                    >
                      Bảng xếp hạng lớp
                    </button>
                  </div>
                ))}
              </div>

              {rankingClass && (
                <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                  <h3 className="font-display text-base font-bold text-[#141B2D]">
                    Bảng xếp hạng học tập Lớp {rankingClass}
                  </h3>
                  {classRanking.length === 0 ? (
                    <p className="text-xs text-stone-500">Chưa có học sinh nào trong lớp này.</p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-500">
                          <th className="py-2">Hạng</th>
                          <th className="py-2">Họ và tên</th>
                          <th className="py-2">Bài hoàn thành</th>
                          <th className="py-2">Điểm TB</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {classRanking.map((rk, i) => (
                          <tr key={rk.id}>
                            <td className="py-2 font-mono-num font-bold">#{i + 1}</td>
                            <td className="py-2 font-semibold">{rk.fullName}</td>
                            <td className="py-2 font-mono-num">{rk.completedLessons}/13</td>
                            <td className="py-2 font-mono-num font-bold text-[#8B1E24]">{rk.avgScore ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. LESSONS MANAGEMENT */}
          {currentPath === '/admin/bai-hoc' && (
            <div className="space-y-5">
              <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                Quản lý Nội dung 6 Chủ đề & 13 Bài học
              </h1>

              {editingLesson && (
                <div className="bg-white border border-[#0B132B] rounded-2xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold">
                    Chỉnh sửa Bài {editingLesson.lessonNumber}: {editingLesson.title}
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Tiêu đề bài học</label>
                      <input
                        type="text"
                        value={editingLesson.title}
                        onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Tóm tắt nội dung duyệt</label>
                      <textarea
                        rows={3}
                        value={editingLesson.content.summary}
                        onChange={(e) =>
                          setEditingLesson({
                            ...editingLesson,
                            content: { ...editingLesson.content, summary: e.target.value },
                          })
                        }
                        className="w-full p-3 rounded-lg border border-stone-300 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={editingLesson.publicationStatus}
                        onChange={(e) =>
                          setEditingLesson({ ...editingLesson, publicationStatus: e.target.value })
                        }
                        className="px-3 py-2 rounded-lg border border-stone-300 text-xs bg-white"
                      >
                        <option value="published">Đã xuất bản (Published)</option>
                        <option value="draft">Bản nháp (Draft)</option>
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await apiFetch(`/api/admin/lessons/${editingLesson.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: editingLesson.title,
                              content: editingLesson.content,
                              publicationStatus: editingLesson.publicationStatus,
                            }),
                          });
                          if (r.ok) {
                            notify('ok', 'Đã lưu phiên bản bài học mới.');
                            setEditingLesson(null);
                            fetchActiveModuleData();
                            refreshBootstrap();
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
                      >
                        Lưu cập nhật bài học
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLesson(null)}
                        className="px-3 py-2 rounded-lg border border-stone-300 text-xs"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2.5">
                {adminLessons.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#141B2D]">
                        Bài {l.lessonNumber}: {l.title}
                      </p>
                      <p className="text-xs text-stone-500">
                        Phiên bản v{l.version} · Trạng thái:{' '}
                        <strong>{l.publicationStatus === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingLesson(l)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-xs font-semibold hover:border-[#0B132B]"
                    >
                      Biên tập nội dung
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. 3D GLB MODELS MANAGEMENT, PYTHON -> GLB COMPILER & UPLOAD */}
          {currentPath === '/admin/mo-hinh-3d' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                    Quản lý Kho Mô hình 3D & Trình Sinh Mô Phỏng Python (.glb)
                  </h1>
                  <p className="text-xs text-stone-600 mt-1">
                    Tất cả mô phỏng không gian lịch sử & biển đảo được biên dịch từ Python 3 ra tệp nhị phân chuẩn glTF 2.0 (<code>.glb</code>) và đăng tải lên Bảo tàng 3D.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/python_glb/hop_nhat_canh_glb.py"
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-stone-300 text-xs font-semibold text-[#0B132B] hover:border-[#0B132B] whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-[#8B1E24]" /> Script hợp nhất &amp; làm đẹp .glb
                  </a>
                  <a
                    href="/python_glb/sinh_mo_phong_lich_su_glb.py"
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-stone-300 text-xs font-semibold text-[#0B132B] hover:border-[#0B132B] whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-[#8B1E24]" /> Lõi sinh .glb
                  </a>
                  <a
                    href="/python_glb/xuat_va_upload_glb.py"
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-stone-300 text-xs font-semibold text-[#0B132B] hover:border-[#0B132B] whitespace-nowrap"
                  >
                    <Code2 className="w-3.5 h-3.5 text-[#8B1E24]" /> Script xuất &amp; upload .glb
                  </a>
                </div>
              </div>

              {/* Python 3 Procedural Simulation -> Export .GLB -> Upload Studio */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!pyModelName.trim()) {
                    notify('err', 'Vui lòng nhập Tên mô hình 3D trước khi biên dịch Python.');
                    return;
                  }
                  setGeneratingPyGlb(true);
                  const params =
                    pyPreset === 'heritage_ecosystem'
                      ? {
                          humanCount: pyHumanCount,
                          vehicleCount: pyVehicleCount,
                          animalCount: pyAnimalCount,
                          treeDensity: pyTreeDensity,
                        }
                      : pyPreset === 'naval_ambush'
                        ? { stakeRows: pyStakeRows, warshipPairs: pyWarshipPairs, tidalAmplitude: pyTidalAmp }
                        : pyPreset === 'maritime_sovereignty'
                          ? { islandClusters: pyIslandClusters, patrolShips: pyPatrolShips }
                          : pyPreset === 'stone_citadel'
                            ? { archCount: pyArchCount, wallSpan: 18 }
                            : { mountainPeaks: pyMountainPeaks, milestoneCount: 4 };

                  const r = await apiFetch('/api/admin/models/generate-python', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      preset: pyPreset,
                      modelName: pyModelName.trim(),
                      lessonId: pyLessonId,
                      description: pyDesc.trim(),
                      params,
                      reviewStatus: 'published',
                    }),
                  });
                  const d = await r.json();
                  setGeneratingPyGlb(false);
                  if (!r.ok) {
                    notify('err', d.error || 'Không thể biên dịch mô phỏng Python sang .glb.');
                    return;
                  }
                  setPyModelName('');
                  setPyDesc('');
                  if (d.model) {
                    setPreviewModel(d.model);
                  }
                  notify(
                    'ok',
                    `Python 3 đã kết xuất tệp .glb (${Math.round((d.bytes || 0) / 1024)} KB) và đăng tải lên Bảo tàng 3D!`,
                  );
                  fetchActiveModuleData();
                  refreshBootstrap();
                }}
                className="bg-[#FAF7F0] border border-stone-300 rounded-2xl p-6 space-y-4"
              >
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-bold text-[#0B132B] flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-[#8B1E24]" /> 1. Lập trình Sinh Mô phỏng từ Python 3 → Xuất .glb & Đăng tải
                  </h2>
                  <p className="text-xs text-stone-600">
                    Thực thi trực tiếp <code>python3 sinh_mo_phong_lich_su_glb.py</code> trên máy chủ để tính toán lưới địa hình, chiến thuyền, bãi cọc/cụm đảo kèm hoạt ảnh, xuất tệp <code>.glb</code> vào <code>/uploads/models/</code> và công bố lên thư viện.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="py-preset-select" className="block text-xs font-semibold text-stone-700 mb-1">
                      Kịch bản thuật toán Python
                    </label>
                    <select
                      id="py-preset-select"
                      value={pyPreset}
                      onChange={(e) => {
                        const val = e.target.value as typeof pyPreset;
                        setPyPreset(val);
                        if (val === 'heritage_ecosystem') setPyLessonId('lesson-8');
                        if (val === 'naval_ambush') setPyLessonId('lesson-7');
                        if (val === 'maritime_sovereignty') setPyLessonId('lesson-13');
                        if (val === 'stone_citadel') setPyLessonId('lesson-9');
                        if (val === 'campaign_relief') setPyLessonId('lesson-8');
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                    >
                      <option value="heritage_ecosystem">Quần thể Người – Xe cộ – Động vật – Cây cối (.glb)</option>
                      <option value="naval_ambush">Thủy chiến & Bãi cọc / Phục kích sông nước</option>
                      <option value="maritime_sovereignty">Hải trình Biển Đông & Cụm đảo chủ quyền</option>
                      <option value="stone_citadel">Thành lũy đá vòm cuốn & Kỳ đài cổ</option>
                      <option value="campaign_relief">Sa bàn địa hình núi rừng & Mốc chiến dịch</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="py-model-name" className="block text-xs font-semibold text-stone-700 mb-1">
                      Tên mô hình 3D xuất bản
                    </label>
                    <input
                      id="py-model-name"
                      type="text"
                      required
                      value={pyModelName}
                      onChange={(e) => setPyModelName(e.target.value)}
                      placeholder="VD: Quần thể Đô thị & Sinh thái 3D"
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label htmlFor="py-lesson-select" className="block text-xs font-semibold text-stone-700 mb-1">
                      Gắn với bài học SGK
                    </label>
                    <select
                      id="py-lesson-select"
                      value={pyLessonId}
                      onChange={(e) => setPyLessonId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                    >
                      {publicLessons.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title.startsWith('Bài') ? l.title : `Bài ${l.lessonNumber}: ${l.title}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Parameter Sliders with Explicit Values & Units */}
                {pyPreset === 'heritage_ecosystem' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-3.5 rounded-xl border border-stone-200">
                    <div>
                      <label htmlFor="slider-humans" className="block text-xs font-semibold text-stone-700 mb-1">
                        Mô hình Người 3D: <span className="font-mono-num text-[#8B1E24]">{pyHumanCount} người</span>
                      </label>
                      <input
                        id="slider-humans"
                        type="range"
                        min={1}
                        max={2}
                        value={pyHumanCount}
                        onChange={(e) => setPyHumanCount(Number(e.target.value))}
                        className="w-full accent-[#0B132B]"
                      />
                    </div>
                    <div>
                      <label htmlFor="slider-vehicles" className="block text-xs font-semibold text-stone-700 mb-1">
                        Phương tiện Xe cộ: <span className="font-mono-num text-[#8B1E24]">{pyVehicleCount} xe</span>
                      </label>
                      <input
                        id="slider-vehicles"
                        type="range"
                        min={1}
                        max={4}
                        value={pyVehicleCount}
                        onChange={(e) => setPyVehicleCount(Number(e.target.value))}
                        className="w-full accent-[#0B132B]"
                      />
                    </div>
                    <div>
                      <label htmlFor="slider-animals" className="block text-xs font-semibold text-stone-700 mb-1">
                        Động vật hoạt ảnh: <span className="font-mono-num text-[#8B1E24]">{pyAnimalCount} loài</span>
                      </label>
                      <input
                        id="slider-animals"
                        type="range"
                        min={1}
                        max={5}
                        value={pyAnimalCount}
                        onChange={(e) => setPyAnimalCount(Number(e.target.value))}
                        className="w-full accent-[#0B132B]"
                      />
                    </div>
                    <div>
                      <label htmlFor="slider-trees" className="block text-xs font-semibold text-stone-700 mb-1">
                        Mật độ Cây cảnh quan: <span className="font-mono-num text-[#8B1E24]">{pyTreeDensity} cụm cây</span>
                      </label>
                      <input
                        id="slider-trees"
                        type="range"
                        min={2}
                        max={10}
                        value={pyTreeDensity}
                        onChange={(e) => setPyTreeDensity(Number(e.target.value))}
                        className="w-full accent-[#0B132B]"
                      />
                    </div>
                  </div>
                )}
                {pyPreset === 'naval_ambush' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-3.5 rounded-xl border border-stone-200">
                    <div>
                      <label htmlFor="slider-stakes" className="block text-xs font-semibold text-stone-700 mb-1">
                        Số hàng cọc ngầm: <span className="font-mono-num text-[#8B1E24]">{pyStakeRows} hàng</span>
                      </label>
                      <input
                        id="slider-stakes"
                        type="range"
                        min={1}
                        max={6}
                        value={pyStakeRows}
                        onChange={(e) => setPyStakeRows(Number(e.target.value))}
                        className="w-full accent-[#0B132B]"
                      />
                    </div>
                    <div>
                      <label htmlFor="slider-warships" className="block text-xs font-semibold text-stone-700 mb-1">
                        Đội thuyền phục kích: <span className="font-mono-num text-[#8B1E24]">{pyWarshipPairs} cặp thuyền</span>
                      </label>
                      <input
                        id="slider-warships"
                        type="range"
                        min={1}
                        max={4}
                        value={pyWarshipPairs}
                        onChange={(e) => setPyWarshipPairs(Number(e.target.value))}
                        className="w-full accent-[#0B132B]"
                      />
                    </div>
                    <div>
                      <label htmlFor="slider-tide" className="block text-xs font-semibold text-stone-700 mb-1">
                        Biên độ thủy triều: <span className="font-mono-num text-[#8B1E24]">{pyTidalAmp.toFixed(2)} m</span>
                      </label>
                      <input
                        id="slider-tide"
                        type="range"
                        min={0.15}
                        max={0.55}
                        step={0.05}
                        value={pyTidalAmp}
                        onChange={(e) => setPyTidalAmp(Number(e.target.value))}
                        className="w-full accent-[#0B132B]"
                      />
                    </div>
                  </div>
                )}

                {pyPreset === 'maritime_sovereignty' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-3.5 rounded-xl border border-stone-200">
                    <div>
                      <label htmlFor="slider-islands" className="block text-xs font-semibold text-stone-700 mb-1">
                        Số cụm đảo & bia chủ quyền: <span className="font-mono-num text-[#8B1E24]">{pyIslandClusters} cụm đảo</span>
                      </label>
                      <input
                        id="slider-islands"
                        type="range"
                        min={2}
                        max={6}
                        value={pyIslandClusters}
                        onChange={(e) => setPyIslandClusters(Number(e.target.value))}
                        className="w-full accent-[#0B132B]"
                      />
                    </div>
                    <div>
                      <label htmlFor="slider-patrol" className="block text-xs font-semibold text-stone-700 mb-1">
                        Đội tàu thực thi hải trình: <span className="font-mono-num text-[#8B1E24]">{pyPatrolShips} tàu</span>
                      </label>
                      <input
                        id="slider-patrol"
                        type="range"
                        min={1}
                        max={4}
                        value={pyPatrolShips}
                        onChange={(e) => setPyPatrolShips(Number(e.target.value))}
                        className="w-full accent-[#0B132B]"
                      />
                    </div>
                  </div>
                )}

                {pyPreset === 'stone_citadel' && (
                  <div className="bg-white p-3.5 rounded-xl border border-stone-200">
                    <label htmlFor="slider-arches" className="block text-xs font-semibold text-stone-700 mb-1">
                      Số vòm cuốn đá khối cổng thành: <span className="font-mono-num text-[#8B1E24]">{pyArchCount} vòm cuốn</span>
                    </label>
                    <input
                      id="slider-arches"
                      type="range"
                      min={1}
                      max={5}
                      value={pyArchCount}
                      onChange={(e) => setPyArchCount(Number(e.target.value))}
                      className="w-full max-w-sm accent-[#0B132B]"
                    />
                  </div>
                )}

                {pyPreset === 'campaign_relief' && (
                  <div className="bg-white p-3.5 rounded-xl border border-stone-200">
                    <label htmlFor="slider-peaks" className="block text-xs font-semibold text-stone-700 mb-1">
                      Mật độ khối núi hiểm trở: <span className="font-mono-num text-[#8B1E24]">{pyMountainPeaks} đỉnh núi</span>
                    </label>
                    <input
                      id="slider-peaks"
                      type="range"
                      min={2}
                      max={8}
                      value={pyMountainPeaks}
                      onChange={(e) => setPyMountainPeaks(Number(e.target.value))}
                      className="w-full max-w-sm accent-[#0B132B]"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="py-model-desc" className="block text-xs font-semibold text-stone-700 mb-1">
                    Thuyết minh lịch sử cho mô hình (tùy chọn)
                  </label>
                  <input
                    id="py-model-desc"
                    type="text"
                    value={pyDesc}
                    onChange={(e) => setPyDesc(e.target.value)}
                    placeholder="Ghi chú ý nghĩa chiến thuật, địa hình hoặc chủ quyền biển đảo..."
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingPyGlb}
                  className="px-4 py-2.5 rounded-lg bg-[#8B1E24] text-white text-xs font-bold hover:bg-[#72171C] transition-colors"
                >
                  {generatingPyGlb
                    ? 'Đang chạy Python 3 kết xuất tệp .glb...'
                    : 'Biên dịch Python ra .glb & Đăng tải lên Thư viện'}
                </button>
              </form>

              {/* Upload Local .GLB File Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!glbFileObj) {
                    notify('err', 'Vui lòng chọn tệp mô hình .glb trên máy tính.');
                    return;
                  }
                  setUploadingGlb(true);
                  const fd = new FormData();
                  fd.append('glbFile', glbFileObj);
                  fd.append('modelName', uploadName);
                  fd.append('lessonId', uploadLessonId);
                  fd.append('description', uploadDesc);
                  fd.append('sourceReference', uploadSource || 'Tư liệu bổ sung bởi Giáo viên');
                  fd.append('reviewStatus', 'published');

                  const r = await apiFetch('/api/admin/models/upload', {
                    method: 'POST',
                    body: fd,
                  });
                  const d = await r.json();
                  setUploadingGlb(false);
                  if (!r.ok) {
                    notify('err', d.error || 'Tải lên tệp .glb thất bại.');
                    return;
                  }
                  setUploadName('');
                  setUploadDesc('');
                  setGlbFileObj(null);
                  notify(
                    'ok',
                    `Đã upload tệp .glb thành công (Generator: ${d.generator || 'glTF 2.0'}, ${d.animationNames?.length || 0} hoạt ảnh)!`,
                  );
                  fetchActiveModuleData();
                  refreshBootstrap();
                }}
                className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
              >
                <h2 className="font-display text-lg font-bold text-[#0B132B] flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#8B1E24]" /> 2. Upload tệp .glb từ máy tính (Xuất từ Python cục bộ hoặc Blender)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="upload-glb-name" className="block text-xs font-semibold text-stone-700 mb-1">
                      Tên mô hình 3D
                    </label>
                    <input
                      id="upload-glb-name"
                      type="text"
                      required
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="VD: Mô phỏng Hải đội Hoàng Sa thế kỷ XVII"
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="upload-glb-lesson" className="block text-xs font-semibold text-stone-700 mb-1">
                      Gắn với bài học
                    </label>
                    <select
                      id="upload-glb-lesson"
                      value={uploadLessonId}
                      onChange={(e) => setUploadLessonId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                    >
                      {publicLessons.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title.startsWith('Bài') ? l.title : `Bài ${l.lessonNumber}: ${l.title}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="upload-glb-file" className="block text-xs font-semibold text-stone-700 mb-1">
                      Tệp nhị phân .glb
                    </label>
                    <input
                      id="upload-glb-file"
                      type="file"
                      accept=".glb"
                      onChange={(e) => setGlbFileObj(e.target.files?.[0] || null)}
                      className="w-full text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="upload-glb-source" className="block text-xs font-semibold text-stone-700 mb-1">
                      Nguồn tư liệu tham khảo
                    </label>
                    <input
                      id="upload-glb-source"
                      type="text"
                      value={uploadSource}
                      onChange={(e) => setUploadSource(e.target.value)}
                      placeholder="VD: Xuất từ script Python sinh_mo_phong_lich_su_glb.py"
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="upload-glb-desc" className="block text-xs font-semibold text-stone-700 mb-1">
                    Mô tả sư phạm
                  </label>
                  <textarea
                    id="upload-glb-desc"
                    rows={2}
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    placeholder="Ghi chú bối cảnh lịch sử và lưu ý đối chiếu thực địa..."
                    className="w-full p-2.5 rounded-lg border border-stone-300 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={uploadingGlb}
                  className="px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
                >
                  {uploadingGlb ? 'Đang tải lên máy chủ...' : 'Tải lên & Xuất bản Mô hình GLB'}
                </button>
              </form>

              {/* Live 3D Admin Preview */}
              {previewModel && (
                <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-[#141B2D]">
                      Xem trước trực tiếp trên Three.js: {previewModel.modelName}
                    </h3>
                    <span className="text-xs font-mono-num text-stone-500">{previewModel.fileUrl}</span>
                  </div>
                  <GlbMuseumViewer model={previewModel} heightClass="h-[380px]" compact />
                </div>
              )}

              {/* Models List */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2.5">
                <h2 className="font-display text-base font-bold text-[#141B2D] pb-1">
                  Danh sách Mô hình .glb trong Cơ sở dữ liệu ({adminModels.length})
                </h2>
                {adminModels.map((m) => {
                  const isCoreModel = ['model-1', 'model-2', 'model-3', 'model-4', 'model-5'].includes(m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-[#141B2D]">{m.modelName}</p>
                        <p className="text-xs text-stone-500">
                          Tệp: <code>{m.fileUrl}</code> · {m.hotspots.length} hotspot · {m.animationNames.length} hoạt ảnh · Trạng thái:{' '}
                          <strong>{m.reviewStatus === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</strong>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={m.fileUrl}
                          download
                          className="px-2.5 py-1.5 rounded bg-white border border-stone-300 text-xs font-semibold text-stone-700 hover:border-[#0B132B]"
                        >
                          Tải .glb
                        </a>
                        <button
                          type="button"
                          onClick={() => setPreviewModel(m)}
                          className="px-3 py-1.5 rounded bg-white border border-stone-300 text-xs font-semibold hover:border-[#0B132B]"
                        >
                          Xem trước 3D
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const nextStatus = m.reviewStatus === 'published' ? 'draft' : 'published';
                            await apiFetch(`/api/admin/models/${m.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ reviewStatus: nextStatus }),
                            });
                            fetchActiveModuleData();
                            refreshBootstrap();
                          }}
                          className="px-3 py-1.5 rounded bg-[#0B132B] text-white text-xs font-semibold"
                        >
                          {m.reviewStatus === 'published' ? 'Chuyển sang Nháp' : 'Xuất bản'}
                        </button>
                        {!isCoreModel && (
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await apiFetch(`/api/admin/models/${m.id}`, {
                                method: 'DELETE',
                              });
                              if (r.ok) {
                                if (previewModel?.id === m.id) setPreviewModel(null);
                                notify('ok', `Đã xóa mô hình "${m.modelName}".`);
                                fetchActiveModuleData();
                                refreshBootstrap();
                              }
                            }}
                            aria-label={`Xóa mô hình ${m.modelName}`}
                            className="p-1.5 rounded border border-red-200 text-[#8B1E24] hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. GAMES OVERVIEW */}
          {currentPath === '/admin/tro-choi' && (
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                Cấu hình Đấu Trường Lịch Sử 11 (6 Trò chơi Tương tác)
              </h1>
              <p className="text-xs text-stone-600 leading-relaxed">
                Hệ thống vận hành 6 mô-đun trò chơi gắn trực tiếp với cơ sở dữ liệu điểm thành tích học sinh và quy tắc mở khóa Huy hiệu tự động:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  '1. Dòng thời gian bí ẩn (Sắp xếp niên biểu 938 – 1917, tối đa 100 điểm)',
                  '2. Ai là sử gia? (Phản xạ trắc nghiệm nhanh 5 câu, tối đa 100 điểm)',
                  '3. Ghép mảnh lịch sử (Ghép nối nhân vật – bộ luật – cải cách, tối đa 100 điểm)',
                  '4. Giải mã bản đồ (Định vị chiến trường & Hoàng Sa – Trường Sa; ≥ 80% cấp huy hiệu Chuyên gia bản đồ)',
                  '5. Truy tìm chứng cứ (Giám định trích đoạn sử liệu gốc, tối đa 100 điểm)',
                  '6. Hành trình vượt thử thách (6 chặng liên hoàn theo 6 Chủ đề SGK, tối đa 120 điểm)',
                ].map((item, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200 font-medium text-stone-800">
                    {item}
                  </div>
                ))}
              </div>
              <Link
                to="/tro-choi"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
              >
                Mở giao diện Đấu trường của Học sinh →
              </Link>
            </div>
          )}

          {/* 7. QUESTION BANK */}
          {currentPath === '/admin/cau-hoi' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                Ngân hàng Câu hỏi Đánh giá Năng lực ({adminQuestions.length})
              </h1>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const answerData =
                    qType === 'short_answer'
                      ? { acceptedAnswers: [qShortAnswer], points: 1 }
                      : qType === 'essay'
                        ? {
                            rubric: [
                              { criterion: 'Trình bày đúng bối cảnh và sự kiện lịch sử cốt lõi', maxPoints: 1 },
                              { criterion: 'Phân tích được ý nghĩa lịch sử và liên hệ thực tiễn', maxPoints: 1 },
                            ],
                            points: 2,
                          }
                        : { options: qOptions, correctIndex: qCorrectIndex, points: 1 };

                  const r = await apiFetch('/api/admin/questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      lessonId: qLessonId,
                      questionType: qType,
                      difficulty: qDifficulty,
                      content: qContent,
                      answerData,
                      explanation: qExplanation,
                      approved: true,
                    }),
                  });
                  if (r.ok) {
                    setQContent('');
                    setQExplanation('');
                    notify('ok', 'Đã bổ sung câu hỏi mới vào ngân hàng.');
                    fetchActiveModuleData();
                  }
                }}
                className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-[#0B132B]">Thêm câu hỏi mới</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={qLessonId}
                    onChange={(e) => setQLessonId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                  >
                    {publicLessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        Bài {l.lessonNumber}: {l.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={qType}
                    onChange={(e) => setQType(e.target.value as QuestionType)}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                  >
                    <option value="mcq">Trắc nghiệm 4 lựa chọn</option>
                    <option value="short_answer">Trả lời ngắn</option>
                    <option value="essay">Tự luận (Chấm theo Rubric)</option>
                  </select>
                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                  >
                    <option value="nhan_biet">Nhận biết</option>
                    <option value="thong_hieu">Thông hiểu</option>
                    <option value="van_dung">Vận dụng</option>
                  </select>
                </div>

                <textarea
                  rows={2}
                  required
                  value={qContent}
                  onChange={(e) => setQContent(e.target.value)}
                  placeholder="Nội dung câu hỏi..."
                  className="w-full p-3 rounded-lg border border-stone-300 text-xs"
                />

                {qType === 'mcq' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {qOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correct-opt"
                          checked={qCorrectIndex === idx}
                          onChange={() => setQCorrectIndex(idx)}
                        />
                        <input
                          type="text"
                          required
                          value={opt}
                          onChange={(e) => {
                            const next = [...qOptions];
                            next[idx] = e.target.value;
                            setQOptions(next);
                          }}
                          placeholder={`Phương án ${String.fromCharCode(65 + idx)}`}
                          className="flex-1 px-3 py-1.5 rounded border border-stone-300 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {qType === 'short_answer' && (
                  <input
                    type="text"
                    required
                    value={qShortAnswer}
                    onChange={(e) => setQShortAnswer(e.target.value)}
                    placeholder="Đáp án chuẩn (VD: 1986)"
                    className="w-full max-w-sm px-3 py-2 rounded-lg border border-stone-300 text-xs"
                  />
                )}

                <input
                  type="text"
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  placeholder="Giải thích đáp án / Hướng dẫn chấm..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
                />

                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
                >
                  Lưu vào Ngân hàng câu hỏi
                </button>
              </form>

              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2 max-h-[460px] overflow-y-auto">
                {adminQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="p-3 rounded-xl bg-[#FAF7F0] border border-stone-200 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#8B1E24] mr-2">[{q.questionType}]</span>
                      <span className="font-medium text-stone-800">{q.content}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/questions/${q.id}`, {
                          method: 'DELETE',
                        });
                        fetchActiveModuleData();
                      }}
                      className="text-[#8B1E24] hover:underline shrink-0"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. QUIZZES & ESSAY RUBRIC GRADING */}
          {currentPath === '/admin/de-kiem-tra' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                Quản lý Đề kiểm tra & Chấm tự luận theo Rubric
              </h1>

              {/* Create Quiz */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const assignedClasses = quizClassesStr
                    .split(',')
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean);
                  const r = await apiFetch('/api/admin/quizzes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: quizTitle,
                      durationMinutes: quizDuration,
                      assignedClasses,
                      questionIds: selectedQuestionIds,
                      publicationStatus: 'published',
                    }),
                  });
                  const d = await r.json();
                  if (!r.ok) {
                    notify('err', d.error || 'Không thể tạo đề.');
                    return;
                  }
                  setQuizTitle('');
                  setSelectedQuestionIds([]);
                  notify('ok', 'Đã xuất bản đề kiểm tra mới.');
                  fetchActiveModuleData();
                }}
                className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-[#0B132B]">Tạo đề kiểm tra mới</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    placeholder="Tên đề kiểm tra (VD: Kiểm tra 15 phút Chủ đề 4)"
                    className="sm:col-span-2 px-3 py-2 rounded-lg border border-stone-300 text-xs"
                  />
                  <input
                    type="number"
                    min={5}
                    max={90}
                    value={quizDuration}
                    onChange={(e) => setQuizDuration(Number(e.target.value))}
                    placeholder="Thời lượng (phút)"
                    className="px-3 py-2 rounded-lg border border-stone-300 text-xs"
                  />
                </div>
                <input
                  type="text"
                  value={quizClassesStr}
                  onChange={(e) => setQuizClassesStr(e.target.value)}
                  placeholder="Các lớp giao bài (cách nhau dấu phẩy, để trống = tất cả các lớp)"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
                />
                <div className="max-h-40 overflow-y-auto border border-stone-200 rounded-lg p-2.5 space-y-1.5 bg-[#FAF7F0]">
                  {adminQuestions.map((q) => (
                    <label key={q.id} className="flex items-start gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.includes(q.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                          else setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== q.id));
                        }}
                      />
                      <span>
                        <strong>[{q.questionType}]</strong> {q.content}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
                >
                  Xuất bản Đề kiểm tra ({selectedQuestionIds.length} câu đã chọn)
                </button>
              </form>

              {/* Existing Quizzes */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2">
                <h2 className="font-display text-base font-bold text-[#141B2D]">
                  Danh sách đề hiện hành ({adminQuizzes.length})
                </h2>
                {adminQuizzes.map((qz) => (
                  <div key={qz.id} className="p-3 rounded-lg bg-[#FAF7F0] border border-stone-200 text-xs flex justify-between">
                    <span className="font-semibold text-[#0B132B]">{qz.title}</span>
                    <span className="font-mono-num text-stone-600">
                      {qz.durationMinutes} phút · {qz.questionIds.length} câu
                    </span>
                  </div>
                ))}
              </div>

              {/* Submissions & Manual Essay Rubric Grading */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#141B2D]">
                  Bài nộp của Học sinh & Chấm điểm Tự luận ({submissions.length})
                </h2>
                {submissions.length === 0 ? (
                  <p className="text-xs text-stone-500">Chưa có bài kiểm tra nào được học sinh nộp.</p>
                ) : (
                  <div className="space-y-4">
                    {submissions.map((sub) => {
                      const essayAnswers = sub.answers.filter((a) => a.questionType === 'essay');
                      return (
                        <div key={sub.id} className="p-4 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div>
                              <strong className="text-[#0B132B]">{sub.fullName}</strong> ({sub.className}) ·{' '}
                              <span>{sub.quizTitle}</span>
                            </div>
                            <div className="font-mono-num font-bold text-[#8B1E24]">
                              Điểm: {sub.score} / {sub.maxScore} (
                              {sub.gradingStatus === 'pending_manual' ? 'Chờ chấm tự luận' : 'Đã chấm'})
                            </div>
                          </div>

                          {essayAnswers.map((ans) => {
                            const draft = gradingDraft[ans.id] ?? {
                              pts: ans.awardedPoints,
                              feedback: ans.teacherFeedback || '',
                            };
                            return (
                              <div key={ans.id} className="p-3 rounded-lg bg-white border border-stone-200 space-y-2 text-xs">
                                <p className="font-bold text-[#141B2D]">Câu tự luận: {ans.content}</p>
                                <p className="p-2.5 rounded bg-stone-50 border border-stone-200 whitespace-pre-line">
                                  <strong>Bài làm HS:</strong> {String(ans.studentAnswer || '(Bỏ trống)')}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="font-semibold">
                                    Điểm GV chấm (tối đa {ans.maxPoints}đ):
                                    <input
                                      type="number"
                                      step="0.25"
                                      min={0}
                                      max={ans.maxPoints}
                                      value={draft.pts}
                                      onChange={(e) =>
                                        setGradingDraft({
                                          ...gradingDraft,
                                          [ans.id]: { ...draft, pts: Number(e.target.value) },
                                        })
                                      }
                                      className="ml-2 w-20 px-2 py-1 rounded border border-stone-300 font-mono-num"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const r = await apiFetch('/api/admin/ai/rubric-suggest', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          questionContent: ans.content,
                                          rubric: ans.answerData?.rubric || [],
                                          studentAnswer: String(ans.studentAnswer || ''),
                                        }),
                                      });
                                      const d = await r.json();
                                      if (r.ok && d.suggestion) {
                                        setGradingDraft({
                                          ...gradingDraft,
                                          [ans.id]: { ...draft, feedback: d.suggestion },
                                        });
                                      } else {
                                        notify('err', d.error || 'Chưa kích hoạt Gemini API cho gợi ý.');
                                      }
                                    }}
                                    className="px-2.5 py-1 rounded border border-[#C89B3C] text-[#0B132B] font-semibold"
                                  >
                                    Gợi ý nhận xét bằng AI
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={draft.feedback}
                                  onChange={(e) =>
                                    setGradingDraft({
                                      ...gradingDraft,
                                      [ans.id]: { ...draft, feedback: e.target.value },
                                    })
                                  }
                                  placeholder="Nhận xét chuyên môn của Giáo viên..."
                                  className="w-full px-3 py-1.5 rounded border border-stone-300"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const r = await apiFetch(`/api/admin/submissions/${sub.id}/grade`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        gradedAnswers: [
                                          {
                                            answerId: ans.id,
                                            awardedPoints: draft.pts,
                                            teacherFeedback: draft.feedback,
                                          },
                                        ],
                                      }),
                                    });
                                    if (r.ok) {
                                      notify('ok', 'Đã lưu điểm chấm Rubric chính thức của Giáo viên.');
                                      fetchActiveModuleData();
                                    }
                                  }}
                                  className="px-3.5 py-1.5 rounded bg-[#0B132B] text-white font-bold"
                                >
                                  Xác nhận điểm Giáo viên
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 9. ANALYTICS */}
          {currentPath === '/admin/thong-ke' && analyticsData && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                  Thống kê Hiệu quả Dạy học & Phổ điểm Thực tế
                </h1>
                <input
                  type="text"
                  value={analyticsFilterClass}
                  onChange={(e) => setAnalyticsFilterClass(e.target.value.toUpperCase())}
                  placeholder="Lọc theo lớp (VD: 11A1)"
                  className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs uppercase w-44"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-stone-200 rounded-xl p-4">
                  <p className="text-xs text-stone-500">Điểm dưới 5.0</p>
                  <p className="font-mono-num text-xl font-bold text-[#8B1E24] mt-1">
                    {analyticsData.scoreDistribution?.under5 ?? 0}
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-4">
                  <p className="text-xs text-stone-500">Từ 5.0 đến cận 6.5</p>
                  <p className="font-mono-num text-xl font-bold text-stone-800 mt-1">
                    {analyticsData.scoreDistribution?.from5To65 ?? 0}
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-4">
                  <p className="text-xs text-stone-500">Từ 6.5 đến cận 8.0</p>
                  <p className="font-mono-num text-xl font-bold text-[#0B132B] mt-1">
                    {analyticsData.scoreDistribution?.from65To8 ?? 0}
                  </p>
                </div>
                <div className="bg-white border border-stone-200 rounded-xl p-4">
                  <p className="text-xs text-stone-500">Giỏi (8.0 – 10)</p>
                  <p className="font-mono-num text-xl font-bold text-emerald-700 mt-1">
                    {analyticsData.scoreDistribution?.from8To10 ?? 0}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#141B2D]">
                  Mức độ hoàn thành và tương tác 3D theo từng Bài học
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500">
                        <th className="py-2 pr-3">Bài học</th>
                        <th className="py-2 pr-3">Số HS hoàn thành</th>
                        <th className="py-2">Số HS đã khám phá 3D</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {analyticsData.lessonCompletions.map((lc) => (
                        <tr key={lc.lessonId}>
                          <td className="py-2 pr-3 font-medium">
                            Bài {lc.lessonNumber}: {lc.title}
                          </td>
                          <td className="py-2 pr-3 font-mono-num font-bold">{lc.completedCount}</td>
                          <td className="py-2 font-mono-num text-[#8B1E24] font-semibold">
                            {lc.explored3dCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 10. SURVEYS */}
          {currentPath === '/admin/khao-sat' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                Khảo sát Thực nghiệm Sư phạm Trước & Sau Tác động (Thang Likert 1–5)
              </h1>
              {adminSurveys.map((sv) => (
                <div key={sv.id} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-[#8B1E24]">
                        {sv.surveyPhase === 'pre' ? 'Trước tác động' : 'Sau tác động'} ·{' '}
                        <strong className="font-mono-num">{sv.responseCount} phiếu thực tế</strong>
                      </span>
                      <h2 className="font-display text-lg font-bold text-[#141B2D]">{sv.title}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/surveys/${sv.id}/toggle`, {
                          method: 'PATCH',
                        });
                        fetchActiveModuleData();
                      }}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold"
                    >
                      {sv.isActive ? 'Đang mở khảo sát (Nhấn để đóng)' : 'Đang đóng (Nhấn để mở)'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sv.averages.map((av, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-[#FAF7F0] border border-stone-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <span>
                          {idx + 1}. {av.question}
                        </span>
                        <span className="font-mono-num font-bold text-[#0B132B] shrink-0">
                          TB: {av.average !== null ? `${av.average} / 5.0` : 'Chưa có phiếu'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 11. AI ASSISTANT SETTINGS */}
          {currentPath === '/admin/tro-ly-ai' && (
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                Quản lý Học thuật Trợ lý SỬ GIA AI 11
              </h1>
              <div className="p-4 rounded-xl bg-[#FAF7F0] border border-stone-200 text-xs space-y-1">
                <p>
                  Trạng thái kết nối khóa máy chủ <code>GEMINI_API_KEY</code>:{' '}
                  <strong className={settingsData?.aiConfigured ? 'text-emerald-700' : 'text-[#8B1E24]'}>
                    {settingsData?.aiConfigured
                      ? 'Đã kích hoạt trên máy chủ'
                      : 'Chưa cấu hình khóa trên máy chủ (Đang dùng kho hướng dẫn nội bộ)'}
                  </strong>
                </p>
                <p className="text-stone-500">
                  Nguyên tắc bảo mật: Khóa API chỉ đọc từ biến môi trường máy chủ, tuyệt đối không gửi hay hiển thị ra trình duyệt.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Chỉ dẫn sư phạm bổ sung của Giáo viên cho Sử Gia AI 11:
                </label>
                <textarea
                  rows={4}
                  value={cmsAiNote}
                  onChange={(e) => setCmsAiNote(e.target.value)}
                  className="w-full p-3 rounded-xl border border-stone-300 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  const r = await apiFetch('/api/admin/settings/site', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ aiSystemNote: cmsAiNote }),
                  });
                  if (r.ok) {
                    notify('ok', 'Đã lưu chỉ dẫn sư phạm cho Sử Gia AI 11.');
                    refreshBootstrap();
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
              >
                Lưu cấu hình Sử Gia AI
              </button>
            </div>
          )}

          {/* 12. SYSTEM SETTINGS, ADMIN PASSWORD & BACKUP */}
          {currentPath === '/admin/cai-dat' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-[#141B2D]">
                Cài đặt Hệ thống, Đổi Mật khẩu Quản trị & Sao lưu Dữ liệu
              </h1>

              {/* CMS Config */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-base font-bold text-[#0B132B]">
                  Thông tin hiển thị Trang chủ & Học liệu
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Khẩu hiệu (Slogan)</label>
                    <input
                      type="text"
                      value={cmsSlogan}
                      onChange={(e) => setCmsSlogan(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Mô tả Banner Trang chủ</label>
                    <textarea
                      rows={2}
                      value={cmsBannerSubtitle}
                      onChange={(e) => setCmsBannerSubtitle(e.target.value)}
                      className="w-full p-3 rounded-lg border border-stone-300 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await apiFetch('/api/admin/settings/site', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ slogan: cmsSlogan, bannerSubtitle: cmsBannerSubtitle }),
                      });
                      if (r.ok) {
                        notify('ok', 'Đã cập nhật thông tin trang chủ.');
                        refreshBootstrap();
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
                  >
                    Lưu thông tin hiển thị
                  </button>
                </div>
              </div>

              {/* Admin Password Change */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await apiFetch('/api/auth/admin/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      currentPassword: curAdminPw,
                      newPassword: newAdminPw,
                      confirmPassword: confAdminPw,
                    }),
                  });
                  const d = await r.json();
                  if (!r.ok) {
                    notify('err', d.error || 'Không thể đổi mật khẩu.');
                    return;
                  }
                  setCurAdminPw('');
                  setNewAdminPw('');
                  setConfAdminPw('');
                  notify('ok', d.message || 'Đã đổi mật khẩu quản trị.');
                  await refreshAuth();
                }}
                className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-[#8B1E24]">
                  Đổi Mật khẩu Quản trị Giáo viên (Băm Argon2id)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="password"
                    required
                    value={curAdminPw}
                    onChange={(e) => setCurAdminPw(e.target.value)}
                    placeholder="Mật khẩu quản trị hiện tại"
                    className="px-3 py-2 rounded-lg border border-stone-300 text-xs"
                  />
                  <input
                    type="password"
                    required
                    value={newAdminPw}
                    onChange={(e) => setNewAdminPw(e.target.value)}
                    placeholder="Mật khẩu mạnh mới (≥ 8 ký tự)"
                    className="px-3 py-2 rounded-lg border border-stone-300 text-xs"
                  />
                  <input
                    type="password"
                    required
                    value={confAdminPw}
                    onChange={(e) => setConfAdminPw(e.target.value)}
                    placeholder="Xác nhận mật khẩu mới"
                    className="px-3 py-2 rounded-lg border border-stone-300 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#8B1E24] text-white text-xs font-bold"
                >
                  Cập nhật Mật khẩu Quản trị
                </button>
              </form>

              {/* Database Backup & Audit Logs */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#0B132B]">
                      Sao lưu Cơ sở dữ liệu & Nhật ký Hệ thống
                    </h2>
                    <p className="text-xs text-stone-500">
                      Tải bản sao lưu toàn bộ lớp học, danh sách học sinh, câu hỏi, đề thi và kết quả khảo sát (không kèm mật khẩu).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await downloadAuthenticatedFile(
                        '/api/admin/backup/export',
                        'lichsu11-backup.json',
                      );
                      if (!ok) notify('err', 'Không thể tải bản sao lưu lúc này.');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5 text-[#E6BE68]" /> Tải tệp Sao lưu JSON
                  </button>
                </div>

                {settingsData?.auditLogs && settingsData.auditLogs.length > 0 && (
                  <div className="pt-3 border-t border-stone-100 max-h-48 overflow-y-auto space-y-1.5 text-xs">
                    {settingsData.auditLogs.slice(0, 15).map((log) => (
                      <div key={log.id} className="flex justify-between gap-2 text-stone-600">
                        <span>
                          <strong>[{log.actor_role}]</strong> {log.action} — {log.details}
                        </span>
                        <span className="font-mono-num text-[11px] text-stone-400 shrink-0">
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
