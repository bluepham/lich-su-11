export type QuestionType =
  | 'mcq'
  | 'true_false'
  | 'short_answer'
  | 'ordering'
  | 'matching'
  | 'essay'
  | 'model_3d'
  | 'source_analysis';

export interface QuestionAnswerSpec {
  options?: string[];
  correctIndex?: number;
  statements?: { id: string; text: string; correct: boolean }[];
  correctBoolean?: boolean;
  acceptedAnswers?: string[];
  items?: { id: string; text: string }[];
  correctOrder?: string[];
  leftItems?: { id: string; text: string }[];
  rightItems?: { id: string; text: string }[];
  correctPairs?: Record<string, string>;
  rubric?: { criterion: string; maxPoints: number }[];
  sourceExcerpt?: string;
  sourceCitation?: string;
  modelSlug?: string;
  points?: number;
}

export interface GradeSingleResult {
  awardedPoints: number;
  maxPoints: number;
  isManual: boolean;
  isCorrect: boolean;
}

export function normalizeShortText(val: string): string {
  return (val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/g, '');
}

export function gradeQuestionAnswer(
  questionType: QuestionType,
  spec: QuestionAnswerSpec,
  studentAnswer: unknown,
): GradeSingleResult {
  const maxPoints = typeof spec.points === 'number' && spec.points > 0 ? spec.points : 1;

  if (questionType === 'essay') {
    return {
      awardedPoints: 0,
      maxPoints,
      isManual: true,
      isCorrect: false,
    };
  }

  if (questionType === 'mcq' || questionType === 'model_3d' || questionType === 'source_analysis') {
    const chosen = typeof studentAnswer === 'number' ? studentAnswer : Number(studentAnswer);
    const isCorrect = Number.isInteger(chosen) && chosen === spec.correctIndex;
    return {
      awardedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      isManual: false,
      isCorrect,
    };
  }

  if (questionType === 'true_false') {
    if (Array.isArray(spec.statements) && spec.statements.length > 0) {
      const ansMap =
        studentAnswer && typeof studentAnswer === 'object'
          ? (studentAnswer as Record<string, boolean>)
          : {};
      let rightCount = 0;
      for (const st of spec.statements) {
        if (typeof ansMap[st.id] === 'boolean' && ansMap[st.id] === st.correct) {
          rightCount++;
        }
      }
      const total = spec.statements.length;
      let ratio = rightCount / total;
      if (total === 4) {
        const gdptScale = [0, 0.1, 0.25, 0.5, 1];
        ratio = gdptScale[rightCount] ?? 0;
      }
      const awarded = Number((maxPoints * ratio).toFixed(2));
      return {
        awardedPoints: awarded,
        maxPoints,
        isManual: false,
        isCorrect: rightCount === total,
      };
    }
    const boolVal = studentAnswer === true || studentAnswer === 'true';
    const isCorrect = boolVal === Boolean(spec.correctBoolean);
    return {
      awardedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      isManual: false,
      isCorrect,
    };
  }

  if (questionType === 'short_answer') {
    const normalized = normalizeShortText(String(studentAnswer ?? ''));
    const accepted = (spec.acceptedAnswers || []).map(normalizeShortText);
    const isCorrect = normalized.length > 0 && accepted.includes(normalized);
    return {
      awardedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      isManual: false,
      isCorrect,
    };
  }

  if (questionType === 'ordering') {
    const submittedOrder = Array.isArray(studentAnswer) ? studentAnswer.map(String) : [];
    const expected = spec.correctOrder || [];
    const isCorrect =
      expected.length > 0 &&
      submittedOrder.length === expected.length &&
      expected.every((id, idx) => submittedOrder[idx] === id);
    return {
      awardedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      isManual: false,
      isCorrect,
    };
  }

  if (questionType === 'matching') {
    const submittedPairs =
      studentAnswer && typeof studentAnswer === 'object'
        ? (studentAnswer as Record<string, string>)
        : {};
    const expectedPairs = spec.correctPairs || {};
    const keys = Object.keys(expectedPairs);
    if (keys.length === 0) {
      return { awardedPoints: 0, maxPoints, isManual: false, isCorrect: false };
    }
    let matched = 0;
    for (const k of keys) {
      if (submittedPairs[k] === expectedPairs[k]) {
        matched++;
      }
    }
    const awarded = Number(((matched / keys.length) * maxPoints).toFixed(2));
    return {
      awardedPoints: awarded,
      maxPoints,
      isManual: false,
      isCorrect: matched === keys.length,
    };
  }

  return { awardedPoints: 0, maxPoints, isManual: false, isCorrect: false };
}

export interface BadgeEligibilityStats {
  explored3dCount: number;
  completedLessonsCount: number;
  mapGameHighScores: number;
  quizHighScores: number;
  completedExplorationWorkflows: number;
}

export interface BadgeDefinition {
  code: string;
  title: string;
  description: string;
}

export const ALL_BADGES: BadgeDefinition[] = [
  {
    code: 'nha_kham_pha_lich_su',
    title: 'Nhà khám phá lịch sử',
    description: 'Hoàn thành quy trình khám phá 5 bước tại ít nhất 1 không gian bảo tàng lịch sử 3D.',
  },
  {
    code: 'chuyen_gia_ban_do',
    title: 'Chuyên gia bản đồ',
    description: 'Đạt từ 80% điểm trở lên trong trò chơi Giải mã bản đồ hoặc khám phá bản đồ 3D.',
  },
  {
    code: 'nguoi_giai_ma_su_kien',
    title: 'Người giải mã sự kiện',
    description: 'Hoàn thành bài kiểm tra lịch sử với kết quả đạt từ 8.0/10 điểm trở lên.',
  },
  {
    code: 'nha_nghien_cuu_tre',
    title: 'Nhà nghiên cứu trẻ',
    description: 'Hoàn thành từ 3 bài học Lịch sử 11 trở lên và khám phá ít nhất 2 mô hình 3D.',
  },
];

export function evaluateEarnedBadges(stats: BadgeEligibilityStats): BadgeDefinition[] {
  const earned: BadgeDefinition[] = [];
  if (stats.completedExplorationWorkflows >= 1) {
    earned.push(ALL_BADGES[0]);
  }
  if (stats.mapGameHighScores >= 1) {
    earned.push(ALL_BADGES[1]);
  }
  if (stats.quizHighScores >= 1) {
    earned.push(ALL_BADGES[2]);
  }
  if (stats.completedLessonsCount >= 3 && stats.explored3dCount >= 2) {
    earned.push(ALL_BADGES[3]);
  }
  return earned;
}
