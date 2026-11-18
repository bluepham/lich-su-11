import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Box,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  Eye,
  FileCode2,
  Layers,
  MapPin,
  PawPrint,
  Search,
  Trees,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GlbMuseumViewer } from '../components/GlbMuseumViewer';
import type { CuratedGlbAsset, Model3DItem, ModelHotspot } from '../types';
import { apiFetch } from '../utils/authSession';

function formatLessonBadge(lessonNumber: number, title: string): string {
  return title.trim().toLowerCase().startsWith('bài') ? title : `Bài ${lessonNumber}: ${title}`;
}

const ROOM_SHORT_TITLES: Record<string, string> = {
  'bach-dang-938': 'Bạch Đằng 938',
  'khoi-nghia-lam-son': 'Khởi nghĩa Lam Sơn',
  'thanh-nha-ho': 'Thành nhà Hồ 1397',
  'dong-nam-a-can-dai': 'Đông Nam Á',
  'khong-gian-bien-dong': 'Biển Đông – Hoàng Sa & Trường Sa',
  'van-minh-cong-nghiep-do-thi': 'Đô thị Cơ giới (Bài 2)',
  'quan-the-nhan-vat-sinh-thai-3d': 'Quần thể Di sản & Cổ phục Đại Việt',
};

export function Museum3DLibraryPage() {
  const { models, lessons } = useApp();
  const [stageSlug, setStageSlug] = useState<string>('quan-the-nhan-vat-sinh-thai-3d');
  const [assetPack, setAssetPack] = useState<CuratedGlbAsset[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'human' | 'vehicle' | 'animal' | 'landscape'>('human');
  const [inspectedAsset, setInspectedAsset] = useState<CuratedGlbAsset | null>(null);

  const stageModel = useMemo(
    () => models.find((m) => m.slug === stageSlug) || models[0] || null,
    [models, stageSlug],
  );

  useEffect(() => {
    let active = true;
    apiFetch('/api/public/python-glb-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data || !Array.isArray(data.assetPack)) return;
        setAssetPack(data.assetPack);
        const firstHuman = data.assetPack.find((a: CuratedGlbAsset) => a.category === 'human');
        if (firstHuman) {
          setInspectedAsset(firstHuman);
        } else if (data.assetPack.length > 0) {
          setInspectedAsset(data.assetPack[0]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const filteredAssets = useMemo(
    () => assetPack.filter((a) => categoryFilter === 'all' || a.category === categoryFilter),
    [assetPack, categoryFilter],
  );

  const singleAssetViewerModel: Model3DItem | null = useMemo(() => {
    if (!inspectedAsset) return null;
    return {
      id: `asset-${inspectedAsset.id}`,
      slug: inspectedAsset.id,
      lessonId: 'lesson-8',
      modelName: `${inspectedAsset.title} (${inspectedAsset.categoryLabel})`,
      fileUrl: inspectedAsset.fileUrl,
      thumbnailUrl: '',
      description: `Tệp nhị phân chuẩn glTF 2.0 (.glb) từ kho ${inspectedAsset.repoName}, đã được chế tác cổ phục lịch sử / chuẩn hóa tâm đáy và làm đẹp vật liệu PBR.`,
      sourceReference: inspectedAsset.repoName,
      authorName: inspectedAsset.repoName,
      animationNames: [],
      cameraSettings: { position: [2.45, 1.55, 3.65], target: [0, 0.9, 0] },
      phases: [],
      reviewStatus: 'published',
      version: '3.0',
      hotspots: [],
    };
  }, [inspectedAsset]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-12">
      {/* Top Centerpiece 3D Exhibition Stage */}
      <section className="bg-[#0B132B] text-[#FAF7F0] rounded-2xl p-5 sm:p-7 border border-[#C89B3C]/40 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1.5 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#E6BE68]">
              Bảo tàng Lịch sử Ba chiều · Bối cảnh Rộng 62m–68m &amp; Cổ phục Lịch sử Việt Nam
            </p>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold">
              Trung tâm Trưng bày Đại cảnh &amp; Cổ phục Lịch sử 3D (.glb)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Khám phá trực tiếp <strong>{models.length} không gian lịch sử mở rộng</strong> và{' '}
              <strong className="text-[#E6BE68]">6 nguyên mẫu Nhân vật Cổ phục Đại Việt</strong> (Áo Giao Lĩnh – Nhật Bình, Mũ Đâu Mâu Giáp đồng, Mũ Cánh Chuồn, Áo Ngũ Thân Nón lá, Thủy quân Bạch Đằng, Nghĩa quân Lam Sơn) cùng Chiến thuyền, Súng Thần Cơ, Kỵ binh và Cảnh quan thiên nhiên.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {stageModel && (
              <Link
                to={`/kham-pha-3d/${stageModel.slug}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold hover:bg-[#d8ab4c] whitespace-nowrap"
              >
                <Compass className="w-4 h-4" /> Mở Phòng Nhiệm Vụ 3D
              </Link>
            )}
            <a
              href="/python_glb/hop_nhat_canh_glb.py"
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#162447] border border-white/20 text-xs font-semibold text-[#E6BE68] hover:bg-[#1F315C] whitespace-nowrap"
            >
              <FileCode2 className="w-4 h-4" /> Mã nguồn Python Cổ phục &amp; Đại cảnh .glb
            </a>
          </div>
        </div>

        {/* Instant 7-Scene Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          {models.map((m) => {
            const active = stageModel?.slug === m.slug;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setStageSlug(m.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#C89B3C] text-[#0B132B] font-bold'
                    : 'bg-[#162447] text-slate-200 border border-white/10 hover:border-[#C89B3C]/60'
                }`}
              >
                {ROOM_SHORT_TITLES[m.slug] || m.modelName}
              </button>
            );
          })}
        </div>

        {stageModel && (
          <GlbMuseumViewer
            model={stageModel}
            heightClass="h-[500px] sm:h-[560px] lg:h-[620px]"
          />
        )}
      </section>

      {/* Part 1: Curated 360° Historical Costume & Prop Studio (.glb) */}
      {assetPack.length > 0 && (
        <section
          data-testid="curated-glb-asset-pack"
          className="scroll-mt-28 bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-stone-100 pb-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
                Phần I · Phòng Trưng bày Cổ phục Lịch sử &amp; Hiện vật 360° (.glb)
              </p>
              <h2 className="font-display text-2xl font-bold text-[#141B2D]">
                Nhân vật Cổ phục Đại Việt · Chiến thuyền · Kỵ mã &amp; Cảnh quan
              </h2>
              <p className="text-xs text-stone-600 max-w-3xl">
                Nhấn chọn từng nhân vật hoặc khí cụ để soi cận cảnh 360° mũ miện, giáp trụ, tà áo cổ phục, binh khí và tải tệp nhị phân <code>.glb</code> độc lập.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                {
                  key: 'human',
                  label: `Nhân vật Cổ phục (${assetPack.filter((a) => a.category === 'human').length})`,
                  icon: UserCheck,
                },
                {
                  key: 'vehicle',
                  label: `Thuyền chiến, Pháo & Xe (${assetPack.filter((a) => a.category === 'vehicle').length})`,
                  icon: Car,
                },
                {
                  key: 'animal',
                  label: `Chiến mã & Động vật (${assetPack.filter((a) => a.category === 'animal').length})`,
                  icon: PawPrint,
                },
                {
                  key: 'landscape',
                  label: `Kiến trúc & Cây cảnh (${assetPack.filter((a) => a.category === 'landscape').length})`,
                  icon: Trees,
                },
                { key: 'all', label: `Tất cả (${assetPack.length})`, icon: Layers },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = categoryFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      const nextKey = tab.key as typeof categoryFilter;
                      setCategoryFilter(nextKey);
                      const firstMatch = assetPack.find((a) => nextKey === 'all' || a.category === nextKey);
                      if (firstMatch) setInspectedAsset(firstMatch);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#0B132B] text-[#FAF7F0]'
                        : 'bg-[#FAF7F0] border border-stone-200 text-stone-700 hover:border-[#0B132B]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-[#C89B3C]" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left/Center Wide 7-Column 360° Studio Pedestal Viewer */}
            <div className="lg:col-span-7 space-y-3">
              {singleAssetViewerModel && inspectedAsset && (
                <>
                  <GlbMuseumViewer
                    model={singleAssetViewerModel}
                    heightClass="h-[480px] sm:h-[520px]"
                    compact
                    autoFitSingleAsset
                  />
                  <div className="p-4 rounded-xl bg-[#FAF7F0] border border-stone-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-[#0B132B]">{inspectedAsset.title}</p>
                      <p className="text-[11px] text-stone-600">
                        Nhóm: <strong>{inspectedAsset.categoryLabel}</strong> · Nguồn: <code>{inspectedAsset.repoName}</code> ·{' '}
                        <span className="font-mono-num">{Math.max(1, Math.round(inspectedAsset.byteLength / 1024))} KB</span> ·{' '}
                        <span className="font-mono-num">{inspectedAsset.meshCount}</span> lưới PBR
                        {inspectedAsset.animationCount > 0 ? ` · ${inspectedAsset.animationCount} hoạt ảnh xương` : ''}
                      </p>
                    </div>
                    <a
                      href={inspectedAsset.fileUrl}
                      download
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#8B1E24] text-white text-xs font-bold hover:bg-[#72171C]"
                    >
                      <Download className="w-3.5 h-3.5" /> Tải {inspectedAsset.filename}
                    </a>
                  </div>
                </>
              )}
            </div>

            {/* Right 5-Column Asset Selector Cards */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredAssets.map((asset) => {
                const isSelected = inspectedAsset?.id === asset.id;
                return (
                  <div
                    key={asset.id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-colors ${
                      isSelected
                        ? 'bg-[#0B132B] text-[#FAF7F0] border-[#0B132B]'
                        : 'bg-[#FAF7F0] text-[#141B2D] border-stone-200 hover:border-[#0B132B]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={isSelected ? 'text-[#E6BE68] font-semibold' : 'text-[#8B1E24] font-semibold'}>
                          {asset.categoryLabel}
                        </span>
                        <span className={`font-mono-num ${isSelected ? 'text-slate-300' : 'text-stone-500'}`}>
                          {Math.max(1, Math.round(asset.byteLength / 1024))} KB
                        </span>
                      </div>
                      <h3 className="text-xs font-bold leading-snug">{asset.title}</h3>
                      <p className={`text-[11px] truncate ${isSelected ? 'text-slate-300' : 'text-stone-500'}`}>
                        {asset.repoName}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-current/10">
                      <button
                        type="button"
                        onClick={() => setInspectedAsset(asset)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-bold ${
                          isSelected
                            ? 'bg-[#C89B3C] text-[#0B132B]'
                            : 'bg-[#0B132B] text-white hover:bg-[#162447]'
                        }`}
                      >
                        <Eye className="w-3 h-3" /> {isSelected ? 'Đang soi 360°' : 'Soi 360° (.glb)'}
                      </button>
                      <a
                        href={asset.fileUrl}
                        download
                        aria-label={`Tải tệp ${asset.filename}`}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-semibold border ${
                          isSelected
                            ? 'border-white/25 text-slate-200 hover:bg-white/10'
                            : 'border-stone-300 bg-white text-stone-700 hover:border-[#0B132B]'
                        }`}
                      >
                        <Download className="w-3 h-3" /> .glb
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Part 2: Complete Catalog of 7 Expanded Historical Worlds */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
              Phần II · Danh mục 7 Đại cảnh Lịch sử Mở rộng (62m – 68m)
            </p>
            <h2 className="font-display text-2xl font-bold text-[#141B2D]">
              Hồ sơ Sử liệu &amp; Phòng Khám phá Từng Đại cảnh (.glb)
            </h2>
          </div>
          <span className="text-xs font-mono-num text-stone-500">
            {models.length} đại cảnh .glb chuẩn hóa
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {models.map((model, idx) => {
            const linkedLesson = lessons.find((l) => l.id === model.lessonId);
            return (
              <div
                key={model.id}
                className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col justify-between space-y-5 hover:border-[#0B132B] transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>
                      Đại cảnh {String(idx + 1).padStart(2, '0')} · v<span className="font-mono-num">{model.version}</span>
                    </span>
                    <span className="font-mono-num text-[#8B1E24] font-semibold">
                      {model.hotspots.length} điểm chú thích · {model.phases.length} giai đoạn
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-[#141B2D]">{model.modelName}</h3>

                  {linkedLesson && (
                    <p className="text-xs font-semibold text-[#0B132B]">
                      Gắn với {formatLessonBadge(linkedLesson.lessonNumber, linkedLesson.title)}
                    </p>
                  )}

                  <p className="text-sm text-stone-600 leading-relaxed">{model.description}</p>
                  <p className="text-xs text-stone-500">
                    <strong>Nguồn tư liệu:</strong> {model.sourceReference} · Tệp: <code>{model.fileUrl}</code>
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/kham-pha-3d/${model.slug}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0B132B] text-[#FAF7F0] text-xs font-bold hover:bg-[#162447]"
                    >
                      <Box className="w-4 h-4 text-[#E6BE68]" /> Vào Phòng Khám Phá 3D
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setStageSlug(model.slug);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-stone-300 bg-[#FAF7F0] text-stone-800 text-xs font-semibold hover:border-[#0B132B]"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#8B1E24]" /> Đưa lên Sân khấu 3D
                    </button>
                    <a
                      href={model.fileUrl}
                      download
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-stone-700 text-xs font-semibold hover:border-[#0B132B]"
                    >
                      <Download className="w-3.5 h-3.5 text-[#8B1E24]" /> .glb
                    </a>
                  </div>
                  {linkedLesson && (
                    <Link
                      to={`/bai-hoc/${linkedLesson.id}`}
                      className="text-xs font-semibold text-[#8B1E24] hover:underline inline-flex items-center gap-1"
                    >
                      Bài học SGK <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function Explore3DRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { models, lessons, role } = useApp();

  const model =
    models.find((m) => m.slug === id || m.id === id) || models[0];

  const [activePhaseKey, setActivePhaseKey] = useState<string>(model?.phases[0]?.key || 'all');
  const [inspectedHotspots, setInspectedHotspots] = useState<string[]>([]);
  const [inspectedMeshes, setInspectedMeshes] = useState<string[]>([]);
  const [predictionText, setPredictionText] = useState<string>('');
  const [verifiedSource, setVerifiedSource] = useState<boolean>(false);
  const [explanationText, setExplanationText] = useState<string>('');
  const [workflowCompleted, setWorkflowCompleted] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  useEffect(() => {
    if (model) {
      setActivePhaseKey(model.phases[0]?.key || 'all');
    }
  }, [model?.id]);

  if (!model) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-sm text-stone-600">
        Đang tải mô hình 3D...
      </div>
    );
  }

  const linkedLesson = lessons.find((l) => l.id === model.lessonId);
  const activePhase = model.phases.find((p) => p.key === activePhaseKey) || model.phases[0];

  const step1Done = inspectedHotspots.length >= 1 || inspectedMeshes.length >= 1;
  const step2Done = predictionText.trim().length >= 8;
  const step3Done = verifiedSource;
  const step4Done = explanationText.trim().length >= 12;

  const handleHotspotSelect = (hs: ModelHotspot) => {
    setInspectedHotspots((prev) => (prev.includes(hs.id) ? prev : [...prev, hs.id]));
  };

  const handleObjectInspected = (meshName: string) => {
    setInspectedMeshes((prev) => (prev.includes(meshName) ? prev : [...prev, meshName]));
  };

  const handleCompleteWorkflow = async () => {
    setWorkflowCompleted(true);
    if (role !== 'student') {
      setSaveMessage(
        'Em đã hoàn thành quy trình 5 bước khám phá! Hãy đăng nhập tài khoản Học sinh để lưu tiến độ và nhận huy hiệu "Nhà khám phá lịch sử".',
      );
      return;
    }

    const res = await apiFetch('/api/student/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId: model.lessonId,
        progressPercent: 100,
        explored3d: true,
        explorationData: {
          modelSlug: model.slug,
          predictionText,
          explanationText,
          step5Completed: true,
          completedAt: new Date().toISOString(),
        },
      }),
    });

    if (res.ok) {
      setSaveMessage(
        'Đã lưu kết quả khám phá 3D vào cơ sở dữ liệu và xét cấp huy hiệu "Nhà khám phá lịch sử" / "Nhà nghiên cứu trẻ"!',
      );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* TOP FULL-WIDTH WIDESCREEN 3D HISTORICAL STAGE */}
      <section className="bg-[#0B132B] text-[#FAF7F0] border-b border-[#C89B3C]/35">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-5 pb-7 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <Link
                to="/thu-vien-3d"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#E6BE68] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Bảo tàng Đại cảnh &amp; Cổ phục 3D
              </Link>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#FAF7F0] mt-0.5">
                {model.modelName}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {linkedLesson && (
                <Link
                  to={`/bai-hoc/${linkedLesson.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#162447] border border-[#C89B3C]/45 text-xs font-semibold text-[#E6BE68] hover:bg-[#1F315C]"
                >
                  <BookOpen className="w-4 h-4" /> Đối chiếu Bài {linkedLesson.lessonNumber} SGK
                </Link>
              )}
              <a
                href={model.fileUrl}
                download
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#162447] border border-white/15 text-xs font-semibold text-slate-200 hover:bg-[#1F315C]"
              >
                <Download className="w-3.5 h-3.5 text-[#E6BE68]" /> Tải tệp .glb
              </a>
            </div>
          </div>

          {/* Quick Switcher Across All 7 Historical 3D Worlds */}
          <div className="flex flex-wrap items-center gap-1.5">
            {models.map((m) => {
              const isCurrent = m.id === model.id;
              return (
                <Link
                  key={m.id}
                  to={`/kham-pha-3d/${m.slug}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    isCurrent
                      ? 'bg-[#C89B3C] text-[#0B132B] font-bold'
                      : 'bg-[#162447] text-slate-200 border border-white/10 hover:border-[#C89B3C]/60'
                  }`}
                >
                  {ROOM_SHORT_TITLES[m.slug] || m.modelName}
                </Link>
              );
            })}
          </div>

          {/* UNOBSTRUCTED 1440px WIDESCREEN 3D VIEWPORT */}
          <GlbMuseumViewer
            model={model}
            heightClass="h-[540px] sm:h-[600px] lg:h-[660px]"
            activePhaseKey={activePhaseKey}
            onPhaseChange={(ph) => setActivePhaseKey(ph.key)}
            onHotspotSelect={handleHotspotSelect}
            onObjectInspected={handleObjectInspected}
          />
        </div>
      </section>

      {/* BELOW-STAGE CURATORIAL WORKBENCH (2 Balanced Columns) */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
        {saveMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLUMNS: Spatial Phases, Hotspot Annotations & Primary Historical Sources */}
          <div className="lg:col-span-7 space-y-6">
            {model.phases.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
                    Diễn trình giai đoạn không gian &amp; Góc máy lịch sử
                  </p>
                  <h2 className="font-display text-xl font-bold text-[#141B2D]">
                    {activePhase?.label}
                  </h2>
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">{activePhase?.summary}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {model.phases.map((ph) => (
                    <button
                      key={ph.key}
                      type="button"
                      onClick={() => setActivePhaseKey(ph.key)}
                      className={`text-left p-3 rounded-xl border text-xs transition-colors ${
                        activePhaseKey === ph.key
                          ? 'bg-[#0B132B] text-white border-[#0B132B]'
                          : 'bg-[#FAF7F0] text-stone-800 border-stone-200 hover:border-[#0B132B]'
                      }`}
                    >
                      <span className="font-bold block">{ph.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
              <div className="space-y-1 border-b border-stone-100 pb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
                  Bối cảnh lịch sử, Cổ phục &amp; Địa vật trong Đại cảnh ({model.hotspots.length} điểm)
                </p>
                <p className="text-sm text-stone-700 leading-relaxed">{model.description}</p>
                <p className="text-xs text-stone-500 pt-1">
                  <strong>Nguồn sử liệu đối chiếu:</strong> {model.sourceReference}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {model.hotspots.map((h, i) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => handleHotspotSelect(h)}
                    className="text-left p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200 hover:border-[#0B132B] space-y-1 transition-colors"
                  >
                    <p className="text-xs font-bold text-[#8B1E24]">
                      {i + 1}. {h.title}
                    </p>
                    <p className="text-xs text-stone-700 leading-relaxed">{h.description}</p>
                  </button>
                ))}
              </div>

              {linkedLesson && linkedLesson.content.primarySources?.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-stone-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B132B]">
                    Trích dẫn tư liệu lịch sử gốc
                  </h3>
                  {linkedLesson.content.primarySources.map((src, idx) => (
                    <blockquote
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200 text-xs space-y-1"
                    >
                      <p className="italic text-stone-800 leading-relaxed">“{src.excerpt}”</p>
                      <footer className="text-stone-500 font-medium">— {src.source}</footer>
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 5 COLUMNS: 5-Step Young Historian Inquiry Workflow */}
          <aside className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
                Quy trình khám phá 5 bước
              </p>
              <h2 className="font-display text-xl font-bold text-[#141B2D]">
                Nhiệm vụ Nhà Sử Học Trẻ
              </h2>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-[#0B132B]">
                <span>Bước 1. Quan sát không gian &amp; nhân vật 3D</span>
                {step1Done && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
              </div>
              <p className="text-xs text-stone-600">
                Xoay 360° đại cảnh phía trên và nhấp vào ít nhất 1 điểm chú thích hoặc vật thể 3D. (Đã khám phá:{' '}
                <strong className="font-mono-num">{inspectedHotspots.length + inspectedMeshes.length}</strong>)
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#0B132B]">
                <span>Bước 2. Dự đoán chiến thuật / giá trị di sản</span>
                {step2Done && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
              </div>
              <textarea
                rows={2}
                value={predictionText}
                onChange={(e) => setPredictionText(e.target.value)}
                placeholder="Theo em, vì sao địa hình sông núi / kiến trúc / đội hình này giữ vai trò quyết định?"
                className="w-full p-2.5 rounded-lg border border-stone-300 bg-white text-xs"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#0B132B]">
                <span>Bước 3. Kiểm chứng tư liệu gốc</span>
                {step3Done && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
              </div>
              <label className="flex items-start gap-2 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedSource}
                  onChange={(e) => setVerifiedSource(e.target.checked)}
                  className="mt-0.5 accent-[#0B132B]"
                />
                <span>Đã đối chiếu các giai đoạn không gian 3D với hồ sơ sử liệu gốc bên trái.</span>
              </label>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#0B132B]">
                <span>Bước 4. Giải thích kết luận lịch sử</span>
                {step4Done && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
              </div>
              <textarea
                rows={2}
                value={explanationText}
                onChange={(e) => setExplanationText(e.target.value)}
                placeholder="Rút ra bài học hoặc ý nghĩa lịch sử cốt lõi..."
                className="w-full p-2.5 rounded-lg border border-stone-300 bg-white text-xs"
              />
            </div>

            <button
              type="button"
              onClick={handleCompleteWorkflow}
              className="w-full py-3 px-4 rounded-xl bg-[#0B132B] text-[#FAF7F0] text-xs font-bold hover:bg-[#162447] transition-colors"
            >
              {workflowCompleted ? 'Đã hoàn thành nhiệm vụ 3D ✓' : 'Bước 5. Hoàn thành & Nhận huy hiệu'}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

interface MapHotspotSite {
  id: string;
  region: 'vietnam' | 'sea' | 'biendong' | 'world';
  name: string;
  era: string;
  x: number;
  y: number;
  summary: string;
  lessonId: string;
  modelSlug?: string;
}

const HISTORICAL_MAP_SITES: MapHotspotSite[] = [
  {
    id: 'site-bach-dang',
    region: 'vietnam',
    name: 'Cửa sông Bạch Đằng (Quảng Ninh – Hải Phòng)',
    era: 'Năm 938 · Năm 981 · Năm 1288',
    x: 285,
    y: 92,
    summary:
      'Không gian chiến lược đường thủy Đông Bắc, nơi Ngô Quyền (938), Lê Hoàn (981) và Trần Hưng Đạo (1288) lợi dụng thủy triều và trận địa cọc gỗ đánh bại quân xâm lược phương Bắc.',
    lessonId: 'lesson-7',
    modelSlug: 'bach-dang-938',
  },
  {
    id: 'site-thanh-nha-ho',
    region: 'vietnam',
    name: 'Thành nhà Hồ – Tây Đô (Vĩnh Lộc, Thanh Hóa)',
    era: 'Năm 1397 – Triều Hồ',
    x: 245,
    y: 138,
    summary:
      'Kinh đô đá khối lớn độc đáo bậc nhất Đông Nam Á gắn với cuộc cải cách toàn diện của Hồ Quý Ly cuối thế kỷ XIV; Di sản Văn hóa Thế giới UNESCO (2011).',
    lessonId: 'lesson-9',
    modelSlug: 'thanh-nha-ho',
  },
  {
    id: 'site-lam-son',
    region: 'vietnam',
    name: 'Căn cứ Lam Sơn & Chiến trường Chi Lăng – Xương Giang',
    era: '1418 – 1427',
    x: 230,
    y: 152,
    summary:
      'Từ núi rừng Lam Sơn (Thanh Hóa), nghĩa quân Lê Lợi – Nguyễn Trãi tiến vào Nghệ An (1424), thắng lớn ở Tốt Động – Chúc Động (1426) và Chi Lăng – Xương Giang (1427).',
    lessonId: 'lesson-8',
    modelSlug: 'khoi-nghia-lam-son',
  },
  {
    id: 'site-rach-gam',
    region: 'vietnam',
    name: 'Sông Tiền: Rạch Gầm – Xoài Mút (Tiền Giang)',
    era: 'Tháng 1/1785',
    x: 255,
    y: 350,
    summary:
      'Trận quyết chiến thủy binh của nghĩa quân Tây Sơn do Nguyễn Huệ chỉ huy tiêu diệt gần 5 vạn quân Xiêm xâm lược, bảo vệ vững chắc vùng đất Nam Bộ.',
    lessonId: 'lesson-7',
  },
  {
    id: 'site-hoang-sa',
    region: 'biendong',
    name: 'Quần đảo Hoàng Sa (Việt Nam)',
    era: 'Thế kỷ XVII – XIX (Đội Hoàng Sa & Bắc Hải)',
    x: 385,
    y: 215,
    summary:
      'Nhà nước phong kiến Việt Nam từ thời chúa Nguyễn đến triều Nguyễn cử Đội Hoàng Sa hằng năm ra khai thác sản vật, đo đạc thủy trình, dựng bia và cắm mốc chủ quyền liên tục, hòa bình.',
    lessonId: 'lesson-13',
    modelSlug: 'khong-gian-bien-dong',
  },
  {
    id: 'site-truong-sa',
    region: 'biendong',
    name: 'Quần đảo Trường Sa & Tuyến hàng hải quốc tế Biển Đông',
    era: 'Lịch sử – Hiện đại (UNCLOS 1982)',
    x: 415,
    y: 325,
    summary:
      'Vạn Lý Trường Sa trên Đại Nam nhất thống toàn đồ (1838); nằm sát tuyến hàng hải huyết mạch nối Thái Bình Dương – Ấn Độ Dương, giữ vị trí chiến lược về quốc phòng và kinh tế biển.',
    lessonId: 'lesson-12',
    modelSlug: 'khong-gian-bien-dong',
  },
  {
    id: 'site-sea-colonial',
    region: 'sea',
    name: 'Không gian Đông Nam Á hải đảo & lục địa',
    era: 'Thế kỷ XVI – 1945 – Hiện đại',
    x: 330,
    y: 390,
    summary:
      'Quá trình thực dân phương Tây xâm lược Đông Nam Á (trừ Xiêm giữ được độc lập tương đối nhờ cải cách Rama V) và hành trình giành độc lập, tái thiết khu vực ASEAN.',
    lessonId: 'lesson-5',
    modelSlug: 'dong-nam-a-can-dai',
  },
  {
    id: 'site-euro-america',
    region: 'world',
    name: 'Âu – Bắc Mỹ & Liên Xô: Cách mạng tư sản và CNXH',
    era: 'Thế kỷ XVI – Thế kỷ XX',
    x: 115,
    y: 95,
    summary:
      'Từ các cuộc cách mạng tư sản Anh, Bắc Mỹ, Pháp đến Cách mạng tháng Mười Nga 1917, sự ra đời Liên Xô (1922) và công cuộc cải cách – đổi mới CNXH từ cuối thế kỷ XX.',
    lessonId: 'lesson-1',
  },
];

export function HistoricalMapPage() {
  const [regionFilter, setRegionFilter] = useState<'all' | 'vietnam' | 'biendong' | 'sea' | 'world'>('all');
  const [selectedSite, setSelectedSite] = useState<MapHotspotSite>(HISTORICAL_MAP_SITES[0]);

  const visibleSites = HISTORICAL_MAP_SITES.filter(
    (s) => regionFilter === 'all' || s.region === regionFilter,
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
            Bản đồ học lịch sử số
          </p>
          <h1 className="font-display text-3xl font-bold text-[#141B2D] mt-1">
            Bản đồ Không gian Lịch sử & Chủ quyền Biển Đảo
          </h1>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'all', label: 'Toàn bộ không gian' },
            { key: 'vietnam', label: 'Việt Nam truyền thống' },
            { key: 'biendong', label: 'Biển Đông – Hoàng Sa & Trường Sa' },
            { key: 'sea', label: 'Đông Nam Á' },
            { key: 'world', label: 'Thế giới' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                const k = tab.key as typeof regionFilter;
                setRegionFilter(k);
                const first = HISTORICAL_MAP_SITES.find((s) => k === 'all' || s.region === k);
                if (first) setSelectedSite(first);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                regionFilter === tab.key
                  ? 'bg-[#0B132B] text-white'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Vector Cartographic Map */}
        <div className="lg:col-span-8 bg-[#0B132B] rounded-2xl p-4 border border-[#C89B3C]/40">
          <svg
            viewBox="0 0 560 450"
            role="img"
            aria-label="Bản đồ tương tác lịch sử lớp 11"
            className="w-full h-auto rounded-xl bg-[#0F1E3F]"
          >
            {/* Coordinate Grid */}
            {[80, 160, 240, 320, 400, 480].map((gx) => (
              <line key={`gx-${gx}`} x1={gx} y1="0" x2={gx} y2="450" stroke="#1E3563" strokeWidth="1" />
            ))}
            {[75, 150, 225, 300, 375].map((gy) => (
              <line key={`gy-${gy}`} x1="0" y1={gy} x2="560" y2={gy} stroke="#1E3563" strokeWidth="1" />
            ))}

            {/* Stylized Landmasses: Mainland Vietnam & Indochina Peninsula */}
            <path
              d="M210,55 L295,62 L302,102 L265,145 L298,215 L306,295 L265,365 L235,355 L252,295 L245,210 L212,145 Z"
              fill="#1E3F35"
              stroke="#C89B3C"
              strokeWidth="1.5"
            />
            {/* Stylised World / Eurasia Inset Box */}
            <rect x="25" y="35" width="145" height="105" rx="8" fill="#16284C" stroke="#64748B" strokeDasharray="4 3" />
            <text x="97" y="55" textAnchor="middle" fontSize="10" fill="#E6BE68" fontWeight="bold">
              KHÔNG GIAN ÂU – MỸ
            </text>

            {/* Stylised Maritime Southeast Asia Archipelagos */}
            <ellipse cx="345" cy="405" rx="95" ry="24" fill="#1B3934" stroke="#6EA8FE" strokeWidth="1" />
            <ellipse cx="465" cy="260" rx="26" ry="52" fill="#1B3934" stroke="#6EA8FE" strokeWidth="1" />

            {/* International Shipping Lane across Bien Dong */}
            <path
              d="M290,425 Q390,320 455,135"
              fill="none"
              stroke="#E6BE68"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <text x="435" y="195" fontSize="9" fill="#E6BE68">
              Tuyến hàng hải quốc tế
            </text>
            <text x="365" y="268" fontSize="12" fill="#9EC5FE" fontWeight="bold">
              BIỂN ĐÔNG
            </text>

            {/* Interactive Historical Pins */}
            {visibleSites.map((site) => {
              const active = selectedSite.id === site.id;
              return (
                <g
                  key={site.id}
                  onClick={() => setSelectedSite(site)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={site.x}
                    cy={site.y}
                    r={active ? 11 : 7.5}
                    fill={active ? '#C89B3C' : '#8B1E24'}
                    stroke="#FAF7F0"
                    strokeWidth="2"
                  />
                  <text
                    x={site.x}
                    y={site.y - 14}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#FAF7F0"
                  >
                    {site.name.split('(')[0].split(':')[0].trim()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Site Detail Panel */}
        <div className="lg:col-span-4 bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B1E24]">
            <MapPin className="w-4 h-4" /> Điểm di tích & Không gian chiến lược
          </div>
          <h2 className="font-display text-xl font-bold text-[#141B2D]">{selectedSite.name}</h2>
          <p className="font-mono-num text-xs font-semibold text-[#0B132B]">{selectedSite.era}</p>
          <p className="text-sm text-stone-700 leading-relaxed">{selectedSite.summary}</p>

          <div className="pt-3 border-t border-stone-100 flex flex-wrap gap-2">
            <Link
              to={`/bai-hoc/${selectedSite.lessonId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-semibold"
            >
              <BookOpen className="w-3.5 h-3.5" /> Học bài liên quan
            </Link>
            {selectedSite.modelSlug && (
              <Link
                to={`/kham-pha-3d/${selectedSite.modelSlug}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold"
              >
                <Compass className="w-3.5 h-3.5" /> Xem mô hình 3D GLB
              </Link>
            )}
          </div>

          <div className="pt-3 border-t border-stone-100 space-y-1.5">
            <p className="text-xs font-semibold text-stone-500">Chọn nhanh địa danh khác:</p>
            {visibleSites.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSite(s)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  selectedSite.id === s.id
                    ? 'bg-[#FAF7F0] border border-[#0B132B] text-[#0B132B] font-bold'
                    : 'hover:bg-stone-50 text-stone-700'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MasterTimelinePage() {
  const { topics, lessons } = useApp();
  const [topicFilter, setTopicFilter] = useState<string>('');
  const [query, setQuery] = useState<string>('');

  const allEvents = lessons.flatMap((les) =>
    (les.content.timeline || []).map((ev) => ({
      ...ev,
      lessonId: les.id,
      lessonNumber: les.lessonNumber,
      lessonTitle: les.title,
      topicId: les.topicId,
    })),
  );

  const filtered = allEvents.filter((item) => {
    if (topicFilter && item.topicId !== topicFilter) return false;
    if (
      query.trim() &&
      !`${item.year} ${item.event} ${item.detail} ${item.lessonTitle}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
          Hệ thống hóa niên biểu lịch sử lớp 11
        </p>
        <h1 className="font-display text-3xl font-bold text-[#141B2D]">
          Trục Dòng Thời Gian Xuyên Suốt 13 Bài Học
        </h1>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm năm (ví dụ: 938, 1427, 1917, 1986) hoặc tên sự kiện..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm"
          />
        </div>
        <select
          aria-label="Lọc dòng thời gian theo chủ đề"
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm max-w-xs"
        >
          <option value="">Tất cả 6 Chủ đề ({allEvents.length} mốc)</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((ev, idx) => (
          <div
            key={`${ev.lessonId}-${idx}`}
            className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col md:flex-row md:items-baseline justify-between gap-4 hover:border-[#0B132B] transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 flex-1">
              <span className="font-mono-num text-sm font-bold text-[#8B1E24] sm:w-40 shrink-0 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {ev.year}
              </span>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#141B2D]">{ev.event}</h2>
                <p className="text-xs text-stone-600 leading-relaxed">{ev.detail}</p>
              </div>
            </div>
            <Link
              to={`/bai-hoc/${ev.lessonId}`}
              className="text-xs font-semibold text-[#0B132B] hover:underline shrink-0"
            >
              {formatLessonBadge(ev.lessonNumber, ev.lessonTitle)} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
