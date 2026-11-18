import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import * as dotenv from 'dotenv';

import {
  DEFAULT_SITE_CONFIG,
  getDb,
  initializeDatabaseAndSeed,
  writeAuditLog,
} from './server/db.ts';
import type { SiteConfig } from './server/db.ts';
import {
  SESSION_COOKIE_NAME,
  checkLoginRateLimit,
  clearLoginFailures,
  clearSessionCookie,
  extractRequestSessionToken,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  recordLoginFailure,
  setSessionCookie,
  validateStudentRegistration,
  verifyPassword,
} from './server/security.ts';
import {
  evaluateEarnedBadges,
  gradeQuestionAnswer,
} from './server/grading.ts';
import type { QuestionAnswerSpec, QuestionType } from './server/grading.ts';
import {
  ensureBuiltInGlbAssets,
  generateCustomGlbViaPython,
  getCuratedGlbAssetPackInfo,
  parseGlbHeaderMetadata,
} from './server/glbGenerator.ts';
import type { PythonGlbPreset } from './server/glbGenerator.ts';
import { askSuGiaAi, isGeminiConfigured, suggestEssayRubricFeedback } from './server/ai.ts';

dotenv.config();

interface AuthSession {
  role: 'student' | 'admin';
  studentId?: string;
  student?: {
    id: string;
    fullName: string;
    className: string;
    username: string;
    mustChangePassword: boolean;
    status: string;
    createdAt: string;
    lastLoginAt: string | null;
  };
}

interface AuthedRequest extends Request {
  auth?: AuthSession;
}

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_STORAGE_DIR || './public/uploads/models');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.glb', '.png', '.jpg', '.jpeg', '.webp', '.blend'];
    if (!allowed.includes(ext)) {
      cb(new Error('Định dạng tệp không hợp lệ. Chỉ chấp nhận .glb, .png, .jpg, .webp hoặc .blend.'));
      return;
    }
    cb(null, true);
  },
});

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function attachSession(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const rawToken = extractRequestSessionToken(req);
  if (!rawToken || typeof rawToken !== 'string') {
    next();
    return;
  }

  const db = getDb();
  const tokenHash = hashSessionToken(rawToken);
  const row = db
    .prepare('SELECT role, student_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(tokenHash) as { role: 'student' | 'admin'; student_id: string | null; expires_at: string } | undefined;

  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    if (row) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    }
    next();
    return;
  }

  if (row.role === 'admin') {
    req.auth = { role: 'admin' };
    next();
    return;
  }

  if (row.role === 'student' && row.student_id) {
    const st = db
      .prepare(
        'SELECT id, full_name, class_name, username, must_change_password, status, created_at, last_login_at FROM students WHERE id = ?',
      )
      .get(row.student_id) as
      | {
          id: string;
          full_name: string;
          class_name: string;
          username: string;
          must_change_password: number;
          status: string;
          created_at: string;
          last_login_at: string | null;
        }
      | undefined;

    if (st && st.status === 'active') {
      req.auth = {
        role: 'student',
        studentId: st.id,
        student: {
          id: st.id,
          fullName: st.full_name,
          className: st.class_name,
          username: st.username,
          mustChangePassword: Boolean(st.must_change_password),
          status: st.status,
          createdAt: st.created_at,
          lastLoginAt: st.last_login_at,
        },
      };
    }
  }

  next();
}

function requireStudent(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.role !== 'student' || !req.auth.student) {
    res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản học sinh để thực hiện chức năng này.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Truy cập bị từ chối: Yêu cầu quyền Quản trị Giáo viên.' });
    return;
  }
  next();
}

function refreshStudentBadges(studentId: string): void {
  const db = getDb();
  const progressRows = db
    .prepare('SELECT progress_percent, completion_status, explored_3d, exploration_data FROM learning_progress WHERE student_id = ?')
    .all(studentId) as {
    progress_percent: number;
    completion_status: string;
    explored_3d: number;
    exploration_data: string;
  }[];

  const completedLessonsCount = progressRows.filter((r) => r.completion_status === 'completed' || r.progress_percent >= 100).length;
  const explored3dCount = progressRows.filter((r) => r.explored_3d === 1).length;
  const completedExplorationWorkflows = progressRows.filter((r) => {
    const parsed = parseJsonSafe<{ step5Completed?: boolean }>(r.exploration_data, {});
    return Boolean(parsed.step5Completed);
  }).length;

  const mapGameHighScores = (
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM game_attempts
         WHERE student_id = ? AND game_type IN ('map_decode', 'evidence_hunt') AND (score * 1.0 / MAX(max_score, 1)) >= 0.8`,
      )
      .get(studentId) as { cnt: number }
  ).cnt;

  const quizHighScores = (
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM quiz_attempts
         WHERE student_id = ? AND submitted_at IS NOT NULL AND (score * 10.0 / MAX(max_score, 1)) >= 8.0`,
      )
      .get(studentId) as { cnt: number }
  ).cnt;

  const earned = evaluateEarnedBadges({
    explored3dCount,
    completedLessonsCount,
    mapGameHighScores,
    quizHighScores,
    completedExplorationWorkflows,
  });

  const insBadge = db.prepare(
    `INSERT OR IGNORE INTO student_badges (id, student_id, badge_code, badge_title, badge_description, awarded_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();
  for (const b of earned) {
    insBadge.run(crypto.randomUUID(), studentId, b.code, b.title, b.description, now);
  }
}

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function startServer(): Promise<void> {
  const app = express();
  const portArgIdx = process.argv.indexOf('--port');
  const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
  const port = Number(process.env.PORT) || (Number.isFinite(cliPort) && cliPort > 0 ? cliPort : 3000);

  let frontendMiddleware: express.RequestHandler | null = null;
  let initError: unknown = null;
  let dbReadyResolve!: () => void;
  const dbReadyPromise = new Promise<void>((resolve) => {
    dbReadyResolve = resolve;
  });
  let viteReadyResolve!: () => void;
  const viteReadyPromise = new Promise<void>((resolve) => {
    viteReadyResolve = resolve;
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: initError ? 'error' : 'ok' });
  });

  // Serve generated .glb models, Python .glb simulation scripts, Blender scripts, and uploaded assets immediately
  app.use('/models', express.static(path.resolve(process.cwd(), 'public', 'models'), { maxAge: '1h' }));
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'public', 'uploads')));
  app.use('/python_glb', express.static(path.resolve(process.cwd(), 'public', 'python_glb')));
  app.use('/blender_scripts', express.static(path.resolve(process.cwd(), 'public', 'blender_scripts')));

  app.use('/api', async (_req, res, next) => {
    await dbReadyPromise;
    if (initError) {
      res.status(500).json({ error: 'Máy chủ đang khởi tạo gặp sự cố.' });
      return;
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use('/api', attachSession);

  app.get('/api/public/python-glb-info', (_req, res) => {
    const modelsDir = path.resolve(process.cwd(), 'public', 'models');
    const coreFiles = [
      'bach_dang_938.glb',
      'khoi_nghia_lam_son.glb',
      'thanh_nha_ho.glb',
      'dong_nam_a_can_dai.glb',
      'khong_gian_bien_dong.glb',
      'van_minh_cong_nghiep_do_thi.glb',
      'quan_the_nhan_vat_sinh_thai_3d.glb',
    ];
    const verifiedAssets = coreFiles.map((file) => {
      const fullPath = path.join(modelsDir, file);
      const info = fs.existsSync(fullPath)
        ? parseGlbHeaderMetadata(fullPath)
        : { valid: false, generator: '', version: '', meshCount: 0, nodeCount: 0, animationNames: [], byteLength: 0 };
      return {
        filename: file,
        fileUrl: `/models/${file}`,
        ...info,
      };
    });

    res.json({
      compilerSignature: 'Python-3.10-LichSu11-3D-GLB-Compiler-HistoricalWideWorld-v4',
      scripts: {
        compilerUrl: '/python_glb/sinh_mo_phong_lich_su_glb.py',
        mergerUrl: '/python_glb/hop_nhat_canh_glb.py',
        uploaderUrl: '/python_glb/xuat_va_upload_glb.py',
        guideUrl: '/models/HUONG_DAN_BLENDER_GLB.md',
      },
      presets: [
        {
          id: 'heritage_ecosystem',
          label: 'Quần thể Người – Xe cộ – Động vật – Cây cối Cảnh quan (.glb)',
          defaultLessonId: 'lesson-8',
          defaultParams: { humanCount: 2, vehicleCount: 3, animalCount: 4, treeDensity: 6 },
        },
        {
          id: 'naval_ambush',
          label: 'Thủy chiến & Trận địa Bãi cọc / Phục kích sông nước',
          defaultLessonId: 'lesson-7',
          defaultParams: { stakeRows: 3, warshipPairs: 2, tidalAmplitude: 0.34 },
        },
        {
          id: 'maritime_sovereignty',
          label: 'Hải trình Biển Đông & Cụm Đảo Chủ Quyền',
          defaultLessonId: 'lesson-13',
          defaultParams: { islandClusters: 3, patrolShips: 2 },
        },
        {
          id: 'stone_citadel',
          label: 'Thành lũy Đá Vòm Cuốn & Kỳ Đài Cổ',
          defaultLessonId: 'lesson-9',
          defaultParams: { archCount: 3, wallSpan: 18 },
        },
        {
          id: 'campaign_relief',
          label: 'Sa bàn Địa hình Núi Rừng & Mốc Chiến Dịch',
          defaultLessonId: 'lesson-8',
          defaultParams: { mountainPeaks: 5, milestoneCount: 4 },
        },
      ],
      verifiedAssets,
      assetPack: getCuratedGlbAssetPackInfo(process.cwd()),
    });
  });

  // ============================================================================
  // PUBLIC CURRICULUM & MUSEUM ENDPOINTS (Real DB metrics only!)
  // ============================================================================
  app.get('/api/public/bootstrap', (_req, res) => {
    try {
      const db = getDb();
      const adminRow = db.prepare('SELECT site_config FROM admin_settings LIMIT 1').get() as { site_config: string } | undefined;
      const siteConfig = parseJsonSafe<SiteConfig>(adminRow?.site_config, DEFAULT_SITE_CONFIG);

      const totalTopics = (db.prepare("SELECT COUNT(*) AS cnt FROM topics WHERE publication_status = 'published'").get() as { cnt: number }).cnt;
      const totalLessons = (db.prepare("SELECT COUNT(*) AS cnt FROM lessons WHERE publication_status = 'published'").get() as { cnt: number }).cnt;
      const totalModels = (db.prepare("SELECT COUNT(*) AS cnt FROM models_3d WHERE review_status = 'published'").get() as { cnt: number }).cnt;
      const totalStudents = (db.prepare('SELECT COUNT(*) AS cnt FROM students').get() as { cnt: number }).cnt;
      const totalQuizAttempts = (db.prepare('SELECT COUNT(*) AS cnt FROM quiz_attempts WHERE submitted_at IS NOT NULL').get() as { cnt: number }).cnt;
      const totalClasses = (db.prepare("SELECT COUNT(*) AS cnt FROM classes WHERE status = 'active'").get() as { cnt: number }).cnt;

      const classes = db
        .prepare("SELECT id, class_name, school_year FROM classes WHERE status = 'active' ORDER BY class_name ASC")
        .all();

      const topics = db
        .prepare("SELECT id, title, description, sort_order FROM topics WHERE publication_status = 'published' ORDER BY sort_order ASC")
        .all();

      const lessonsRaw = db
        .prepare(
          `SELECT id, topic_id, lesson_number, title, objectives, approved_content, publication_status, version, updated_at
           FROM lessons WHERE publication_status = 'published' ORDER BY lesson_number ASC`,
        )
        .all() as {
        id: string;
        topic_id: string;
        lesson_number: number;
        title: string;
        objectives: string;
        approved_content: string;
        publication_status: string;
        version: number;
        updated_at: string;
      }[];

      const lessons = lessonsRaw.map((l) => ({
        id: l.id,
        topicId: l.topic_id,
        lessonNumber: l.lesson_number,
        title: l.title,
        objectives: parseJsonSafe(l.objectives, { knowledge: [], competence: [], qualities: [] }),
        content: parseJsonSafe(l.approved_content, {}),
        publicationStatus: l.publication_status,
        version: l.version,
        updatedAt: l.updated_at,
      }));

      const modelsRaw = db
        .prepare(
          `SELECT id, slug, lesson_id, model_name, file_url, thumbnail_url, description, source_reference,
                  author_name, animation_names, camera_settings, phases_json, review_status, version, created_at
           FROM models_3d WHERE review_status = 'published' ORDER BY created_at ASC`,
        )
        .all() as Record<string, unknown>[];

      const hotspotsAll = db
        .prepare('SELECT id, model_id, position_x, position_y, position_z, title, description, phase_key, question_id FROM model_hotspots')
        .all() as {
        id: string;
        model_id: string;
        position_x: number;
        position_y: number;
        position_z: number;
        title: string;
        description: string;
        phase_key: string;
        question_id: string | null;
      }[];

      const models = modelsRaw.map((m) => ({
        id: m.id,
        slug: m.slug,
        lessonId: m.lesson_id,
        modelName: m.model_name,
        fileUrl: m.file_url,
        thumbnailUrl: m.thumbnail_url,
        description: m.description,
        sourceReference: m.source_reference,
        authorName: m.author_name,
        animationNames: parseJsonSafe<string[]>(String(m.animation_names || '[]'), []),
        cameraSettings: parseJsonSafe(String(m.camera_settings || '{}'), { position: [9, 7, 11], target: [0, 0, 0] }),
        phases: parseJsonSafe(String(m.phases_json || '[]'), []),
        reviewStatus: m.review_status,
        version: m.version,
        hotspots: hotspotsAll
          .filter((h) => h.model_id === m.id)
          .map((h) => ({
            id: h.id,
            x: h.position_x,
            y: h.position_y,
            z: h.position_z,
            title: h.title,
            description: h.description,
            phaseKey: h.phase_key,
            questionId: h.question_id,
          })),
      }));

      res.json({
        siteConfig,
        aiConfigured: isGeminiConfigured(),
        stats: {
          totalTopics,
          totalLessons,
          totalModels,
          totalStudents,
          totalQuizAttempts,
          totalClasses,
        },
        classes,
        topics,
        lessons,
        models,
      });
    } catch (error) {
      console.error('Bootstrap error:', error);
      res.status(500).json({ error: 'Không thể tải dữ liệu khởi tạo hệ thống.' });
    }
  });

  // Public practice questions (without exposing raw answer key before check, or safe practice set)
  app.get('/api/public/questions', (req, res) => {
    const db = getDb();
    const lessonId = typeof req.query.lessonId === 'string' ? req.query.lessonId : '';
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty : '';

    let sql = 'SELECT id, lesson_id, question_type, content, answer_data, explanation, difficulty FROM questions WHERE approved = 1';
    const params: unknown[] = [];
    if (lessonId) {
      sql += ' AND lesson_id = ?';
      params.push(lessonId);
    }
    if (difficulty) {
      sql += ' AND difficulty = ?';
      params.push(difficulty);
    }
    sql += ' ORDER BY created_at ASC';

    const rows = db.prepare(sql).all(...params) as {
      id: string;
      lesson_id: string;
      question_type: string;
      content: string;
      answer_data: string;
      explanation: string;
      difficulty: string;
    }[];

    const sanitized = rows.map((r) => {
      const spec = parseJsonSafe<QuestionAnswerSpec>(r.answer_data, {});
      return {
        id: r.id,
        lessonId: r.lesson_id,
        questionType: r.question_type,
        content: r.content,
        difficulty: r.difficulty,
        promptData: {
          options: spec.options,
          statements: spec.statements?.map((s) => ({ id: s.id, text: s.text })),
          items: spec.items,
          leftItems: spec.leftItems,
          rightItems: spec.rightItems,
          rubric: spec.rubric,
          sourceExcerpt: spec.sourceExcerpt,
          sourceCitation: spec.sourceCitation,
          modelSlug: spec.modelSlug,
          points: spec.points ?? 1,
        },
      };
    });

    res.json({ questions: sanitized });
  });

  // Instant practice check endpoint (evaluates single practice question on server)
  app.post('/api/public/practice/check', (req, res) => {
    const { questionId, answer } = req.body as { questionId?: string; answer?: unknown };
    if (!questionId) {
      res.status(400).json({ error: 'Thiếu mã câu hỏi.' });
      return;
    }
    const db = getDb();
    const q = db
      .prepare('SELECT question_type, answer_data, explanation FROM questions WHERE id = ? AND approved = 1')
      .get(questionId) as { question_type: QuestionType; answer_data: string; explanation: string } | undefined;

    if (!q) {
      res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
      return;
    }

    const spec = parseJsonSafe<QuestionAnswerSpec>(q.answer_data, {});
    const result = gradeQuestionAnswer(q.question_type, spec, answer);
    res.json({
      ...result,
      explanation: q.explanation,
    });
  });

  // ============================================================================
  // AUTHENTICATION: STUDENT & PASSWORD-ONLY TEACHER ADMIN
  // ============================================================================
  app.get('/api/auth/me', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.json({ role: 'guest', user: null });
      return;
    }
    if (req.auth.role === 'admin') {
      const db = getDb();
      const adminRow = db
        .prepare('SELECT must_change_password, password_changed_at FROM admin_settings LIMIT 1')
        .get() as { must_change_password: number; password_changed_at: string | null } | undefined;
      res.json({
        role: 'admin',
        mustChangePassword: Boolean(adminRow?.must_change_password),
        passwordChangedAt: adminRow?.password_changed_at ?? null,
      });
      return;
    }
    res.json({
      role: 'student',
      student: req.auth.student,
    });
  });

  app.post('/api/auth/student/register', async (req, res) => {
    try {
      const validation = validateStudentRegistration(req.body || {});
      if (!validation.valid || !validation.normalized) {
        res.status(400).json({ error: validation.error || 'Thông tin đăng ký không hợp lệ.' });
        return;
      }

      const { fullName, className, username } = validation.normalized;
      const db = getDb();

      const dup = db.prepare('SELECT id FROM students WHERE username = ?').get(username);
      if (dup) {
        res.status(409).json({ error: 'Tên đăng nhập này đã tồn tại. Vui lòng chọn tên đăng nhập khác.' });
        return;
      }

      // Ensure class exists in classes table automatically if valid Grade 10-12 class
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR IGNORE INTO classes (id, class_name, school_year, status, created_at)
         VALUES (?, ?, '2026 - 2027', 'active', ?)`,
      ).run(`cls-${className.toLowerCase()}`, className, now);

      const studentId = crypto.randomUUID();
      const passwordHash = await hashPassword(req.body.password);

      db.prepare(
        `INSERT INTO students (id, full_name, class_name, username, password_hash, must_change_password, status, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, 0, 'active', ?, ?, ?)`,
      ).run(studentId, fullName, className, username, passwordHash, now, now, now);

      const { rawToken, tokenHash } = generateSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (token_hash, role, student_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(
        tokenHash,
        'student',
        studentId,
        expiresAt,
        now,
      );

      setSessionCookie(req, res, rawToken);
      writeAuditLog('student', 'REGISTER_STUDENT', 'student', studentId, `${fullName} (${className})`);

      res.status(201).json({
        role: 'student',
        sessionToken: rawToken,
        student: {
          id: studentId,
          fullName,
          className,
          username,
          mustChangePassword: false,
          status: 'active',
          createdAt: now,
          lastLoginAt: now,
        },
      });
    } catch (error) {
      console.error('Student register error:', error);
      res.status(500).json({ error: 'Không thể tạo tài khoản học sinh. Vui lòng thử lại.' });
    }
  });

  app.post('/api/auth/student/login', async (req, res) => {
    try {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (!username || !password) {
        res.status(400).json({ error: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.' });
        return;
      }

      const rateKey = `student:${req.ip}:${username}`;
      const rateStatus = checkLoginRateLimit(rateKey);
      if (!rateStatus.allowed) {
        res.status(429).json({
          error: `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${rateStatus.retryAfterSeconds} giây.`,
        });
        return;
      }

      const db = getDb();
      const st = db
        .prepare(
          'SELECT id, full_name, class_name, username, password_hash, must_change_password, status, created_at FROM students WHERE username = ?',
        )
        .get(username) as
        | {
            id: string;
            full_name: string;
            class_name: string;
            username: string;
            password_hash: string;
            must_change_password: number;
            status: string;
            created_at: string;
          }
        | undefined;

      if (!st || !(await verifyPassword(st.password_hash, password))) {
        const fail = recordLoginFailure(rateKey);
        res.status(401).json({
          error: fail.locked
            ? `Sai thông tin đăng nhập quá giới hạn. Tạm khóa thử lại trong ${fail.retryAfterSeconds} giây.`
            : 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        });
        return;
      }

      if (st.status !== 'active') {
        res.status(403).json({
          error: 'Tài khoản học sinh hiện đang bị khóa. Vui lòng liên hệ Giáo viên bộ môn.',
        });
        return;
      }

      clearLoginFailures(rateKey);
      const now = new Date().toISOString();
      db.prepare('UPDATE students SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, st.id);

      const { rawToken, tokenHash } = generateSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (token_hash, role, student_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(
        tokenHash,
        'student',
        st.id,
        expiresAt,
        now,
      );

      setSessionCookie(req, res, rawToken);

      res.json({
        role: 'student',
        sessionToken: rawToken,
        student: {
          id: st.id,
          fullName: st.full_name,
          className: st.class_name,
          username: st.username,
          mustChangePassword: Boolean(st.must_change_password),
          status: st.status,
          createdAt: st.created_at,
          lastLoginAt: now,
        },
      });
    } catch (error) {
      console.error('Student login error:', error);
      res.status(500).json({ error: 'Lỗi đăng nhập máy chủ.' });
    }
  });

  app.post('/api/auth/student/change-password', requireStudent, async (req: AuthedRequest, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
      };

      if (!currentPassword || !newPassword || newPassword.length < 6) {
        res.status(400).json({ error: 'Mật khẩu mới phải từ 6 ký tự trở lên.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'Mật khẩu xác nhận không trùng khớp.' });
        return;
      }

      const db = getDb();
      const st = db
        .prepare('SELECT password_hash FROM students WHERE id = ?')
        .get(req.auth!.studentId!) as { password_hash: string } | undefined;

      if (!st || !(await verifyPassword(st.password_hash, currentPassword))) {
        res.status(401).json({ error: 'Mật khẩu hiện tại không đúng.' });
        return;
      }

      const newHash = await hashPassword(newPassword);
      db.prepare('UPDATE students SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(
        newHash,
        new Date().toISOString(),
        req.auth!.studentId!,
      );

      res.json({ ok: true, message: 'Đã cập nhật mật khẩu thành công.' });
    } catch (error) {
      console.error('Change student password error:', error);
      res.status(500).json({ error: 'Không thể đổi mật khẩu.' });
    }
  });

  // TEACHER ADMIN LOGIN: PASSWORD ONLY (No username, no email, no ID!)
  app.post('/api/auth/admin/login', async (req, res) => {
    try {
      const password = String(req.body?.password || '');
      if (!password) {
        res.status(400).json({ error: 'Vui lòng nhập Mật khẩu quản trị.' });
        return;
      }

      const db = getDb();
      const adminRow = db
        .prepare('SELECT id, password_hash, must_change_password, login_security_settings FROM admin_settings LIMIT 1')
        .get() as
        | {
            id: string;
            password_hash: string;
            must_change_password: number;
            login_security_settings: string;
          }
        | undefined;

      if (!adminRow) {
        res.status(500).json({ error: 'Chưa khởi tạo cấu hình quản trị.' });
        return;
      }

      const sec = parseJsonSafe<{ maxAttempts?: number; lockoutSeconds?: number }>(
        adminRow.login_security_settings,
        { maxAttempts: 5, lockoutSeconds: 60 },
      );
      const maxAttempts = sec.maxAttempts || 5;
      const lockoutMs = (sec.lockoutSeconds || 60) * 1000;

      const rateKey = `admin:${req.ip}`;
      const rate = checkLoginRateLimit(rateKey, maxAttempts, lockoutMs);
      if (!rate.allowed) {
        res.status(429).json({
          error: `Mật khẩu quản trị nhập sai quá số lần cho phép. Vui lòng chờ ${rate.retryAfterSeconds} giây.`,
          retryAfterSeconds: rate.retryAfterSeconds,
        });
        return;
      }

      const match = await verifyPassword(adminRow.password_hash, password);
      if (!match) {
        const fail = recordLoginFailure(rateKey, maxAttempts, lockoutMs);
        res.status(401).json({
          error: fail.locked
            ? `Mật khẩu quản trị không chính xác. Tạm khóa đăng nhập trong ${fail.retryAfterSeconds} giây.`
            : `Mật khẩu quản trị không chính xác (còn ${fail.remainingAttempts} lần thử).`,
        });
        return;
      }

      clearLoginFailures(rateKey);
      const now = new Date().toISOString();
      const { rawToken, tokenHash } = generateSessionToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO sessions (token_hash, role, student_id, expires_at, created_at) VALUES (?, ?, NULL, ?, ?)').run(
        tokenHash,
        'admin',
        expiresAt,
        now,
      );

      setSessionCookie(req, res, rawToken, 1);
      writeAuditLog('admin', 'ADMIN_LOGIN', 'admin_settings', adminRow.id, 'Đăng nhập quản trị thành công');

      res.json({
        role: 'admin',
        sessionToken: rawToken,
        mustChangePassword: Boolean(adminRow.must_change_password),
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ error: 'Lỗi xác thực quản trị.' });
    }
  });

  app.post('/api/auth/admin/change-password', requireAdmin, async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
      };
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        res.status(400).json({ error: 'Mật khẩu quản trị mới cần ít nhất 8 ký tự.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'Mật khẩu xác nhận không trùng khớp.' });
        return;
      }

      const db = getDb();
      const adminRow = db
        .prepare('SELECT id, password_hash FROM admin_settings LIMIT 1')
        .get() as { id: string; password_hash: string };

      if (!(await verifyPassword(adminRow.password_hash, currentPassword))) {
        res.status(401).json({ error: 'Mật khẩu quản trị hiện tại không chính xác.' });
        return;
      }

      const newHash = await hashPassword(newPassword);
      const now = new Date().toISOString();
      db.prepare(
        'UPDATE admin_settings SET password_hash = ?, password_changed_at = ?, must_change_password = 0 WHERE id = ?',
      ).run(newHash, now, adminRow.id);

      writeAuditLog('admin', 'CHANGE_ADMIN_PASSWORD', 'admin_settings', adminRow.id, 'Đổi mật khẩu quản trị');
      res.json({ ok: true, message: 'Đã đổi sang mật khẩu quản trị mạnh thành công.' });
    } catch (error) {
      console.error('Admin change password error:', error);
      res.status(500).json({ error: 'Không thể đổi mật khẩu quản trị.' });
    }
  });

  app.post('/api/auth/logout', (req: AuthedRequest, res) => {
    const rawToken = extractRequestSessionToken(req);
    if (rawToken) {
      const db = getDb();
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(rawToken));
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // ============================================================================
  // STUDENT PROTECTED ENDPOINTS: DASHBOARD, PROGRESS, NOTES, QUIZZES, GAMES, SURVEYS
  // ============================================================================
  app.get('/api/student/dashboard', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const studentId = req.auth!.studentId!;
    refreshStudentBadges(studentId);

    const progress = db
      .prepare('SELECT lesson_id, progress_percent, completion_status, explored_3d, exploration_data, updated_at FROM learning_progress WHERE student_id = ?')
      .all(studentId) as {
      lesson_id: string;
      progress_percent: number;
      completion_status: string;
      explored_3d: number;
      exploration_data: string;
      updated_at: string;
    }[];

    const attempts = db
      .prepare(
        `SELECT qa.id, qa.quiz_id, q.title AS quiz_title, q.lesson_id, qa.score, qa.max_score,
                qa.start_time, qa.submitted_at, qa.grading_status
         FROM quiz_attempts qa
         JOIN quizzes q ON q.id = qa.quiz_id
         WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL
         ORDER BY qa.submitted_at DESC`,
      )
      .all(studentId);

    const notes = db
      .prepare('SELECT id, lesson_id, note_text, created_at, updated_at FROM student_notes WHERE student_id = ? ORDER BY updated_at DESC')
      .all(studentId);

    const badges = db
      .prepare('SELECT badge_code, badge_title, badge_description, awarded_at FROM student_badges WHERE student_id = ? ORDER BY awarded_at DESC')
      .all(studentId);

    const gameHistory = db
      .prepare('SELECT id, game_type, lesson_id, score, max_score, duration_seconds, created_at FROM game_attempts WHERE student_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(studentId);

    const activeSurveysRaw = db
      .prepare('SELECT id, title, survey_phase, questions_json, created_at FROM surveys WHERE is_active = 1 ORDER BY created_at ASC')
      .all() as { id: string; title: string; survey_phase: string; questions_json: string; created_at: string }[];

    const respondedIds = new Set(
      (
        db.prepare('SELECT survey_id FROM survey_responses WHERE student_id = ?').all(studentId) as { survey_id: string }[]
      ).map((r) => r.survey_id),
    );

    const activeSurveys = activeSurveysRaw.map((s) => ({
      id: s.id,
      title: s.title,
      surveyPhase: s.survey_phase,
      questions: parseJsonSafe<string[]>(s.questions_json, []),
      completed: respondedIds.has(s.id),
    }));

    res.json({
      student: req.auth!.student,
      progress: progress.map((p) => ({
        lessonId: p.lesson_id,
        progressPercent: p.progress_percent,
        completionStatus: p.completion_status,
        explored3d: Boolean(p.explored_3d),
        explorationData: parseJsonSafe(p.exploration_data, {}),
        updatedAt: p.updated_at,
      })),
      attempts,
      notes,
      badges,
      gameHistory,
      activeSurveys,
    });
  });

  app.post('/api/student/progress', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const studentId = req.auth!.studentId!;
    const { lessonId, progressPercent, explored3d, explorationData } = req.body as {
      lessonId?: string;
      progressPercent?: number;
      explored3d?: boolean;
      explorationData?: Record<string, unknown>;
    };

    if (!lessonId) {
      res.status(400).json({ error: 'Thiếu mã bài học.' });
      return;
    }

    const existing = db
      .prepare('SELECT progress_percent, explored_3d, exploration_data FROM learning_progress WHERE student_id = ? AND lesson_id = ?')
      .get(studentId, lessonId) as
      | { progress_percent: number; explored_3d: number; exploration_data: string }
      | undefined;

    const mergedPercent = Math.min(
      100,
      Math.max(existing?.progress_percent ?? 0, typeof progressPercent === 'number' ? progressPercent : 0),
    );
    const mergedExplored = (existing?.explored_3d ?? 0) === 1 || Boolean(explored3d) ? 1 : 0;
    const prevData = parseJsonSafe<Record<string, unknown>>(existing?.exploration_data, {});
    const nextData = explorationData ? { ...prevData, ...explorationData } : prevData;
    const status = mergedPercent >= 100 ? 'completed' : 'in_progress';
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO learning_progress (student_id, lesson_id, progress_percent, completion_status, explored_3d, exploration_data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, lesson_id) DO UPDATE SET
         progress_percent = excluded.progress_percent,
         completion_status = excluded.completion_status,
         explored_3d = excluded.explored_3d,
         exploration_data = excluded.exploration_data,
         updated_at = excluded.updated_at`,
    ).run(studentId, lessonId, mergedPercent, status, mergedExplored, JSON.stringify(nextData), now);

    refreshStudentBadges(studentId);
    res.json({ ok: true, progressPercent: mergedPercent, completionStatus: status, explored3d: Boolean(mergedExplored) });
  });

  app.post('/api/student/notes', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const studentId = req.auth!.studentId!;
    const { lessonId, noteText } = req.body as { lessonId?: string; noteText?: string };
    if (!lessonId || !noteText?.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập nội dung ghi chú.' });
      return;
    }
    const now = new Date().toISOString();
    const existing = db
      .prepare('SELECT id FROM student_notes WHERE student_id = ? AND lesson_id = ?')
      .get(studentId, lessonId) as { id: string } | undefined;

    if (existing) {
      db.prepare('UPDATE student_notes SET note_text = ?, updated_at = ? WHERE id = ?').run(
        noteText.trim(),
        now,
        existing.id,
      );
      res.json({ ok: true, id: existing.id });
    } else {
      const id = crypto.randomUUID();
      db.prepare(
        'INSERT INTO student_notes (id, student_id, lesson_id, note_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(id, studentId, lessonId, noteText.trim(), now, now);
      res.json({ ok: true, id });
    }
  });

  // Quizzes list for students (filtered by publication_status & class assignment)
  app.get('/api/student/quizzes', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const studentClass = req.auth!.student!.className;
    const rows = db
      .prepare("SELECT id, title, lesson_id, assigned_classes, duration_minutes, open_at, close_at, question_ids, created_at FROM quizzes WHERE publication_status = 'published' ORDER BY created_at DESC")
      .all() as {
      id: string;
      title: string;
      lesson_id: string | null;
      assigned_classes: string;
      duration_minutes: number;
      open_at: string | null;
      close_at: string | null;
      question_ids: string;
      created_at: string;
    }[];

    const filtered = rows
      .filter((q) => {
        const cls = parseJsonSafe<string[]>(q.assigned_classes, []);
        return cls.length === 0 || cls.includes(studentClass);
      })
      .map((q) => ({
        id: q.id,
        title: q.title,
        lessonId: q.lesson_id,
        durationMinutes: q.duration_minutes,
        openAt: q.open_at,
        closeAt: q.close_at,
        questionCount: parseJsonSafe<string[]>(q.question_ids, []).length,
      }));

    res.json({ quizzes: filtered });
  });

  app.get('/api/student/quizzes/:id/start', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const qz = db
      .prepare("SELECT id, title, lesson_id, assigned_classes, duration_minutes, open_at, close_at, question_ids FROM quizzes WHERE id = ? AND publication_status = 'published'")
      .get(req.params.id) as
      | {
          id: string;
          title: string;
          lesson_id: string | null;
          assigned_classes: string;
          duration_minutes: number;
          open_at: string | null;
          close_at: string | null;
          question_ids: string;
        }
      | undefined;

    if (!qz) {
      res.status(404).json({ error: 'Không tìm thấy đề kiểm tra.' });
      return;
    }

    const nowMs = Date.now();
    if (qz.open_at && new Date(qz.open_at).getTime() > nowMs) {
      res.status(403).json({ error: 'Đề kiểm tra chưa đến thời gian mở.' });
      return;
    }
    if (qz.close_at && new Date(qz.close_at).getTime() < nowMs) {
      res.status(403).json({ error: 'Đề kiểm tra đã hết thời gian làm bài.' });
      return;
    }

    const qIds = parseJsonSafe<string[]>(qz.question_ids, []);
    if (qIds.length === 0) {
      res.status(400).json({ error: 'Đề kiểm tra chưa có câu hỏi.' });
      return;
    }

    const placeholders = qIds.map(() => '?').join(',');
    const qRows = db
      .prepare(`SELECT id, lesson_id, question_type, content, answer_data, difficulty FROM questions WHERE id IN (${placeholders})`)
      .all(...qIds) as {
      id: string;
      lesson_id: string;
      question_type: string;
      content: string;
      answer_data: string;
      difficulty: string;
    }[];

    const questions = qIds
      .map((id) => qRows.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => {
        const spec = parseJsonSafe<QuestionAnswerSpec>(r.answer_data, {});
        return {
          id: r.id,
          lessonId: r.lesson_id,
          questionType: r.question_type,
          content: r.content,
          difficulty: r.difficulty,
          promptData: {
            options: spec.options,
            statements: spec.statements?.map((s) => ({ id: s.id, text: s.text })),
            items: spec.items,
            leftItems: spec.leftItems,
            rightItems: spec.rightItems,
            rubric: spec.rubric,
            sourceExcerpt: spec.sourceExcerpt,
            sourceCitation: spec.sourceCitation,
            modelSlug: spec.modelSlug,
            points: spec.points ?? 1,
          },
        };
      });

    res.json({
      quiz: {
        id: qz.id,
        title: qz.title,
        lessonId: qz.lesson_id,
        durationMinutes: qz.duration_minutes,
      },
      startTime: new Date().toISOString(),
      questions,
    });
  });

  app.post('/api/student/quizzes/:id/submit', requireStudent, (req: AuthedRequest, res) => {
    try {
      const db = getDb();
      const studentId = req.auth!.studentId!;
      const quizId = req.params.id;
      const { answers, startTime } = req.body as {
        answers?: Record<string, unknown>;
        startTime?: string;
      };

      const qz = db
        .prepare("SELECT id, title, lesson_id, question_ids FROM quizzes WHERE id = ? AND publication_status = 'published'")
        .get(quizId) as { id: string; title: string; lesson_id: string | null; question_ids: string } | undefined;

      if (!qz) {
        res.status(404).json({ error: 'Không tìm thấy đề kiểm tra.' });
        return;
      }

      const qIds = parseJsonSafe<string[]>(qz.question_ids, []);
      const placeholders = qIds.map(() => '?').join(',');
      const qRows = db
        .prepare(`SELECT id, lesson_id, question_type, content, answer_data, explanation FROM questions WHERE id IN (${placeholders})`)
        .all(...qIds) as {
        id: string;
        lesson_id: string;
        question_type: QuestionType;
        content: string;
        answer_data: string;
        explanation: string;
      }[];

      const submittedAnswers = answers && typeof answers === 'object' ? answers : {};
      let rawAwarded = 0;
      let rawMax = 0;
      let hasPendingManual = false;

      const gradedItems: {
        questionId: string;
        content: string;
        questionType: QuestionType;
        studentAnswer: unknown;
        awardedPoints: number;
        maxPoints: number;
        isCorrect: boolean;
        isManual: boolean;
        explanation: string;
      }[] = [];

      for (const qId of qIds) {
        const row = qRows.find((r) => r.id === qId);
        if (!row) continue;
        const spec = parseJsonSafe<QuestionAnswerSpec>(row.answer_data, {});
        const ans = submittedAnswers[qId];
        const g = gradeQuestionAnswer(row.question_type, spec, ans);

        rawAwarded += g.awardedPoints;
        rawMax += g.maxPoints;
        if (g.isManual) hasPendingManual = true;

        gradedItems.push({
          questionId: row.id,
          content: row.content,
          questionType: row.question_type,
          studentAnswer: ans ?? null,
          awardedPoints: g.awardedPoints,
          maxPoints: g.maxPoints,
          isCorrect: g.isCorrect,
          isManual: g.isManual,
          explanation: row.explanation,
        });
      }

      const normalizedScore10 = rawMax > 0 ? Number(((rawAwarded / rawMax) * 10).toFixed(2)) : 0;
      const attemptId = crypto.randomUUID();
      const now = new Date().toISOString();
      const gradingStatus = hasPendingManual ? 'pending_manual' : 'graded';

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO quiz_attempts (id, student_id, quiz_id, score, max_score, start_time, submitted_at, grading_status)
           VALUES (?, ?, ?, ?, 10, ?, ?, ?)`,
        ).run(attemptId, studentId, quizId, normalizedScore10, startTime || now, now, gradingStatus);

        const insAns = db.prepare(
          `INSERT INTO quiz_answers (id, attempt_id, question_id, student_answer, awarded_points, max_points, teacher_feedback)
           VALUES (?, ?, ?, ?, ?, ?, '')`,
        );
        for (const item of gradedItems) {
          insAns.run(
            crypto.randomUUID(),
            attemptId,
            item.questionId,
            JSON.stringify(item.studentAnswer),
            item.awardedPoints,
            item.maxPoints,
          );
        }

        if (qz.lesson_id && normalizedScore10 >= 5) {
          db.prepare(
            `INSERT INTO learning_progress (student_id, lesson_id, progress_percent, completion_status, explored_3d, exploration_data, updated_at)
             VALUES (?, ?, 100, 'completed', 0, '{}', ?)
             ON CONFLICT(student_id, lesson_id) DO UPDATE SET
               progress_percent = MAX(learning_progress.progress_percent, 100),
               completion_status = 'completed',
               updated_at = excluded.updated_at`,
          ).run(studentId, qz.lesson_id, now);
        }
      });
      tx();

      refreshStudentBadges(studentId);

      res.json({
        attemptId,
        score: normalizedScore10,
        maxScore: 10,
        rawAwarded,
        rawMax,
        gradingStatus,
        details: gradedItems,
      });
    } catch (error) {
      console.error('Submit quiz error:', error);
      res.status(500).json({ error: 'Không thể nộp bài kiểm tra.' });
    }
  });

  app.post('/api/student/games/submit', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const studentId = req.auth!.studentId!;
    const { gameType, lessonId, score, maxScore, durationSeconds } = req.body as {
      gameType?: string;
      lessonId?: string;
      score?: number;
      maxScore?: number;
      durationSeconds?: number;
    };

    if (!gameType || typeof score !== 'number' || typeof maxScore !== 'number' || maxScore <= 0) {
      res.status(400).json({ error: 'Dữ liệu kết quả trò chơi không hợp lệ.' });
      return;
    }

    const boundedScore = Math.max(0, Math.min(score, maxScore));
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO game_attempts (id, student_id, game_type, lesson_id, score, max_score, duration_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, studentId, gameType, lessonId || null, boundedScore, maxScore, Math.max(0, Math.round(durationSeconds || 0)), now);

    refreshStudentBadges(studentId);
    res.json({ ok: true, id, score: boundedScore, maxScore });
  });

  app.post('/api/student/surveys/:id/submit', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const studentId = req.auth!.studentId!;
    const surveyId = req.params.id;
    const { ratings, comment } = req.body as { ratings?: number[]; comment?: string };

    if (!Array.isArray(ratings) || ratings.length === 0 || ratings.some((r) => typeof r !== 'number' || r < 1 || r > 5)) {
      res.status(400).json({ error: 'Vui lòng đánh giá đầy đủ các tiêu chí theo thang đo 1–5.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO survey_responses (id, survey_id, student_id, ratings_json, comment, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(survey_id, student_id) DO UPDATE SET
         ratings_json = excluded.ratings_json,
         comment = excluded.comment,
         submitted_at = excluded.submitted_at`,
    ).run(crypto.randomUUID(), surveyId, studentId, JSON.stringify(ratings), (comment || '').trim(), now);

    res.json({ ok: true });
  });

  // ============================================================================
  // SỬ GIA AI 11 ENDPOINTS
  // ============================================================================
  app.get('/api/ai/status', (_req, res) => {
    res.json({ configured: isGeminiConfigured() });
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, history, lessonId } = req.body as {
        message?: string;
        history?: { role: 'user' | 'model'; text: string }[];
        lessonId?: string;
      };
      if (!message?.trim()) {
        res.status(400).json({ error: 'Vui lòng nhập câu hỏi lịch sử cần giải đáp.' });
        return;
      }

      if (!isGeminiConfigured()) {
        res.status(503).json({
          configured: false,
          error: 'Trợ lý AI chưa được kích hoạt (chưa cấu hình GEMINI_API_KEY trên máy chủ). Vui lòng sử dụng kho hướng dẫn học tập đã duyệt bên dưới.',
        });
        return;
      }

      const db = getDb();
      const adminRow = db.prepare('SELECT site_config FROM admin_settings LIMIT 1').get() as { site_config: string } | undefined;
      const siteConfig = parseJsonSafe<SiteConfig>(adminRow?.site_config, DEFAULT_SITE_CONFIG);

      const result = await askSuGiaAi({
        message: message.trim(),
        history,
        lessonId,
        adminNote: siteConfig.aiSystemNote,
      });

      res.json({ configured: true, ...result });
    } catch (error) {
      console.error('Su Gia AI chat error:', error);
      res.status(500).json({
        configured: isGeminiConfigured(),
        error: 'Không thể kết nối tới dịch vụ Gemini lúc này. Vui lòng kiểm tra khóa API trong Settings > Secrets hoặc thử lại sau.',
      });
    }
  });

  // ============================================================================
  // TEACHER ADMIN ENDPOINTS (All strictly protected by requireAdmin!)
  // ============================================================================
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const db = getDb();
    const totalStudents = (db.prepare('SELECT COUNT(*) AS cnt FROM students').get() as { cnt: number }).cnt;
    const activeStudents = (db.prepare("SELECT COUNT(*) AS cnt FROM students WHERE status = 'active'").get() as { cnt: number }).cnt;
    const recentActiveStudents = (
      db
        .prepare("SELECT COUNT(*) AS cnt FROM students WHERE last_login_at IS NOT NULL AND last_login_at >= datetime('now', '-7 days')")
        .get() as { cnt: number }
    ).cnt;
    const totalClasses = (db.prepare("SELECT COUNT(*) AS cnt FROM classes WHERE status = 'active'").get() as { cnt: number }).cnt;
    const publishedLessons = (db.prepare("SELECT COUNT(*) AS cnt FROM lessons WHERE publication_status = 'published'").get() as { cnt: number }).cnt;
    const activeModels = (db.prepare("SELECT COUNT(*) AS cnt FROM models_3d WHERE review_status = 'published'").get() as { cnt: number }).cnt;
    const completedQuizAttempts = (db.prepare('SELECT COUNT(*) AS cnt FROM quiz_attempts WHERE submitted_at IS NOT NULL').get() as { cnt: number }).cnt;
    const pendingManualGrading = (
      db.prepare("SELECT COUNT(*) AS cnt FROM quiz_attempts WHERE grading_status = 'pending_manual'").get() as { cnt: number }
    ).cnt;
    const total3dInteractions = (
      db.prepare('SELECT COUNT(*) AS cnt FROM learning_progress WHERE explored_3d = 1').get() as { cnt: number }
    ).cnt;

    const classAverages = db
      .prepare(
        `SELECT c.class_name AS className,
                COUNT(DISTINCT s.id) AS studentCount,
                COUNT(qa.id) AS attemptCount,
                ROUND(AVG(qa.score), 2) AS avgScore
         FROM classes c
         LEFT JOIN students s ON s.class_name = c.class_name
         LEFT JOIN quiz_attempts qa ON qa.student_id = s.id AND qa.submitted_at IS NOT NULL
         GROUP BY c.class_name
         ORDER BY c.class_name ASC`,
      )
      .all();

    res.json({
      totalStudents,
      activeStudents,
      recentActiveStudents,
      totalClasses,
      publishedLessons,
      activeModels,
      completedQuizAttempts,
      pendingManualGrading,
      total3dInteractions,
      classAverages,
    });
  });

  // --- Admin: Student Management ---
  app.get('/api/admin/students', requireAdmin, (req, res) => {
    const db = getDb();
    const q = String(req.query.q || '').trim().toLowerCase();
    const className = String(req.query.className || '').trim();
    const status = String(req.query.status || '').trim();

    let sql = `
      SELECT s.id, s.full_name AS fullName, s.class_name AS className, s.username,
             s.status, s.must_change_password AS mustChangePassword,
             s.created_at AS createdAt, s.last_login_at AS lastLoginAt,
             (SELECT COUNT(*) FROM learning_progress lp WHERE lp.student_id = s.id AND lp.completion_status = 'completed') AS completedLessons,
             (SELECT ROUND(AVG(qa.score), 2) FROM quiz_attempts qa WHERE qa.student_id = s.id AND qa.submitted_at IS NOT NULL) AS avgScore,
             (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.student_id = s.id AND qa.submitted_at IS NOT NULL) AS attemptCount
      FROM students s
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (q) {
      sql += ' AND (LOWER(s.full_name) LIKE ? OR LOWER(s.username) LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (className) {
      sql += ' AND s.class_name = ?';
      params.push(className);
    }
    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY s.created_at DESC';

    const students = db.prepare(sql).all(...params);
    res.json({ students });
  });

  app.get('/api/admin/students/:id/detail', requireAdmin, (req, res) => {
    const db = getDb();
    const st = db
      .prepare('SELECT id, full_name AS fullName, class_name AS className, username, status, created_at AS createdAt, last_login_at AS lastLoginAt FROM students WHERE id = ?')
      .get(req.params.id);
    if (!st) {
      res.status(404).json({ error: 'Không tìm thấy học sinh.' });
      return;
    }
    const progress = db
      .prepare(
        `SELECT lp.lesson_id AS lessonId, l.lesson_number AS lessonNumber, l.title,
                lp.progress_percent AS progressPercent, lp.completion_status AS completionStatus,
                lp.explored_3d AS explored3d, lp.updated_at AS updatedAt
         FROM learning_progress lp
         JOIN lessons l ON l.id = lp.lesson_id
         WHERE lp.student_id = ?
         ORDER BY l.lesson_number ASC`,
      )
      .all(req.params.id);

    const attempts = db
      .prepare(
        `SELECT qa.id, q.title AS quizTitle, qa.score, qa.max_score AS maxScore, qa.submitted_at AS submittedAt, qa.grading_status AS gradingStatus
         FROM quiz_attempts qa
         JOIN quizzes q ON q.id = qa.quiz_id
         WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL
         ORDER BY qa.submitted_at DESC`,
      )
      .all(req.params.id);

    res.json({ student: st, progress, attempts });
  });

  app.patch('/api/admin/students/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const { fullName, className, status } = req.body as {
      fullName?: string;
      className?: string;
      status?: 'active' | 'locked';
    };
    const existing = db.prepare('SELECT id, full_name, class_name, status FROM students WHERE id = ?').get(req.params.id) as
      | { id: string; full_name: string; class_name: string; status: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy tài khoản học sinh.' });
      return;
    }

    const nextName = fullName?.trim() || existing.full_name;
    const nextClass = className?.trim().toUpperCase() || existing.class_name;
    const nextStatus = status === 'locked' || status === 'active' ? status : existing.status;
    const now = new Date().toISOString();

    db.prepare('UPDATE students SET full_name = ?, class_name = ?, status = ?, updated_at = ? WHERE id = ?').run(
      nextName,
      nextClass,
      nextStatus,
      now,
      existing.id,
    );
    if (nextStatus === 'locked') {
      db.prepare('DELETE FROM sessions WHERE student_id = ?').run(existing.id);
    }

    writeAuditLog('admin', 'UPDATE_STUDENT', 'student', existing.id, `${nextName} - ${nextClass} - ${nextStatus}`);
    res.json({ ok: true });
  });

  app.post('/api/admin/students/:id/reset-password', requireAdmin, async (req, res) => {
    const db = getDb();
    const { newPassword } = req.body as { newPassword?: string };
    const tempPassword = (newPassword || '').trim() || `HS${Math.floor(100000 + Math.random() * 900000)}`;
    if (tempPassword.length < 6) {
      res.status(400).json({ error: 'Mật khẩu đặt lại phải từ 6 ký tự trở lên.' });
      return;
    }

    const st = db.prepare('SELECT id, username FROM students WHERE id = ?').get(req.params.id) as
      | { id: string; username: string }
      | undefined;
    if (!st) {
      res.status(404).json({ error: 'Không tìm thấy học sinh.' });
      return;
    }

    const hashVal = await hashPassword(tempPassword);
    db.prepare('UPDATE students SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?').run(
      hashVal,
      new Date().toISOString(),
      st.id,
    );
    writeAuditLog('admin', 'RESET_STUDENT_PASSWORD', 'student', st.id, `Đặt lại mật khẩu cho ${st.username}`);

    res.json({ ok: true, temporaryPassword: tempPassword });
  });

  app.delete('/api/admin/students/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const st = db.prepare('SELECT id, full_name, username FROM students WHERE id = ?').get(req.params.id) as
      | { id: string; full_name: string; username: string }
      | undefined;
    if (!st) {
      res.status(404).json({ error: 'Không tìm thấy học sinh.' });
      return;
    }
    db.prepare('DELETE FROM students WHERE id = ?').run(st.id);
    writeAuditLog('admin', 'DELETE_STUDENT', 'student', st.id, `${st.full_name} (${st.username})`);
    res.json({ ok: true });
  });

  app.get('/api/admin/students/export/csv', requireAdmin, (req, res) => {
    const db = getDb();
    const className = String(req.query.className || '').trim();
    const rows = (
      className
        ? db
            .prepare(
              `SELECT s.full_name, s.class_name, s.username, s.status, s.created_at,
                      (SELECT COUNT(*) FROM learning_progress lp WHERE lp.student_id = s.id AND lp.completion_status = 'completed') AS completed_lessons,
                      (SELECT ROUND(AVG(qa.score), 2) FROM quiz_attempts qa WHERE qa.student_id = s.id AND qa.submitted_at IS NOT NULL) AS avg_score
               FROM students s WHERE s.class_name = ? ORDER BY s.full_name ASC`,
            )
            .all(className)
        : db
            .prepare(
              `SELECT s.full_name, s.class_name, s.username, s.status, s.created_at,
                      (SELECT COUNT(*) FROM learning_progress lp WHERE lp.student_id = s.id AND lp.completion_status = 'completed') AS completed_lessons,
                      (SELECT ROUND(AVG(qa.score), 2) FROM quiz_attempts qa WHERE qa.student_id = s.id AND qa.submitted_at IS NOT NULL) AS avg_score
               FROM students s ORDER BY s.class_name ASC, s.full_name ASC`,
            )
            .all()
    ) as Record<string, unknown>[];

    const header = ['STT', 'Họ và tên', 'Lớp', 'Tên đăng nhập', 'Trạng thái', 'Số bài hoàn thành', 'Điểm TB', 'Ngày đăng ký'];
    const lines = [
      header.join(','),
      ...rows.map((r, idx) =>
        [
          idx + 1,
          escapeCsvCell(r.full_name),
          escapeCsvCell(r.class_name),
          escapeCsvCell(r.username),
          r.status === 'active' ? 'Hoạt động' : 'Đã khóa',
          r.completed_lessons ?? 0,
          r.avg_score ?? '',
          escapeCsvCell(r.created_at),
        ].join(','),
      ),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="danh_sach_hoc_sinh${className ? `_${className}` : ''}.csv"`);
    res.send('\uFEFF' + lines.join('\n'));
  });

  // --- Admin: Classes Management ---
  app.get('/api/admin/classes', requireAdmin, (_req, res) => {
    const db = getDb();
    const classes = db
      .prepare(
        `SELECT c.id, c.class_name AS className, c.school_year AS schoolYear, c.status,
                COUNT(DISTINCT s.id) AS studentCount,
                ROUND(AVG(qa.score), 2) AS avgScore
         FROM classes c
         LEFT JOIN students s ON s.class_name = c.class_name
         LEFT JOIN quiz_attempts qa ON qa.student_id = s.id AND qa.submitted_at IS NOT NULL
         GROUP BY c.id
         ORDER BY c.class_name ASC`,
      )
      .all();

    res.json({ classes });
  });

  app.post('/api/admin/classes', requireAdmin, (req, res) => {
    const db = getDb();
    const className = String(req.body?.className || '').trim().toUpperCase();
    const schoolYear = String(req.body?.schoolYear || '2026 - 2027').trim();
    if (!className) {
      res.status(400).json({ error: 'Tên lớp không được để trống.' });
      return;
    }
    const id = `cls-${className.toLowerCase()}-${Date.now().toString(36)}`;
    try {
      db.prepare('INSERT INTO classes (id, class_name, school_year, status, created_at) VALUES (?, ?, ?, ?, ?)').run(
        id,
        className,
        schoolYear,
        'active',
        new Date().toISOString(),
      );
      writeAuditLog('admin', 'CREATE_CLASS', 'class', id, className);
      res.status(201).json({ ok: true, id });
    } catch {
      res.status(409).json({ error: 'Tên lớp này đã tồn tại.' });
    }
  });

  app.patch('/api/admin/classes/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const { className, schoolYear, status } = req.body as { className?: string; schoolYear?: string; status?: string };
    const existing = db.prepare('SELECT id, class_name, school_year, status FROM classes WHERE id = ?').get(req.params.id) as
      | { id: string; class_name: string; school_year: string; status: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy lớp học.' });
      return;
    }
    const nextName = className?.trim().toUpperCase() || existing.class_name;
    const nextYear = schoolYear?.trim() || existing.school_year;
    const nextStatus = status || existing.status;

    const tx = db.transaction(() => {
      db.prepare('UPDATE classes SET class_name = ?, school_year = ?, status = ? WHERE id = ?').run(
        nextName,
        nextYear,
        nextStatus,
        existing.id,
      );
      if (nextName !== existing.class_name) {
        db.prepare('UPDATE students SET class_name = ? WHERE class_name = ?').run(nextName, existing.class_name);
      }
    });
    tx();
    res.json({ ok: true });
  });

  app.get('/api/admin/classes/:className/ranking', requireAdmin, (req, res) => {
    const db = getDb();
    const ranking = db
      .prepare(
        `SELECT s.id, s.full_name AS fullName, s.username,
                COUNT(DISTINCT qa.id) AS attemptCount,
                ROUND(AVG(qa.score), 2) AS avgScore,
                (SELECT COUNT(*) FROM learning_progress lp WHERE lp.student_id = s.id AND lp.completion_status = 'completed') AS completedLessons
         FROM students s
         LEFT JOIN quiz_attempts qa ON qa.student_id = s.id AND qa.submitted_at IS NOT NULL
         WHERE s.class_name = ?
         GROUP BY s.id
         ORDER BY COALESCE(AVG(qa.score), -1) DESC, completedLessons DESC`,
      )
      .all(req.params.className);
    res.json({ ranking });
  });

  // --- Admin: Lessons & Topics Management ---
  app.get('/api/admin/lessons', requireAdmin, (_req, res) => {
    const db = getDb();
    const topics = db.prepare('SELECT id, title, description, sort_order, publication_status FROM topics ORDER BY sort_order ASC').all();
    const lessons = (
      db
        .prepare('SELECT id, topic_id, lesson_number, title, objectives, approved_content, publication_status, version, updated_at FROM lessons ORDER BY lesson_number ASC')
        .all() as Record<string, unknown>[]
    ).map((l) => ({
      id: l.id,
      topicId: l.topic_id,
      lessonNumber: l.lesson_number,
      title: l.title,
      objectives: parseJsonSafe(String(l.objectives), { knowledge: [], competence: [], qualities: [] }),
      content: parseJsonSafe(String(l.approved_content), {}),
      publicationStatus: l.publication_status,
      version: l.version,
      updatedAt: l.updated_at,
    }));
    res.json({ topics, lessons });
  });

  app.patch('/api/admin/lessons/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const existing = db
      .prepare('SELECT id, title, objectives, approved_content, publication_status, version FROM lessons WHERE id = ?')
      .get(req.params.id) as
      | {
          id: string;
          title: string;
          objectives: string;
          approved_content: string;
          publication_status: string;
          version: number;
        }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy bài học.' });
      return;
    }

    const { title, objectives, content, publicationStatus } = req.body as {
      title?: string;
      objectives?: unknown;
      content?: unknown;
      publicationStatus?: string;
    };

    const nextTitle = title?.trim() || existing.title;
    const nextObjectives = objectives ? JSON.stringify(objectives) : existing.objectives;
    const nextContent = content ? JSON.stringify(content) : existing.approved_content;
    const nextStatus = publicationStatus || existing.publication_status;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE lessons
       SET title = ?, objectives = ?, approved_content = ?, publication_status = ?, version = version + 1, updated_at = ?
       WHERE id = ?`,
    ).run(nextTitle, nextObjectives, nextContent, nextStatus, now, existing.id);

    writeAuditLog('admin', 'UPDATE_LESSON', 'lesson', existing.id, `${nextTitle} (${nextStatus})`);
    res.json({ ok: true });
  });

  // --- Admin: 3D Models & GLB Upload ---
  app.get('/api/admin/models', requireAdmin, (_req, res) => {
    const db = getDb();
    const modelsRaw = db
      .prepare(
        `SELECT id, slug, lesson_id, model_name, file_url, thumbnail_url, description, source_reference,
                author_name, animation_names, camera_settings, phases_json, review_status, version, created_at
         FROM models_3d ORDER BY created_at DESC`,
      )
      .all() as Record<string, unknown>[];

    const hotspots = db.prepare('SELECT * FROM model_hotspots').all() as Record<string, unknown>[];

    const models = modelsRaw.map((m) => ({
      id: m.id,
      slug: m.slug,
      lessonId: m.lesson_id,
      modelName: m.model_name,
      fileUrl: m.file_url,
      thumbnailUrl: m.thumbnail_url,
      description: m.description,
      sourceReference: m.source_reference,
      authorName: m.author_name,
      animationNames: parseJsonSafe(String(m.animation_names), []),
      cameraSettings: parseJsonSafe(String(m.camera_settings), { position: [9, 7, 11], target: [0, 0, 0] }),
      phases: parseJsonSafe(String(m.phases_json), []),
      reviewStatus: m.review_status,
      version: m.version,
      createdAt: m.created_at,
      hotspots: hotspots
        .filter((h) => h.model_id === m.id)
        .map((h) => ({
          id: h.id,
          x: h.position_x,
          y: h.position_y,
          z: h.position_z,
          title: h.title,
          description: h.description,
          phaseKey: h.phase_key,
        })),
    }));

    res.json({ models });
  });

  app.post(
    '/api/admin/models/upload',
    requireAdmin,
    uploadMiddleware.fields([
      { name: 'glbFile', maxCount: 1 },
      { name: 'thumbnailFile', maxCount: 1 },
    ]),
    (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        const glbFile = files?.glbFile?.[0];
        const thumbFile = files?.thumbnailFile?.[0];

        if (!glbFile) {
          res.status(400).json({ error: 'Vui lòng chọn tệp mô hình .glb để tải lên.' });
          return;
        }

        const binaryInfo = parseGlbHeaderMetadata(glbFile.path);
        if (!binaryInfo.valid) {
          try {
            fs.unlinkSync(glbFile.path);
          } catch {
            // ignore cleanup error
          }
          res.status(400).json({ error: 'Tệp tải lên không đúng định dạng nhị phân chuẩn glTF 2.0 (.glb).' });
          return;
        }

        const modelName = String(req.body.modelName || '').trim();
        const lessonId = String(req.body.lessonId || 'lesson-7').trim();
        const description = String(req.body.description || '').trim();
        const sourceReference = String(
          req.body.sourceReference ||
            (binaryInfo.generator.includes('Python')
              ? `Mô phỏng 3D sinh từ ${binaryInfo.generator}`
              : 'Tư liệu do Giáo viên bổ sung'),
        ).trim();
        const authorName = String(req.body.authorName || binaryInfo.generator || 'Giáo viên Lịch sử').trim();
        const reviewStatus = String(req.body.reviewStatus || 'published').trim();
        const version = String(req.body.version || '1.0').trim();

        if (!modelName) {
          res.status(400).json({ error: 'Vui lòng nhập Tên mô hình 3D.' });
          return;
        }

        const customCamera = parseJsonSafe<{ position?: number[]; target?: number[] } | null>(
          req.body.cameraSettingsJson,
          null,
        );
        const cameraSettings =
          customCamera && Array.isArray(customCamera.position) && Array.isArray(customCamera.target)
            ? customCamera
            : { position: [9.5, 7.2, 11.5], target: [0, 0.4, 0] };

        const customPhases = parseJsonSafe<unknown[]>(req.body.phasesJson, []);
        const defaultPhases =
          customPhases.length > 0
            ? customPhases
            : binaryInfo.animationNames.map((animName, idx) => ({
                key: idx === 0 ? 'all' : `phase-${idx + 1}`,
                label: idx === 0 ? `Toàn cảnh (${animName})` : `Hoạt ảnh ${idx + 1}: ${animName}`,
                animationName: animName,
                cameraPosition: cameraSettings.position,
                cameraTarget: cameraSettings.target,
                summary: description || 'Mô phỏng không gian lịch sử 3D chuẩn glTF 2.0 (.glb).',
              }));

        const customHotspots = parseJsonSafe<
          { x?: number; y?: number; z?: number; title?: string; description?: string; phaseKey?: string }[]
        >(req.body.hotspotsJson, []);

        const id = `model-${crypto.randomUUID().slice(0, 8)}`;
        const slug =
          modelName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') +
          '-' +
          Date.now().toString(36).slice(-4);

        const fileUrl = `/uploads/models/${glbFile.filename}`;
        const thumbnailUrl = thumbFile ? `/uploads/models/${thumbFile.filename}` : '';
        const now = new Date().toISOString();

        const db = getDb();
        const tx = db.transaction(() => {
          db.prepare(
            `INSERT INTO models_3d (
              id, slug, lesson_id, model_name, file_url, thumbnail_url, description,
              source_reference, author_name, animation_names, camera_settings, phases_json,
              review_status, version, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            id,
            slug,
            lessonId,
            modelName,
            fileUrl,
            thumbnailUrl,
            description || 'Mô hình 3D lịch sử phục vụ học tập.',
            sourceReference,
            authorName,
            JSON.stringify(binaryInfo.animationNames),
            JSON.stringify(cameraSettings),
            JSON.stringify(defaultPhases),
            reviewStatus,
            version,
            now,
          );

          if (customHotspots.length > 0) {
            const insHs = db.prepare(
              'INSERT INTO model_hotspots (id, model_id, position_x, position_y, position_z, title, description, phase_key, question_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
            );
            for (const hs of customHotspots) {
              if (!hs.title?.trim()) continue;
              insHs.run(
                crypto.randomUUID(),
                id,
                Number(hs.x) || 0,
                Number(hs.y) || 0,
                Number(hs.z) || 0,
                hs.title.trim(),
                String(hs.description || '').trim(),
                hs.phaseKey || 'all',
              );
            }
          }
        });
        tx();

        writeAuditLog(
          'admin',
          'UPLOAD_GLB_MODEL',
          'model_3d',
          id,
          `${modelName} -> ${fileUrl} (${binaryInfo.generator})`,
        );
        res.status(201).json({
          ok: true,
          id,
          slug,
          fileUrl,
          generator: binaryInfo.generator,
          meshCount: binaryInfo.meshCount,
          animationNames: binaryInfo.animationNames,
        });
      } catch (error) {
        console.error('Upload GLB error:', error);
        res.status(500).json({ error: 'Không thể lưu tệp mô hình GLB.' });
      }
    },
  );

  app.post('/api/admin/models/generate-python', requireAdmin, (req, res) => {
    try {
      const {
        preset,
        modelName,
        lessonId,
        description,
        sourceReference,
        params,
        reviewStatus,
      } = req.body as {
        preset?: PythonGlbPreset;
        modelName?: string;
        lessonId?: string;
        description?: string;
        sourceReference?: string;
        params?: Record<string, unknown>;
        reviewStatus?: string;
      };

      const allowedPresets: readonly PythonGlbPreset[] = [
        'heritage_ecosystem',
        'naval_ambush',
        'maritime_sovereignty',
        'stone_citadel',
        'campaign_relief',
      ];
      const chosenPreset: PythonGlbPreset = allowedPresets.includes(preset as PythonGlbPreset)
        ? (preset as PythonGlbPreset)
        : 'heritage_ecosystem';

      const cleanName = String(modelName || '').trim();
      if (!cleanName) {
        res.status(400).json({ error: 'Vui lòng nhập Tên mô hình mô phỏng 3D trước khi chạy Python.' });
        return;
      }

      const filename = `py-${chosenPreset}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.glb`;
      const outPath = path.join(uploadDir, filename);

      const pyResult = generateCustomGlbViaPython(chosenPreset, outPath, params || {}, process.cwd());
      const fileUrl = `/uploads/models/${filename}`;

      const id = `model-${crypto.randomUUID().slice(0, 8)}`;
      const slug =
        cleanName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') +
        '-' +
        Date.now().toString(36).slice(-4);

      const finalLessonId = String(lessonId || 'lesson-7').trim();
      const finalDesc =
        String(description || '').trim() ||
        `Mô phỏng 3D lịch sử được lập trình và biên dịch trực tiếp từ Python 3 (${pyResult.generator}), đóng gói chuẩn nhị phân glTF 2.0 (.glb).`;
      const finalSource =
        String(sourceReference || '').trim() ||
        'SGK Lịch sử 11 – Kết nối tri thức với cuộc sống (Mô phỏng sinh từ Python 3)';
      const finalStatus = reviewStatus === 'draft' ? 'draft' : 'published';
      const now = new Date().toISOString();

      const db = getDb();
      const createdHotspots: {
        id: string;
        x: number;
        y: number;
        z: number;
        title: string;
        description: string;
        phaseKey: string;
      }[] = [];

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO models_3d (
            id, slug, lesson_id, model_name, file_url, thumbnail_url, description,
            source_reference, author_name, animation_names, camera_settings, phases_json,
            review_status, version, created_at
          ) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, '1.0', ?)`,
        ).run(
          id,
          slug,
          finalLessonId,
          cleanName,
          fileUrl,
          finalDesc,
          finalSource,
          pyResult.generator,
          JSON.stringify(pyResult.meta.animationNames || []),
          JSON.stringify(pyResult.meta.cameraSettings || { position: [10, 7.5, 12], target: [0, 0.3, 0] }),
          JSON.stringify(pyResult.meta.phases || []),
          finalStatus,
          now,
        );

        const insHs = db.prepare(
          'INSERT INTO model_hotspots (id, model_id, position_x, position_y, position_z, title, description, phase_key, question_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
        );
        for (const hs of pyResult.meta.hotspots || []) {
          const hsId = crypto.randomUUID();
          insHs.run(hsId, id, hs.x, hs.y, hs.z, hs.title, hs.description, hs.phaseKey || 'all');
          createdHotspots.push({
            id: hsId,
            x: hs.x,
            y: hs.y,
            z: hs.z,
            title: hs.title,
            description: hs.description,
            phaseKey: hs.phaseKey || 'all',
          });
        }
      });
      tx();

      writeAuditLog(
        'admin',
        'GENERATE_PYTHON_GLB',
        'model_3d',
        id,
        `${cleanName} -> ${fileUrl} (${pyResult.bytes} bytes)`,
      );

      res.status(201).json({
        ok: true,
        bytes: pyResult.bytes,
        generator: pyResult.generator,
        model: {
          id,
          slug,
          lessonId: finalLessonId,
          modelName: cleanName,
          fileUrl,
          thumbnailUrl: '',
          description: finalDesc,
          sourceReference: finalSource,
          authorName: pyResult.generator,
          animationNames: pyResult.meta.animationNames || [],
          cameraSettings: pyResult.meta.cameraSettings,
          phases: pyResult.meta.phases || [],
          reviewStatus: finalStatus,
          version: '1.0',
          hotspots: createdHotspots,
        },
      });
    } catch (error) {
      console.error('Python GLB generate error:', error);
      res.status(500).json({
        error: 'Không thể chạy trình biên dịch Python sinh tệp .glb. Vui lòng kiểm tra tham số đầu vào.',
      });
    }
  });

  app.delete('/api/admin/models/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const coreIds = new Set(['model-1', 'model-2', 'model-3', 'model-4', 'model-5', 'model-6', 'model-7']);
    if (coreIds.has(req.params.id)) {
      res.status(400).json({
        error: 'Không xóa 7 mô hình gốc của chương trình; thầy/cô có thể chuyển sang trạng thái Bản nháp nếu muốn ẩn.',
      });
      return;
    }
    const existing = db
      .prepare('SELECT id, model_name, file_url FROM models_3d WHERE id = ?')
      .get(req.params.id) as { id: string; model_name: string; file_url: string } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy mô hình 3D.' });
      return;
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM model_hotspots WHERE model_id = ?').run(req.params.id);
      db.prepare('DELETE FROM models_3d WHERE id = ?').run(req.params.id);
    });
    tx();

    if (existing.file_url.startsWith('/uploads/models/')) {
      const diskPath = path.join(uploadDir, path.basename(existing.file_url));
      if (fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch {
          // ignore
        }
      }
    }

    writeAuditLog('admin', 'DELETE_MODEL_3D', 'model_3d', req.params.id, existing.model_name);
    res.json({ ok: true });
  });

  app.patch('/api/admin/models/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM models_3d WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy mô hình 3D.' });
      return;
    }

    const { modelName, lessonId, description, sourceReference, reviewStatus, cameraSettings, animationNames, hotspots } =
      req.body as {
        modelName?: string;
        lessonId?: string;
        description?: string;
        sourceReference?: string;
        reviewStatus?: string;
        cameraSettings?: unknown;
        animationNames?: string[];
        hotspots?: { x: number; y: number; z: number; title: string; description: string; phaseKey?: string }[];
      };

    db.prepare(
      `UPDATE models_3d SET
        model_name = ?,
        lesson_id = ?,
        description = ?,
        source_reference = ?,
        review_status = ?,
        camera_settings = ?,
        animation_names = ?
       WHERE id = ?`,
    ).run(
      modelName?.trim() || existing.model_name,
      lessonId || existing.lesson_id,
      description?.trim() || existing.description,
      sourceReference?.trim() || existing.source_reference,
      reviewStatus || existing.review_status,
      cameraSettings ? JSON.stringify(cameraSettings) : existing.camera_settings,
      animationNames ? JSON.stringify(animationNames) : existing.animation_names,
      req.params.id,
    );

    if (Array.isArray(hotspots)) {
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM model_hotspots WHERE model_id = ?').run(req.params.id);
        const ins = db.prepare(
          'INSERT INTO model_hotspots (id, model_id, position_x, position_y, position_z, title, description, phase_key, question_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
        );
        for (const h of hotspots) {
          if (!h.title?.trim()) continue;
          ins.run(
            crypto.randomUUID(),
            req.params.id,
            Number(h.x) || 0,
            Number(h.y) || 0,
            Number(h.z) || 0,
            h.title.trim(),
            (h.description || '').trim(),
            h.phaseKey || 'all',
          );
        }
      });
      tx();
    }

    writeAuditLog('admin', 'UPDATE_MODEL_3D', 'model_3d', req.params.id, String(modelName || existing.model_name));
    res.json({ ok: true });
  });

  // --- Admin: Question Bank & Quizzes & Essay Rubric Grading ---
  app.get('/api/admin/questions', requireAdmin, (_req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM questions ORDER BY created_at DESC').all() as Record<string, unknown>[];
    res.json({
      questions: rows.map((r) => ({
        id: r.id,
        lessonId: r.lesson_id,
        questionType: r.question_type,
        content: r.content,
        answerData: parseJsonSafe(String(r.answer_data), {}),
        explanation: r.explanation,
        difficulty: r.difficulty,
        approved: Boolean(r.approved),
        createdAt: r.created_at,
      })),
    });
  });

  app.post('/api/admin/questions', requireAdmin, (req, res) => {
    const db = getDb();
    const { lessonId, questionType, content, answerData, explanation, difficulty, approved } = req.body as {
      lessonId?: string;
      questionType?: string;
      content?: string;
      answerData?: unknown;
      explanation?: string;
      difficulty?: string;
      approved?: boolean;
    };
    if (!lessonId || !questionType || !content?.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ bài học, loại câu hỏi và nội dung.' });
      return;
    }
    const id = `q-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(
      `INSERT INTO questions (id, lesson_id, question_type, content, answer_data, explanation, difficulty, approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      lessonId,
      questionType,
      content.trim(),
      JSON.stringify(answerData || {}),
      (explanation || '').trim(),
      difficulty || 'thong_hieu',
      approved === false ? 0 : 1,
      new Date().toISOString(),
    );
    writeAuditLog('admin', 'CREATE_QUESTION', 'question', id, content.trim().slice(0, 60));
    res.status(201).json({ ok: true, id });
  });

  app.delete('/api/admin/questions/:id', requireAdmin, (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.get('/api/admin/quizzes', requireAdmin, (_req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM quizzes ORDER BY created_at DESC').all() as Record<string, unknown>[];
    res.json({
      quizzes: rows.map((q) => ({
        id: q.id,
        title: q.title,
        lessonId: q.lesson_id,
        assignedClasses: parseJsonSafe<string[]>(String(q.assigned_classes), []),
        durationMinutes: q.duration_minutes,
        openAt: q.open_at,
        closeAt: q.close_at,
        publicationStatus: q.publication_status,
        questionIds: parseJsonSafe<string[]>(String(q.question_ids), []),
        createdAt: q.created_at,
      })),
    });
  });

  app.post('/api/admin/quizzes', requireAdmin, (req, res) => {
    const db = getDb();
    const { title, lessonId, assignedClasses, durationMinutes, openAt, closeAt, publicationStatus, questionIds } =
      req.body as {
        title?: string;
        lessonId?: string;
        assignedClasses?: string[];
        durationMinutes?: number;
        openAt?: string | null;
        closeAt?: string | null;
        publicationStatus?: string;
        questionIds?: string[];
      };

    if (!title?.trim() || !Array.isArray(questionIds) || questionIds.length === 0) {
      res.status(400).json({ error: 'Vui lòng nhập tên đề kiểm tra và chọn ít nhất 1 câu hỏi.' });
      return;
    }

    const id = `quiz-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(
      `INSERT INTO quizzes (id, title, lesson_id, assigned_classes, duration_minutes, open_at, close_at, publication_status, question_ids, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      title.trim(),
      lessonId || null,
      JSON.stringify(assignedClasses || []),
      Math.max(5, Number(durationMinutes) || 15),
      openAt || null,
      closeAt || null,
      publicationStatus || 'published',
      JSON.stringify(questionIds),
      new Date().toISOString(),
    );

    writeAuditLog('admin', 'CREATE_QUIZ', 'quiz', id, title.trim());
    res.status(201).json({ ok: true, id });
  });

  app.get('/api/admin/submissions', requireAdmin, (_req, res) => {
    const db = getDb();
    const attempts = db
      .prepare(
        `SELECT qa.id, qa.student_id AS studentId, s.full_name AS fullName, s.class_name AS className,
                qa.quiz_id AS quizId, q.title AS quizTitle, qa.score, qa.max_score AS maxScore,
                qa.submitted_at AS submittedAt, qa.grading_status AS gradingStatus
         FROM quiz_attempts qa
         JOIN students s ON s.id = qa.student_id
         JOIN quizzes q ON q.id = qa.quiz_id
         WHERE qa.submitted_at IS NOT NULL
         ORDER BY qa.submitted_at DESC`,
      )
      .all() as Record<string, unknown>[];

    const answers = db
      .prepare(
        `SELECT ans.id, ans.attempt_id AS attemptId, ans.question_id AS questionId,
                qs.question_type AS questionType, qs.content, qs.answer_data AS answerData,
                ans.student_answer AS studentAnswer, ans.awarded_points AS awardedPoints,
                ans.max_points AS maxPoints, ans.teacher_feedback AS teacherFeedback
         FROM quiz_answers ans
         JOIN questions qs ON qs.id = ans.question_id`,
      )
      .all() as Record<string, unknown>[];

    const enriched = attempts.map((a) => ({
      ...a,
      answers: answers
        .filter((ans) => ans.attemptId === a.id)
        .map((ans) => ({
          ...ans,
          studentAnswer: parseJsonSafe(String(ans.studentAnswer), ans.studentAnswer),
          answerData: parseJsonSafe(String(ans.answerData), {}),
        })),
    }));

    res.json({ submissions: enriched });
  });

  app.post('/api/admin/submissions/:attemptId/grade', requireAdmin, (req, res) => {
    const db = getDb();
    const { gradedAnswers } = req.body as {
      gradedAnswers?: { answerId: string; awardedPoints: number; teacherFeedback: string }[];
    };

    if (!Array.isArray(gradedAnswers)) {
      res.status(400).json({ error: 'Dữ liệu chấm điểm không hợp lệ.' });
      return;
    }

    const tx = db.transaction(() => {
      const upd = db.prepare('UPDATE quiz_answers SET awarded_points = ?, teacher_feedback = ? WHERE id = ? AND attempt_id = ?');
      for (const ga of gradedAnswers) {
        upd.run(Math.max(0, Number(ga.awardedPoints) || 0), (ga.teacherFeedback || '').trim(), ga.answerId, req.params.attemptId);
      }

      const totals = db
        .prepare('SELECT SUM(awarded_points) AS awarded, SUM(max_points) AS maxPts FROM quiz_answers WHERE attempt_id = ?')
        .get(req.params.attemptId) as { awarded: number; maxPts: number };

      const score10 = totals.maxPts > 0 ? Number(((totals.awarded / totals.maxPts) * 10).toFixed(2)) : 0;
      db.prepare("UPDATE quiz_attempts SET score = ?, grading_status = 'graded' WHERE id = ?").run(
        score10,
        req.params.attemptId,
      );
    });
    tx();

    writeAuditLog('admin', 'GRADE_ESSAY', 'quiz_attempt', req.params.attemptId, 'Chấm câu hỏi tự luận theo Rubric');
    res.json({ ok: true });
  });

  app.post('/api/admin/ai/rubric-suggest', requireAdmin, async (req, res) => {
    try {
      const { questionContent, rubric, studentAnswer } = req.body as {
        questionContent?: string;
        rubric?: { criterion: string; maxPoints: number }[];
        studentAnswer?: string;
      };
      if (!isGeminiConfigured()) {
        res.status(503).json({ error: 'Chưa cấu hình khóa Gemini API trên máy chủ.' });
        return;
      }
      const data = await suggestEssayRubricFeedback({
        questionContent: String(questionContent || ''),
        rubric: Array.isArray(rubric) ? rubric : [],
        studentAnswer: String(studentAnswer || ''),
      });
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Không thể tạo gợi ý nhận xét lúc này.' });
    }
  });

  // --- Admin: Analytics & Effectiveness Statistics ---
  app.get('/api/admin/analytics', requireAdmin, (req, res) => {
    const db = getDb();
    const className = String(req.query.className || '').trim();
    const lessonId = String(req.query.lessonId || '').trim();
    const topicId = String(req.query.topicId || '').trim();

    const lessonCompletions = db
      .prepare(
        `SELECT l.id AS lessonId, l.lesson_number AS lessonNumber, l.title, l.topic_id AS topicId,
                COUNT(DISTINCT CASE WHEN lp.completion_status = 'completed' THEN lp.student_id END) AS completedCount,
                COUNT(DISTINCT CASE WHEN lp.explored_3d = 1 THEN lp.student_id END) AS explored3dCount
         FROM lessons l
         LEFT JOIN learning_progress lp ON lp.lesson_id = l.id
         LEFT JOIN students s ON s.id = lp.student_id
         WHERE (? = '' OR s.class_name = ?)
           AND (? = '' OR l.id = ?)
           AND (? = '' OR l.topic_id = ?)
         GROUP BY l.id
         ORDER BY l.lesson_number ASC`,
      )
      .all(className, className, lessonId, lessonId, topicId, topicId);

    const wrongByTopic = db
      .prepare(
        `SELECT t.id AS topicId, t.title AS topicTitle,
                COUNT(ans.id) AS totalAnswered,
                SUM(CASE WHEN ans.awarded_points < ans.max_points THEN 1 ELSE 0 END) AS wrongCount
         FROM topics t
         LEFT JOIN lessons l ON l.topic_id = t.id
         LEFT JOIN questions qs ON qs.lesson_id = l.id
         LEFT JOIN quiz_answers ans ON ans.question_id = qs.id
         LEFT JOIN quiz_attempts qa ON qa.id = ans.attempt_id
         LEFT JOIN students s ON s.id = qa.student_id
         WHERE (? = '' OR s.class_name = ?)
         GROUP BY t.id
         ORDER BY t.sort_order ASC`,
      )
      .all(className, className);

    const scoreDistribution = db
      .prepare(
        `SELECT
           SUM(CASE WHEN qa.score < 5 THEN 1 ELSE 0 END) AS under5,
           SUM(CASE WHEN qa.score >= 5 AND qa.score < 6.5 THEN 1 ELSE 0 END) AS from5To65,
           SUM(CASE WHEN qa.score >= 6.5 AND qa.score < 8 THEN 1 ELSE 0 END) AS from65To8,
           SUM(CASE WHEN qa.score >= 8 THEN 1 ELSE 0 END) AS from8To10
         FROM quiz_attempts qa
         JOIN students s ON s.id = qa.student_id
         WHERE qa.submitted_at IS NOT NULL AND (? = '' OR s.class_name = ?)`,
      )
      .get(className, className);

    res.json({
      lessonCompletions,
      wrongByTopic,
      scoreDistribution,
    });
  });

  // --- Admin: Surveys (Pre / Post Likert 1-5) ---
  app.get('/api/admin/surveys', requireAdmin, (_req, res) => {
    const db = getDb();
    const surveys = db.prepare('SELECT * FROM surveys ORDER BY created_at DESC').all() as {
      id: string;
      title: string;
      survey_phase: string;
      questions_json: string;
      is_active: number;
      created_at: string;
    }[];
    const responses = db
      .prepare(
        `SELECT sr.id, sr.survey_id AS surveyId, sr.student_id AS studentId,
                s.full_name AS fullName, s.class_name AS className,
                sr.ratings_json AS ratingsJson, sr.comment, sr.submitted_at AS submittedAt
         FROM survey_responses sr
         JOIN students s ON s.id = sr.student_id
         ORDER BY sr.submitted_at DESC`,
      )
      .all() as {
      id: string;
      surveyId: string;
      studentId: string;
      fullName: string;
      className: string;
      ratingsJson: string;
      comment: string;
      submittedAt: string;
    }[];

    const result = surveys.map((sv) => {
      const questions = parseJsonSafe<string[]>(sv.questions_json, []);
      const svRes = responses.filter((r) => r.surveyId === sv.id);
      const averages = questions.map((qText, idx) => {
        if (svRes.length === 0) return { question: qText, average: null, count: 0 };
        const vals = svRes
          .map((r) => parseJsonSafe<number[]>(r.ratingsJson, [])[idx])
          .filter((v): v is number => typeof v === 'number');
        const avg = vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
        return { question: qText, average: avg, count: vals.length };
      });
      return {
        id: sv.id,
        title: sv.title,
        surveyPhase: sv.survey_phase,
        isActive: Boolean(sv.is_active),
        questions,
        responseCount: svRes.length,
        averages,
        responses: svRes.map((r) => ({
          ...r,
          ratings: parseJsonSafe<number[]>(r.ratingsJson, []),
        })),
      };
    });

    res.json({ surveys: result });
  });

  app.post('/api/admin/surveys', requireAdmin, (req, res) => {
    const db = getDb();
    const { title, surveyPhase, questions } = req.body as {
      title?: string;
      surveyPhase?: 'pre' | 'post';
      questions?: string[];
    };
    if (!title?.trim() || !Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'Vui lòng nhập tiêu đề và danh sách câu hỏi khảo sát.' });
      return;
    }
    const id = `survey-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare('INSERT INTO surveys (id, title, survey_phase, questions_json, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(
      id,
      title.trim(),
      surveyPhase === 'post' ? 'post' : 'pre',
      JSON.stringify(questions.map((q) => q.trim()).filter(Boolean)),
      new Date().toISOString(),
    );
    writeAuditLog('admin', 'CREATE_SURVEY', 'survey', id, title.trim());
    res.status(201).json({ ok: true, id });
  });

  app.patch('/api/admin/surveys/:id/toggle', requireAdmin, (req, res) => {
    const db = getDb();
    db.prepare('UPDATE surveys SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // --- Admin: Site Config, Backup & Audit Logs ---
  app.get('/api/admin/settings', requireAdmin, (_req, res) => {
    const db = getDb();
    const row = db
      .prepare('SELECT password_changed_at, must_change_password, login_security_settings, site_config FROM admin_settings LIMIT 1')
      .get() as {
      password_changed_at: string | null;
      must_change_password: number;
      login_security_settings: string;
      site_config: string;
    };
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50').all();

    res.json({
      passwordChangedAt: row.password_changed_at,
      mustChangePassword: Boolean(row.must_change_password),
      loginSecurity: parseJsonSafe(row.login_security_settings, { maxAttempts: 5, lockoutSeconds: 60 }),
      siteConfig: parseJsonSafe<SiteConfig>(row.site_config, DEFAULT_SITE_CONFIG),
      aiConfigured: isGeminiConfigured(),
      auditLogs: logs,
    });
  });

  app.patch('/api/admin/settings/site', requireAdmin, (req, res) => {
    const db = getDb();
    const row = db.prepare('SELECT id, site_config FROM admin_settings LIMIT 1').get() as { id: string; site_config: string };
    const current = parseJsonSafe<SiteConfig>(row.site_config, DEFAULT_SITE_CONFIG);
    const updated: SiteConfig = { ...current, ...(req.body || {}) };
    db.prepare('UPDATE admin_settings SET site_config = ? WHERE id = ?').run(JSON.stringify(updated), row.id);
    writeAuditLog('admin', 'UPDATE_SITE_CONFIG', 'admin_settings', row.id, updated.appName);
    res.json({ ok: true, siteConfig: updated });
  });

  app.get('/api/admin/backup/export', requireAdmin, (_req, res) => {
    const db = getDb();
    const backup = {
      exportedAt: new Date().toISOString(),
      classes: db.prepare('SELECT * FROM classes').all(),
      students: db.prepare('SELECT id, full_name, class_name, username, status, created_at, updated_at, last_login_at FROM students').all(),
      topics: db.prepare('SELECT * FROM topics').all(),
      lessons: db.prepare('SELECT * FROM lessons').all(),
      models3d: db.prepare('SELECT * FROM models_3d').all(),
      modelHotspots: db.prepare('SELECT * FROM model_hotspots').all(),
      questions: db.prepare('SELECT * FROM questions').all(),
      quizzes: db.prepare('SELECT * FROM quizzes').all(),
      quizAttempts: db.prepare('SELECT * FROM quiz_attempts').all(),
      quizAnswers: db.prepare('SELECT * FROM quiz_answers').all(),
      learningProgress: db.prepare('SELECT * FROM learning_progress').all(),
      surveys: db.prepare('SELECT * FROM surveys').all(),
      surveyResponses: db.prepare('SELECT * FROM survey_responses').all(),
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lichsu11_3d_backup.json"');
    res.send(JSON.stringify(backup, null, 2));
  });

  // ============================================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC ASSETS
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    app.use(async (req, res, next) => {
      if (!frontendMiddleware) {
        await Promise.race([
          viteReadyPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 4500)),
        ]);
      }
      if (frontendMiddleware) {
        frontendMiddleware(req, res, next);
        return;
      }
      res
        .status(200)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .send(
          '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta http-equiv="refresh" content="1"><title>LỊCH SỬ 11 3D</title></head><body style="background:#0B132B;color:#FAF7F0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">Đang khởi động không gian Lịch sử 11 3D...</body></html>',
        );
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await new Promise<void>((resolve, reject) => {
    const srv = app.listen(port, '0.0.0.0', () => {
      console.log(`LỊCH SỬ 11 3D server listening at http://0.0.0.0:${port}`);
      resolve();
    });
    srv.on('error', reject);
  });

  // Run DB & Vite initialization asynchronously right after port 3000 is bound
  setImmediate(() => {
    (async () => {
      try {
        ensureBuiltInGlbAssets(process.cwd());
        await initializeDatabaseAndSeed();
      } catch (err) {
        initError = err;
        console.error('Database/GLB initialization error:', err);
      } finally {
        dbReadyResolve();
      }

      if (process.env.NODE_ENV !== 'production') {
        try {
          const { createServer: createViteServer } = await import('vite');
          const vite = await createViteServer({
            server: {
              middlewareMode: true,
              allowedHosts: true,
            },
            appType: 'spa',
          });
          frontendMiddleware = vite.middlewares;
        } catch (err) {
          initError = err;
          console.error('Vite dev server initialization error:', err);
        } finally {
          viteReadyResolve();
        }
      } else {
        viteReadyResolve();
      }
    })();
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
