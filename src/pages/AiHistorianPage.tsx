import React, { useState } from 'react';
import { BookOpen, MessageSquare, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/authSession';

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

const SUGGESTED_PROMPTS = [
  'Vì sao Ngô Quyền chọn cửa sông Bạch Đằng và thủy triều để đánh bại quân Nam Hán năm 938?',
  'So sánh điểm giống nhau giữa cải cách của Hồ Quý Ly và cải cách của vua Lê Thánh Tông.',
  'Ý nghĩa chiến lược của Biển Đông và bằng chứng lịch sử chủ quyền Việt Nam đối với Hoàng Sa, Trường Sa?',
  'Nguyên nhân nào giúp Vương quốc Xiêm giữ được độc lập trước sự xâm lược của thực dân phương Tây?',
];

export function AiHistorianPage() {
  const { aiConfigured, lessons } = useApp();
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: 'model',
      text: 'Xin chào! Thầy/Cô trợ giảng số SỬ GIA AI 11 sẵn sàng đồng hành cùng em ôn tập 6 chủ đề, 13 bài học Lịch sử lớp 11 (Kết nối tri thức với cuộc sống). Em muốn tìm hiểu sự kiện, nhân vật hay mô hình 3D nào hôm nay?',
    },
  ]);
  const [sending, setSending] = useState<boolean>(false);
  const [errorNote, setErrorNote] = useState<string>('');

  const sendQuestion = async (questionText: string) => {
    const clean = questionText.trim();
    if (!clean || sending) return;
    setErrorNote('');
    const nextHistory: ChatTurn[] = [...turns, { role: 'user', text: clean }];
    setTurns(nextHistory);
    setInput('');

    if (!aiConfigured) {
      // Built-in curriculum study response when server API key is unconfigured
      const matchedLesson =
        lessons.find((l) => l.id === selectedLessonId) ||
        lessons.find((l) =>
          clean
            .toLowerCase()
            .split(/\s+/)
            .some((w) => w.length > 3 && l.title.toLowerCase().includes(w)),
        ) ||
        lessons[6];

      const fallbackReply = matchedLesson
        ? `[Hướng dẫn từ kho học liệu chuẩn hóa – Bài ${matchedLesson.lessonNumber}: ${matchedLesson.title}]\n\n• Tóm tắt trọng tâm: ${matchedLesson.content.summary}\n• Diễn biến & Ý nghĩa: ${matchedLesson.content.causeCourseOutcome?.significance || matchedLesson.content.keyPoints[0] || ''}\n\nCâu hỏi gợi mở tư duy: Từ nội dung Bài ${matchedLesson.lessonNumber}, em hãy rút ra một bài học lịch sử còn nguyên giá trị đối với thế hệ trẻ hiện nay?`
        : 'Trợ lý AI hiện chưa được kích hoạt khóa máy chủ. Em vui lòng chọn bài học cụ thể ở thanh bên để tra cứu tóm tắt chuẩn SGK.';

      setTurns([...nextHistory, { role: 'model', text: fallbackReply }]);
      return;
    }

    setSending(true);
    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          history: turns.slice(-6),
          lessonId: selectedLessonId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorNote(data.error || 'Không thể nhận phản hồi lúc này.');
      } else if (data.answer) {
        setTurns([...nextHistory, { role: 'model', text: data.answer }]);
      }
    } catch {
      setErrorNote('Lỗi kết nối tới máy chủ Sử Gia AI 11.');
    } finally {
      setSending(false);
    }
  };

  const activeGuideLesson = lessons.find((l) => l.id === selectedLessonId) || lessons[6] || lessons[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Header with Vietnamese Historian Scholar Emblem */}
      <div className="bg-[#0B132B] text-[#FAF7F0] rounded-2xl p-6 sm:p-8 border border-[#C89B3C]/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          {/* Custom SVG Scholarly Scroll & Bronze Drum Star Emblem */}
          <div className="w-14 h-14 rounded-2xl bg-[#162447] border border-[#C89B3C] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 48 48" className="w-9 h-9" aria-hidden="true">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#C89B3C" strokeWidth="1.8" />
              <polygon
                points="24,8 27,19 38,19 29,25 32,36 24,29 16,36 19,25 10,19 21,19"
                fill="#E6BE68"
                opacity="0.9"
              />
              <circle cx="24" cy="24" r="4" fill="#0B132B" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#E6BE68]">
              Trợ giảng lịch sử số có kiểm soát học thuật
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">SỬ GIA AI 11</h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Giải thích sự kiện, tóm tắt bài học và gợi mở tư duy phản biện dựa trên kho nội dung Lịch sử 11 đã kiểm duyệt. Tuyệt đối không thu thập hay gửi dữ liệu cá nhân của học sinh.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <select
            aria-label="Chọn ngữ cảnh bài học cho Sử Gia AI"
            value={selectedLessonId}
            onChange={(e) => setSelectedLessonId(e.target.value)}
            className="px-3.5 py-2.5 rounded-lg bg-[#162447] border border-[#C89B3C]/50 text-xs text-white max-w-xs"
          >
            <option value="">Ngữ cảnh: Toàn bộ 13 bài học</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                Bài {l.lessonNumber}: {l.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Honest Server Key Status Banner when GEMINI_API_KEY is not configured */}
      {!aiConfigured && (
        <div
          data-testid="ai-unconfigured-banner"
          className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3"
        >
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Trợ lý AI chưa được kích hoạt</p>
            <p className="leading-relaxed">
              Máy chủ hiện chưa được cấu hình biến môi trường <code>GEMINI_API_KEY</code>. Hệ thống tự động chuyển sang chế độ{' '}
              <strong>Tra cứu Hướng dẫn Học tập Chuẩn hóa</strong> từ cơ sở dữ liệu SGK Lịch sử 11 bên dưới để đảm bảo việc ôn tập của học sinh không bị gián đoạn.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Chat Column */}
        <div className="lg:col-span-8 bg-white border border-stone-200 rounded-2xl flex flex-col h-[560px]">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <span className="text-xs font-bold text-[#0B132B] flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[#8B1E24]" /> Đối thoại học thuật Lịch sử 11
            </span>
            <span className="text-[11px] text-stone-500">Luôn đối chiếu SGK Kết nối tri thức</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {turns.map((t, i) => (
              <div
                key={i}
                className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    t.role === 'user'
                      ? 'bg-[#0B132B] text-[#FAF7F0]'
                      : 'bg-[#FAF7F0] border border-stone-200 text-stone-800'
                  }`}
                >
                  {t.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="text-xs text-stone-500 italic flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C89B3C]" /> Sử Gia AI 11 đang tra cứu học liệu...
              </div>
            )}
            {errorNote && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {errorNote}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="p-3.5 border-t border-stone-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Đặt câu hỏi về sự kiện, nhân vật, cải cách hoặc chủ quyền Biển Đông..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:border-[#0B132B]"
            />
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B132B] text-[#FAF7F0] text-xs font-bold hover:bg-[#162447] disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-[#E6BE68]" /> Gửi
            </button>
          </form>
        </div>

        {/* Right Suggested Prompts & Vetted Lesson Digest */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-display text-base font-bold text-[#141B2D]">Câu hỏi gợi ý ôn tập</h2>
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendQuestion(p)}
                  className="w-full text-left p-3 rounded-xl bg-[#FAF7F0] border border-stone-200 hover:border-[#0B132B] text-xs text-stone-800 leading-relaxed transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {activeGuideLesson && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#8B1E24]">
                <BookOpen className="w-4 h-4" /> Tóm tắt chuẩn Bài {activeGuideLesson.lessonNumber}
              </div>
              <h3 className="text-sm font-bold text-[#141B2D]">{activeGuideLesson.title}</h3>
              <p className="text-xs text-stone-600 leading-relaxed">{activeGuideLesson.content.summary}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
