import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { hashPassword } from './security.ts';
import {
  INITIAL_CLASSES,
  INITIAL_LESSONS,
  INITIAL_MODELS_3D,
  INITIAL_QUESTIONS,
  INITIAL_QUIZZES,
  INITIAL_SURVEYS,
  INITIAL_TOPICS,
} from './seedData.ts';

let dbInstance: Database.Database | null = null;

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

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  appName: 'LỊCH SỬ 11 3D – KHÁM PHÁ LỊCH SỬ QUA KHÔNG GIAN SỐ',
  slogan: 'Chạm vào quá khứ – Khám phá lịch sử – Kiến tạo tương lai.',
  schoolName: 'Trường THPT Hòa Minh, tỉnh Vĩnh Long',
  subjectName: 'Lịch sử lớp 11 – Chương trình GDPT 2018',
  textbookName: 'Lịch sử 11 – Kết nối tri thức với cuộc sống',
  authorInfo: 'Tổ Chuyên môn Lịch sử – Trường THPT Hòa Minh, tỉnh Vĩnh Long',
  projectIntro:
    'Hệ sinh thái học tập số tích hợp Bảo tàng Lịch sử 3D tương tác (.glb), bản đồ – dòng thời gian trực quan, đấu trường trò chơi, hệ thống kiểm tra đánh giá năng lực và trợ lý Sử Gia AI 11.',
  bannerSubtitle:
    'Khám phá các sự kiện, nhân vật và không gian lịch sử qua mô hình ba chiều tương tác.',
  aiSystemNote:
    'Ưu tiên kho học liệu Lịch sử 11 đã được giáo viên phê duyệt; không suy diễn ngoài tư liệu; luôn đặt câu hỏi gợi mở tư duy cho học sinh.',
  resourceLinks: [
    {
      title: 'Hướng dẫn tạo & xuất mô hình Blender (.glb) cho Giáo viên',
      url: '/models/HUONG_DAN_BLENDER_GLB.md',
      type: 'link',
    },
    {
      title: 'Kịch bản Python Blender mẫu: Bãi cọc Bạch Đằng 938',
      url: '/blender_scripts/tao_bai_coc_bach_dang.py',
      type: 'link',
    },
  ],
};

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/lichsu11.sqlite');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migrationPath = path.resolve(process.cwd(), 'server', 'migrations', '001_init.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  db.exec(sql);

  dbInstance = db;
  return db;
}

export async function initializeDatabaseAndSeed(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  // 1. Seed admin_settings idempotently with default password '123456' (never overwrite custom changed password)
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || '123456';
  const existingAdmin = db
    .prepare('SELECT id, password_changed_at, must_change_password FROM admin_settings LIMIT 1')
    .get() as { id: string; password_changed_at: string | null; must_change_password: number } | undefined;
  if (!existingAdmin) {
    const passwordHash = await hashPassword(initialPassword);
    db.prepare(
      `INSERT INTO admin_settings (id, password_hash, password_changed_at, must_change_password, login_security_settings, site_config)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'admin-root',
      passwordHash,
      null,
      0,
      JSON.stringify({ maxAttempts: 5, lockoutSeconds: 60 }),
      JSON.stringify(DEFAULT_SITE_CONFIG),
    );
  } else if (existingAdmin.password_changed_at === null && existingAdmin.must_change_password !== 0) {
    const passwordHash = await hashPassword(initialPassword);
    db.prepare('UPDATE admin_settings SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(
      passwordHash,
      existingAdmin.id,
    );
  }

  const runSeedTransaction = db.transaction(() => {
    // 2. Seed classes if empty
    const classCount = (db.prepare('SELECT COUNT(*) AS cnt FROM classes').get() as { cnt: number }).cnt;
    if (classCount === 0) {
      const insClass = db.prepare(
        'INSERT INTO classes (id, class_name, school_year, status, created_at) VALUES (?, ?, ?, ?, ?)',
      );
      for (const cls of INITIAL_CLASSES) {
        insClass.run(`cls-${cls.toLowerCase()}`, cls, '2026 - 2027', 'active', now);
      }
    }

    // 3. Seed 6 topics if empty
    const topicCount = (db.prepare('SELECT COUNT(*) AS cnt FROM topics').get() as { cnt: number }).cnt;
    if (topicCount === 0) {
      const insTopic = db.prepare(
        'INSERT INTO topics (id, title, description, sort_order, publication_status) VALUES (?, ?, ?, ?, ?)',
      );
      for (const t of INITIAL_TOPICS) {
        insTopic.run(t.id, t.title, t.description, t.sortOrder, 'published');
      }
    }

    // 4. Seed 13 lessons if empty
    const lessonCount = (db.prepare('SELECT COUNT(*) AS cnt FROM lessons').get() as { cnt: number }).cnt;
    if (lessonCount === 0) {
      const insLesson = db.prepare(
        `INSERT INTO lessons (id, topic_id, lesson_number, title, objectives, approved_content, publication_status, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      );
      for (const l of INITIAL_LESSONS) {
        insLesson.run(
          l.id,
          l.topicId,
          l.lessonNumber,
          l.title,
          JSON.stringify(l.objectives),
          JSON.stringify(l.content),
          l.publicationStatus,
          now,
        );
      }
    }

    // 5. Upsert built-in 3D GLB models (model-1..model-7) & their seed hotspots idempotently
    const upsertModel = db.prepare(
      `INSERT INTO models_3d (
        id, slug, lesson_id, model_name, file_url, thumbnail_url, description,
        source_reference, author_name, animation_names, camera_settings, phases_json,
        review_status, version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '3.0', ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        lesson_id = excluded.lesson_id,
        model_name = excluded.model_name,
        file_url = excluded.file_url,
        description = excluded.description,
        source_reference = excluded.source_reference,
        animation_names = excluded.animation_names,
        camera_settings = excluded.camera_settings,
        phases_json = excluded.phases_json,
        version = '3.0'`,
    );
    const upsertHotspot = db.prepare(
      `INSERT INTO model_hotspots (
        id, model_id, position_x, position_y, position_z, title, description, phase_key, question_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        model_id = excluded.model_id,
        position_x = excluded.position_x,
        position_y = excluded.position_y,
        position_z = excluded.position_z,
        title = excluded.title,
        description = excluded.description,
        phase_key = excluded.phase_key`,
    );
    for (const m of INITIAL_MODELS_3D) {
      upsertModel.run(
        m.id,
        m.slug,
        m.lessonId,
        m.modelName,
        m.fileUrl,
        '',
        m.description,
        m.sourceReference,
        'Tổ Lịch sử – THPT Hòa Minh',
        JSON.stringify(m.animationNames),
        JSON.stringify(m.cameraSettings),
        JSON.stringify(m.phases),
        m.reviewStatus,
        now,
      );
      for (const h of m.hotspots) {
        upsertHotspot.run(h.id, m.id, h.x, h.y, h.z, h.title, h.description, h.phaseKey, null);
      }
    }

    // 6. Seed approved question bank if empty
    const qCount = (db.prepare('SELECT COUNT(*) AS cnt FROM questions').get() as { cnt: number }).cnt;
    if (qCount === 0) {
      const insQuestion = db.prepare(
        `INSERT INTO questions (id, lesson_id, question_type, content, answer_data, explanation, difficulty, approved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      );
      for (const q of INITIAL_QUESTIONS) {
        insQuestion.run(
          q.id,
          q.lessonId,
          q.questionType,
          q.content,
          JSON.stringify(q.answerData),
          q.explanation,
          q.difficulty,
          now,
        );
      }
    }

    // 7. Seed quizzes if empty
    const quizCount = (db.prepare('SELECT COUNT(*) AS cnt FROM quizzes').get() as { cnt: number }).cnt;
    if (quizCount === 0) {
      const insQuiz = db.prepare(
        `INSERT INTO quizzes (id, title, lesson_id, assigned_classes, duration_minutes, open_at, close_at, publication_status, question_ids, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
      );
      for (const qz of INITIAL_QUIZZES) {
        insQuiz.run(
          qz.id,
          qz.title,
          qz.lessonId,
          JSON.stringify(qz.assignedClasses),
          qz.durationMinutes,
          qz.publicationStatus,
          JSON.stringify(qz.questionIds),
          now,
        );
      }
    }

    // 8. Seed pre/post survey templates (0 fake responses!)
    const surveyCount = (db.prepare('SELECT COUNT(*) AS cnt FROM surveys').get() as { cnt: number }).cnt;
    if (surveyCount === 0) {
      const insSurvey = db.prepare(
        `INSERT INTO surveys (id, title, survey_phase, questions_json, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const s of INITIAL_SURVEYS) {
        insSurvey.run(s.id, s.title, s.surveyPhase, JSON.stringify(s.questions), s.isActive, now);
      }
    }
  });

  runSeedTransaction();
}

export function writeAuditLog(
  actorRole: string,
  action: string,
  targetType: string,
  targetId: string,
  details = '',
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_logs (id, actor_role, action, target_type, target_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), actorRole, action, targetType, targetId, details, new Date().toISOString());
}
