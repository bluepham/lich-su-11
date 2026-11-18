import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Box, BookOpen } from 'lucide-react';
import type { PublicQuestion } from '../types';

interface QuestionRendererProps {
  question: PublicQuestion;
  index?: number;
  value: unknown;
  onChange: (nextVal: unknown) => void;
  disabled?: boolean;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: 'Trắc nghiệm 4 phương án',
  true_false: 'Đúng – Sai',
  short_answer: 'Trả lời ngắn',
  ordering: 'Sắp xếp sự kiện theo thời gian',
  matching: 'Ghép nối cặp lịch sử',
  essay: 'Tự luận (Chấm theo Rubric)',
  model_3d: 'Câu hỏi gắn Mô hình 3D',
  source_analysis: 'Đọc & Phân tích tư liệu lịch sử',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  nhan_biet: 'Nhận biết',
  thong_hieu: 'Thông hiểu',
  van_dung: 'Vận dụng',
};

export function QuestionRenderer({ question, index, value, onChange, disabled = false }: QuestionRendererProps) {
  const { questionType, promptData } = question;

  // Initialize ordering array if unset
  const currentOrder: string[] =
    Array.isArray(value) && value.length > 0
      ? (value as string[])
      : (promptData.items || []).map((it) => it.id);

  const moveOrderItem = (pos: number, dir: -1 | 1) => {
    const next = [...currentOrder];
    const target = pos + dir;
    if (target < 0 || target >= next.length) return;
    const tmp = next[pos];
    next[pos] = next[target];
    next[target] = tmp;
    onChange(next);
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
      {/* Clean unboxed metadata line */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <div>
          <span>{QUESTION_TYPE_LABELS[questionType] || questionType}</span>
          <span className="mx-2">·</span>
          <span>Mức độ: {DIFFICULTY_LABELS[question.difficulty] || question.difficulty}</span>
          <span className="mx-2">·</span>
          <span className="font-mono-num">{promptData.points} điểm</span>
        </div>
        {promptData.modelSlug && (
          <Link
            to={`/kham-pha-3d/${promptData.modelSlug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[#8B1E24] hover:underline font-medium"
          >
            <Box className="w-3.5 h-3.5" /> Mở không gian 3D liên quan
          </Link>
        )}
      </div>

      {/* Primary Historical Source Excerpt if source_analysis */}
      {promptData.sourceExcerpt && (
        <div className="bg-[#FAF7F0] border border-stone-200 rounded-lg p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8B1E24]">
            <BookOpen className="w-3.5 h-3.5" /> Tư liệu lịch sử gốc
          </div>
          <p className="text-sm italic text-stone-800 leading-relaxed">{promptData.sourceExcerpt}</p>
          {promptData.sourceCitation && (
            <p className="text-xs text-stone-500">— Nguồn: {promptData.sourceCitation}</p>
          )}
        </div>
      )}

      <h3 className="text-base font-semibold text-[#141B2D] leading-relaxed">
        {typeof index === 'number' ? `Câu ${index + 1}. ` : ''}
        {question.content}
      </h3>

      {/* 1. MCQ / Model 3D / Source Analysis */}
      {(questionType === 'mcq' || questionType === 'model_3d' || questionType === 'source_analysis') &&
        Array.isArray(promptData.options) && (
          <div className="space-y-2">
            {promptData.options.map((opt, optIdx) => {
              const selected = value === optIdx;
              const letter = String.fromCharCode(65 + optIdx);
              return (
                <label
                  key={optIdx}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected
                      ? 'border-[#0B132B] bg-[#0B132B]/5 font-medium'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange(optIdx)}
                    className="mt-1 accent-[#0B132B]"
                  />
                  <span className="text-sm text-stone-800">
                    <strong className="mr-1.5">{letter}.</strong>
                    {opt}
                  </span>
                </label>
              );
            })}
          </div>
        )}

      {/* 2. True / False (4 statements cluster or single boolean) */}
      {questionType === 'true_false' && (
        <div className="space-y-2.5">
          {Array.isArray(promptData.statements) && promptData.statements.length > 0 ? (
            promptData.statements.map((st, idx) => {
              const mapVal = (value && typeof value === 'object' ? (value as Record<string, boolean>) : {}) || {};
              const chosen = mapVal[st.id];
              return (
                <div
                  key={st.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-stone-200 bg-[#FAF7F0]/60"
                >
                  <p className="text-sm text-stone-800">
                    <strong className="mr-1.5">{String.fromCharCode(97 + idx)})</strong>
                    {st.text}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ ...mapVal, [st.id]: true })}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                        chosen === true
                          ? 'bg-[#0B132B] text-white border-[#0B132B]'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      Đúng
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ ...mapVal, [st.id]: false })}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                        chosen === false
                          ? 'bg-[#8B1E24] text-white border-[#8B1E24]'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      Sai
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  value === true ? 'bg-[#0B132B] text-white border-[#0B132B]' : 'bg-white border-stone-300'
                }`}
              >
                Đúng
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  value === false ? 'bg-[#8B1E24] text-white border-[#8B1E24]' : 'bg-white border-stone-300'
                }`}
              >
                Sai
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Short Answer */}
      {questionType === 'short_answer' && (
        <div>
          <label className="block text-xs text-stone-600 mb-1">Nhập câu trả lời ngắn gọn của em:</label>
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ví dụ: 1986 hoặc Bộ luật Hồng Đức..."
            className="w-full max-w-md px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:border-[#0B132B]"
          />
        </div>
      )}

      {/* 4. Chronological Ordering */}
      {questionType === 'ordering' && Array.isArray(promptData.items) && (
        <div className="space-y-2">
          <p className="text-xs text-stone-500">Sử dụng nút Lên / Xuống để sắp xếp các sự kiện theo đúng thứ tự thời gian từ sớm đến muộn:</p>
          {currentOrder.map((itemId, idx) => {
            const itemObj = promptData.items?.find((i) => i.id === itemId);
            if (!itemObj) return null;
            return (
              <div
                key={itemId}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-stone-200 bg-[#FAF7F0]"
              >
                <span className="text-sm text-stone-800">
                  <strong className="font-mono-num mr-2 text-[#8B1E24]">#{idx + 1}</strong>
                  {itemObj.text}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={disabled || idx === 0}
                    aria-label={`Chuyển sự kiện ${idx + 1} lên trên`}
                    onClick={() => moveOrderItem(idx, -1)}
                    className="p-1.5 rounded border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-40"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || idx === currentOrder.length - 1}
                    aria-label={`Chuyển sự kiện ${idx + 1} xuống dưới`}
                    onClick={() => moveOrderItem(idx, 1)}
                    className="p-1.5 rounded border border-stone-300 bg-white hover:bg-stone-100 disabled:opacity-40"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Matching Pairs */}
      {questionType === 'matching' &&
        Array.isArray(promptData.leftItems) &&
        Array.isArray(promptData.rightItems) && (
          <div className="space-y-2.5">
            {promptData.leftItems.map((left) => {
              const pairMap = (value && typeof value === 'object' ? (value as Record<string, string>) : {}) || {};
              return (
                <div
                  key={left.id}
                  className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-center p-3 rounded-lg border border-stone-200 bg-[#FAF7F0]/60"
                >
                  <div className="text-sm font-medium text-stone-800">{left.text}</div>
                  <select
                    aria-label={`Ghép nối cho ${left.text}`}
                    disabled={disabled}
                    value={pairMap[left.id] || ''}
                    onChange={(e) => onChange({ ...pairMap, [left.id]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
                  >
                    <option value="">— Chọn nội dung ghép tương ứng —</option>
                    {promptData.rightItems?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.text}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}

      {/* 6. Essay (Rubric-graded by teacher) */}
      {questionType === 'essay' && (
        <div className="space-y-3">
          {Array.isArray(promptData.rubric) && promptData.rubric.length > 0 && (
            <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-600 space-y-1">
              <p className="font-semibold text-stone-800">Tiêu chí chấm điểm (Rubric dành cho Giáo viên):</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {promptData.rubric.map((r, i) => (
                  <li key={i}>
                    {r.criterion} (<span className="font-mono-num">{r.maxPoints}đ</span>)
                  </li>
                ))}
              </ul>
            </div>
          )}
          <textarea
            rows={5}
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Trình bày lập luận lịch sử, dẫn chứng tư liệu và liên hệ thực tiễn của em tại đây..."
            className="w-full p-3.5 rounded-lg border border-stone-300 text-sm leading-relaxed focus:outline-none focus:border-[#0B132B]"
          />
        </div>
      )}
    </div>
  );
}
