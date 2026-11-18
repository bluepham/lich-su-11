import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Box,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gamepad2,
  KeyRound,
  Sparkles,
  TrendingUp,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/authSession';

interface DashboardData {
  progress: {
    lessonId: string;
    progressPercent: number;
    completionStatus: string;
    explored3d: boolean;
    updatedAt: string;
  }[];
  attempts: {
    id: string;
    quiz_id: string;
    quiz_title: string;
    lesson_id: string | null;
    score: number;
    max_score: number;
    submitted_at: string;
    grading_status: string;
  }[];
  notes: {
    id: string;
    lesson_id: string;
    note_text: string;
    updated_at: string;
  }[];
  badges: {
    badge_code: string;
    badge_title: string;
    badge_description: string;
    awarded_at: string;
  }[];
  gameHistory: {
    id: string;
    game_type: string;
    score: number;
    max_score: number;
    duration_seconds: number;
    created_at: string;
  }[];
  activeSurveys: {
    id: string;
    title: string;
    surveyPhase: string;
    questions: string[];
    completed: boolean;
  }[];
}

const GAME_NAMES: Record<string, string> = {
  timeline_mystery: 'Dòng thời gian bí ẩn',
  who_is_historian: 'Ai là sử gia?',
  history_puzzle: 'Ghép mảnh lịch sử',
  map_decode: 'Giải mã bản đồ',
  evidence_hunt: 'Truy tìm chứng cứ',
  challenge_journey: 'Hành trình vượt thử thách',
};

export function StudentPortalPage() {
  const { role, student, topics, lessons, refreshAuth } = useApp();
  const location = useLocation();

  const initialTab =
    location.pathname === '/ket-qua'
      ? 'results'
      : location.pathname === '/ho-so'
        ? 'profile'
        : 'overview';

  const [activeTab, setActiveTab] = useState<'overview' | 'results' | 'surveys' | 'profile'>(initialTab);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Survey state
  const [surveyRatings, setSurveyRatings] = useState<Record<string, number[]>>({});
  const [surveyComments, setSurveyComments] = useState<Record<string, string>>({});
  const [surveyFeedback, setSurveyFeedback] = useState<string>('');

  useEffect(() => {
    if (location.pathname === '/ket-qua') setActiveTab('results');
    else if (location.pathname === '/ho-so') setActiveTab('profile');
    else setActiveTab('overview');
  }, [location.pathname]);

  const loadDashboard = useCallback(async () => {
    if (role !== 'student') {
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    try {
      const res = await apiFetch('/api/student/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoadingData(false);
    }
  }, [role]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (role !== 'student' || !student) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-[#141B2D]">Khu vực Học tập Cá nhân</h1>
        <p className="text-sm text-stone-600">
          Vui lòng đăng nhập tài khoản học sinh để theo dõi tiến độ 13 bài học, điểm kiểm tra và huy hiệu khám phá 3D.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/dang-nhap"
            className="px-5 py-2.5 rounded-lg bg-[#0B132B] text-white text-sm font-semibold"
          >
            Đăng nhập Học sinh
          </Link>
          <Link
            to="/dang-ky"
            className="px-5 py-2.5 rounded-lg border border-stone-300 bg-white text-stone-800 text-sm font-semibold"
          >
            Đăng ký mới
          </Link>
        </div>
      </div>
    );
  }

  const completedLessonIds = new Set(
    (data?.progress || [])
      .filter((p) => p.completionStatus === 'completed' || p.progressPercent >= 100)
      .map((p) => p.lessonId),
  );
  const completedCount = completedLessonIds.size;
  const explored3dCount = (data?.progress || []).filter((p) => p.explored3d).length;
  const attempts = data?.attempts || [];
  const avgQuizScore =
    attempts.length > 0
      ? (attempts.reduce((acc, a) => acc + a.score, 0) / attempts.length).toFixed(2)
      : null;

  const recommendedLessons = lessons.filter((l) => !completedLessonIds.has(l.id)).slice(0, 3);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    const res = await apiFetch('/api/auth/student/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPwMsg({ type: 'err', text: json.error || 'Không thể đổi mật khẩu.' });
      return;
    }
    setPwMsg({ type: 'ok', text: json.message || 'Đổi mật khẩu thành công.' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    await refreshAuth();
  };

  const handleSubmitSurvey = async (surveyId: string, questionCount: number) => {
    const ratings = surveyRatings[surveyId] || Array(questionCount).fill(5);
    const comment = surveyComments[surveyId] || '';
    const res = await apiFetch(`/api/student/surveys/${surveyId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ratings, comment }),
    });
    if (res.ok) {
      setSurveyFeedback('Đã ghi nhận phiếu khảo sát của em vào cơ sở dữ liệu.');
      await loadDashboard();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Mandatory Student Welcome Banner */}
      <div
        data-testid="student-welcome-banner"
        className="bg-[#0B132B] text-[#FAF7F0] rounded-2xl p-6 sm:p-7 border border-[#C89B3C]/40 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#E6BE68]">
            Hồ sơ học tập trực tuyến
          </p>
          <h1 className="font-display text-xl sm:text-2xl font-bold">
            Chào mừng {student.fullName} – Lớp {student.className} đến với LỊCH SỬ 11 3D.
          </h1>
          <p className="text-xs text-slate-300">
            Tên đăng nhập: <strong className="text-white">{student.username}</strong> · Trạng thái: Đang hoạt động
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/kiem-tra"
            className="px-4 py-2 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold hover:bg-[#d8ab4c]"
          >
            Làm đề kiểm tra
          </Link>
          <Link
            to="/thu-vien-3d"
            className="px-4 py-2 rounded-lg bg-[#162447] border border-white/20 text-white text-xs font-semibold hover:bg-[#1F315C]"
          >
            Khám phá 3D
          </Link>
        </div>
      </div>

      {student.mustChangePassword && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm flex items-center justify-between gap-3">
          <span>
            Giáo viên vừa cấp mật khẩu tạm thời cho tài khoản của em. Vui lòng vào mục <strong>Hồ sơ & Mật khẩu</strong> để đổi sang mật khẩu cá nhân mới.
          </span>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="px-3 py-1.5 rounded bg-amber-800 text-white text-xs font-semibold shrink-0"
          >
            Đổi ngay
          </button>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-3">
        {[
          { key: 'overview', label: 'Tổng quan & Tiến độ', to: '/dashboard', icon: TrendingUp },
          { key: 'results', label: 'Bảng điểm & Lịch sử làm bài', to: '/ket-qua', icon: ClipboardCheck },
          { key: 'surveys', label: 'Khảo sát sáng kiến (1–5)', to: '/dashboard', icon: Sparkles },
          { key: 'profile', label: 'Hồ sơ & Đổi mật khẩu', to: '/ho-so', icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                active
                  ? 'bg-[#0B132B] text-white'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loadingData ? (
        <div className="py-12 text-center text-sm text-stone-500">Đang đồng bộ dữ liệu học tập từ máy chủ...</div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 4 Key Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-stone-500">Tiến độ chương trình</p>
                  <p className="font-mono-num text-2xl font-bold text-[#0B132B] mt-1">
                    {completedCount} / {lessons.length || 13}
                  </p>
                  <p className="text-xs text-stone-500 mt-1">Bài học đã hoàn thành</p>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-stone-500">Không gian 3D đã trải nghiệm</p>
                  <p className="font-mono-num text-2xl font-bold text-[#8B1E24] mt-1">{explored3dCount}</p>
                  <p className="text-xs text-stone-500 mt-1">Mô hình GLB tương tác</p>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-stone-500">Điểm trung bình kiểm tra</p>
                  <p className="font-mono-num text-2xl font-bold text-[#0B132B] mt-1">
                    {avgQuizScore ?? '—'}
                  </p>
                  <p className="text-xs text-stone-500 mt-1">
                    Trên <span className="font-mono-num">{attempts.length}</span> bài đã nộp
                  </p>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-xs text-stone-500">Huy hiệu đạt được</p>
                  <p className="font-mono-num text-2xl font-bold text-[#C89B3C] mt-1">
                    {data?.badges.length || 0} / 4
                  </p>
                  <p className="text-xs text-stone-500 mt-1">Danh hiệu nhà sử học trẻ</p>
                </div>
              </div>

              {/* Charts Row: Topic Completion & Score Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Topic Progress Chart */}
                <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[#141B2D]">
                    Biểu đồ hoàn thành theo 6 Chủ đề
                  </h2>
                  <div className="space-y-3">
                    {topics.map((tp) => {
                      const tpLessons = lessons.filter((l) => l.topicId === tp.id);
                      const doneInTopic = tpLessons.filter((l) => completedLessonIds.has(l.id)).length;
                      const pct = tpLessons.length > 0 ? Math.round((doneInTopic / tpLessons.length) * 100) : 0;
                      return (
                        <div key={tp.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-stone-700 truncate max-w-[75%]">
                              {tp.title}
                            </span>
                            <span className="font-mono-num font-semibold text-[#0B132B]">
                              {doneInTopic}/{tpLessons.length} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0B132B] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quiz Scores Over Time SVG Chart */}
                <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[#141B2D]">
                    Biểu đồ diễn biến điểm kiểm tra (Thang 10)
                  </h2>
                  {attempts.length === 0 ? (
                    <div className="h-48 rounded-lg bg-[#FAF7F0] border border-stone-200 flex flex-col items-center justify-center p-4 text-center">
                      <p className="text-xs text-stone-600 mb-2">
                        Em chưa nộp bài kiểm tra nào. Hãy thực hiện bài kiểm tra đầu tiên để hệ thống vẽ biểu đồ tiến bộ thực tế.
                      </p>
                      <Link
                        to="/kiem-tra"
                        className="px-3.5 py-1.5 rounded bg-[#0B132B] text-white text-xs font-semibold"
                      >
                        Đến khu Kiểm tra
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <svg viewBox="0 0 420 170" className="w-full h-44 bg-[#FAF7F0] rounded-lg border border-stone-200 p-2">
                        {[0, 2.5, 5, 7.5, 10].map((mark) => {
                          const y = 145 - (mark / 10) * 120;
                          return (
                            <g key={mark}>
                              <line x1="36" y1={y} x2="400" y2={y} stroke="#e5e0d5" strokeDasharray="3 3" />
                              <text x="8" y={y + 3} fontSize="9" fill="#6b7280">
                                {mark}đ
                              </text>
                            </g>
                          );
                        })}
                        {(() => {
                          const chronological = [...attempts].reverse().slice(-8);
                          const step = chronological.length > 1 ? 340 / (chronological.length - 1) : 0;
                          const pts = chronological.map((a, i) => ({
                            x: 48 + i * step,
                            y: 145 - (Math.min(10, Math.max(0, a.score)) / 10) * 120,
                            score: a.score,
                            label: `Lần ${i + 1}`,
                          }));
                          const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
                          return (
                            <>
                              {pts.length > 1 && (
                                <polyline fill="none" stroke="#8B1E24" strokeWidth="2.5" points={poly} />
                              )}
                              {pts.map((p, idx) => (
                                <g key={idx}>
                                  <circle cx={p.x} cy={p.y} r="4.5" fill="#0B132B" stroke="#C89B3C" strokeWidth="1.5" />
                                  <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0B132B">
                                    {p.score}
                                  </text>
                                  <text x={p.x} y="162" textAnchor="middle" fontSize="9" fill="#57534e">
                                    {p.label}
                                  </text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Badges & Study Recommendations */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[#141B2D] flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#C89B3C]" /> Huy hiệu thành tích lịch sử
                  </h2>
                  {data?.badges && data.badges.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {data.badges.map((b) => (
                        <div key={b.badge_code} className="p-3.5 rounded-lg bg-[#FAF7F0] border border-[#C89B3C]/50">
                          <p className="text-sm font-bold text-[#0B132B]">{b.badge_title}</p>
                          <p className="text-xs text-stone-600 mt-1">{b.badge_description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Hoàn thành quy trình 5 bước trong <strong>Phòng Khám Phá 3D</strong>, giải mã bản đồ đạt ≥ 80% hoặc đạt ≥ 8.0 điểm kiểm tra để mở khóa 4 huy hiệu danh giá (<em>Nhà khám phá lịch sử</em>, <em>Chuyên gia bản đồ</em>, <em>Người giải mã sự kiện</em>, <em>Nhà nghiên cứu trẻ</em>).
                    </p>
                  )}
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[#141B2D] flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#8B1E24]" /> Đề xuất bài học cần ưu tiên
                  </h2>
                  {recommendedLessons.length === 0 ? (
                    <p className="text-sm text-emerald-700 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Xuất sắc! Em đã hoàn thành toàn bộ 13 bài học Lịch sử 11.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recommendedLessons.map((l) => (
                        <Link
                          key={l.id}
                          to={`/bai-hoc/${l.id}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#FAF7F0] border border-stone-200 hover:border-[#0B132B] text-xs font-medium"
                        >
                          <span>
                            <strong>Bài {l.lessonNumber}:</strong> {l.title}
                          </span>
                          <span className="text-[#8B1E24] font-semibold shrink-0 ml-2">Học ngay →</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Lesson Notes */}
              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-3">
                <h2 className="font-display text-lg font-bold text-[#141B2D] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0B132B]" /> Sổ tay ghi chú lịch sử của em
                </h2>
                {data?.notes && data.notes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.notes.map((n) => {
                      const les = lessons.find((l) => l.id === n.lesson_id);
                      return (
                        <div key={n.id} className="p-3.5 rounded-lg bg-[#FAF7F0] border border-stone-200 space-y-1">
                          <Link
                            to={`/bai-hoc/${n.lesson_id}`}
                            className="text-xs font-bold text-[#8B1E24] hover:underline"
                          >
                            {les ? `Bài ${les.lessonNumber}: ${les.title}` : n.lesson_id}
                          </Link>
                          <p className="text-xs text-stone-700 whitespace-pre-line">{n.note_text}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500">
                    Em chưa lưu ghi chú nào. Trong mỗi bài học luôn có ô Sổ tay cá nhân để em ghi lại mốc sự kiện quan trọng.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RESULTS & GAME SCORES */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#141B2D]">
                  Lịch sử bài kiểm tra đã nộp ({attempts.length})
                </h2>
                {attempts.length === 0 ? (
                  <p className="text-xs text-stone-500">Chưa có bài kiểm tra nào được nộp.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-500">
                          <th className="py-2.5 pr-4">Đề kiểm tra</th>
                          <th className="py-2.5 pr-4">Điểm số (Thang 10)</th>
                          <th className="py-2.5 pr-4">Trạng thái chấm</th>
                          <th className="py-2.5">Thời gian nộp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {attempts.map((a) => (
                          <tr key={a.id} data-testid="student-quiz-attempt-row">
                            <td className="py-3 pr-4 font-semibold text-[#141B2D]">{a.quiz_title}</td>
                            <td className="py-3 pr-4 font-mono-num font-bold text-[#8B1E24]">
                              {a.score} / {a.max_score}
                            </td>
                            <td className="py-3 pr-4">
                              {a.grading_status === 'graded'
                                ? 'Đã chấm hoàn tất'
                                : 'Đang chờ GV chấm tự luận'}
                            </td>
                            <td className="py-3 font-mono-num text-stone-500">
                              {new Date(a.submitted_at).toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#141B2D] flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-[#0B132B]" /> Kết quả Đấu Trường Lịch Sử 11
                </h2>
                {data?.gameHistory && data.gameHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-500">
                          <th className="py-2 pr-4">Trò chơi</th>
                          <th className="py-2 pr-4">Điểm đạt được</th>
                          <th className="py-2 pr-4">Thời gian hoàn thành</th>
                          <th className="py-2">Ngày chơi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {data.gameHistory.map((g) => (
                          <tr key={g.id}>
                            <td className="py-2.5 pr-4 font-medium text-stone-800">
                              {GAME_NAMES[g.game_type] || g.game_type}
                            </td>
                            <td className="py-2.5 pr-4 font-mono-num font-semibold text-[#0B132B]">
                              {g.score} / {g.max_score}
                            </td>
                            <td className="py-2.5 pr-4 font-mono-num text-stone-600">{g.duration_seconds}s</td>
                            <td className="py-2.5 font-mono-num text-stone-500">
                              {new Date(g.created_at).toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-stone-500">Chưa có lượt chơi nào được lưu.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PRE/POST SURVEYS */}
          {activeTab === 'surveys' && (
            <div className="space-y-6">
              {surveyFeedback && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
                  {surveyFeedback}
                </div>
              )}
              {(data?.activeSurveys || []).map((sv) => {
                const currentRatings = surveyRatings[sv.id] || Array(sv.questions.length).fill(5);
                return (
                  <div key={sv.id} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-[#8B1E24]">
                          {sv.surveyPhase === 'pre' ? 'Khảo sát Trước tác động' : 'Khảo sát Sau tác động'}
                        </span>
                        <h3 className="font-display text-lg font-bold text-[#141B2D]">{sv.title}</h3>
                      </div>
                      {sv.completed && (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Đã gửi phản hồi
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {sv.questions.map((qText, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-lg bg-[#FAF7F0] border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <p className="text-xs font-medium text-stone-800">
                            {idx + 1}. {qText}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {[1, 2, 3, 4, 5].map((scoreVal) => (
                              <button
                                key={scoreVal}
                                type="button"
                                onClick={() => {
                                  const copy = [...currentRatings];
                                  copy[idx] = scoreVal;
                                  setSurveyRatings({ ...surveyRatings, [sv.id]: copy });
                                }}
                                className={`w-8 h-8 rounded font-mono-num text-xs font-bold border ${
                                  currentRatings[idx] === scoreVal
                                    ? 'bg-[#0B132B] text-white border-[#0B132B]'
                                    : 'bg-white text-stone-700 border-stone-300'
                                }`}
                              >
                                {scoreVal}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Ý kiến đóng góp thêm của em (tùy chọn):
                      </label>
                      <textarea
                        rows={2}
                        value={surveyComments[sv.id] || ''}
                        onChange={(e) => setSurveyComments({ ...surveyComments, [sv.id]: e.target.value })}
                        placeholder="Cảm nhận của em sau khi học với mô hình 3D..."
                        className="w-full p-3 rounded-lg border border-stone-300 text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSubmitSurvey(sv.id, sv.questions.length)}
                      className="px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
                    >
                      {sv.completed ? 'Cập nhật lại phiếu khảo sát' : 'Gửi phiếu khảo sát'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: PROFILE & PASSWORD */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-3">
                <h2 className="font-display text-lg font-bold text-[#141B2D]">Thông tin hồ sơ học sinh</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <dt className="text-stone-500">Họ và tên:</dt>
                    <dd className="font-semibold text-[#141B2D]">{student.fullName}</dd>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <dt className="text-stone-500">Lớp:</dt>
                    <dd className="font-semibold text-[#141B2D]">{student.className}</dd>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <dt className="text-stone-500">Tên đăng nhập:</dt>
                    <dd className="font-mono-num font-semibold text-[#141B2D]">{student.username}</dd>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <dt className="text-stone-500">Ngày tham gia:</dt>
                    <dd className="font-mono-num text-xs text-stone-700">
                      {new Date(student.createdAt).toLocaleDateString('vi-VN')}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#141B2D] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#8B1E24]" /> Đổi mật khẩu bảo mật
                </h2>
                {pwMsg && (
                  <div
                    className={`p-3 rounded-lg text-xs font-medium ${
                      pwMsg.type === 'ok'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {pwMsg.text}
                  </div>
                )}
                <form onSubmit={handlePasswordChange} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Mật khẩu mới (≥ 6 ký tự)</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
                  >
                    Lưu mật khẩu mới
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
