import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  BootstrapStats,
  LessonItem,
  Model3DItem,
  SiteConfig,
  StudentProfile,
  TopicItem,
} from '../types';
import { apiFetch, clearStoredSessionToken, setStoredSessionToken } from '../utils/authSession';

interface ClassOption {
  id: string;
  class_name: string;
  school_year: string;
}

interface AppContextValue {
  loading: boolean;
  role: 'guest' | 'student' | 'admin';
  student: StudentProfile | null;
  mustChangeAdminPassword: boolean;
  siteConfig: SiteConfig;
  aiConfigured: boolean;
  stats: BootstrapStats;
  classes: ClassOption[];
  topics: TopicItem[];
  lessons: LessonItem[];
  models: Model3DItem[];
  refreshBootstrap: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  activateAdminSession: (sessionToken?: string, mustChangePassword?: boolean) => void;
  activateStudentSession: (studentProfile: StudentProfile, sessionToken?: string) => void;
  logout: () => Promise<void>;
}

const DEFAULT_CONFIG: SiteConfig = {
  appName: 'LỊCH SỬ 11 3D – KHÁM PHÁ LỊCH SỬ QUA KHÔNG GIAN SỐ',
  slogan: 'Chạm vào quá khứ – Khám phá lịch sử – Kiến tạo tương lai.',
  schoolName: 'Trường THPT Hòa Minh, tỉnh Vĩnh Long',
  subjectName: 'Lịch sử lớp 11 – Chương trình GDPT 2018',
  textbookName: 'Lịch sử 11 – Kết nối tri thức với cuộc sống',
  authorInfo: 'Tổ Chuyên môn Lịch sử – Trường THPT Hòa Minh, tỉnh Vĩnh Long',
  projectIntro: '',
  bannerSubtitle: 'Khám phá các sự kiện, nhân vật và không gian lịch sử qua mô hình ba chiều tương tác.',
  aiSystemNote: '',
  resourceLinks: [],
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'guest' | 'student' | 'admin'>('guest');
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [mustChangeAdminPassword, setMustChangeAdminPassword] = useState(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [stats, setStats] = useState<BootstrapStats>({
    totalTopics: 6,
    totalLessons: 13,
    totalModels: 5,
    totalStudents: 0,
    totalQuizAttempts: 0,
    totalClasses: 4,
  });
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [models, setModels] = useState<Model3DItem[]>([]);

  const refreshBootstrap = useCallback(async () => {
    const res = await apiFetch('/api/public/bootstrap');
    if (!res.ok) return;
    const data = await res.json();
    if (data.siteConfig) setSiteConfig(data.siteConfig);
    setAiConfigured(Boolean(data.aiConfigured));
    if (data.stats) setStats(data.stats);
    if (Array.isArray(data.classes)) setClasses(data.classes);
    if (Array.isArray(data.topics)) setTopics(data.topics);
    if (Array.isArray(data.lessons)) setLessons(data.lessons);
    if (Array.isArray(data.models)) setModels(data.models);
  }, []);

  const refreshAuth = useCallback(async () => {
    const res = await apiFetch('/api/auth/me');
    if (!res.ok) {
      setRole('guest');
      setStudent(null);
      return;
    }
    const data = await res.json();
    if (data.role === 'admin') {
      setRole('admin');
      setStudent(null);
      setMustChangeAdminPassword(Boolean(data.mustChangePassword));
    } else if (data.role === 'student' && data.student) {
      setRole('student');
      setStudent(data.student);
      setMustChangeAdminPassword(false);
    } else {
      clearStoredSessionToken();
      setRole('guest');
      setStudent(null);
      setMustChangeAdminPassword(false);
    }
  }, []);

  const activateAdminSession = useCallback((sessionToken?: string, mustChange = false) => {
    if (sessionToken) {
      setStoredSessionToken(sessionToken);
    }
    setRole('admin');
    setStudent(null);
    setMustChangeAdminPassword(mustChange);
  }, []);

  const activateStudentSession = useCallback((studentProfile: StudentProfile, sessionToken?: string) => {
    if (sessionToken) {
      setStoredSessionToken(sessionToken);
    }
    setRole('student');
    setStudent(studentProfile);
    setMustChangeAdminPassword(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearStoredSessionToken();
      setRole('guest');
      setStudent(null);
      setMustChangeAdminPassword(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([refreshBootstrap(), refreshAuth()])
      .catch((err) => console.error('Init failed:', err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshBootstrap, refreshAuth]);

  return (
    <AppContext.Provider
      value={{
        loading,
        role,
        student,
        mustChangeAdminPassword,
        siteConfig,
        aiConfigured,
        stats,
        classes,
        topics,
        lessons,
        models,
        refreshBootstrap,
        refreshAuth,
        activateAdminSession,
        activateStudentSession,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
