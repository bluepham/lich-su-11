import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Box,
  CheckCircle2,
  Clock,
  Compass,
  FileCode2,
  Gamepad2,
  GraduationCap,
  Layers,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GlbMuseumViewer } from '../components/GlbMuseumViewer';

const SHORT_SCENE_LABELS: Record<string, string> = {
  'bach-dang-938': '1. Bạch Đằng 938',
  'khoi-nghia-lam-son': '2. Khởi nghĩa Lam Sơn',
  'thanh-nha-ho': '3. Thành nhà Hồ 1397',
  'dong-nam-a-can-dai': '4. Đông Nam Á Cận – Hiện đại',
  'khong-gian-bien-dong': '5. Biển Đông – Hoàng Sa & Trường Sa',
  'van-minh-cong-nghiep-do-thi': '6. Văn minh Công nghiệp – Đô thị',
  'quan-the-nhan-vat-sinh-thai-3d': '7. Quần thể Di sản & Cổ phục Đại Việt',
};

export function HomePage() {
  const { siteConfig, stats, topics, lessons, models, role } = useApp();
  const [featuredSlug, setFeaturedSlug] = useState<string>('bach-dang-938');

  const activeModel =
    models.find((m) => m.slug === featuredSlug) || models[0] || null;
  const activeLinkedLesson = activeModel
    ? lessons.find((l) => l.id === activeModel.lessonId)
    : undefined;

  const featureCards = [
    {
      icon: Box,
      title: 'Đại cảnh 3D Mở rộng & Cổ phục',
      desc: '7 không gian lịch sử rộng 62m–68m định dạng .glb với nhân vật mặc cổ phục đúng thời kì, núi sông, đình điện, thành lũy và chiến thuyền.',
      to: '/thu-vien-3d',
    },
    {
      icon: Layers,
      title: '6 chủ đề học tập GDPT 2018',
      desc: 'Hệ thống hóa toàn bộ mạch kiến thức Lịch sử thế giới, Đông Nam Á và Việt Nam lớp 11 theo bộ sách Kết nối tri thức với cuộc sống.',
      to: '/chu-de',
    },
    {
      icon: BookOpen,
      title: '13 bài học chuẩn SGK',
      desc: 'Mỗi bài học thiết kế 8 phân mục sư phạm từ Mục tiêu, Khám phá kiến thức, Không gian 3D, Tư liệu gốc đến Tự đánh giá.',
      to: '/bai-hoc',
    },
    {
      icon: Compass,
      title: 'Nhiệm vụ Nhà sử học trẻ 5 bước',
      desc: 'Thực hành quy trình khám phá trên không gian 3D: Quan sát -> Dự đoán -> Kiểm chứng sử liệu -> Giải thích -> Hoàn thành.',
      to: '/kham-pha-3d/bach-dang-938',
    },
    {
      icon: Clock,
      title: 'Bản đồ & Dòng thời gian số',
      desc: 'Đối chiếu trực quan tọa độ chiến trường, chủ quyền Hoàng Sa – Trường Sa và niên biểu sự kiện xuyên suốt 13 bài học.',
      to: '/ban-do',
    },
    {
      icon: Award,
      title: 'Luyện tập 8 dạng câu hỏi',
      desc: 'Ngân hàng câu hỏi đánh giá năng lực có chấm tự động khách quan, chấm tự luận theo Rubric giáo viên và lưu tiến độ thực tế.',
      to: '/kiem-tra',
    },
  ];

  return (
    <div>
      {/* CENTERPIECE 3D HISTORICAL THEATER STAGE */}
      <section className="bg-[#0B132B] text-[#FAF7F0] border-b border-[#C89B3C]/35">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-5 pb-8 space-y-4">
          {/* Compact Curatorial Masthead + Quick CTAs */}
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3 pb-3 border-b border-white/10">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#E6BE68]">
                {siteConfig.schoolName} · Chương trình Lịch sử 11 (Kết nối tri thức với cuộc sống)
              </p>
              <h1 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-bold leading-tight text-[#FAF7F0]">
                {siteConfig.appName}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {activeModel && (
                <Link
                  to={`/kham-pha-3d/${activeModel.slug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold hover:bg-[#d8ab4c] transition-colors"
                >
                  <Compass className="w-4 h-4" />
                  Mở Phòng Khám Phá Chuyên Sâu
                </Link>
              )}
              <Link
                to="/thu-vien-3d"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#162447] border border-[#C89B3C]/45 text-xs font-semibold text-[#E6BE68] hover:bg-[#1F315C] transition-colors"
              >
                <Box className="w-3.5 h-3.5" />
                Kho Cổ phục &amp; Tài nguyên 3D
              </Link>
              <Link
                to="/chu-de"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#162447] border border-white/15 text-xs font-semibold text-white hover:bg-[#1F315C] transition-colors"
              >
                6 Chủ đề · 13 Bài học
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* 7-World Interactive Switcher Bar Right Above the 3D Stage */}
          {models.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Chọn đại cảnh lịch sử 3D">
              {models.map((m) => {
                const isSelected = activeModel?.slug === m.slug;
                const label =
                  SHORT_SCENE_LABELS[m.slug] || m.modelName.replace(/\s*\([^)]*\)/g, '').trim();
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setFeaturedSlug(m.slug)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#C89B3C] text-[#0B132B] font-bold shadow-sm'
                        : 'bg-[#162447] text-slate-200 border border-white/10 hover:border-[#C89B3C]/60 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* FULL-WIDTH WIDESCREEN 3D MODEL CENTERPIECE */}
          {activeModel ? (
            <div className="space-y-4">
              <GlbMuseumViewer
                model={activeModel}
                heightClass="h-[520px] sm:h-[580px] lg:h-[640px]"
              />

              {/* Curatorial Context & Real Database Metrics Dock Beneath the 3D Stage */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center bg-[#111D3B] border border-white/12 rounded-xl p-4 sm:p-5">
                <div className="lg:col-span-7 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#E6BE68] font-semibold">
                    <span>Đang trưng bày: {activeModel.modelName}</span>
                    {activeLinkedLesson && (
                      <Link
                        to={`/bai-hoc/${activeLinkedLesson.id}`}
                        className="underline hover:text-white"
                      >
                        Đối chiếu Bài {activeLinkedLesson.lessonNumber} SGK →
                      </Link>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    {activeModel.description}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
                    <span>Sử liệu tham chiếu: {activeModel.sourceReference}</span>
                    {role === 'guest' && (
                      <Link
                        to="/dang-ky"
                        className="text-[#E6BE68] font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        Đăng ký tài khoản Học sinh (không cần email/SĐT) →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Real Database Metrics Strip (Zero fake numbers!) */}
                <div
                  data-testid="home-real-stats"
                  className="lg:col-span-5 grid grid-cols-5 gap-2 sm:gap-3 lg:border-l lg:border-white/15 lg:pl-5 pt-3 lg:pt-0 border-t border-white/10 lg:border-t-0"
                >
                  <div>
                    <p className="font-mono-num text-lg sm:text-xl font-bold text-[#E6BE68]">{stats.totalTopics}</p>
                    <p className="text-[11px] text-slate-300">Chủ đề</p>
                  </div>
                  <div>
                    <p className="font-mono-num text-lg sm:text-xl font-bold text-[#E6BE68]">{stats.totalLessons}</p>
                    <p className="text-[11px] text-slate-300">Bài học</p>
                  </div>
                  <div>
                    <p className="font-mono-num text-lg sm:text-xl font-bold text-[#E6BE68]">{stats.totalModels}</p>
                    <p className="text-[11px] text-slate-300">Đại cảnh 3D</p>
                  </div>
                  <div>
                    <p className="font-mono-num text-lg sm:text-xl font-bold text-white">{stats.totalStudents}</p>
                    <p className="text-[11px] text-slate-300">Học sinh ĐK</p>
                  </div>
                  <div>
                    <p className="font-mono-num text-lg sm:text-xl font-bold text-white">{stats.totalQuizAttempts}</p>
                    <p className="text-[11px] text-slate-300">Lượt làm đề</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[520px] rounded-xl bg-[#162447] border border-white/10 flex items-center justify-center text-sm text-slate-300">
              Đang khởi tạo không gian lịch sử 3D (.glb)...
            </div>
          )}
        </div>
      </section>

      {/* 6 Core Pedagogical Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="max-w-2xl mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
            Cấu trúc hệ sinh thái học tập
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141B2D] mt-1">
            Học lịch sử qua trải nghiệm không gian, tư liệu gốc và nhiệm vụ khám phá
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                to={card.to}
                className="group bg-white border border-stone-200 rounded-xl p-6 hover:border-[#C89B3C] hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0B132B] text-[#E6BE68] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#141B2D] group-hover:text-[#8B1E24] transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed">{card.desc}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B132B] mt-4 group-hover:translate-x-0.5 transition-transform">
                  Truy cập phân khu <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 6 Curriculum Topics Overview */}
      <section className="bg-white border-y border-stone-200 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
                Chương trình Lịch sử 11 – Kết nối tri thức với cuộc sống
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141B2D] mt-1">
                6 Chủ đề & 13 Bài học chính khóa
              </h2>
            </div>
            <Link
              to="/bai-hoc"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8B1E24] hover:underline"
            >
              Xem danh mục toàn bộ 13 bài học <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topics.map((topic, idx) => {
              const topicLessons = lessons.filter((l) => l.topicId === topic.id);
              return (
                <div
                  key={topic.id}
                  className="bg-[#FAF7F0] border border-stone-200 rounded-xl p-6 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-[#8B1E24]">
                      Chủ đề {idx + 1} · <span className="font-mono-num">{topicLessons.length} bài học</span>
                    </p>
                    <h3 className="font-display text-lg font-bold text-[#141B2D] leading-snug">
                      {topic.title}
                    </h3>
                    <p className="text-xs text-stone-600 leading-relaxed">{topic.description}</p>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-stone-200/80">
                    {topicLessons.map((les) => (
                      <Link
                        key={les.id}
                        to={`/bai-hoc/${les.id}`}
                        className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded bg-white border border-stone-200/80 hover:border-[#0B132B] text-xs font-medium text-stone-800 transition-colors"
                      >
                        <span className="truncate">
                          <strong className="font-mono-num text-[#0B132B]">Bài {les.lessonNumber}:</strong>{' '}
                          {les.title}
                        </span>
                        {les.content.modelSlug && (
                          <span className="text-[10px] font-semibold text-[#8B1E24] shrink-0">3D GLB</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Arena & AI Historian Callout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0B132B] text-[#FAF7F0] rounded-2xl p-7 border border-[#C89B3C]/40 flex flex-col justify-between space-y-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6BE68]">
              <Gamepad2 className="w-4 h-4" /> TRÒ CHƠI GIÁO DỤC TƯƠNG TÁC
            </div>
            <h3 className="font-display text-2xl font-bold">Đấu Trường Lịch Sử 11</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Rèn luyện phản xạ niên biểu, ghép mảnh tư liệu, giải mã bản đồ chiến dịch và vượt hành trình 6 thử thách lịch sử có lưu điểm thực tế vào hồ sơ học sinh.
            </p>
          </div>
          <div>
            <Link
              to="/tro-choi"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold hover:bg-[#d8ab4c]"
            >
              Bước vào Đấu trường <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="bg-white text-[#141B2D] rounded-2xl p-7 border border-stone-200 flex flex-col justify-between space-y-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#8B1E24]">
              <Sparkles className="w-4 h-4" /> TRỢ LÝ SƯ PHẠM CÓ KIỂM SOÁT
            </div>
            <h3 className="font-display text-2xl font-bold">Sử Gia AI 11</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Hỗ trợ giải thích khái niệm, tóm tắt bài học và gợi mở tư duy phản biện dựa trên kho nội dung Lịch sử 11 đã kiểm duyệt; bảo vệ tuyệt đối quyền riêng tư học sinh.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/tro-ly-ai"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
            >
              Trò chuyện cùng Sử Gia AI <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/gioi-thieu" className="text-xs font-semibold text-stone-600 hover:text-[#0B132B]">
              Tìm hiểu nguyên tắc biên soạn →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AboutPage() {
  const { siteConfig } = useApp();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-10">
      <div className="space-y-3 border-b border-stone-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1E24]">
          Hồ sơ sáng kiến & Giới thiệu hệ thống
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#141B2D]">
          {siteConfig.appName}
        </h1>
        <p className="text-base font-display italic text-stone-700">“{siteConfig.slogan}”</p>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 sm:p-8 space-y-4">
        <h2 className="font-display text-xl font-bold text-[#141B2D]">1. Mục tiêu sư phạm & Bối cảnh triển khai</h2>
        <p className="text-sm text-stone-700 leading-relaxed">
          {siteConfig.projectIntro ||
            'Hệ thống được phát triển tại Trường THPT Hòa Minh, tỉnh Vĩnh Long nhằm đổi mới phương pháp dạy học và kiểm tra đánh giá môn Lịch sử lớp 11 theo định hướng phát triển phẩm chất, năng lực học sinh của Chương trình GDPT 2018 (bộ sách Kết nối tri thức với cuộc sống).'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-lg bg-[#FAF7F0] border border-stone-200 space-y-1.5">
            <h3 className="text-sm font-bold text-[#0B132B] flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#8B1E24]" /> Chế độ Khách tham quan
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Xem tự do 6 chủ đề, 13 bài học, xoay mô hình GLB 3D, tra cứu bản đồ, dòng thời gian và làm câu hỏi luyện tập mẫu.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#FAF7F0] border border-stone-200 space-y-1.5">
            <h3 className="text-sm font-bold text-[#0B132B] flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-[#8B1E24]" /> Chế độ Học sinh
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Tự đăng ký nhanh không cần email/SĐT, lưu tiến độ 13 bài học, ghi chú cá nhân, làm đề kiểm tra tính giờ, tích lũy huy hiệu và khảo sát.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#FAF7F0] border border-stone-200 space-y-1.5">
            <h3 className="text-sm font-bold text-[#0B132B] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#8B1E24]" /> Chế độ Giáo viên Quản trị
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Đăng nhập một bước bằng Mật khẩu quản trị được băm Argon2id, quản lý lớp học, tải lên mô hình .glb mới, chấm tự luận Rubric và xuất báo cáo CSV.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 sm:p-8 space-y-4">
        <h2 className="font-display text-xl font-bold text-[#141B2D]">
          2. Quy trình Lập trình Mô phỏng từ Python 3 → Xuất tệp .glb → Đăng tải lên Hệ thống
        </h2>
        <p className="text-sm text-stone-700 leading-relaxed">
          Toàn bộ không gian mô phỏng lịch sử và biển đảo trong ứng dụng được lập trình hình học 3D thủ tục bằng{' '}
          <strong>Python 3</strong>, kết xuất trực tiếp sang định dạng nhị phân chuẩn <code>glTF 2.0 (.glb)</code> và
          hiển thị qua <code>GLTFLoader</code> của Three.js. Giáo viên và học sinh có thể tải kịch bản Python về chạy
          trên máy tính để sinh tệp <code>.glb</code> rồi upload lên hệ thống, hoặc biên dịch trực tiếp ngay trong trang
          Quản trị Giáo viên.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <a
            href="/python_glb/sinh_mo_phong_lich_su_glb.py"
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B132B] text-white text-xs font-semibold hover:bg-[#162447]"
          >
            <FileCode2 className="w-4 h-4 text-[#E6BE68]" />
            Mã nguồn Python sinh mô phỏng .glb
          </a>
          <a
            href="/python_glb/xuat_va_upload_glb.py"
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 bg-[#FAF7F0] text-stone-800 text-xs font-semibold hover:bg-stone-100"
          >
            <FileCode2 className="w-4 h-4 text-[#8B1E24]" />
            Script Python tự động xuất .glb &amp; upload
          </a>
          <a
            href="/models/HUONG_DAN_BLENDER_GLB.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 text-xs font-semibold hover:bg-stone-100"
          >
            <BookOpen className="w-4 h-4 text-[#0B132B]" />
            Tài liệu hướng dẫn Python &amp; Blender GLB
          </a>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 sm:p-8 space-y-3">
        <h2 className="font-display text-xl font-bold text-[#141B2D]">3. Cam kết tính xác thực khoa học lịch sử</h2>
        <ul className="space-y-2 text-sm text-stone-700">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-1" />
            <span>
              Mọi niên đại, nhân vật, sự kiện và trích dẫn tư liệu đều đối chiếu chuẩn xác với SGK{' '}
              <em>Lịch sử 11 – Kết nối tri thức với cuộc sống</em> và giáo trình lịch sử chính thống.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-1" />
            <span>
              Các mô hình 3D ghi chú rõ ràng đâu là di tích/tư liệu khảo cổ và đâu là mô phỏng không gian phục vụ học tập trực quan.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-1" />
            <span>
              Số liệu học sinh, điểm kiểm tra và kết quả khảo sát trên hệ thống hoàn toàn là dữ liệu thực phát sinh từ cơ sở dữ liệu máy chủ.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
