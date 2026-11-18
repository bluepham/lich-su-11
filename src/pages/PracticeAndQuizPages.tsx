import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Flag,
  GraduationCap,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { QuestionRenderer } from '../components/QuestionRenderer';
import type { PublicQuestion } from '../types';
import { apiFetch } from '../utils/authSession';

export function PracticeBankPage() {
  const { lessons } = useApp();
  const [lessonFilter, setLessonFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [results, setResults] = useState<
    Record<
      string,
      {
        isCorrect: boolean;
        isManual: boolean;
        awardedPoints: number;
        maxPoints: number;
        explanation: string;
      }
    >
  >({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (lessonFilter) params.set('lessonId', lessonFilter);
    if (difficultyFilter) params.set('difficulty', difficultyFilter);
    apiFetch(`/api/public/questions?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setQuestions(Array.isArray(d.questions) ? d.questions : []))
      .finally(() => setLoading(false));
  }, [lessonFilter, difficultyFilter]);

  const checkAnswer = async (qId: string) => {
    const res = await apiFetch('/api/public/practice/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qId, answer: answers[qId] }),
    });
    if (res.ok) {
      const json = await res.json();
      setResults((prev) => ({ ...prev, [qId]: json }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
            Tự ôn luyện theo năng lực (8 dạng câu hỏi)
          </p>
          <h1 className="font-display text-3xl font-bold text-[#141B2D] mt-1">
            Ngân hàng Luyện tập Lịch sử 11
          </h1>
        </div>
        <Link
          to="/kiem-tra"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
        >
          <ClipboardList className="w-4 h-4 text-[#E6BE68]" /> Chuyển sang Thi trực tuyến tính giờ
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-600 shrink-0">
          <SlidersHorizontal className="w-4 h-4" /> Bộ lọc:
        </div>
        <select
          aria-label="Lọc câu hỏi theo bài học"
          value={lessonFilter}
          onChange={(e) => setLessonFilter(e.target.value)}
          className="w-full sm:w-auto flex-1 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
        >
          <option value="">Tất cả 13 bài học</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              Bài {l.lessonNumber}: {l.title}
            </option>
          ))}
        </select>

        <select
          aria-label="Lọc câu hỏi theo mức độ nhận thức"
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
          className="w-full sm:w-52 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
        >
          <option value="">Mọi mức độ nhận thức</option>
          <option value="nhan_biet">Nhận biết</option>
          <option value="thong_hieu">Thông hiểu</option>
          <option value="van_dung">Vận dụng</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500 py-8 text-center">Đang tải ngân hàng câu hỏi đã thẩm định...</p>
      ) : (
        <div className="space-y-5">
          {questions.map((q, idx) => {
            const res = results[q.id];
            return (
              <div key={q.id} className="space-y-2">
                <QuestionRenderer
                  question={q}
                  index={idx}
                  value={answers[q.id]}
                  onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => checkAnswer(q.id)}
                    className="px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-semibold hover:bg-[#162447]"
                  >
                    Đối chiếu đáp án & Giải thích
                  </button>
                  {res && (
                    <div
                      className={`flex-1 p-3 rounded-lg text-xs ${
                        res.isManual
                          ? 'bg-blue-50 border border-blue-200 text-blue-900'
                          : res.isCorrect
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                            : 'bg-amber-50 border border-amber-200 text-amber-900'
                      }`}
                    >
                      {res.isManual ? (
                        <span>
                          <strong>Câu tự luận mở:</strong> Giáo viên sẽ chấm theo Rubric trong đề kiểm tra. Gợi ý hướng
                          triển khai: {res.explanation}
                        </span>
                      ) : (
                        <span>
                          <strong>
                            {res.isCorrect ? 'Đúng hoàn toàn!' : 'Chưa trọn vẹn:'} ({res.awardedPoints}/
                            {res.maxPoints} điểm)
                          </strong>{' '}
                          — {res.explanation}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface QuizSummaryItem {
  id: string;
  title: string;
  lessonId: string | null;
  durationMinutes: number;
  openAt: string | null;
  closeAt: string | null;
  questionCount: number;
}

interface SubmittedDetailItem {
  questionId: string;
  content: string;
  questionType: string;
  awardedPoints: number;
  maxPoints: number;
  isCorrect: boolean;
  isManual: boolean;
  explanation: string;
}

export function OnlineExamPage() {
  const { role, student, refreshBootstrap } = useApp();
  const [quizzes, setQuizzes] = useState<QuizSummaryItem[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState<boolean>(false);

  // Active exam session state
  const [activeQuiz, setActiveQuiz] = useState<{
    id: string;
    title: string;
    durationMinutes: number;
  } | null>(null);
  const [examStartTime, setExamStartTime] = useState<string>('');
  const [examQuestions, setExamQuestions] = useState<PublicQuestion[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<string, unknown>>({});
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [examError, setExamError] = useState<string>('');

  const [submissionResult, setSubmissionResult] = useState<{
    attemptId: string;
    score: number;
    maxScore: number;
    gradingStatus: string;
    details: SubmittedDetailItem[];
  } | null>(null);

  useEffect(() => {
    if (role !== 'student') return;
    setLoadingQuizzes(true);
    apiFetch('/api/student/quizzes')
      .then((r) => r.json())
      .then((d) => setQuizzes(Array.isArray(d.quizzes) ? d.quizzes : []))
      .finally(() => setLoadingQuizzes(false));
  }, [role]);

  // Countdown timer during active exam
  useEffect(() => {
    if (!activeQuiz || submissionResult) return;
    if (secondsLeft <= 0) {
      handleSubmitExam();
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeQuiz, secondsLeft, submissionResult]);

  const startExam = async (quizId: string) => {
    setExamError('');
    setSubmissionResult(null);
    const res = await apiFetch(`/api/student/quizzes/${quizId}/start`);
    const data = await res.json();
    if (!res.ok) {
      setExamError(data.error || 'Không thể bắt đầu đề kiểm tra.');
      return;
    }
    setActiveQuiz(data.quiz);
    setExamStartTime(data.startTime);
    setExamQuestions(data.questions || []);
    setExamAnswers({});
    setFlaggedIds({});
    setSecondsLeft((data.quiz.durationMinutes || 15) * 60);
  };

  const handleSubmitExam = async () => {
    if (!activeQuiz || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/student/quizzes/${activeQuiz.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: examAnswers,
          startTime: examStartTime,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmissionResult(data);
        await refreshBootstrap();
      } else {
        setExamError(data.error || 'Lỗi nộp bài kiểm tra.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const answeredCount = examQuestions.filter((q) => {
    const v = examAnswers[q.id];
    if (v === undefined || v === null || v === '') return false;
    return true;
  }).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
            Đánh giá năng lực định kỳ & thường xuyên
          </p>
          <h1 className="font-display text-3xl font-bold text-[#141B2D] mt-1">
            Luyện tập & Kiểm tra Trực tuyến
          </h1>
        </div>
        <Link
          to="/luyen-tap"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-[#0B132B] hover:bg-stone-100"
        >
          Mở Ngân hàng Luyện tập tự do (không giới hạn giờ) →
        </Link>
      </div>

      {examError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800">
          {examError}
        </div>
      )}

      {/* Guest Notice */}
      {role !== 'student' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#0B132B] text-[#E6BE68] flex items-center justify-center mx-auto">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h2 className="font-display text-xl font-bold text-[#141B2D]">
            Đăng nhập Học sinh để làm Đề kiểm tra tính giờ & Lưu điểm
          </h2>
          <p className="text-sm text-stone-600 max-w-xl mx-auto leading-relaxed">
            Hệ thống kiểm tra trực tuyến sẽ ghi nhận điểm thực tế vào cơ sở dữ liệu theo lớp của em. Nếu muốn làm thử câu hỏi ngay không cần đăng nhập, em có thể vào Ngân hàng Luyện tập tự do.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/dang-nhap"
              className="px-5 py-2.5 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
            >
              Đăng nhập Học sinh
            </Link>
            <Link
              to="/dang-ky"
              className="px-5 py-2.5 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold hover:bg-[#d8ab4c]"
            >
              Tự đăng ký tài khoản
            </Link>
            <Link
              to="/luyen-tap"
              className="px-5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF7F0] text-stone-800 text-xs font-semibold"
            >
              Luyện tập tự do ngay
            </Link>
          </div>
        </div>
      )}

      {/* Logged-in Student: Quiz List */}
      {role === 'student' && !activeQuiz && (
        <div className="space-y-4">
          <p className="text-xs text-stone-600">
            Đề kiểm tra dành cho lớp <strong>{student?.className}</strong>:
          </p>
          {loadingQuizzes ? (
            <p className="text-sm text-stone-500 py-8 text-center">Đang tải danh sách đề kiểm tra...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {quizzes.map((qz) => (
                <div
                  key={qz.id}
                  data-testid={`quiz-card-${qz.id}`}
                  className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span className="font-mono-num font-semibold text-[#8B1E24]">
                        {qz.durationMinutes} phút
                      </span>
                      <span className="font-mono-num">{qz.questionCount} câu hỏi</span>
                    </div>
                    <h2 className="font-display text-lg font-bold text-[#141B2D]">{qz.title}</h2>
                  </div>

                  <button
                    type="button"
                    data-testid={`start-quiz-${qz.id}`}
                    onClick={() => startExam(qz.id)}
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-[#0B132B] text-[#FAF7F0] text-xs font-bold hover:bg-[#162447]"
                  >
                    <Play className="w-3.5 h-3.5 text-[#E6BE68]" /> Bắt đầu làm bài
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Timed Exam View */}
      {activeQuiz && !submissionResult && (
        <div className="space-y-6">
          {/* Sticky Exam Status Bar */}
          <div className="sticky top-16 z-30 bg-[#0B132B] text-[#FAF7F0] rounded-xl p-4 border border-[#C89B3C]/50 flex flex-wrap items-center justify-between gap-4 shadow-md">
            <div>
              <p className="text-sm font-bold text-[#FAF7F0]">{activeQuiz.title}</p>
              <p className="text-xs text-slate-300">
                Đã trả lời:{' '}
                <strong className="font-mono-num text-[#E6BE68]">
                  {answeredCount} / {examQuestions.length}
                </strong>{' '}
                câu · Đánh dấu xem lại:{' '}
                <strong className="font-mono-num">
                  {Object.values(flaggedIds).filter(Boolean).length}
                </strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3.5 py-1.5 rounded-lg bg-[#162447] border border-[#C89B3C]/40 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#E6BE68]" />
                <span className="font-mono-num text-sm font-bold text-white">
                  {formatCountdown(secondsLeft)}
                </span>
              </div>

              <button
                type="button"
                disabled={submitting}
                data-testid="submit-quiz-btn"
                onClick={handleSubmitExam}
                className="px-4 py-2 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold hover:bg-[#d8ab4c] disabled:opacity-50"
              >
                {submitting ? 'Đang nộp...' : 'NỘP BÀI KIỂM TRA'}
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {examQuestions.map((q, idx) => {
              const flagged = Boolean(flaggedIds[q.id]);
              return (
                <div key={q.id} className="space-y-1.5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setFlaggedIds((prev) => ({ ...prev, [q.id]: !flagged }))}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
                        flagged
                          ? 'bg-[#8B1E24] text-white'
                          : 'bg-stone-200/70 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      <Flag className="w-3 h-3" />
                      {flagged ? 'Đã đánh dấu xem lại' : 'Đánh dấu xem lại'}
                    </button>
                  </div>
                  <QuestionRenderer
                    question={q}
                    index={idx}
                    value={examAnswers[q.id]}
                    onChange={(val) => setExamAnswers((prev) => ({ ...prev, [q.id]: val }))}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitExam}
              className="px-6 py-3 rounded-xl bg-[#0B132B] text-white text-sm font-bold hover:bg-[#162447]"
            >
              Hoàn thành & Nộp bài kiểm tra
            </button>
          </div>
        </div>
      )}

      {/* Post-Submission Detailed Report */}
      {submissionResult && (
        <div data-testid="quiz-submission-result" className="space-y-6">
          <div className="bg-[#0B132B] text-[#FAF7F0] rounded-2xl p-7 border border-[#C89B3C] space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6BE68]">
              <CheckCircle2 className="w-4 h-4" /> ĐÃ GHI NHẬN BÀI LÀM VÀO CƠ SỞ DỮ LIỆU
            </div>
            <h2 className="font-display text-2xl font-bold">{activeQuiz?.title}</h2>
            <p className="text-lg">
              Điểm số đạt được:{' '}
              <strong data-testid="submitted-quiz-score" className="font-mono-num text-2xl text-[#E6BE68]">
                {submissionResult.score} / {submissionResult.maxScore}
              </strong>
            </p>
            <p className="text-xs text-slate-300">
              {submissionResult.gradingStatus === 'pending_manual'
                ? 'Lưu ý: Đề có câu hỏi Tự luận nên điểm hiện tại là điểm phần khách quan; Giáo viên sẽ chấm bổ sung câu Tự luận theo Rubric.'
                : 'Toàn bộ câu hỏi khách quan đã được chấm tự động và lưu vào Bảng điểm cá nhân.'}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveQuiz(null);
                  setSubmissionResult(null);
                }}
                className="px-4 py-2 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold"
              >
                Quay lại danh sách đề
              </button>
              <Link
                to="/ket-qua"
                className="px-4 py-2 rounded-lg bg-[#162447] border border-white/20 text-white text-xs font-semibold"
              >
                Xem Bảng điểm tích lũy
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-display text-lg font-bold text-[#141B2D]">
              Chi tiết đáp án & Hướng dẫn ôn tập sau kiểm tra
            </h3>
            {submissionResult.details.map((item, idx) => (
              <div key={item.questionId} className="bg-white border border-stone-200 rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0B132B]">Câu {idx + 1}</span>
                  <span
                    className={`font-mono-num font-bold ${
                      item.isManual
                        ? 'text-blue-700'
                        : item.isCorrect
                          ? 'text-emerald-700'
                          : 'text-[#8B1E24]'
                    }`}
                  >
                    {item.isManual
                      ? `Chờ chấm Rubric (tối đa ${item.maxPoints}đ)`
                      : `${item.awardedPoints} / ${item.maxPoints} điểm`}
                  </span>
                </div>
                <p className="text-sm font-medium text-stone-800">{item.content}</p>
                <p className="text-xs text-stone-600 bg-[#FAF7F0] p-3 rounded-lg border border-stone-200">
                  <strong>Giải thích sử liệu:</strong> {item.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
