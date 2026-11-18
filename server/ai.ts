import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { getDb } from './db.ts';

export function isGeminiConfigured(): boolean {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 12);
}

function createGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildApprovedCurriculumContext(lessonId?: string): string {
  const db = getDb();
  const rows = lessonId
    ? db
        .prepare(
          `SELECT lesson_number, title, approved_content FROM lessons WHERE publication_status = 'published' AND id = ?`,
        )
        .all(lessonId)
    : db
        .prepare(
          `SELECT lesson_number, title, approved_content FROM lessons WHERE publication_status = 'published' ORDER BY lesson_number ASC`,
        )
        .all();

  const typedRows = rows as { lesson_number: number; title: string; approved_content: string }[];
  return typedRows
    .map((r) => {
      try {
        const parsed = JSON.parse(r.approved_content) as {
          summary?: string;
          keyPoints?: string[];
          primarySources?: { excerpt: string; source: string }[];
        };
        const pts = (parsed.keyPoints || []).join(' | ');
        const srcs = (parsed.primarySources || [])
          .map((s) => `"${s.excerpt}" (${s.source})`)
          .join(' ; ');
        return `[Bài ${r.lesson_number} - ${r.title}] Tóm tắt: ${parsed.summary || ''}. Ý chính: ${pts}. Tư liệu gốc: ${srcs}`;
      } catch {
        return `[Bài ${r.lesson_number} - ${r.title}]`;
      }
    })
    .join('\n');
}

export async function askSuGiaAi(params: {
  message: string;
  history?: { role: 'user' | 'model'; text: string }[];
  lessonId?: string;
  adminNote?: string;
}): Promise<{ reply: string; citations: string[] }> {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_NOT_CONFIGURED');
  }

  const ai = createGeminiClient();
  const contextText = buildApprovedCurriculumContext(params.lessonId);

  const systemInstruction = `Bạn là SỬ GIA AI 11 – trợ lý học tập môn Lịch sử lớp 11 (Chương trình GDPT 2018, sách Kết nối tri thức với cuộc sống) của Trường THPT Hòa Minh, tỉnh Vĩnh Long.

QUY TẮC BẮT BUỘC:
1. Ưu tiên sử dụng kho tài liệu Lịch sử 11 đã được giáo viên phê duyệt dưới đây.
2. Nếu câu hỏi vượt ngoài tư liệu kiểm chứng hoặc chưa đủ căn cứ lịch sử, phải nêu rõ "Hiện tại kho học liệu đã duyệt chưa có đủ căn cứ xác thực cho chi tiết này" – TUYỆT ĐỐI không tự bịa niên đại, tên nhân vật, lời nói trực tiếp hay diễn biến lịch sử.
3. TUYỆT ĐỐI không khẳng định các chi tiết đồ họa trong mô hình 3D tái hiện là chứng cứ khảo cổ nguyên trạng; luôn giải thích mô hình 3D là phương tiện trực quan hỗ trợ hình dung không gian lịch sử.
4. Giúp học sinh phân biệt rõ giữa "Dữ kiện lịch sử" (năm tháng, sự kiện, văn bản gốc) và "Nhận định/Suy luận".
5. Trích dẫn tên Bài học (ví dụ: Theo Bài 7 – Chiến tranh bảo vệ Tổ quốc...) hoặc nguồn tư liệu khi giải thích.
6. Cuối câu trả lời, luôn đặt 1 câu hỏi gợi mở ngắn gọn để học sinh tự suy ngẫm sâu hơn.
7. Trình bày tiếng Việt chuẩn mực, súc tích, dễ đọc cho học sinh lớp 11.
${params.adminNote ? `Ghi chú bổ sung từ Giáo viên bộ môn: ${params.adminNote}` : ''}

KHO HỌC LIỆU LỊCH SỬ 11 ĐÃ PHÊ DUYỆT:
${contextText}`;

  const historyLines = (params.history || [])
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Học sinh' : 'Sử Gia AI 11'}: ${h.text}`)
    .join('\n');

  const fullPrompt = historyLines
    ? `Lịch sử trao đổi gần đây:\n${historyLines}\n\nCâu hỏi mới của học sinh: ${params.message}`
    : params.message;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: fullPrompt,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const reply = (response.text || '').trim();
  if (!reply) {
    throw new Error('Không nhận được phản hồi từ mô hình AI.');
  }

  const matchedLessons = Array.from(reply.matchAll(/Bài\s+(\d{1,2})/gi)).map((m) => `Bài ${m[1]} – SGK Lịch sử 11`);
  const citations = Array.from(new Set(matchedLessons));

  return { reply, citations };
}

export async function suggestEssayRubricFeedback(params: {
  questionContent: string;
  rubric: { criterion: string; maxPoints: number }[];
  studentAnswer: string;
}): Promise<{ suggestion: string }> {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_NOT_CONFIGURED');
  }

  const ai = createGeminiClient();
  const rubricText = params.rubric
    .map((r, i) => `${i + 1}. ${r.criterion} (Tối đa ${r.maxPoints} điểm)`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Câu hỏi tự luận: ${params.questionContent}\n\nHướng dẫn chấm (Rubric):\n${rubricText}\n\nBài làm của học sinh:\n"${params.studentAnswer}"\n\nHãy đưa ra gợi ý nhận xét khách quan theo từng tiêu chí Rubric để GIÁO VIÊN tham khảo (nêu rõ ý học sinh đã đạt, ý còn thiếu, và mức điểm tham khảo; nhấn mạnh quyền quyết định điểm số chính thức thuộc về Giáo viên).`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return {
    suggestion: (response.text || '').trim(),
  };
}
