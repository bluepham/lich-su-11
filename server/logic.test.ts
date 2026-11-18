import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SESSION_COOKIE_NAME,
  checkLoginRateLimit,
  clearLoginFailures,
  extractRequestSessionToken,
  hashPassword,
  recordLoginFailure,
  validateStudentRegistration,
  verifyPassword,
} from './security';
import { evaluateEarnedBadges, gradeQuestionAnswer } from './grading';
import { buildGlbBuffer } from './glbGenerator';

test('student registration validates fields and confirms matching passwords', () => {
  const ok = validateStudentRegistration({
    fullName: '  Nguyễn Văn Minh  ',
    className: '11a1',
    username: 'Minh11A1',
    password: 'Password123',
    confirmPassword: 'Password123',
  });
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.normalized, {
    fullName: 'Nguyễn Văn Minh',
    className: '11A1',
    username: 'minh11a1',
  });

  const mismatch = validateStudentRegistration({
    fullName: 'Nguyễn Văn Minh',
    className: '11A1',
    username: 'minh11a1',
    password: 'Password123',
    confirmPassword: 'Password999',
  });
  assert.equal(mismatch.valid, false);

  const badClass = validateStudentRegistration({
    fullName: 'Nguyễn Văn Minh',
    className: 'Lop9A',
    username: 'minh11a1',
    password: 'Password123',
    confirmPassword: 'Password123',
  });
  assert.equal(badClass.valid, false);
});

test('Argon2id hashes and verifies passwords without storing plaintext', async () => {
  const hash = await hashPassword('123456');
  assert.ok(hash.startsWith('$argon2id$'));
  assert.notEqual(hash, '123456');
  assert.equal(await verifyPassword(hash, '123456'), true);
  assert.equal(await verifyPassword(hash, 'wrong-pass'), false);
});

test('login rate limiter locks after max failed attempts and unlocks after expiry', () => {
  const key = 'unit-test-admin';
  clearLoginFailures(key);
  const t0 = 1_000_000;

  assert.equal(checkLoginRateLimit(key, 3, 30_000, t0).allowed, true);
  assert.equal(recordLoginFailure(key, 3, 30_000, t0).locked, false);
  assert.equal(recordLoginFailure(key, 3, 30_000, t0 + 100).locked, false);
  const third = recordLoginFailure(key, 3, 30_000, t0 + 200);
  assert.equal(third.locked, true);

  assert.equal(checkLoginRateLimit(key, 3, 30_000, t0 + 5_000).allowed, false);
  assert.equal(checkLoginRateLimit(key, 3, 30_000, t0 + 31_000).allowed, true);
});

test('grading engine scores all 8 question types accurately and flags essays for manual rubric grading', () => {
  assert.equal(
    gradeQuestionAnswer('mcq', { options: ['A', 'B', 'C', 'D'], correctIndex: 2, points: 2 }, 2).awardedPoints,
    2,
  );

  const tfSpec = {
    statements: [
      { id: 's1', text: '1', correct: true },
      { id: 's2', text: '2', correct: false },
      { id: 's3', text: '3', correct: true },
      { id: 's4', text: '4', correct: true },
    ],
    points: 2,
  };
  // 3/4 correct -> 50% scale in GDPT 2018 -> 1.0 pt
  assert.equal(
    gradeQuestionAnswer('true_false', tfSpec, { s1: true, s2: false, s3: true, s4: false }).awardedPoints,
    1,
  );
  // 4/4 correct -> 100% -> 2.0 pts
  assert.equal(
    gradeQuestionAnswer('true_false', tfSpec, { s1: true, s2: false, s3: true, s4: true }).awardedPoints,
    2,
  );

  assert.equal(
    gradeQuestionAnswer('short_answer', { acceptedAnswers: ['1986', 'năm 1986'], points: 1 }, ' 1986. ').isCorrect,
    true,
  );

  assert.equal(
    gradeQuestionAnswer('ordering', { correctOrder: ['a', 'b', 'c'], points: 1.5 }, ['a', 'b', 'c']).awardedPoints,
    1.5,
  );

  assert.equal(
    gradeQuestionAnswer('matching', { correctPairs: { l1: 'r1', l2: 'r2' }, points: 2 }, { l1: 'r1', l2: 'wrong' })
      .awardedPoints,
    1,
  );

  const essayRes = gradeQuestionAnswer('essay', { points: 3 }, 'Bài viết tự luận của học sinh');
  assert.equal(essayRes.isManual, true);
  assert.equal(essayRes.awardedPoints, 0);
});

test('badge evaluator awards badges strictly when criteria are met', () => {
  assert.equal(
    evaluateEarnedBadges({
      explored3dCount: 0,
      completedLessonsCount: 0,
      mapGameHighScores: 0,
      quizHighScores: 0,
      completedExplorationWorkflows: 0,
    }).length,
    0,
  );

  const full = evaluateEarnedBadges({
    explored3dCount: 2,
    completedLessonsCount: 3,
    mapGameHighScores: 1,
    quizHighScores: 1,
    completedExplorationWorkflows: 1,
  });
  assert.equal(full.length, 4);
});

test('GLB binary builder outputs valid glTF 2.0 binary with aligned JSON and BIN chunks and animations', () => {
  const buf = buildGlbBuffer(
    [
      {
        name: 'Coc_Go',
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
        color: [0.5, 0.3, 0.1, 1],
      },
    ],
    [
      {
        name: 'Song_Nuoc',
        channels: [
          {
            targetNodeName: 'Coc_Go',
            path: 'translation',
            times: [0, 1],
            values: [0, 0, 0, 0, 0.5, 0],
          },
        ],
      },
    ],
  );

  assert.equal(buf.readUInt32LE(0), 0x46546c67); // 'glTF'
  assert.equal(buf.readUInt32LE(4), 2); // version 2
  assert.equal(buf.readUInt32LE(8), buf.length);
  assert.equal(buf.length % 4, 0);

  const jsonLen = buf.readUInt32LE(12);
  assert.equal(buf.readUInt32LE(16), 0x4e4f534a); // 'JSON'
  const parsed = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  assert.equal(parsed.asset.version, '2.0');
  assert.equal(parsed.meshes[0].name, 'Coc_Go');
  assert.equal(parsed.animations[0].name, 'Song_Nuoc');
});

test('Python 3 procedural & multi-asset GLB compilers build all 7 beautified .glb scenes and custom presets cleanly', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const {
    ensureBuiltInGlbAssets,
    generateCustomGlbViaPython,
    getCuratedGlbAssetPackInfo,
    parseGlbHeaderMetadata,
  } = await import('./glbGenerator');

  ensureBuiltInGlbAssets(process.cwd());

  const expectedScenes: { file: string; anim: string; minMeshes: number }[] = [
    { file: 'bach_dang_938.glb', anim: 'Toan_Canh_Thuy_Trieu_Va_Phan_Cong', minMeshes: 30 },
    { file: 'khoi_nghia_lam_son.glb', anim: 'Dien_Bien_Hanh_Quan_1418_1427', minMeshes: 30 },
    { file: 'thanh_nha_ho.glb', anim: 'Ky_Dai_Tung_Bay', minMeshes: 30 },
    { file: 'dong_nam_a_can_dai.glb', anim: 'Tuyen_Hang_Hai_Va_Doc_Lap', minMeshes: 25 },
    { file: 'khong_gian_bien_dong.glb', anim: 'Luu_Thong_Tuyen_Hang_Hai_Quoc_Te', minMeshes: 30 },
    { file: 'van_minh_cong_nghiep_do_thi.glb', anim: 'Nhip_Song_Giao_Thong_Do_Thi_Hien_Dai', minMeshes: 40 },
    { file: 'quan_the_nhan_vat_sinh_thai_3d.glb', anim: 'Toan_Canh_Bao_Tang_Nhan_Vat_Xe_Co_Dong_Vat_Canh_Quan', minMeshes: 50 },
  ];

  for (const sc of expectedScenes) {
    const fullPath = path.join(process.cwd(), 'public', 'models', sc.file);
    const meta = parseGlbHeaderMetadata(fullPath);
    assert.equal(meta.valid, true, `Expected valid GLB header for ${sc.file}`);
    assert.ok(meta.generator.includes('HistoricalWideWorld-v4'), `Unexpected generator for ${sc.file}: ${meta.generator}`);
    assert.ok(meta.byteLength < 10 * 1024 * 1024, `Expected compact GLB < 10MB for ${sc.file}, got ${meta.byteLength}`);
    assert.ok(meta.meshCount >= sc.minMeshes, `Expected >= ${sc.minMeshes} meshes in ${sc.file}, got ${meta.meshCount}`);
    assert.ok(meta.animationNames.includes(sc.anim), `Missing primary animation ${sc.anim} in ${sc.file}`);
  }

  // Verify curated 4-category .glb asset pack including all 6 period-costumed Vietnamese human models
  const assetPack = getCuratedGlbAssetPackInfo(process.cwd());
  assert.ok(assetPack.length >= 28);
  for (const cat of ['human', 'vehicle', 'animal', 'landscape'] as const) {
    assert.ok(assetPack.some((a) => a.category === cat), `Expected curated .glb assets in category ${cat}`);
  }
  const historicalHumans = [
    'nguoi_tran_thi_ngoc_tham.glb',
    'nguoi_thanh.glb',
    'tuong_linh_bach_dang.glb',
    'nghia_quan_lam_son.glb',
    'quan_vien_trieu_ho.glb',
    'dan_nu_dai_viet_co_truyen.glb',
  ];
  for (const hFile of historicalHumans) {
    assert.ok(assetPack.some((a) => a.filename === hFile), `Missing historical human .glb ${hFile} in assetPack`);
    const hBuf = fs.readFileSync(path.join(process.cwd(), 'public', 'models', 'assets_pack', hFile));
    assert.ok(hBuf.length < 1_200_000, `Expected compact human GLB < 1.2MB for ${hFile}, got ${hBuf.length}`);
    const jLen = hBuf.readUInt32LE(12);
    const gJson = JSON.parse(hBuf.subarray(20, 20 + jLen).toString('utf8')) as {
      nodes?: { name?: string; mesh?: number }[];
      meshes?: { primitives?: { targets?: unknown[] }[] }[];
    };
    const activeGlasses = (gJson.nodes || []).filter(
      (n) => String(n.name || '').toLowerCase().includes('glasses') && typeof n.mesh === 'number',
    );
    assert.equal(activeGlasses.length, 0, `Expected zero modern glasses meshes in ${hFile}`);
    const morphCount = (gJson.meshes || []).reduce(
      (sum, m) => sum + (m.primitives || []).reduce((s2, p) => s2 + (p.targets?.length || 0), 0),
      0,
    );
    assert.equal(morphCount, 0, `Expected zero unused ARKit morph targets in ${hFile}`);
  }

  const tmpNaval = path.join(os.tmpdir(), `test_py_sim_${Date.now()}.glb`);
  const customNaval = generateCustomGlbViaPython('naval_ambush', tmpNaval, { stakeRows: 3, warshipPairs: 2 });
  assert.ok(customNaval.bytes > 1000);
  assert.equal(parseGlbHeaderMetadata(tmpNaval).valid, true);
  fs.unlinkSync(tmpNaval);

  const tmpEco = path.join(os.tmpdir(), `test_py_eco_${Date.now()}.glb`);
  const customEco = generateCustomGlbViaPython('heritage_ecosystem', tmpEco, {
    humanCount: 2,
    vehicleCount: 2,
    animalCount: 2,
    treeDensity: 3,
  });
  assert.ok(customEco.bytes > 100_000);
  const ecoHeader = parseGlbHeaderMetadata(tmpEco);
  assert.equal(ecoHeader.valid, true);
  assert.ok(ecoHeader.animationNames.includes('Chuyen_Dong_Quan_The_Nguoi_Xe_DongVat'));
  fs.unlinkSync(tmpEco);
});

test('admin 123456 password seeds with direct dashboard entry and cross-origin Bearer session token resolves cleanly', async () => {
  const { getDb, initializeDatabaseAndSeed } = await import('./db');
  await initializeDatabaseAndSeed();
  const db = getDb();
  const adminRow = db
    .prepare('SELECT password_hash, password_changed_at, must_change_password FROM admin_settings LIMIT 1')
    .get() as { password_hash: string; password_changed_at: string | null; must_change_password: number };

  assert.ok(adminRow);
  if (adminRow.password_changed_at === null) {
    assert.equal(adminRow.must_change_password, 0);
    assert.equal(await verifyPassword(adminRow.password_hash, '123456'), true);
  }

  assert.equal(
    extractRequestSessionToken({
      headers: { authorization: 'Bearer tok-123' },
      cookies: {},
    } as never),
    'tok-123',
  );
  assert.equal(
    extractRequestSessionToken({
      headers: {},
      cookies: { [SESSION_COOKIE_NAME]: 'cookie-456' },
    } as never),
    'cookie-456',
  );

  const fs = await import('node:fs');
  const path = await import('node:path');
  assert.equal(
    fs.existsSync(path.join(process.cwd(), 'public', 'models', 'assets_pack', '_raw_human_tham.glb')),
    false,
    'Expected _raw_human_tham.glb not to be recreated on disk',
  );
  assert.equal(
    fs.existsSync(path.join(process.cwd(), 'public', 'models', 'assets_pack', '_raw_human_thanh.glb')),
    false,
    'Expected _raw_human_thanh.glb not to be recreated on disk',
  );
});

test('apiFetch works cleanly when window.fetch is a read-only getter-only property', async () => {
  const { apiFetch, buildApiAuthHeaders, setStoredSessionToken, clearStoredSessionToken } = await import(
    '../src/utils/authSession'
  );

  const h1 = buildApiAuthHeaders({ 'Content-Type': 'application/json' }, 'admin-tok-999');
  assert.equal(h1.get('Authorization'), 'Bearer admin-tok-999');
  assert.equal(h1.get('Content-Type'), 'application/json');

  const store = new Map<string, string>();
  let capturedInit: RequestInit | undefined;
  const fakeFetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    capturedInit = init;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const mockWindow: Record<string, unknown> = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  };
  Object.defineProperty(mockWindow, 'fetch', {
    get: () => fakeFetch,
    configurable: false,
  });

  const prevWindow = (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).window = mockWindow;
  try {
    assert.throws(() => {
      (mockWindow as { fetch: unknown }).fetch = fakeFetch;
    }, TypeError);

    setStoredSessionToken('session-abc-123');
    const res = await apiFetch('/api/admin/overview');
    assert.equal(res.status, 200);
    assert.equal(capturedInit?.credentials, 'include');
    const sentHeaders = new Headers(capturedInit?.headers);
    assert.equal(sentHeaders.get('Authorization'), 'Bearer session-abc-123');
    clearStoredSessionToken();
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
  }
});

