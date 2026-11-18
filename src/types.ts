export interface SiteConfig {
  appName: string;
  slogan: string;
  schoolName: string;
  subjectName: string;
  textbookName: string;
  authorInfo: string;
  projectIntro: string;
  bannerSubtitle: string;
  aiSystemNote: string;
  resourceLinks: { title: string; url: string; type: 'pdf' | 'link' }[];
}

export interface TopicItem {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  publication_status?: string;
}

export interface LessonObjectives {
  knowledge: string[];
  competence: string[];
  qualities: string[];
}

export interface LessonContent {
  summary: string;
  verificationNote: string;
  keyPoints: string[];
  timeline: { year: string; event: string; detail: string }[];
  figures: { name: string; role: string; note: string }[];
  causeCourseOutcome: {
    cause: string;
    course: string;
    outcome: string;
    significance: string;
  };
  primarySources: { excerpt: string; source: string }[];
  explorationTasks: string[];
  applicationPrompt: string;
  selfCheckGuide: string[];
  modelSlug?: string;
  mapRegion?: string;
}

export interface LessonItem {
  id: string;
  topicId: string;
  lessonNumber: number;
  title: string;
  objectives: LessonObjectives;
  content: LessonContent;
  publicationStatus: string;
  version: number;
  updatedAt: string;
}

export interface ModelHotspot {
  id: string;
  x: number;
  y: number;
  z: number;
  title: string;
  description: string;
  phaseKey: string;
  questionId?: string | null;
}

export interface ModelPhase {
  key: string;
  label: string;
  summary: string;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  animationName?: string;
}

export interface Model3DItem {
  id: string;
  slug: string;
  lessonId: string;
  modelName: string;
  fileUrl: string;
  thumbnailUrl: string;
  description: string;
  sourceReference: string;
  authorName: string;
  animationNames: string[];
  cameraSettings: {
    position: [number, number, number];
    target: [number, number, number];
  };
  phases: ModelPhase[];
  reviewStatus: string;
  version: string;
  hotspots: ModelHotspot[];
}

export interface StudentProfile {
  id: string;
  fullName: string;
  className: string;
  username: string;
  mustChangePassword: boolean;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export type QuestionType =
  | 'mcq'
  | 'true_false'
  | 'short_answer'
  | 'ordering'
  | 'matching'
  | 'essay'
  | 'model_3d'
  | 'source_analysis';

export interface PublicQuestion {
  id: string;
  lessonId: string;
  questionType: QuestionType;
  content: string;
  difficulty: 'nhan_biet' | 'thong_hieu' | 'van_dung';
  promptData: {
    options?: string[];
    statements?: { id: string; text: string }[];
    items?: { id: string; text: string }[];
    leftItems?: { id: string; text: string }[];
    rightItems?: { id: string; text: string }[];
    rubric?: { criterion: string; maxPoints: number }[];
    sourceExcerpt?: string;
    sourceCitation?: string;
    modelSlug?: string;
    points: number;
  };
}

export interface BootstrapStats {
  totalTopics: number;
  totalLessons: number;
  totalModels: number;
  totalStudents: number;
  totalQuizAttempts: number;
  totalClasses: number;
}

export interface CuratedGlbAsset {
  id: string;
  category: 'human' | 'vehicle' | 'animal' | 'landscape';
  categoryLabel: string;
  title: string;
  filename: string;
  fileUrl: string;
  repoName: string;
  repoUrl: string;
  byteLength: number;
  meshCount: number;
  animationCount: number;
}

