import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface GlbBinaryMetadata {
  valid: boolean;
  generator: string;
  version: string;
  meshCount: number;
  nodeCount: number;
  animationNames: string[];
  byteLength: number;
}

export interface PythonPresetResult {
  outFile: string;
  bytes: number;
  generator: string;
  meta: {
    animationNames: string[];
    cameraSettings: { position: [number, number, number]; target: [number, number, number] };
    phases: {
      key: string;
      label: string;
      animationName?: string;
      cameraPosition?: [number, number, number];
      cameraTarget?: [number, number, number];
      summary: string;
    }[];
    hotspots: {
      x: number;
      y: number;
      z: number;
      title: string;
      description: string;
      phaseKey: string;
    }[];
  };
}

const glbHeaderCache = new Map<string, { mtimeMs: number; size: number; meta: GlbBinaryMetadata }>();

export function parseGlbHeaderMetadata(input: Buffer | string): GlbBinaryMetadata {
  try {
    if (typeof input === 'string') {
      const stat = fs.statSync(input);
      const byteLength = stat.size;
      if (byteLength < 28) {
        return { valid: false, generator: '', version: '', meshCount: 0, nodeCount: 0, animationNames: [], byteLength };
      }
      const cached = glbHeaderCache.get(input);
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === byteLength) {
        return cached.meta;
      }

      const fd = fs.openSync(input, 'r');
      try {
        const header = Buffer.allocUnsafe(20);
        const headerRead = fs.readSync(fd, header, 0, 20, 0);
        if (headerRead < 20) {
          return { valid: false, generator: '', version: '', meshCount: 0, nodeCount: 0, animationNames: [], byteLength };
        }
        const magic = header.readUInt32LE(0);
        const glbVer = header.readUInt32LE(4);
        const jsonChunkLen = header.readUInt32LE(12);
        const jsonChunkType = header.readUInt32LE(16);
        if (magic !== 0x46546c67 || glbVer !== 2 || jsonChunkType !== 0x4e4f534a || 20 + jsonChunkLen > byteLength) {
          return { valid: false, generator: '', version: '', meshCount: 0, nodeCount: 0, animationNames: [], byteLength };
        }

        const jsonBuf = Buffer.allocUnsafe(jsonChunkLen);
        const jsonRead = fs.readSync(fd, jsonBuf, 0, jsonChunkLen, 20);
        if (jsonRead < jsonChunkLen) {
          return { valid: false, generator: '', version: '', meshCount: 0, nodeCount: 0, animationNames: [], byteLength };
        }

        const gltf = JSON.parse(jsonBuf.toString('utf8')) as {
          asset?: { generator?: string; version?: string };
          meshes?: unknown[];
          nodes?: unknown[];
          animations?: { name?: string }[];
        };
        const animationNames = Array.isArray(gltf.animations)
          ? gltf.animations.map((a, idx) => a.name || `Animation_${idx + 1}`)
          : [];
        const meta: GlbBinaryMetadata = {
          valid: true,
          generator: gltf.asset?.generator || 'Unknown-GLTF-Generator',
          version: gltf.asset?.version || '2.0',
          meshCount: Array.isArray(gltf.meshes) ? gltf.meshes.length : 0,
          nodeCount: Array.isArray(gltf.nodes) ? gltf.nodes.length : 0,
          animationNames,
          byteLength,
        };
        glbHeaderCache.set(input, { mtimeMs: stat.mtimeMs, size: byteLength, meta });
        return meta;
      } finally {
        fs.closeSync(fd);
      }
    }

    const buf = input;
    if (buf.length < 28) {
      return { valid: false, generator: '', version: '', meshCount: 0, nodeCount: 0, animationNames: [], byteLength: buf.length };
    }
    const magic = buf.readUInt32LE(0);
    const glbVer = buf.readUInt32LE(4);
    const jsonChunkLen = buf.readUInt32LE(12);
    const jsonChunkType = buf.readUInt32LE(16);
    if (magic !== 0x46546c67 || glbVer !== 2 || jsonChunkType !== 0x4e4f534a || 20 + jsonChunkLen > buf.length) {
      return { valid: false, generator: '', version: '', meshCount: 0, nodeCount: 0, animationNames: [], byteLength: buf.length };
    }
    const gltf = JSON.parse(buf.subarray(20, 20 + jsonChunkLen).toString('utf8')) as {
      asset?: { generator?: string; version?: string };
      meshes?: unknown[];
      nodes?: unknown[];
      animations?: { name?: string }[];
    };
    const animationNames = Array.isArray(gltf.animations)
      ? gltf.animations.map((a, idx) => a.name || `Animation_${idx + 1}`)
      : [];
    return {
      valid: true,
      generator: gltf.asset?.generator || 'Unknown-GLTF-Generator',
      version: gltf.asset?.version || '2.0',
      meshCount: Array.isArray(gltf.meshes) ? gltf.meshes.length : 0,
      nodeCount: Array.isArray(gltf.nodes) ? gltf.nodes.length : 0,
      animationNames,
      byteLength: buf.length,
    };
  } catch {
    return { valid: false, generator: '', version: '', meshCount: 0, nodeCount: 0, animationNames: [], byteLength: 0 };
  }
}

export type PythonGlbPreset =
  | 'naval_ambush'
  | 'maritime_sovereignty'
  | 'stone_citadel'
  | 'campaign_relief'
  | 'heritage_ecosystem';

export interface CuratedGlbAssetItem {
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

const CURATED_ASSET_SPECS: Omit<CuratedGlbAssetItem, 'fileUrl' | 'byteLength' | 'meshCount' | 'animationCount'>[] = [
  // 1. MÔ HÌNH NGƯỜI TRANG PHỤC LỊCH SỬ VIỆT NAM (hmthanh/3d-human-model + Phục trang Cổ phục PBR)
  {
    id: 'nguoi-tran-thi-ngoc-tham',
    category: 'human',
    categoryLabel: 'Mô hình Người Cổ phục',
    title: 'Nữ quý tộc – Mệnh phụ Đại Việt (Áo Giao Lĩnh & Khăn vấn Hoàng kim)',
    filename: 'nguoi_tran_thi_ngoc_tham.glb',
    repoName: 'hmthanh/3d-human-model · Cổ phục Đại Việt',
    repoUrl: 'https://github.com/hmthanh/3d-human-model/blob/main/TranThiNgocTham.glb',
  },
  {
    id: 'nguoi-thanh',
    category: 'human',
    categoryLabel: 'Mô hình Người Cổ phục',
    title: 'Danh tướng Đại Việt (Mũ Đâu Mâu & Giáp vảy đồng sơn son)',
    filename: 'nguoi_thanh.glb',
    repoName: 'hmthanh/3d-human-model · Võ phục Đại Việt',
    repoUrl: 'https://github.com/hmthanh/3d-human-model',
  },
  {
    id: 'tuong-linh-bach-dang',
    category: 'human',
    categoryLabel: 'Mô hình Người Cổ phục',
    title: 'Thủy quân – Tướng lĩnh Bạch Đằng 938 (Giáp da đồng & Trường thương)',
    filename: 'tuong_linh_bach_dang.glb',
    repoName: 'hmthanh/3d-human-model · Quân phục Thế kỉ X',
    repoUrl: 'https://github.com/hmthanh/3d-human-model',
  },
  {
    id: 'nghia-quan-lam-son',
    category: 'human',
    categoryLabel: 'Mô hình Người Cổ phục',
    title: 'Nghĩa quân Lam Sơn 1418–1427 (Khăn chít đầu, Áo chàm & Khiên mây)',
    filename: 'nghia_quan_lam_son.glb',
    repoName: 'hmthanh/3d-human-model · Nghĩa binh Thế kỉ XV',
    repoUrl: 'https://github.com/hmthanh/3d-human-model',
  },
  {
    id: 'quan-vien-trieu-ho',
    category: 'human',
    categoryLabel: 'Mô hình Người Cổ phục',
    title: 'Quan Văn Triều Hồ – Lê Sơ (Mũ Cánh Chuồn, Áo Giao Lĩnh chàm & Chiếu thư)',
    filename: 'quan_vien_trieu_ho.glb',
    repoName: 'hmthanh/3d-human-model · Quan phục Tây Đô',
    repoUrl: 'https://github.com/hmthanh/3d-human-model',
  },
  {
    id: 'dan-nu-dai-viet-co-truyen',
    category: 'human',
    categoryLabel: 'Mô hình Người Cổ phục',
    title: 'Thôn nữ – Dân binh Đại Việt (Nón lá truyền thống & Áo Ngũ Thân nâu non)',
    filename: 'dan_nu_dai_viet_co_truyen.glb',
    repoName: 'hmthanh/3d-human-model · Dân phục Việt cổ',
    repoUrl: 'https://github.com/hmthanh/3d-human-model/blob/main/TranThiNgocTham.glb',
  },
  // 2. MÔ HÌNH XE CỘ & PHƯƠNG TIỆN (Hidencod/tge-assets)
  {
    id: 'xe-oto-sedan',
    category: 'vehicle',
    categoryLabel: 'Mô hình Xe cộ',
    title: 'Ô tô Sedan Thể thao Đô thị',
    filename: 'xe_oto_sedan.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  {
    id: 'xe-tai-co-gioi',
    category: 'vehicle',
    categoryLabel: 'Mô hình Xe cộ',
    title: 'Xe tải Vận tải Công nghiệp',
    filename: 'xe_tai_co_gioi.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  {
    id: 'xe-oto-suv',
    category: 'vehicle',
    categoryLabel: 'Mô hình Xe cộ',
    title: 'Ô tô Địa hình SUV Hiện đại',
    filename: 'xe_oto_suv.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  {
    id: 'xe-van-tai-thuong-mai',
    category: 'vehicle',
    categoryLabel: 'Mô hình Xe cộ',
    title: 'Xe Vận tải Thương mại Đô thị',
    filename: 'xe_van_tai_thuong_mai.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  {
    id: 'may-keo-co-gioi',
    category: 'vehicle',
    categoryLabel: 'Mô hình Xe cộ',
    title: 'Máy kéo Cơ giới hóa Nông nghiệp',
    filename: 'may_keo_co_gioi.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  {
    id: 'thuyen-chien-vua',
    category: 'vehicle',
    categoryLabel: 'Mô hình Xe cộ',
    title: 'Soái thuyền Buồm lớn Lịch sử',
    filename: 'thuyen_chien_vua.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  {
    id: 'thuyen-chien-lon',
    category: 'vehicle',
    categoryLabel: 'Mô hình Xe cộ',
    title: 'Chiến thuyền Viễn dương Ba cột buồm',
    filename: 'thuyen_chien_lon.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  {
    id: 'thuyen-cheo-nhanh',
    category: 'vehicle',
    categoryLabel: 'Mô hình Xe cộ',
    title: 'Thuyền chèo Mai phục Đường thủy',
    filename: 'thuyen_cheo_nhanh.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  {
    id: 'phao-than-cong-co-dong',
    category: 'vehicle',
    categoryLabel: 'Mô hình Xe cộ',
    title: 'Pháo Thần công Bánh xe Cổ đại',
    filename: 'phao_than_cong_co_dong.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  // 3. ĐỘNG VẬT (Ariescar/gobkit-free-assets & Hidencod/tge-assets)
  {
    id: 'ca-map-bien-dong',
    category: 'animal',
    categoryLabel: 'Động vật',
    title: 'Cá mập Đại dương (Có hoạt ảnh bơi)',
    filename: 'ca_map_bien_dong.glb',
    repoName: 'Ariescar/gobkit-free-assets',
    repoUrl: 'https://github.com/Ariescar/gobkit-free-assets',
  },
  {
    id: 'sua-bien-dai-duong',
    category: 'animal',
    categoryLabel: 'Động vật',
    title: 'Sứa biển Nhiệt đới (Có hoạt ảnh xương)',
    filename: 'sua_bien_dai_duong.glb',
    repoName: 'Ariescar/gobkit-free-assets',
    repoUrl: 'https://github.com/Ariescar/gobkit-free-assets',
  },
  {
    id: 'chim-thuy-cam-vit',
    category: 'animal',
    categoryLabel: 'Động vật',
    title: 'Chim Thủy cầm / Vịt nước (Có hoạt ảnh)',
    filename: 'chim_thuy_cam_vit.glb',
    repoName: 'Ariescar/gobkit-free-assets',
    repoUrl: 'https://github.com/Ariescar/gobkit-free-assets',
  },
  {
    id: 'ha-ma-sinh-thai',
    category: 'animal',
    categoryLabel: 'Động vật',
    title: 'Hà mã Đầm lầy Sinh thái (Có hoạt ảnh)',
    filename: 'ha_ma_sinh_thai.glb',
    repoName: 'Ariescar/gobkit-free-assets',
    repoUrl: 'https://github.com/Ariescar/gobkit-free-assets',
  },
  {
    id: 'khuyen-canh-corgi',
    category: 'animal',
    categoryLabel: 'Động vật',
    title: 'Chó Corgi Công viên (Có hoạt ảnh)',
    filename: 'khuyen_canh_corgi.glb',
    repoName: 'Ariescar/gobkit-free-assets',
    repoUrl: 'https://github.com/Ariescar/gobkit-free-assets',
  },
  {
    id: 'chien-ma-ky-binh',
    category: 'animal',
    categoryLabel: 'Động vật',
    title: 'Chiến mã Kỵ binh Lịch sử',
    filename: 'chien_ma_ky_binh.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  {
    id: 'huou-rung-lam-son',
    category: 'animal',
    categoryLabel: 'Động vật',
    title: 'Hươu sao Rừng núi Lam Sơn',
    filename: 'huou_rung_lam_son.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
  // 4. CÂY CỐI & CẢNH QUAN (agentkaerf/FreeModels & GeorgeQLe/assets-kaykit-3d-environments)
  {
    id: 'cay-co-thu-freemodels',
    category: 'landscape',
    categoryLabel: 'Cây cối & Cảnh quan',
    title: 'Cây Cổ thụ Tán lá Tự nhiên',
    filename: 'cay_co_thu_freemodels.glb',
    repoName: 'agentkaerf/FreeModels',
    repoUrl: 'https://github.com/agentkaerf/FreeModels',
  },
  {
    id: 'bui-hoa-freemodels',
    category: 'landscape',
    categoryLabel: 'Cây cối & Cảnh quan',
    title: 'Bụi Hoa Cảnh quan Rực rỡ',
    filename: 'bui_hoa_freemodels.glb',
    repoName: 'agentkaerf/FreeModels',
    repoUrl: 'https://github.com/agentkaerf/FreeModels',
  },
  {
    id: 'tang-da-freemodels',
    category: 'landscape',
    categoryLabel: 'Cây cối & Cảnh quan',
    title: 'Tảng Đá Tự nhiên Phong hóa',
    filename: 'tang_da_freemodels.glb',
    repoName: 'agentkaerf/FreeModels',
    repoUrl: 'https://github.com/agentkaerf/FreeModels',
  },
  {
    id: 'cay-rung-kaykit',
    category: 'landscape',
    categoryLabel: 'Cây cối & Cảnh quan',
    title: 'Cây Rừng Xanh Mát (KayKit)',
    filename: 'cay_rung_kaykit.glb',
    repoName: 'GeorgeQLe/assets-kaykit-3d-environments',
    repoUrl: 'https://github.com/GeorgeQLe/assets-kaykit-3d-environments',
  },
  {
    id: 'cay-thong-kaykit',
    category: 'landscape',
    categoryLabel: 'Cây cối & Cảnh quan',
    title: 'Cây Thông Cao nguyên (KayKit)',
    filename: 'cay_thong_kaykit.glb',
    repoName: 'GeorgeQLe/assets-kaykit-3d-environments',
    repoUrl: 'https://github.com/GeorgeQLe/assets-kaykit-3d-environments',
  },
  {
    id: 'da-nui-kaykit',
    category: 'landscape',
    categoryLabel: 'Cây cối & Cảnh quan',
    title: 'Khối Đá Núi Địa hình (KayKit)',
    filename: 'da_nui_kaykit.glb',
    repoName: 'GeorgeQLe/assets-kaykit-3d-environments',
    repoUrl: 'https://github.com/GeorgeQLe/assets-kaykit-3d-environments',
  },
  {
    id: 'thanh-luy-kaykit',
    category: 'landscape',
    categoryLabel: 'Cây cối & Cảnh quan',
    title: 'Thành lũy Kiến trúc Trung đại (KayKit)',
    filename: 'thanh_luy_kaykit.glb',
    repoName: 'GeorgeQLe/assets-kaykit-3d-environments',
    repoUrl: 'https://github.com/GeorgeQLe/assets-kaykit-3d-environments',
  },
  {
    id: 'thuong-cang-kaykit',
    category: 'landscape',
    categoryLabel: 'Cây cối & Cảnh quan',
    title: 'Thương cảng & Bến Đóng tàu (KayKit)',
    filename: 'thuong_cang_kaykit.glb',
    repoName: 'GeorgeQLe/assets-kaykit-3d-environments',
    repoUrl: 'https://github.com/GeorgeQLe/assets-kaykit-3d-environments',
  },
  {
    id: 'toa-nha-do-thi-kaykit',
    category: 'landscape',
    categoryLabel: 'Cây cối & Cảnh quan',
    title: 'Tòa nhà Kiến trúc Đô thị (KayKit)',
    filename: 'toa_nha_do_thi_kaykit.glb',
    repoName: 'GeorgeQLe/assets-kaykit-3d-environments',
    repoUrl: 'https://github.com/GeorgeQLe/assets-kaykit-3d-environments',
  },
  {
    id: 'cay-dua-bien',
    category: 'landscape',
    categoryLabel: 'Cây cối & Cảnh quan',
    title: 'Cây Dừa Biển Đảo Nhiệt đới',
    filename: 'cay_dua_bien.glb',
    repoName: 'Hidencod/tge-assets',
    repoUrl: 'https://github.com/Hidencod/tge-assets',
  },
];

export function getCuratedGlbAssetPackInfo(rootDir = process.cwd()): CuratedGlbAssetItem[] {
  const packDir = path.join(rootDir, 'public', 'models', 'assets_pack');
  return CURATED_ASSET_SPECS.map((spec) => {
    const fullPath = path.join(packDir, spec.filename);
    const meta = fs.existsSync(fullPath)
      ? parseGlbHeaderMetadata(fullPath)
      : { valid: false, byteLength: 0, meshCount: 0, animationNames: [] };
    return {
      ...spec,
      fileUrl: `/models/assets_pack/${spec.filename}`,
      byteLength: meta.byteLength,
      meshCount: meta.meshCount,
      animationCount: meta.animationNames.length,
    };
  }).filter((item) => item.byteLength > 0);
}

export function generateCustomGlbViaPython(
  preset: PythonGlbPreset,
  outFilePath: string,
  params: Record<string, unknown> = {},
  rootDir = process.cwd(),
): PythonPresetResult {
  if (preset === 'heritage_ecosystem') {
    const mergerPath = path.join(rootDir, 'public', 'python_glb', 'hop_nhat_canh_glb.py');
    const modelsDir = path.join(rootDir, 'public', 'models');
    const stdout = execFileSync(
      'python3',
      [
        mergerPath,
        '--custom-out',
        outFilePath,
        '--out-dir',
        modelsDir,
        '--params-json',
        JSON.stringify(params),
      ],
      { encoding: 'utf8', timeout: 35_000 },
    );
    const parsed = JSON.parse(stdout.trim()) as PythonPresetResult & { ok?: boolean };
    if (!parsed || !parsed.ok) {
      throw new Error('Trình hợp nhất cảnh 3D Python không trả về kết quả hợp lệ.');
    }
    return parsed;
  }

  const scriptPath = path.join(rootDir, 'public', 'python_glb', 'sinh_mo_phong_lich_su_glb.py');
  const stdout = execFileSync(
    'python3',
    [
      scriptPath,
      '--preset',
      preset,
      '--out-file',
      outFilePath,
      '--params-json',
      JSON.stringify(params),
    ],
    { encoding: 'utf8', timeout: 20_000 },
  );
  const parsed = JSON.parse(stdout.trim()) as PythonPresetResult & { ok?: boolean };
  if (!parsed || !parsed.ok) {
    throw new Error('Trình biên dịch Python không trả về kết quả hợp lệ.');
  }
  return parsed;
}

interface RawMeshSpec {
  name: string;
  positions: number[];
  normals: number[];
  indices: number[];
  color: [number, number, number, number];
  metallic?: number;
  roughness?: number;
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
}

interface RawAnimChannel {
  targetNodeName: string;
  path: 'translation' | 'rotation' | 'scale';
  times: number[];
  values: number[];
}

interface RawAnimationClip {
  name: string;
  channels: RawAnimChannel[];
}

function addBoxGeometry(
  positions: number[],
  normals: number[],
  indices: number[],
  w: number,
  h: number,
  d: number,
  ox = 0,
  oy = 0,
  oz = 0,
): void {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;

  const faces: { n: [number, number, number]; v: [number, number, number][] }[] = [
    {
      n: [0, 0, 1],
      v: [
        [-hw, -hh, hd],
        [hw, -hh, hd],
        [hw, hh, hd],
        [-hw, hh, hd],
      ],
    },
    {
      n: [0, 0, -1],
      v: [
        [hw, -hh, -hd],
        [-hw, -hh, -hd],
        [-hw, hh, -hd],
        [hw, hh, -hd],
      ],
    },
    {
      n: [0, 1, 0],
      v: [
        [-hw, hh, hd],
        [hw, hh, hd],
        [hw, hh, -hd],
        [-hw, hh, -hd],
      ],
    },
    {
      n: [0, -1, 0],
      v: [
        [-hw, -hh, -hd],
        [hw, -hh, -hd],
        [hw, -hh, hd],
        [-hw, -hh, hd],
      ],
    },
    {
      n: [1, 0, 0],
      v: [
        [hw, -hh, hd],
        [hw, -hh, -hd],
        [hw, hh, -hd],
        [hw, hh, hd],
      ],
    },
    {
      n: [-1, 0, 0],
      v: [
        [-hw, -hh, -hd],
        [-hw, -hh, hd],
        [-hw, hh, hd],
        [-hw, hh, -hd],
      ],
    },
  ];

  for (const f of faces) {
    const base = positions.length / 3;
    for (const vert of f.v) {
      positions.push(vert[0] + ox, vert[1] + oy, vert[2] + oz);
      normals.push(f.n[0], f.n[1], f.n[2]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function addCylinderOrCone(
  positions: number[],
  normals: number[],
  indices: number[],
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments = 10,
  ox = 0,
  oy = 0,
  oz = 0,
): void {
  const halfH = height / 2;
  const baseIdx = positions.length / 3;

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const ny = 0.25;
    const invLen = 1 / Math.hypot(cos, ny, sin);

    positions.push(cos * radiusTop + ox, halfH + oy, sin * radiusTop + oz);
    normals.push(cos * invLen, ny * invLen, sin * invLen);

    positions.push(cos * radiusBottom + ox, -halfH + oy, sin * radiusBottom + oz);
    normals.push(cos * invLen, ny * invLen, sin * invLen);
  }

  for (let i = 0; i < segments; i++) {
    const a = baseIdx + i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, d, a, d, c);
  }

  if (radiusTop > 0.001) {
    const centerTop = positions.length / 3;
    positions.push(ox, halfH + oy, oz);
    normals.push(0, 1, 0);
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      positions.push(Math.cos(theta) * radiusTop + ox, halfH + oy, Math.sin(theta) * radiusTop + oz);
      normals.push(0, 1, 0);
    }
    for (let i = 0; i < segments; i++) {
      indices.push(centerTop, centerTop + 1 + i + 1, centerTop + 1 + i);
    }
  }
}

function createWarshipMesh(
  name: string,
  hullColor: [number, number, number, number],
  sailColor: [number, number, number, number],
  translation: [number, number, number],
  rotY = 0,
): RawMeshSpec[] {
  const hullPos: number[] = [];
  const hullNorm: number[] = [];
  const hullIdx: number[] = [];
  // Primary hull + raised bow & stern + deck cabin + oars
  addBoxGeometry(hullPos, hullNorm, hullIdx, 0.85, 0.28, 2.4, 0, 0.16, 0);
  addBoxGeometry(hullPos, hullNorm, hullIdx, 0.52, 0.34, 0.65, 0, 0.28, 1.18);
  addBoxGeometry(hullPos, hullNorm, hullIdx, 0.56, 0.38, 0.6, 0, 0.3, -1.12);
  addBoxGeometry(hullPos, hullNorm, hullIdx, 0.58, 0.32, 0.9, 0, 0.42, -0.15);
  addCylinderOrCone(hullPos, hullNorm, hullIdx, 0.04, 0.05, 1.65, 8, 0, 0.98, 0.15);

  const sailPos: number[] = [];
  const sailNorm: number[] = [];
  const sailIdx: number[] = [];
  addBoxGeometry(sailPos, sailNorm, sailIdx, 0.95, 0.85, 0.06, 0, 1.05, 0.2);

  const half = rotY / 2;
  const quat: [number, number, number, number] = [0, Math.sin(half), 0, Math.cos(half)];

  return [
    {
      name,
      positions: hullPos,
      normals: hullNorm,
      indices: hullIdx,
      color: hullColor,
      roughness: 0.72,
      metallic: 0.12,
      translation,
      rotation: quat,
    },
    {
      name: `${name}_Buom`,
      positions: sailPos,
      normals: sailNorm,
      indices: sailIdx,
      color: sailColor,
      roughness: 0.85,
      metallic: 0.05,
      translation: [translation[0], translation[1], translation[2]],
      rotation: quat,
    },
  ];
}

function createArrowMesh(
  name: string,
  color: [number, number, number, number],
  translation: [number, number, number],
  rotY = 0,
  length = 2.2,
): RawMeshSpec {
  const pos: number[] = [];
  const norm: number[] = [];
  const idx: number[] = [];
  addBoxGeometry(pos, norm, idx, 0.22, 0.08, length, 0, 0, 0);
  addCylinderOrCone(pos, norm, idx, 0.01, 0.34, 0.65, 6, 0, 0, length / 2 + 0.25);
  // Rotate cone tip forward via box chevrons for crisp tactical look
  addBoxGeometry(pos, norm, idx, 0.55, 0.09, 0.35, 0, 0, length / 2 + 0.12);
  const half = rotY / 2;
  return {
    name,
    positions: pos,
    normals: norm,
    indices: idx,
    color,
    roughness: 0.35,
    metallic: 0.45,
    translation,
    rotation: [0, Math.sin(half), 0, Math.cos(half)],
  };
}

export function buildGlbBuffer(meshes: RawMeshSpec[], animations: RawAnimationClip[] = []): Buffer {
  const bufferViews: Record<string, unknown>[] = [];
  const accessors: Record<string, unknown>[] = [];
  const materials: Record<string, unknown>[] = [];
  const gltfMeshes: Record<string, unknown>[] = [];
  const nodes: Record<string, unknown>[] = [];
  const binaryChunks: Buffer[] = [];
  let byteOffset = 0;

  function appendAlignedBuffer(buf: Buffer, target?: number): number {
    const pad = (4 - (buf.length % 4)) % 4;
    const aligned = pad > 0 ? Buffer.concat([buf, Buffer.alloc(pad, 0)]) : buf;
    const viewIndex = bufferViews.length;
    const view: Record<string, unknown> = {
      buffer: 0,
      byteOffset,
      byteLength: buf.length,
    };
    if (target) view.target = target;
    bufferViews.push(view);
    binaryChunks.push(aligned);
    byteOffset += aligned.length;
    return viewIndex;
  }

  function computeMinMaxVec(arr: number[], stride: number): { min: number[]; max: number[] } {
    const min = new Array(stride).fill(Infinity);
    const max = new Array(stride).fill(-Infinity);
    for (let i = 0; i < arr.length; i += stride) {
      for (let c = 0; c < stride; c++) {
        const v = arr[i + c];
        if (v < min[c]) min[c] = v;
        if (v > max[c]) max[c] = v;
      }
    }
    return { min, max };
  }

  const nodeNameToIndex = new Map<string, number>();

  for (const m of meshes) {
    const matIndex = materials.length;
    materials.push({
      name: `${m.name}_Mat`,
      pbrMetallicRoughness: {
        baseColorFactor: m.color,
        metallicFactor: m.metallic ?? 0.15,
        roughnessFactor: m.roughness ?? 0.75,
      },
      doubleSided: true,
    });

    const posFloat = new Float32Array(m.positions);
    const posView = appendAlignedBuffer(
      Buffer.from(posFloat.buffer, posFloat.byteOffset, posFloat.byteLength),
      34962,
    );
    const posBounds = computeMinMaxVec(m.positions, 3);
    const posAccessor = accessors.length;
    accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: m.positions.length / 3,
      type: 'VEC3',
      min: posBounds.min,
      max: posBounds.max,
    });

    const normFloat = new Float32Array(m.normals);
    const normView = appendAlignedBuffer(
      Buffer.from(normFloat.buffer, normFloat.byteOffset, normFloat.byteLength),
      34962,
    );
    const normAccessor = accessors.length;
    accessors.push({
      bufferView: normView,
      componentType: 5126,
      count: m.normals.length / 3,
      type: 'VEC3',
    });

    const useUint32 = m.positions.length / 3 > 65530;
    const idxArray = useUint32 ? new Uint32Array(m.indices) : new Uint16Array(m.indices);
    const idxView = appendAlignedBuffer(
      Buffer.from(idxArray.buffer, idxArray.byteOffset, idxArray.byteLength),
      34963,
    );
    const idxAccessor = accessors.length;
    accessors.push({
      bufferView: idxView,
      componentType: useUint32 ? 5125 : 5123,
      count: m.indices.length,
      type: 'SCALAR',
    });

    const meshIndex = gltfMeshes.length;
    gltfMeshes.push({
      name: m.name,
      primitives: [
        {
          attributes: {
            POSITION: posAccessor,
            NORMAL: normAccessor,
          },
          indices: idxAccessor,
          material: matIndex,
        },
      ],
    });

    const nodeIndex = nodes.length;
    const nodeObj: Record<string, unknown> = {
      name: m.name,
      mesh: meshIndex,
    };
    if (m.translation) nodeObj.translation = m.translation;
    if (m.rotation) nodeObj.rotation = m.rotation;
    if (m.scale) nodeObj.scale = m.scale;
    nodes.push(nodeObj);
    nodeNameToIndex.set(m.name, nodeIndex);
  }

  const gltfAnimations: Record<string, unknown>[] = [];
  for (const clip of animations) {
    const samplers: Record<string, unknown>[] = [];
    const channels: Record<string, unknown>[] = [];

    for (const ch of clip.channels) {
      const targetNode = nodeNameToIndex.get(ch.targetNodeName);
      if (targetNode === undefined) continue;

      const tArr = new Float32Array(ch.times);
      const tView = appendAlignedBuffer(Buffer.from(tArr.buffer, tArr.byteOffset, tArr.byteLength));
      const tBounds = computeMinMaxVec(ch.times, 1);
      const inputAcc = accessors.length;
      accessors.push({
        bufferView: tView,
        componentType: 5126,
        count: ch.times.length,
        type: 'SCALAR',
        min: tBounds.min,
        max: tBounds.max,
      });

      const stride = ch.path === 'rotation' ? 4 : 3;
      const vArr = new Float32Array(ch.values);
      const vView = appendAlignedBuffer(Buffer.from(vArr.buffer, vArr.byteOffset, vArr.byteLength));
      const outputAcc = accessors.length;
      accessors.push({
        bufferView: vView,
        componentType: 5126,
        count: ch.values.length / stride,
        type: stride === 4 ? 'VEC4' : 'VEC3',
      });

      const samplerIndex = samplers.length;
      samplers.push({
        input: inputAcc,
        interpolation: 'LINEAR',
        output: outputAcc,
      });

      channels.push({
        sampler: samplerIndex,
        target: {
          node: targetNode,
          path: ch.path,
        },
      });
    }

    if (channels.length > 0) {
      gltfAnimations.push({
        name: clip.name,
        samplers,
        channels,
      });
    }
  }

  const binBuffer = Buffer.concat(binaryChunks);
  const gltfJson: Record<string, unknown> = {
    asset: {
      version: '2.0',
      generator: 'LichSu11-3D-THPT-HoaMinh-GLBBuilder',
    },
    scene: 0,
    scenes: [
      {
        name: 'HistoricalScene',
        nodes: nodes.map((_, idx) => idx),
      },
    ],
    nodes,
    meshes: gltfMeshes,
    materials,
    bufferViews,
    accessors,
    buffers: [
      {
        byteLength: binBuffer.length,
      },
    ],
  };

  if (gltfAnimations.length > 0) {
    gltfJson.animations = gltfAnimations;
  }

  const jsonBytes = Buffer.from(JSON.stringify(gltfJson), 'utf8');
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const jsonAligned =
    jsonPad > 0 ? Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]) : jsonBytes;

  const totalLength = 12 + 8 + jsonAligned.length + 8 + binBuffer.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4); // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonAligned.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuffer.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonHeader, jsonAligned, binHeader, binBuffer]);
}

function buildBachDang938Glb(): Buffer {
  const meshes: RawMeshSpec[] = [];

  // Riverbed & two lush riverbanks
  const bedP: number[] = [];
  const bedN: number[] = [];
  const bedI: number[] = [];
  addBoxGeometry(bedP, bedN, bedI, 22, 0.5, 22, 0, -0.85, 0);
  meshes.push({
    name: 'Long_Song_Bach_Dang',
    positions: bedP,
    normals: bedN,
    indices: bedI,
    color: [0.24, 0.2, 0.15, 1],
    roughness: 0.92,
  });

  const bankP: number[] = [];
  const bankN: number[] = [];
  const bankI: number[] = [];
  addBoxGeometry(bankP, bankN, bankI, 5.4, 1.5, 22, -8.3, 0.1, 0);
  addBoxGeometry(bankP, bankN, bankI, 5.4, 1.5, 22, 8.3, 0.1, 0);
  addBoxGeometry(bankP, bankN, bankI, 3.2, 2.2, 16, -9.4, 0.75, -1);
  addBoxGeometry(bankP, bankN, bankI, 3.2, 2.2, 16, 9.4, 0.75, 1);
  meshes.push({
    name: 'Hai_Ben_Bo_Dia_Hinh',
    positions: bankP,
    normals: bankN,
    indices: bankI,
    color: [0.22, 0.39, 0.21, 1],
    roughness: 0.88,
  });

  // Forest canopy along riverbanks
  const treeP: number[] = [];
  const treeN: number[] = [];
  const treeI: number[] = [];
  const treeCoords = [
    [-7.2, -6], [-7.8, -2], [-6.9, 2.5], [-7.6, 6.5],
    [7.2, -5.5], [7.7, -1.5], [7.0, 3], [7.5, 7],
  ];
  for (const [tx, tz] of treeCoords) {
    addCylinderOrCone(treeP, treeN, treeI, 0.14, 0.2, 0.9, 7, tx, 1.25, tz);
    addCylinderOrCone(treeP, treeN, treeI, 0.05, 0.78, 1.45, 8, tx, 2.15, tz);
    addCylinderOrCone(treeP, treeN, treeI, 0.04, 0.6, 1.1, 8, tx, 2.75, tz);
  }
  meshes.push({
    name: 'Rung_Phuc_Binh_Ven_Song',
    positions: treeP,
    normals: treeN,
    indices: treeI,
    color: [0.15, 0.34, 0.17, 1],
    roughness: 0.85,
  });

  // Tidal water surface
  const waterP: number[] = [];
  const waterN: number[] = [];
  const waterI: number[] = [];
  addBoxGeometry(waterP, waterN, waterI, 11.2, 0.18, 21.6, 0, -0.05, 0);
  meshes.push({
    name: 'Mat_Nuoc_Thuy_Trieu',
    positions: waterP,
    normals: waterN,
    indices: waterI,
    color: [0.11, 0.38, 0.54, 0.92],
    roughness: 0.2,
    metallic: 0.35,
    translation: [0, 0.18, 0],
  });

  // Wooden iron-tipped stakes (Bãi cọc ngầm Bạch Đằng)
  const stakeP: number[] = [];
  const stakeN: number[] = [];
  const stakeI: number[] = [];
  for (let row = -2; row <= 2; row++) {
    for (let col = -5; col <= 5; col++) {
      const sx = col * 0.82 + (row % 2 === 0 ? 0.2 : -0.2);
      const sz = row * 0.85 - 0.5;
      addCylinderOrCone(stakeP, stakeN, stakeI, 0.11, 0.15, 1.25, 8, sx, -0.1, sz);
      addCylinderOrCone(stakeP, stakeN, stakeI, 0.01, 0.12, 0.38, 8, sx, 0.68, sz);
    }
  }
  meshes.push({
    name: 'Bai_Coc_Go_Bit_Sat',
    positions: stakeP,
    normals: stakeN,
    indices: stakeI,
    color: [0.46, 0.29, 0.14, 1],
    roughness: 0.78,
    metallic: 0.18,
  });

  // Ngo Quyen light decoy & ambush warships (crimson sails)
  meshes.push(
    ...createWarshipMesh('Thuyen_Nhu_Dich_Ngo_Quyen', [0.42, 0.24, 0.12, 1], [0.72, 0.16, 0.16, 1], [0, 0.18, -5.2], 0),
    ...createWarshipMesh('Thuyen_Phuc_Kich_Ta_Ngan', [0.42, 0.24, 0.12, 1], [0.78, 0.58, 0.18, 1], [-4.1, 0.18, -3.2], 0.55),
    ...createWarshipMesh('Thuyen_Phuc_Kich_Huu_Ngan', [0.42, 0.24, 0.12, 1], [0.78, 0.58, 0.18, 1], [4.1, 0.18, -3.2], -0.55),
  );

  // Southern Han heavy warships (dark slate sails)
  meshes.push(
    ...createWarshipMesh('Chien_Thuyen_Nam_Han_1', [0.26, 0.22, 0.2, 1], [0.24, 0.28, 0.35, 1], [-1.3, 0.2, 6.2], Math.PI),
    ...createWarshipMesh('Chien_Thuyen_Nam_Han_2', [0.26, 0.22, 0.2, 1], [0.24, 0.28, 0.35, 1], [1.4, 0.2, 7.1], Math.PI),
  );

  // Tactical arrows
  meshes.push(
    createArrowMesh('Mui_Ten_Phan_Cong_1', [0.85, 0.62, 0.15, 1], [-2.6, 0.65, -2.2], 0.35, 2.1),
    createArrowMesh('Mui_Ten_Phan_Cong_2', [0.85, 0.62, 0.15, 1], [2.6, 0.65, -2.2], -0.35, 2.1),
  );

  const animations: RawAnimationClip[] = [
    {
      name: 'Toan_Canh_Thuy_Trieu_Va_Phan_Cong',
      channels: [
        {
          targetNodeName: 'Mat_Nuoc_Thuy_Trieu',
          path: 'translation',
          times: [0, 2.5, 5, 8],
          values: [
            0, 0.38, 0,
            0, 0.28, 0,
            0, -0.18, 0,
            0, -0.22, 0,
          ],
        },
        {
          targetNodeName: 'Chien_Thuyen_Nam_Han_1',
          path: 'translation',
          times: [0, 3, 5.5, 8],
          values: [
            -1.3, 0.35, 6.2,
            -1.1, 0.28, 1.8,
            -0.9, 0.02, -0.4,
            -0.9, -0.05, -0.5,
          ],
        },
        {
          targetNodeName: 'Chien_Thuyen_Nam_Han_2',
          path: 'translation',
          times: [0, 3, 5.5, 8],
          values: [
            1.4, 0.35, 7.1,
            1.2, 0.28, 2.4,
            1.0, 0.02, 0.1,
            1.0, -0.05, 0.0,
          ],
        },
        {
          targetNodeName: 'Thuyen_Phuc_Kich_Ta_Ngan',
          path: 'translation',
          times: [0, 3.5, 6.5, 8],
          values: [
            -4.1, 0.25, -3.2,
            -3.8, 0.2, -2.8,
            -2.1, 0.05, -1.3,
            -1.9, 0.05, -1.1,
          ],
        },
        {
          targetNodeName: 'Thuyen_Phuc_Kich_Huu_Ngan',
          path: 'translation',
          times: [0, 3.5, 6.5, 8],
          values: [
            4.1, 0.25, -3.2,
            3.8, 0.2, -2.8,
            2.1, 0.05, -1.3,
            1.9, 0.05, -1.1,
          ],
        },
      ],
    },
    {
      name: 'Giai_Doan_2_Nhu_Dich_Trieu_Len',
      channels: [
        {
          targetNodeName: 'Mat_Nuoc_Thuy_Trieu',
          path: 'translation',
          times: [0, 2, 4],
          values: [0, 0.32, 0, 0, 0.42, 0, 0, 0.36, 0],
        },
        {
          targetNodeName: 'Thuyen_Nhu_Dich_Ngo_Quyen',
          path: 'translation',
          times: [0, 2, 4],
          values: [0, 0.35, 1.8, 0, 0.38, -1.8, 0, 0.35, -4.8],
        },
      ],
    },
  ];

  return buildGlbBuffer(meshes, animations);
}

function buildLamSonGlb(): Buffer {
  const meshes: RawMeshSpec[] = [];

  // Relief terrain table
  const baseP: number[] = [];
  const baseN: number[] = [];
  const baseI: number[] = [];
  addBoxGeometry(baseP, baseN, baseI, 18, 0.7, 22, 0, -0.35, 0);
  meshes.push({
    name: 'Ban_Do_Dia_Hinh_Dai_Viet',
    positions: baseP,
    normals: baseN,
    indices: baseI,
    color: [0.76, 0.7, 0.56, 1],
    roughness: 0.88,
  });

  // Western mountain ranges (Chí Linh – Lam Sơn)
  const mtP: number[] = [];
  const mtN: number[] = [];
  const mtI: number[] = [];
  addCylinderOrCone(mtP, mtN, mtI, 0.3, 2.4, 2.8, 7, -3.5, 1.4, 1.5);
  addCylinderOrCone(mtP, mtN, mtI, 0.25, 1.9, 2.2, 7, -4.8, 1.1, -0.5);
  addCylinderOrCone(mtP, mtN, mtI, 0.35, 2.1, 2.4, 7, -2.8, 1.2, 4.2);
  addCylinderOrCone(mtP, mtN, mtI, 0.3, 1.8, 2.1, 7, -1.8, 1.05, -6.2);
  meshes.push({
    name: 'Nui_Chi_Linh_Lam_Son',
    positions: mtP,
    normals: mtN,
    indices: mtI,
    color: [0.24, 0.41, 0.24, 1],
    roughness: 0.86,
  });

  // Landmark beacons for 1418, 1424, 1426, 1427
  const milestones: { name: string; pos: [number, number, number]; color: [number, number, number, number] }[] = [
    { name: 'Moc_1418_Can_Cu_Lam_Son', pos: [-2.2, 0.9, 1.5], color: [0.78, 0.18, 0.18, 1] },
    { name: 'Moc_1424_Tien_Vao_Nghe_An', pos: [-0.8, 0.9, 5.8], color: [0.82, 0.55, 0.14, 1] },
    { name: 'Moc_1426_Tot_Dong_Chuc_Dong', pos: [1.2, 0.9, -3.2], color: [0.85, 0.64, 0.16, 1] },
    { name: 'Moc_1427_Chi_Lang_Xuong_Giang', pos: [1.8, 0.9, -7.2], color: [0.16, 0.52, 0.34, 1] },
  ];

  for (const m of milestones) {
    const p: number[] = [];
    const n: number[] = [];
    const idx: number[] = [];
    addCylinderOrCone(p, n, idx, 0.35, 0.45, 0.35, 10, 0, -0.65, 0);
    addCylinderOrCone(p, n, idx, 0.08, 0.08, 1.6, 8, 0, 0.2, 0);
    addBoxGeometry(p, n, idx, 0.9, 0.55, 0.08, 0.45, 0.72, 0);
    meshes.push({
      name: m.name,
      positions: p,
      normals: n,
      indices: idx,
      color: m.color,
      roughness: 0.45,
      metallic: 0.25,
      translation: m.pos,
    });
  }

  meshes.push(
    createArrowMesh('Huong_Tien_1424_Nam_Tien', [0.82, 0.55, 0.14, 1], [-1.4, 0.35, 3.6], 0.25, 2.8),
    createArrowMesh('Huong_Tien_1426_Bac_Tien', [0.78, 0.18, 0.18, 1], [0.5, 0.35, 1.2], Math.PI - 0.2, 4.6),
  );

  const animations: RawAnimationClip[] = [
    {
      name: 'Dien_Bien_Hanh_Quan_1418_1427',
      channels: milestones.map((m, i) => ({
        targetNodeName: m.name,
        path: 'scale' as const,
        times: [0, i * 1.2 + 0.6, i * 1.2 + 1.2, 6],
        values: [1, 1, 1, 1.22, 1.28, 1.22, 1, 1, 1, 1, 1, 1],
      })),
    },
  ];

  return buildGlbBuffer(meshes, animations);
}

function buildThanhNhaHoGlb(): Buffer {
  const meshes: RawMeshSpec[] = [];

  // Ground & Royal Avenue
  const groundP: number[] = [];
  const groundN: number[] = [];
  const groundI: number[] = [];
  addBoxGeometry(groundP, groundN, groundI, 24, 0.5, 24, 0, -0.25, 0);
  meshes.push({
    name: 'Khong_Gian_Tay_Do',
    positions: groundP,
    normals: groundN,
    indices: groundI,
    color: [0.34, 0.46, 0.28, 1],
    roughness: 0.9,
  });

  const roadP: number[] = [];
  const roadN: number[] = [];
  const roadI: number[] = [];
  addBoxGeometry(roadP, roadN, roadI, 3.2, 0.12, 18, 0, 0.06, 2.5);
  meshes.push({
    name: 'Duong_Hoang_Gia_Lat_Da',
    positions: roadP,
    normals: roadN,
    indices: roadI,
    color: [0.68, 0.65, 0.58, 1],
    roughness: 0.78,
  });

  // Massive limestone South Gate (Cổng Nam 3 vòm cuốn đá khối)
  const gateP: number[] = [];
  const gateN: number[] = [];
  const gateI: number[] = [];
  // 4 stone piers forming 3 vaulted passages
  const pierXs = [-3.6, -1.2, 1.2, 3.6];
  for (const px of pierXs) {
    addBoxGeometry(gateP, gateN, gateI, 1.35, 2.8, 2.8, px, 1.4, 0);
  }
  // Upper stone lintel & battlement parapet
  addBoxGeometry(gateP, gateN, gateI, 8.8, 1.15, 2.85, 0, 3.35, 0);
  for (let bx = -4.0; bx <= 4.0; bx += 1.0) {
    addBoxGeometry(gateP, gateN, gateI, 0.55, 0.42, 0.4, bx, 4.12, 1.2);
    addBoxGeometry(gateP, gateN, gateI, 0.55, 0.42, 0.4, bx, 4.12, -1.2);
  }
  meshes.push({
    name: 'Cong_Nam_Da_Khoi_Ba_Vom',
    positions: gateP,
    normals: gateN,
    indices: gateI,
    color: [0.58, 0.59, 0.56, 1],
    roughness: 0.82,
    metallic: 0.08,
  });

  // Citadel stone walls & earthen ramparts
  const wallP: number[] = [];
  const wallN: number[] = [];
  const wallI: number[] = [];
  addBoxGeometry(wallP, wallN, wallI, 6.5, 2.6, 2.4, -7.6, 1.3, 0);
  addBoxGeometry(wallP, wallN, wallI, 6.5, 2.6, 2.4, 7.6, 1.3, 0);
  addBoxGeometry(wallP, wallN, wallI, 2.4, 2.6, 12, -10.2, 1.3, -6);
  addBoxGeometry(wallP, wallN, wallI, 2.4, 2.6, 12, 10.2, 1.3, -6);
  meshes.push({
    name: 'Tuong_Thanh_Da_Ghep_Khit',
    positions: wallP,
    normals: wallN,
    indices: wallI,
    color: [0.52, 0.54, 0.51, 1],
    roughness: 0.86,
  });

  // Protective moat
  const moatP: number[] = [];
  const moatN: number[] = [];
  const moatI: number[] = [];
  addBoxGeometry(moatP, moatN, moatI, 8.2, 0.08, 2.2, -6.5, 0.03, 3.6);
  addBoxGeometry(moatP, moatN, moatI, 8.2, 0.08, 2.2, 6.5, 0.03, 3.6);
  meshes.push({
    name: 'Hao_Thanh_Bao_Ve',
    positions: moatP,
    normals: moatN,
    indices: moatI,
    color: [0.16, 0.42, 0.55, 1],
    roughness: 0.22,
  });

  // Banner atop South Gate
  const flagP: number[] = [];
  const flagN: number[] = [];
  const flagI: number[] = [];
  addCylinderOrCone(flagP, flagN, flagI, 0.05, 0.06, 1.8, 8, 0, 0.9, 0);
  addBoxGeometry(flagP, flagN, flagI, 1.1, 0.65, 0.06, 0.55, 1.45, 0);
  meshes.push({
    name: 'Ky_Dai_Trieu_Ho',
    positions: flagP,
    normals: flagN,
    indices: flagI,
    color: [0.76, 0.56, 0.16, 1],
    roughness: 0.5,
    translation: [0, 3.9, 0],
  });

  const animations: RawAnimationClip[] = [
    {
      name: 'Ky_Dai_Tung_Bay',
      channels: [
        {
          targetNodeName: 'Ky_Dai_Trieu_Ho',
          path: 'rotation',
          times: [0, 1.5, 3, 4.5],
          values: [
            0, 0, 0, 1,
            0, 0.12, 0, 0.992,
            0, -0.12, 0, 0.992,
            0, 0, 0, 1,
          ],
        },
      ],
    },
  ];

  return buildGlbBuffer(meshes, animations);
}

function buildDongNamAGlb(): Buffer {
  const meshes: RawMeshSpec[] = [];

  const seaP: number[] = [];
  const seaN: number[] = [];
  const seaI: number[] = [];
  addBoxGeometry(seaP, seaN, seaI, 24, 0.35, 20, 0, -0.2, 0);
  meshes.push({
    name: 'Vung_Bien_Dong_Nam_A',
    positions: seaP,
    normals: seaN,
    indices: seaI,
    color: [0.09, 0.28, 0.45, 1],
    roughness: 0.28,
    metallic: 0.25,
  });

  const regions: { name: string; w: number; d: number; pos: [number, number, number]; color: [number, number, number, number] }[] = [
    { name: 'Ban_Dao_Dong_Duong_VN_Lao_CPC', w: 3.2, d: 5.2, pos: [-1.2, 0.35, -3.5], color: [0.78, 0.58, 0.22, 1] },
    { name: ' Vuong_Quoc_Xiem_Thai_Lan', w: 2.6, d: 3.6, pos: [-4.2, 0.32, -3.2], color: [0.35, 0.58, 0.42, 1] },
    { name: 'Myanmar_Miendia', w: 2.2, d: 3.8, pos: [-6.8, 0.32, -4.8], color: [0.62, 0.42, 0.32, 1] },
    { name: 'Ban_Dao_Ma_Lai_Singapore', w: 1.6, d: 3.4, pos: [-3.5, 0.3, 1.2], color: [0.52, 0.46, 0.68, 1] },
    { name: 'Quan_Dao_Indonesia', w: 9.5, d: 2.2, pos: [0.5, 0.3, 5.2], color: [0.74, 0.32, 0.26, 1] },
    { name: 'Quan_Dao_Philippines', w: 2.4, d: 4.4, pos: [5.4, 0.32, -1.2], color: [0.28, 0.54, 0.68, 1] },
  ];

  for (const r of regions) {
    const p: number[] = [];
    const n: number[] = [];
    const idx: number[] = [];
    addBoxGeometry(p, n, idx, r.w, 0.65, r.d, 0, 0, 0);
    addCylinderOrCone(p, n, idx, 0.18, 0.24, 0.9, 8, 0, 0.72, 0);
    meshes.push({
      name: r.name.trim(),
      positions: p,
      normals: n,
      indices: idx,
      color: r.color,
      roughness: 0.68,
      translation: r.pos,
    });
  }

  meshes.push(
    createArrowMesh('Tuyen_Hang_Hai_Eo_Malacca', [0.9, 0.72, 0.22, 1], [-4.8, 0.45, 2.8], 0.85, 4.2),
  );

  const animations: RawAnimationClip[] = [
    {
      name: 'Tuyen_Hang_Hai_Va_Doc_Lap',
      channels: [
        {
          targetNodeName: 'Tuyen_Hang_Hai_Eo_Malacca',
          path: 'translation',
          times: [0, 2.5, 5],
          values: [-5.8, 0.45, 3.5, -3.2, 0.55, 1.6, -5.8, 0.45, 3.5],
        },
      ],
    },
  ];

  return buildGlbBuffer(meshes, animations);
}

function buildBienDongGlb(): Buffer {
  const meshes: RawMeshSpec[] = [];

  const oceanP: number[] = [];
  const oceanN: number[] = [];
  const oceanI: number[] = [];
  addBoxGeometry(oceanP, oceanN, oceanI, 22, 0.4, 24, 0, -0.2, 0);
  meshes.push({
    name: 'Khong_Gian_Bien_Dong',
    positions: oceanP,
    normals: oceanN,
    indices: oceanI,
    color: [0.08, 0.34, 0.56, 1],
    roughness: 0.24,
    metallic: 0.3,
  });

  // S-shaped Vietnam coastline & continental shelf on the West
  const vnP: number[] = [];
  const vnN: number[] = [];
  const vnI: number[] = [];
  addBoxGeometry(vnP, vnN, vnI, 3.6, 0.9, 6.2, -6.2, 0.45, -6.5);
  addBoxGeometry(vnP, vnN, vnI, 2.2, 0.85, 6.4, -5.0, 0.42, -0.5);
  addBoxGeometry(vnP, vnN, vnI, 3.2, 0.8, 5.4, -5.8, 0.4, 5.2);
  meshes.push({
    name: 'Dai_Dat_Lien_Va_Bo_Bien_Viet_Nam',
    positions: vnP,
    normals: vnN,
    indices: vnI,
    color: [0.24, 0.52, 0.3, 1],
    roughness: 0.78,
  });

  // Continental shelf terrace
  const shelfP: number[] = [];
  const shelfN: number[] = [];
  const shelfI: number[] = [];
  addBoxGeometry(shelfP, shelfN, shelfI, 4.8, 0.22, 18.5, -3.8, 0.08, -0.5);
  meshes.push({
    name: 'Them_Luc_Dia_Viet_Nam',
    positions: shelfP,
    normals: shelfN,
    indices: shelfI,
    color: [0.18, 0.56, 0.72, 1],
    roughness: 0.42,
  });

  // Hoang Sa & Truong Sa archipelagos markers (historical sovereignty markers)
  const hsP: number[] = [];
  const hsN: number[] = [];
  const hsI: number[] = [];
  addCylinderOrCone(hsP, hsN, hsI, 0.85, 1.15, 0.35, 10, 0, 0.18, 0);
  addBoxGeometry(hsP, hsN, hsI, 0.38, 1.35, 0.24, 0, 0.95, 0);
  meshes.push({
    name: 'Quan_Dao_Hoang_Sa',
    positions: hsP,
    normals: hsN,
    indices: hsI,
    color: [0.85, 0.65, 0.2, 1],
    roughness: 0.45,
    metallic: 0.3,
    translation: [-0.8, 0.1, -2.6],
  });

  const tsP: number[] = [];
  const tsN: number[] = [];
  const tsI: number[] = [];
  addCylinderOrCone(tsP, tsN, tsI, 1.05, 1.35, 0.35, 10, 0, 0.18, 0);
  addBoxGeometry(tsP, tsN, tsI, 0.38, 1.35, 0.24, 0, 0.95, 0);
  meshes.push({
    name: 'Quan_Dao_Truong_Sa',
    positions: tsP,
    normals: tsN,
    indices: tsI,
    color: [0.85, 0.22, 0.22, 1],
    roughness: 0.45,
    metallic: 0.3,
    translation: [1.4, 0.1, 3.4],
  });

  // International maritime shipping lane vessel + arrow
  meshes.push(
    ...createWarshipMesh('Tau_Hang_Hai_Quoc_Te', [0.82, 0.84, 0.88, 1], [0.88, 0.65, 0.18, 1], [2.8, 0.15, 7.5], Math.PI * 0.88),
    createArrowMesh('Tuyen_Hang_Hai_Thai_Binh_Duong_An_Do_Duong', [0.92, 0.74, 0.22, 1], [2.4, 0.32, 0.5], -0.25, 9.5),
  );

  const animations: RawAnimationClip[] = [
    {
      name: 'Luu_Thong_Tuyen_Hang_Hai_Quoc_Te',
      channels: [
        {
          targetNodeName: 'Tau_Hang_Hai_Quoc_Te',
          path: 'translation',
          times: [0, 3, 6],
          values: [
            0.2, 0.15, 8.2,
            2.4, 0.15, 0.5,
            4.6, 0.15, -7.2,
          ],
        },
      ],
    },
  ];

  return buildGlbBuffer(meshes, animations);
}

export function ensureBuiltInGlbAssets(rootDir = process.cwd()): void {
  const modelsDir = path.join(rootDir, 'public', 'models');
  const uploadsDir = path.join(rootDir, 'public', 'uploads', 'models');
  const blenderDir = path.join(rootDir, 'public', 'blender_scripts');

  fs.mkdirSync(modelsDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(blenderDir, { recursive: true });

  const gitkeep = path.join(uploadsDir, '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, '');
  }

  const coreFilenames = [
    'bach_dang_938.glb',
    'khoi_nghia_lam_son.glb',
    'thanh_nha_ho.glb',
    'dong_nam_a_can_dai.glb',
    'khong_gian_bien_dong.glb',
    'van_minh_cong_nghiep_do_thi.glb',
    'quan_the_nhan_vat_sinh_thai_3d.glb',
  ];

  const allPythonGlbsReady = coreFilenames.every((filename) => {
    const filePath = path.join(modelsDir, filename);
    if (!fs.existsSync(filePath)) return false;
    const meta = parseGlbHeaderMetadata(filePath);
    return meta.valid && meta.generator.includes('HistoricalWideWorld-v4');
  });

  if (!allPythonGlbsReady) {
    const mergerScriptPath = path.join(rootDir, 'public', 'python_glb', 'hop_nhat_canh_glb.py');
    const pyScriptPath = path.join(rootDir, 'public', 'python_glb', 'sinh_mo_phong_lich_su_glb.py');
    let builtByPython = false;

    if (fs.existsSync(mergerScriptPath)) {
      try {
        execFileSync('python3', [mergerScriptPath, '--build-all', '--out-dir', modelsDir], {
          encoding: 'utf8',
          timeout: 180_000,
        });
        builtByPython = true;
      } catch (err) {
        console.warn('Multi-asset Python GLB merger warning, trying procedural Python compiler:', err);
      }
    }

    if (!builtByPython && fs.existsSync(pyScriptPath)) {
      try {
        execFileSync('python3', [pyScriptPath, '--build-all', '--out-dir', modelsDir], {
          encoding: 'utf8',
          timeout: 25_000,
        });
        builtByPython = true;
      } catch (err) {
        console.warn('Python 3 GLB build warning, falling back to TypeScript GLB builder:', err);
      }
    }

    if (!builtByPython) {
      const targets: { filename: string; build: () => Buffer }[] = [
        { filename: 'bach_dang_938.glb', build: buildBachDang938Glb },
        { filename: 'khoi_nghia_lam_son.glb', build: buildLamSonGlb },
        { filename: 'thanh_nha_ho.glb', build: buildThanhNhaHoGlb },
        { filename: 'dong_nam_a_can_dai.glb', build: buildDongNamAGlb },
        { filename: 'khong_gian_bien_dong.glb', build: buildBienDongGlb },
      ];

      for (const t of targets) {
        const filePath = path.join(modelsDir, t.filename);
        fs.writeFileSync(filePath, t.build());
      }
    }
  }

  const readmePath = path.join(modelsDir, 'HUONG_DAN_BLENDER_GLB.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(
      readmePath,
      `# Hướng dẫn Tạo & Bổ sung Mô hình Lịch sử 3D (.glb) từ Blender

1. Mở **Blender 3.6 / 4.x**, chuyển sang tab **Scripting** và chạy kịch bản Python mẫu trong \`/public/blender_scripts/tao_bai_coc_bach_dang.py\`.
2. Đặt tên rõ ràng cho từng đối tượng (Object Name) để học sinh nhấn vào xem chú thích qua Raycaster.
3. Nếu có hoạt ảnh theo giai đoạn lịch sử, tạo các Action trong **Action Editor / NLA** (hệ thống tự động đọc danh sách \`gltf.animations\` qua \`AnimationMixer\`).
4. Xuất tệp: **File -> Export -> glTF 2.0 (.glb)**, bật chọn *Apply Modifiers*, *Normals*, *Materials*, và *Animations*.
5. Đăng nhập Quản trị Giáo viên (\`/giao-vien\`) -> **Quản lý mô hình 3D** (\`/admin/mo-hinh-3d\`) -> Tải tệp \`.glb\` lên, chỉnh góc camera, gắn điểm tương tác (Hotspot) và nhấn **Duyệt và công bố** mà không cần sửa mã nguồn.
`,
      'utf8',
    );
  }

  const scriptPath = path.join(blenderDir, 'tao_bai_coc_bach_dang.py');
  if (!fs.existsSync(scriptPath)) {
    fs.writeFileSync(
      scriptPath,
      `# Kịch bản Python Blender mẫu tạo mô hình Bãi cọc Bạch Đằng 938 và xuất ra .glb
import bpy
import math

bpy.ops.wm.read_factory_settings(use_empty=True)

# Tạo mặt sông
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
river = bpy.context.active_object
river.name = "Mat_Nuoc_Bach_Dang"

# Tạo hàng cọc gỗ nhọn
for r in range(-2, 3):
    for c in range(-4, 5):
        bpy.ops.mesh.primitive_cone_add(
            vertices=10, radius1=0.14, radius2=0.04, depth=1.6,
            location=(c * 0.9, r * 0.9, 0.2)
        )
        stake = bpy.context.active_object
        stake.name = f"Coc_Go_{r}_{c}"
        stake.rotation_euler = (math.radians(12), 0, 0)

# Xuất ra tệp GLB chuẩn cho WebGL / Three.js
bpy.ops.export_scene.gltf(filepath="bach_dang_custom.glb", export_format="GLB")
`,
      'utf8',
    );
  }
}
