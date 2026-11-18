-- Migration 001: Khởi tạo Cơ sở dữ liệu Hệ sinh thái LỊCH SỬ 11 3D
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  class_name TEXT NOT NULL UNIQUE,
  school_year TEXT NOT NULL DEFAULT '2026 - 2027',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

CREATE TABLE IF NOT EXISTS admin_settings (
  id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  password_changed_at TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  login_security_settings TEXT NOT NULL,
  site_config TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  student_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  publication_status TEXT NOT NULL DEFAULT 'published'
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  lesson_number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  objectives TEXT NOT NULL,
  approved_content TEXT NOT NULL,
  publication_status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS models_3d (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  lesson_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Tổ Lịch sử – THPT Hòa Minh',
  animation_names TEXT NOT NULL DEFAULT '[]',
  camera_settings TEXT NOT NULL DEFAULT '{}',
  phases_json TEXT NOT NULL DEFAULT '[]',
  review_status TEXT NOT NULL DEFAULT 'published',
  version TEXT NOT NULL DEFAULT '1.0',
  created_at TEXT NOT NULL,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS model_hotspots (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  position_z REAL NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  phase_key TEXT NOT NULL DEFAULT 'all',
  question_id TEXT,
  FOREIGN KEY (model_id) REFERENCES models_3d(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  question_type TEXT NOT NULL,
  content TEXT NOT NULL,
  answer_data TEXT NOT NULL,
  explanation TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'thong_hieu',
  approved INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_lesson ON questions(lesson_id);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  lesson_id TEXT,
  assigned_classes TEXT NOT NULL DEFAULT '[]',
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  open_at TEXT,
  close_at TEXT,
  publication_status TEXT NOT NULL DEFAULT 'published',
  question_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 10,
  start_time TEXT NOT NULL,
  submitted_at TEXT,
  grading_status TEXT NOT NULL DEFAULT 'graded',
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attempts_student ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON quiz_attempts(quiz_id);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  student_answer TEXT NOT NULL,
  awarded_points REAL NOT NULL DEFAULT 0,
  max_points REAL NOT NULL DEFAULT 1,
  teacher_feedback TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learning_progress (
  student_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  completion_status TEXT NOT NULL DEFAULT 'in_progress',
  explored_3d INTEGER NOT NULL DEFAULT 0,
  exploration_data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, lesson_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_notes (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  note_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_badges (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  badge_code TEXT NOT NULL,
  badge_title TEXT NOT NULL,
  badge_description TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  UNIQUE (student_id, badge_code),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  lesson_id TEXT,
  score REAL NOT NULL,
  max_score REAL NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  survey_phase TEXT NOT NULL DEFAULT 'pre',
  questions_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  ratings_json TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL,
  UNIQUE (survey_id, student_id),
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
