import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Box,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Search,
  Target,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GlbMuseumViewer } from '../components/GlbMuseumViewer';
import { QuestionRenderer } from '../components/QuestionRenderer';
import type { PublicQuestion } from '../types';
import { apiFetch } from '../utils/authSession';

export function TopicsPage() {
  const { topics, lessons, models } = useApp();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
            Chương trình GDPT 2018 · Kết nối tri thức với cuộc sống
          </p>
          <h1 className="font-display text-3xl font-bold text-[#141B2D] mt-1">
            6 Chủ đề Học tập Lịch sử Lớp 11
          </h1>
        </div>
        <Link
          to="/bai-hoc"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-semibold hover:bg-[#162447]"
        >
          Tra cứu danh sách 13 bài học <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-8">
        {topics.map((topic, idx) => {
          const topicLessons = lessons.filter((l) => l.topicId === topic.id);
          return (
            <section
              key={topic.id}
              className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-5"
            >
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#8B1E24]">
                  Chủ đề {idx + 1} · <span className="font-mono-num">{topicLessons.length} bài học</span>
                </p>
                <h2 className="font-display text-2xl font-bold text-[#141B2D]">{topic.title}</h2>
                <p className="text-sm text-stone-600 leading-relaxed max-w-4xl">{topic.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {topicLessons.map((les) => {
                  const linkedModel =
                    models.find((m) => m.slug === les.content.modelSlug) ||
                    models.find((m) => m.lessonId === les.id);
                  return (
                    <div
                      key={les.id}
                      className="p-5 rounded-xl bg-[#FAF7F0] border border-stone-200 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-stone-500">
                          <span className="font-mono-num font-bold text-[#0B132B]">
                            Bài {les.lessonNumber}
                          </span>
                          {linkedModel && (
                            <span className="text-[#8B1E24] font-semibold">Có mô hình 3D GLB</span>
                          )}
                        </div>
                        <h3 className="font-display text-base font-bold text-[#141B2D] leading-snug">
                          {les.title}
                        </h3>
                        <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                          {les.content.summary}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-200/80">
                        <Link
                          to={`/bai-hoc/${les.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#0B132B] text-white text-xs font-semibold hover:bg-[#162447]"
                        >
                          Vào học 8 Tab <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        {linkedModel && (
                          <Link
                            to={`/kham-pha-3d/${linkedModel.slug}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#C89B3C] text-[#0B132B] bg-white text-xs font-semibold hover:bg-[#C89B3C]/15"
                          >
                            <Box className="w-3.5 h-3.5 text-[#8B1E24]" /> Khám phá 3D
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function LessonsListPage() {
  const { topics, lessons } = useApp();
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');

  const filtered = lessons.filter((l) => {
    if (selectedTopic && l.topicId !== selectedTopic) return false;
    if (
      keyword.trim() &&
      !`${l.lessonNumber} ${l.title} ${l.content.summary}`
        .toLowerCase()
        .includes(keyword.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
          Danh mục bài giảng chuẩn hóa
        </p>
        <h1 className="font-display text-3xl font-bold text-[#141B2D]">
          Toàn bộ 13 Bài học Lịch sử 11
        </h1>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo tên bài học, sự kiện, khái niệm..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
        </div>
        <select
          aria-label="Lọc theo chủ đề"
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm max-w-xs"
        >
          <option value="">Tất cả 6 Chủ đề</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((les) => {
          const tp = topics.find((t) => t.id === les.topicId);
          return (
            <Link
              key={les.id}
              to={`/bai-hoc/${les.id}`}
              className="group bg-white border border-stone-200 rounded-xl p-6 hover:border-[#0B132B] transition-colors flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <p className="text-xs text-stone-500">
                  <strong className="font-mono-num text-[#8B1E24]">Bài {les.lessonNumber}</strong>
                  {tp ? ` · ${tp.title}` : ''}
                </p>
                <h2 className="font-display text-lg font-bold text-[#141B2D] group-hover:text-[#8B1E24] transition-colors">
                  {les.title}
                </h2>
                <p className="text-xs text-stone-600 leading-relaxed">{les.content.summary}</p>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#0B132B] pt-2 border-t border-stone-100">
                <span>8 Tab học tập tương tác</span>
                <span className="inline-flex items-center gap-1">
                  Mở bài học <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const EIGHT_TABS = [
  { num: 1, label: '1. Mục tiêu' },
  { num: 2, label: '2. Khám phá kiến thức' },
  { num: 3, label: '3. Không gian lịch sử 3D' },
  { num: 4, label: '4. Dòng thời gian' },
  { num: 5, label: '5. Nhiệm vụ khám phá' },
  { num: 6, label: '6. Luyện tập' },
  { num: 7, label: '7. Vận dụng' },
  { num: 8, label: '8. Tự đánh giá' },
];

export function LessonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { lessons, topics, models, role } = useApp();

  const lesson =
    lessons.find((l) => l.id === id || `bai-${l.lessonNumber}` === id || String(l.lessonNumber) === id) ||
    lessons[0];

  const [tab, setTab] = useState<number>(1);
  const [practiceQuestions, setPracticeQuestions] = useState<PublicQuestion[]>([]);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, unknown>>({});
  const [practiceChecks, setPracticeChecks] = useState<
    Record<string, { isCorrect: boolean; awardedPoints: number; maxPoints: number; explanation: string }>
  >({});

  const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});
  const [selfChecks, setSelfChecks] = useState<Record<number, boolean>>({});
  const [noteText, setNoteText] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<string>('');

  useEffect(() => {
    setTab(1);
    setStatusBanner('');
    if (!lesson) return;
    apiFetch(`/api/public/questions?lessonId=${encodeURIComponent(lesson.id)}`)
      .then((r) => r.json())
      .then((d) => setPracticeQuestions(Array.isArray(d.questions) ? d.questions : []))
      .catch(() => setPracticeQuestions([]));
  }, [lesson?.id]);

  if (!lesson) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-sm text-stone-600">Đang tải nội dung bài học...</p>
      </div>
    );
  }

  const topic = topics.find((t) => t.id === lesson.topicId);
  const linkedModel =
    models.find((m) => m.slug === lesson.content.modelSlug) ||
    models.find((m) => m.lessonId === lesson.id) ||
    models[0];

  const handleCheckSingleQuestion = async (qId: string) => {
    const res = await apiFetch('/api/public/practice/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qId, answer: practiceAnswers[qId] }),
    });
    if (res.ok) {
      const json = await res.json();
      setPracticeChecks((prev) => ({ ...prev, [qId]: json }));
    }
  };

  const handleSaveProgress = async (percent: number, explored3d = false) => {
    if (role !== 'student') {
      setStatusBanner('Em đang ở chế độ Khách. Hãy đăng nhập Học sinh để lưu tiến độ bài học vào hồ sơ.');
      return;
    }
    const res = await apiFetch('/api/student/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId: lesson.id, progressPercent: percent, explored3d }),
    });
    if (res.ok) {
      setStatusBanner(
        percent >= 100
          ? `Đã ghi nhận hoàn thành Bài ${lesson.lessonNumber} vào hồ sơ học sinh!`
          : `Đã cập nhật tiến độ Bài ${lesson.lessonNumber} (${percent}%).`,
      );
    }
  };

  const handleSaveNote = async () => {
    if (role !== 'student') {
      setStatusBanner('Vui lòng đăng nhập tài khoản Học sinh để lưu sổ tay ghi chú.');
      return;
    }
    if (!noteText.trim()) return;
    const res = await apiFetch('/api/student/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId: lesson.id, noteText }),
    });
    if (res.ok) {
      setStatusBanner('Đã lưu ghi chú bài học vào sổ tay cá nhân.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Breadcrumb & Lesson Header */}
      <div className="bg-[#0B132B] text-[#FAF7F0] rounded-2xl p-6 sm:p-8 border border-[#C89B3C]/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#E6BE68]">
          <Link to="/chu-de" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại 6 Chủ đề
          </Link>
          <span>{topic?.title}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="font-mono-num text-xs uppercase tracking-wider text-slate-300">
              Bài học số {lesson.lessonNumber} / 13 · Phiên bản duyệt v{lesson.version}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold leading-snug">
              Bài {lesson.lessonNumber}: {lesson.title}
            </h1>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {linkedModel && (
              <Link
                to={`/kham-pha-3d/${linkedModel.slug}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold hover:bg-[#d8ab4c]"
              >
                <Box className="w-4 h-4" /> Mở Phòng Khám Phá 3D
              </Link>
            )}
            <button
              type="button"
              onClick={() => handleSaveProgress(100)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#162447] border border-white/20 text-white text-xs font-semibold hover:bg-[#1F315C]"
            >
              <CheckCircle2 className="w-4 h-4 text-[#E6BE68]" /> Đánh dấu hoàn thành bài
            </button>
          </div>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
          {statusBanner}
        </div>
      )}

      {/* 8 Pedagogical Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-stone-200">
        {EIGHT_TABS.map((t) => (
          <button
            key={t.num}
            type="button"
            onClick={() => setTab(t.num)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.num
                ? 'bg-[#0B132B] text-[#FAF7F0]'
                : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8">
        {/* TAB 1: OBJECTIVES */}
        {tab === 1 && (
          <div className="space-y-6">
            <h2 className="font-display text-xl font-bold text-[#141B2D] flex items-center gap-2">
              <Target className="w-5 h-5 text-[#8B1E24]" /> Yêu cầu cần đạt theo Chương trình GDPT 2018
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-2">
                <h3 className="text-sm font-bold text-[#0B132B]">1. Về kiến thức lịch sử</h3>
                <ul className="list-disc pl-4 space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  {(lesson.objectives.knowledge || []).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="p-5 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-2">
                <h3 className="text-sm font-bold text-[#0B132B]">2. Về năng lực đặc thù</h3>
                <ul className="list-disc pl-4 space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  {(lesson.objectives.competence || []).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="p-5 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-2">
                <h3 className="text-sm font-bold text-[#0B132B]">3. Về phẩm chất</h3>
                <ul className="list-disc pl-4 space-y-1.5 text-xs text-stone-700 leading-relaxed">
                  {(lesson.objectives.qualities || []).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CORE KNOWLEDGE */}
        {tab === 2 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h2 className="font-display text-xl font-bold text-[#141B2D]">Tổng quan nội dung cốt lõi</h2>
              <p className="text-sm text-stone-800 leading-relaxed">{lesson.content.summary}</p>
              {lesson.content.verificationNote && (
                <p className="text-xs text-stone-500 italic">
                  Ghi chú thẩm định sử liệu: {lesson.content.verificationNote}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-display text-lg font-bold text-[#141B2D]">Luận điểm trọng tâm</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(lesson.content.keyPoints || []).map((kp, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[#FAF7F0] border border-stone-200 text-sm text-stone-800 leading-relaxed">
                    <strong className="font-mono-num text-[#8B1E24] mr-2">0{i + 1}.</strong>
                    {kp}
                  </div>
                ))}
              </div>
            </div>

            {lesson.content.causeCourseOutcome && (
              <div className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#141B2D]">
                  Phân tích Nguyên nhân – Diễn biến – Kết quả – Ý nghĩa
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-stone-200 space-y-1">
                    <p className="text-xs font-bold uppercase text-[#8B1E24]">Nguyên nhân / Bối cảnh</p>
                    <p className="text-xs text-stone-700 leading-relaxed">{lesson.content.causeCourseOutcome.cause}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-stone-200 space-y-1">
                    <p className="text-xs font-bold uppercase text-[#0B132B]">Diễn biến chính</p>
                    <p className="text-xs text-stone-700 leading-relaxed">{lesson.content.causeCourseOutcome.course}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-stone-200 space-y-1">
                    <p className="text-xs font-bold uppercase text-[#0B132B]">Kết quả</p>
                    <p className="text-xs text-stone-700 leading-relaxed">{lesson.content.causeCourseOutcome.outcome}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-stone-200 space-y-1">
                    <p className="text-xs font-bold uppercase text-[#8B1E24]">Ý nghĩa lịch sử</p>
                    <p className="text-xs text-stone-700 leading-relaxed">
                      {lesson.content.causeCourseOutcome.significance}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Historical Figures & Primary Sources */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#141B2D]">Nhân vật & Thực thể lịch sử</h3>
                <div className="space-y-2.5">
                  {(lesson.content.figures || []).map((fig, i) => (
                    <div key={i} className="p-3.5 rounded-lg bg-[#FAF7F0] border border-stone-200">
                      <p className="text-sm font-bold text-[#0B132B]">
                        {fig.name} <span className="text-xs font-normal text-[#8B1E24]">· {fig.role}</span>
                      </p>
                      <p className="text-xs text-stone-600 mt-1">{fig.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#141B2D]">Tư liệu lịch sử gốc</h3>
                <div className="space-y-2.5">
                  {(lesson.content.primarySources || []).map((src, i) => (
                    <blockquote
                      key={i}
                      className="p-4 rounded-lg bg-[#FAF7F0] border border-stone-200 space-y-1.5"
                    >
                      <p className="text-xs italic text-stone-800 leading-relaxed">“{src.excerpt}”</p>
                      <footer className="text-[11px] font-medium text-stone-500">— {src.source}</footer>
                    </blockquote>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 3D HISTORICAL SPACE */}
        {tab === 3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-[#141B2D]">
                  Không gian Lịch sử 3D ({linkedModel?.modelName})
                </h2>
                <p className="text-xs text-stone-600">
                  Xoay mô hình .glb, chọn từng giai đoạn lịch sử hoặc mở toàn màn hình Phòng Khám Phá 3D.
                </p>
              </div>
              {linkedModel && (
                <Link
                  to={`/kham-pha-3d/${linkedModel.slug}`}
                  onClick={() => handleSaveProgress(60, true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-semibold"
                >
                  <Compass className="w-4 h-4 text-[#E6BE68]" /> Chuyển sang Phòng Khám Phá 5 Bước
                </Link>
              )}
            </div>
            {linkedModel && <GlbMuseumViewer model={linkedModel} heightClass="h-[500px]" />}
          </div>
        )}

        {/* TAB 4: LESSON TIMELINE */}
        {tab === 4 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-[#141B2D] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#8B1E24]" /> Trục Niên biểu Sự kiện trong bài
            </h2>
            <div className="space-y-3">
              {(lesson.content.timeline || []).map((ev, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-[#FAF7F0] border border-stone-200 flex flex-col sm:flex-row sm:items-baseline gap-3"
                >
                  <span className="font-mono-num text-sm font-bold text-[#8B1E24] sm:w-36 shrink-0">
                    {ev.year}
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[#141B2D]">{ev.event}</h3>
                    <p className="text-xs text-stone-600 leading-relaxed">{ev.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: EXPLORATION TASKS */}
        {tab === 5 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-[#141B2D]">Nhiệm vụ Khám phá Sử liệu</h2>
            <p className="text-xs text-stone-600">
              Thực hiện các nhiệm vụ tìm tòi dưới đây và đánh dấu khi em đã đối chiếu xong trên mô hình 3D hoặc SGK:
            </p>
            <div className="space-y-2.5">
              {(lesson.content.explorationTasks || []).map((task, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-3 p-4 rounded-xl bg-[#FAF7F0] border border-stone-200 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(checkedTasks[idx])}
                    onChange={(e) => {
                      const next = { ...checkedTasks, [idx]: e.target.checked };
                      setCheckedTasks(next);
                      handleSaveProgress(50);
                    }}
                    className="mt-1 accent-[#0B132B]"
                  />
                  <span className="text-sm text-stone-800 leading-relaxed">{task}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: PRACTICE */}
        {tab === 6 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-[#141B2D]">
                Câu hỏi Luyện tập Bài {lesson.lessonNumber}
              </h2>
              <Link to="/luyen-tap" className="text-xs font-semibold text-[#8B1E24] hover:underline">
                Mở ngân hàng luyện tập toàn khóa →
              </Link>
            </div>

            {practiceQuestions.length === 0 ? (
              <p className="text-xs text-stone-500">
                Đang cập nhật thêm câu hỏi riêng cho bài này. Em có thể luyện tập tổng hợp tại mục Luyện tập – Kiểm tra.
              </p>
            ) : (
              <div className="space-y-5">
                {practiceQuestions.map((q, idx) => {
                  const check = practiceChecks[q.id];
                  return (
                    <div key={q.id} className="space-y-2">
                      <QuestionRenderer
                        question={q}
                        index={idx}
                        value={practiceAnswers[q.id]}
                        onChange={(val) => setPracticeAnswers((prev) => ({ ...prev, [q.id]: val }))}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleCheckSingleQuestion(q.id)}
                          className="px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-semibold hover:bg-[#162447]"
                        >
                          Kiểm tra đáp án
                        </button>
                        {check && (
                          <div
                            className={`flex-1 p-3 rounded-lg text-xs ${
                              check.isCorrect
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                                : 'bg-amber-50 border border-amber-200 text-amber-900'
                            }`}
                          >
                            <strong>
                              {check.isCorrect ? 'Chính xác!' : 'Cần xem lại:'} ({check.awardedPoints}/
                              {check.maxPoints} điểm)
                            </strong>{' '}
                            — {check.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: APPLICATION & PERSONAL NOTE */}
        {tab === 7 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-bold text-[#141B2D] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#8B1E24]" /> Vận dụng & Sổ tay Ghi chú Cá nhân
            </h2>
            <div className="p-5 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-2">
              <p className="text-xs font-bold uppercase text-[#8B1E24]">Câu hỏi liên hệ thực tiễn</p>
              <p className="text-sm text-stone-800 leading-relaxed">{lesson.content.applicationPrompt}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700">
                Ghi chú cá nhân / Bài viết vận dụng của em cho Bài {lesson.lessonNumber}:
              </label>
              <textarea
                rows={5}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Ghi lại ý chính, lập luận vận dụng hoặc câu hỏi cần trao đổi trên lớp..."
                className="w-full p-3.5 rounded-xl border border-stone-300 text-sm"
              />
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-4 py-2.5 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
              >
                Lưu vào Sổ tay Học sinh
              </button>
            </div>
          </div>
        )}

        {/* TAB 8: SELF-ASSESSMENT */}
        {tab === 8 && (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-bold text-[#141B2D] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#0B132B]" /> Bảng Tự đánh giá Năng lực Sau bài học
            </h2>
            <div className="space-y-2.5">
              {(lesson.content.selfCheckGuide || []).map((criterion, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-3 p-4 rounded-xl bg-[#FAF7F0] border border-stone-200 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selfChecks[idx])}
                    onChange={(e) => setSelfChecks({ ...selfChecks, [idx]: e.target.checked })}
                    className="mt-1 accent-[#0B132B]"
                  />
                  <span className="text-sm text-stone-800">{criterion}</span>
                </label>
              ))}
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSaveProgress(100)}
                className="px-5 py-3 rounded-lg bg-[#C89B3C] text-[#0B132B] text-sm font-bold hover:bg-[#d8ab4c]"
              >
                Xác nhận Hoàn thành 100% Bài {lesson.lessonNumber}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
