import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Award,
  CheckCircle2,
  Compass,
  FileSearch,
  Gamepad2,
  HelpCircle,
  MapPin,
  Puzzle,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/authSession';

type ArenaGameKey =
  | 'timeline_mystery'
  | 'who_is_historian'
  | 'history_puzzle'
  | 'map_decode'
  | 'evidence_hunt'
  | 'challenge_journey';

interface GameCardMeta {
  key: ArenaGameKey;
  title: string;
  subtitle: string;
  instructions: string;
  lessonId: string;
}

const ARENA_GAMES: GameCardMeta[] = [
  {
    key: 'timeline_mystery',
    title: '1. Dòng thời gian bí ẩn',
    subtitle: 'Sắp xếp 5 mốc sự kiện lớn từ thế kỷ X đến thế kỷ XX theo thứ tự niên biểu.',
    instructions: 'Dùng nút Lên / Xuống để xếp các sự kiện từ sớm nhất đến muộn nhất rồi nhấn Chấm điểm.',
    lessonId: 'lesson-7',
  },
  {
    key: 'who_is_historian',
    title: '2. Ai là sử gia?',
    subtitle: 'Trả lời 5 câu hỏi phản xạ nhanh về nhân vật, cải cách và cách mạng thế giới.',
    instructions: 'Chọn phương án chính xác nhất cho từng câu hỏi để tích lũy điểm tối đa.',
    lessonId: 'lesson-1',
  },
  {
    key: 'history_puzzle',
    title: '3. Ghép mảnh lịch sử',
    subtitle: 'Kết nối chính xác 5 nhân vật – triều đại với thành tựu, bộ luật hoặc cải cách tiêu biểu.',
    instructions: 'Chọn mảnh ghép tương ứng ở cột bên phải cho từng nhân vật lịch sử.',
    lessonId: 'lesson-10',
  },
  {
    key: 'map_decode',
    title: '4. Giải mã bản đồ',
    subtitle: 'Xác định đúng vị trí địa – chiến lược trên bản đồ Việt Nam và Biển Đông.',
    instructions: 'Đọc câu hỏi định vị và nhấp trực tiếp vào điểm đánh dấu tương ứng trên bản đồ số.',
    lessonId: 'lesson-13',
  },
  {
    key: 'evidence_hunt',
    title: '5. Truy tìm chứng cứ',
    subtitle: 'Đọc đoạn trích sử liệu gốc và xác định văn kiện hoặc sự kiện lịch sử tương ứng.',
    instructions: 'Đối chiếu từ khóa trong đoạn trích tư liệu gốc để chọn đúng nguồn chứng cứ lịch sử.',
    lessonId: 'lesson-8',
  },
  {
    key: 'challenge_journey',
    title: '6. Hành trình vượt thử thách',
    subtitle: 'Chinh phục liên hoàn 6 chặng tương ứng với 6 Chủ đề Lịch sử lớp 11.',
    instructions: 'Vượt qua từng chặng theo thứ tự từ Chủ đề 1 đến Chủ đề 6 để mở khóa đích đến.',
    lessonId: 'lesson-12',
  },
];

const TIMELINE_EVENTS = [
  { id: 'ev-938', text: 'Chiến thắng Bạch Đằng của Ngô Quyền chấm dứt thời Bắc thuộc', rank: 1 },
  { id: 'ev-1397', text: 'Hồ Quý Ly cho xây dựng kinh thành Tây Đô (Thành nhà Hồ)', rank: 2 },
  { id: 'ev-1427', text: 'Chiến thắng Chi Lăng – Xương Giang kết thúc khởi nghĩa Lam Sơn', rank: 3 },
  { id: 'ev-1789', text: 'Cách mạng tư sản Pháp bùng nổ với sự kiện phá ngục Ba-xti', rank: 4 },
  { id: 'ev-1917', text: 'Cách mạng tháng Mười Nga thắng lợi dưới sự lãnh đạo của Lê-nin', rank: 5 },
];

const HISTORIAN_QUIZ = [
  {
    q: 'Cuộc cách mạng nào mở đầu thời kỳ xác lập chủ nghĩa tư bản ở châu Âu thế kỷ XVII?',
    options: ['Cách mạng tư sản Anh', 'Chiến tranh giành độc lập Bắc Mỹ', 'Cải cách Minh Trị', 'Cách mạng Tân Hợi'],
    correct: 0,
  },
  {
    q: 'Quốc gia Đông Nam Á duy nhất giữ được độc lập tương đối trước thực dân phương Tây cuối thế kỷ XIX là:',
    options: ['Miến Điện', 'Xiêm (Thái Lan)', 'Phi-líp-pin', 'In-đô-nê-xi-a'],
    correct: 1,
  },
  {
    q: 'Vua Lê Thánh Tông thực hiện cải cách hành chính chia cả nước Đại Việt thành bao nhiêu đạo thừa tuyên?',
    options: ['5 đạo', '10 đạo', '13 đạo thừa tuyên', '30 tỉnh'],
    correct: 2,
  },
  {
    q: 'Cuộc cải cách hành chính lớn vào các năm 1831 – 1832 ở Việt Nam gắn liền với vị vua nào?',
    options: ['Vua Gia Long', 'Vua Minh Mạng', 'Vua Tự Đức', 'Hồ Quý Ly'],
    correct: 1,
  },
  {
    q: 'Văn kiện pháp lý quốc tế năm 1982 là cơ sở xác lập các vùng biển thuộc chủ quyền Việt Nam ở Biển Đông là:',
    options: ['Hiệp ước Pa-ri', 'Hiến chương ASEAN', 'Công ước Liên hợp quốc về Luật Biển (UNCLOS 1982)', 'Tuyên bố Băng Cốc'],
    correct: 2,
  },
];

const PUZZLE_PAIRS = [
  { id: 'p1', left: 'Ngô Quyền (938)', rightId: 'r1', rightText: 'Trận địa cọc gỗ lợi dụng thủy triều trên sông Bạch Đằng' },
  { id: 'p2', left: 'Nguyễn Trãi – Lê Lợi (1428)', rightId: 'r2', rightText: 'Bình Ngô đại cáo tổng kết thắng lợi khởi nghĩa Lam Sơn' },
  { id: 'p3', left: 'Hồ Quý Ly (cuối thế kỷ XIV)', rightId: 'r3', rightText: 'Phát hành tiền giấy Thông bảo hội sao, phép hạn điền – hạn nô' },
  { id: 'p4', left: 'Vua Lê Thánh Tông (thế kỷ XV)', rightId: 'r4', rightText: 'Ban hành Quốc triều hình luật (Bộ luật Hồng Đức)' },
  { id: 'p5', left: 'Chúa Nguyễn & Triều Nguyễn', rightId: 'r5', rightText: 'Lập Đội Hoàng Sa và Đội Bắc Hải thực thi chủ quyền biển đảo' },
];

const MAP_CHALLENGES = [
  {
    targetCode: 'BACH_DANG',
    prompt: 'Hãy nhấp chọn vị trí Cửa sông Bạch Đằng – nơi diễn ra đại thắng năm 938 và năm 1288.',
  },
  {
    targetCode: 'LAM_SON',
    prompt: 'Hãy nhấp chọn vùng căn cứ Lam Sơn – Tây Đô (Thanh Hóa) của thế kỷ XIV – XV.',
  },
  {
    targetCode: 'HOANG_SA',
    prompt: 'Hãy nhấp chọn Quần đảo Hoàng Sa nơi Đội Hoàng Sa dựng bia chủ quyền từ thế kỷ XVII.',
  },
  {
    targetCode: 'TRUONG_SA',
    prompt: 'Hãy nhấp chọn Quần đảo Trường Sa nằm gần tuyến hàng hải quốc tế trên Biển Đông.',
  },
  {
    targetCode: 'RACH_GAM',
    prompt: 'Hãy nhấp chọn đoạn sông Tiền (Rạch Gầm – Xoài Mút) nơi quân Tây Sơn đại thắng quân Xiêm năm 1785.',
  },
];

const MAP_NODES = [
  { code: 'BACH_DANG', label: 'A', x: 255, y: 78 },
  { code: 'LAM_SON', label: 'B', x: 215, y: 142 },
  { code: 'HOANG_SA', label: 'C', x: 355, y: 195 },
  { code: 'TRUONG_SA', label: 'D', x: 385, y: 305 },
  { code: 'RACH_GAM', label: 'E', x: 235, y: 335 },
];

const EVIDENCE_ITEMS = [
  {
    excerpt: '“Việc nhân nghĩa cốt ở yên dân, Quân điếu phạt trước lo trừ bạo...”',
    options: ['Bình Ngô đại cáo – Nguyễn Trãi', 'Hịch tướng sĩ – Trần Quốc Tuấn', 'Chiếu dời đô – Lý Công Uẩn'],
    correct: 0,
  },
  {
    excerpt:
      '“Phía ngoài biển xã An Vĩnh, huyện Bình Sơn có hơn 130 bãi cát... Chúa Nguyễn lập đội Hoàng Sa gồm 70 suất...”',
    options: ['Hoàng Lê nhất thống chí', 'Phủ biên tạp lục – Lê Quý Đôn (1776)', 'Lịch triều hiến chương loại chí'],
    correct: 1,
  },
  {
    excerpt:
      '“Tất cả mọi người sinh ra đều có quyền bình đẳng. Tạo hóa cho họ những quyền không ai có thể xâm phạm được...”',
    options: ['Tuyên ngôn Nhân quyền Pháp 1789', 'Tuyên ngôn Độc lập Hợp chúng quốc Mỹ (1776)', 'Luận cương tháng Tư 1917'],
    correct: 1,
  },
  {
    excerpt: '“Tiền dẫn là cội gốc của nước, nay ban hành Thông bảo hội sao thay cho tiền đồng...”',
    options: ['Cải cách Hồ Quý Ly (1396)', 'Cải cách Minh Mạng (1831)', 'Cải cách Lê Thánh Tông (1471)'],
    correct: 0,
  },
];

const JOURNEY_STAGES = [
  {
    topic: 'Chặng 1 · Cách mạng tư sản',
    q: 'Động lực kinh tế dẫn tới sự mở rộng chủ nghĩa tư bản cuối thế kỷ XIX – đầu thế kỷ XX là:',
    options: ['Sự hình thành các tổ chức độc quyền tài chính – công nghiệp', 'Kinh tế tự cung tự cấp phong kiến', 'Bế quan tỏa cảng'],
    correct: 0,
  },
  {
    topic: 'Chặng 2 · Chủ nghĩa xã hội',
    q: 'Công cuộc Đổi mới ở Việt Nam (từ năm 1986) và Cải cách mở cửa ở Trung Quốc (từ năm 1978) có điểm chung cốt lõi nào?',
    options: [
      'Xóa bỏ hoàn toàn thương mại quốc tế',
      'Phát triển kinh tế thị trường định hướng XHCN, hội nhập gắn với giữ vững ổn định chính trị',
      'Duy trì cơ chế bao cấp hiện vật',
    ],
    correct: 1,
  },
  {
    topic: 'Chặng 3 · Đông Nam Á',
    q: 'Năm 1945, ba quốc gia Đông Nam Á nào tuyên bố độc lập sớm nhất ngay sau khi phát xít Nhật đầu hàng?',
    options: [
      'In-đô-nê-xi-a, Việt Nam, Lào',
      'Thái Lan, Ma-lai-xi-a, Xin-ga-po',
      'Phi-líp-pin, Bru-nây, Mi-an-ma',
    ],
    correct: 0,
  },
  {
    topic: 'Chặng 4 · Chiến tranh bảo vệ Tổ quốc',
    q: 'Nghệ thuật quân sự nổi bật xuyên suốt khởi nghĩa Lam Sơn (1418 – 1427) là:',
    options: [
      'Lấy ít địch nhiều, lấy yếu chống mạnh, kết hợp tiến công quân sự với vây thành diệt viện và tâm công',
      'Chỉ phòng ngự cố thủ trong thành đá',
      'Đánh nhanh thắng nhanh trong một trận duy nhất năm 1418',
    ],
    correct: 0,
  },
  {
    topic: 'Chặng 5 · Cải cách lịch sử dân tộc',
    q: 'Ý nghĩa lớn nhất của cuộc cải cách hành chính vua Minh Mạng (1831 – 1832) là:',
    options: [
      'Chia nước ta thành Bắc Thành và Gia Định Thành',
      'Thống nhất đơn vị hành chính 30 tỉnh và phủ Thừa Thiên trên cả nước, tăng cường tính tập quyền',
      'Phát hành tiền giấy đầu tiên',
    ],
    correct: 1,
  },
  {
    topic: 'Chặng 6 · Chủ quyền Biển Đông',
    q: 'Chủ trương nhất quán của Nhà nước Việt Nam trong giải quyết các tranh chấp ở Biển Đông hiện nay là:',
    options: [
      'Đấu tranh bằng biện pháp hòa bình, trên cơ sở luật pháp quốc tế, đặc biệt là UNCLOS 1982',
      'Đóng cửa các tuyến hàng hải quốc tế',
      'Từ bỏ quyền tài phán vùng đặc quyền kinh tế',
    ],
    correct: 0,
  },
];

export function GamesArenaPage() {
  const { role } = useApp();
  const [selectedGame, setSelectedGame] = useState<ArenaGameKey>('timeline_mystery');
  const startTimeRef = useRef<number>(Date.now());
  const [resultBanner, setResultBanner] = useState<{
    score: number;
    maxScore: number;
    saved: boolean;
    note: string;
  } | null>(null);

  // Game 1 state (shuffled initial order)
  const [timelineOrder, setTimelineOrder] = useState<string[]>([
    'ev-1789',
    'ev-938',
    'ev-1917',
    'ev-1427',
    'ev-1397',
  ]);

  // Game 2 state
  const [historianAnswers, setHistorianAnswers] = useState<Record<number, number>>({});

  // Game 3 state
  const [puzzleMap, setPuzzleMap] = useState<Record<string, string>>({});

  // Game 4 state
  const [mapSelections, setMapSelections] = useState<Record<number, string>>({});
  const [activeMapStep, setActiveMapStep] = useState<number>(0);

  // Game 5 state
  const [evidenceAnswers, setEvidenceAnswers] = useState<Record<number, number>>({});

  // Game 6 state
  const [journeyAnswers, setJourneyAnswers] = useState<Record<number, number>>({});

  const activeMeta = ARENA_GAMES.find((g) => g.key === selectedGame) || ARENA_GAMES[0];

  const switchGame = (key: ArenaGameKey) => {
    setSelectedGame(key);
    setResultBanner(null);
    startTimeRef.current = Date.now();
  };

  const persistGameScore = async (gameType: ArenaGameKey, score: number, maxScore: number, lessonId: string) => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    if (role !== 'student') {
      setResultBanner({
        score,
        maxScore,
        saved: false,
        note: 'Em đang chơi ở chế độ Khách. Đăng nhập tài khoản Học sinh để lưu điểm vào Bảng thành tích & mở khóa Huy hiệu!',
      });
      return;
    }

    const res = await apiFetch('/api/student/games/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType, lessonId, score, maxScore, durationSeconds }),
    });

    setResultBanner({
      score,
      maxScore,
      saved: res.ok,
      note: res.ok
        ? `Đã lưu kết quả ${score}/${maxScore} điểm vào hồ sơ học sinh (${durationSeconds} giây).`
        : 'Không thể lưu điểm lúc này.',
    });
  };

  const resetCurrentGame = () => {
    setResultBanner(null);
    startTimeRef.current = Date.now();
    if (selectedGame === 'timeline_mystery') {
      setTimelineOrder(['ev-1789', 'ev-938', 'ev-1917', 'ev-1427', 'ev-1397']);
    } else if (selectedGame === 'who_is_historian') {
      setHistorianAnswers({});
    } else if (selectedGame === 'history_puzzle') {
      setPuzzleMap({});
    } else if (selectedGame === 'map_decode') {
      setMapSelections({});
      setActiveMapStep(0);
    } else if (selectedGame === 'evidence_hunt') {
      setEvidenceAnswers({});
    } else if (selectedGame === 'challenge_journey') {
      setJourneyAnswers({});
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Arena Header */}
      <div className="bg-[#0B132B] text-[#FAF7F0] rounded-2xl p-7 sm:p-8 border border-[#C89B3C]/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E6BE68]">
            <Gamepad2 className="w-4 h-4" /> HỆ THỐNG TRÒ CHƠI HỌC TẬP TƯƠNG TÁC
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">ĐẤU TRƯỜNG LỊCH SỬ 11</h1>
          <p className="text-xs sm:text-sm text-slate-300">
            6 thử thách rèn luyện tư duy niên biểu, không gian bản đồ, sử liệu gốc và hệ thống hóa kiến thức toàn khóa.
          </p>
        </div>
        {role === 'student' && (
          <Link
            to="/ket-qua"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold shrink-0"
          >
            <Trophy className="w-4 h-4" /> Xem lịch sử điểm của em
          </Link>
        )}
      </div>

      {/* 6 Game Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {ARENA_GAMES.map((g) => {
          const active = g.key === selectedGame;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => switchGame(g.key)}
              className={`text-left p-4 rounded-xl border transition-all ${
                active
                  ? 'bg-[#0B132B] text-[#FAF7F0] border-[#C89B3C] shadow-md'
                  : 'bg-white text-[#141B2D] border-stone-200 hover:border-[#0B132B]'
              }`}
            >
              <p className={`font-display text-base font-bold ${active ? 'text-[#E6BE68]' : 'text-[#141B2D]'}`}>
                {g.title}
              </p>
              <p className={`text-xs mt-1 leading-relaxed ${active ? 'text-slate-300' : 'text-stone-600'}`}>
                {g.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Game Play Stage */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-[#141B2D]">{activeMeta.title}</h2>
            <p className="text-xs text-stone-600">
              <strong>Hướng dẫn chơi:</strong> {activeMeta.instructions}
            </p>
          </div>
          <button
            type="button"
            onClick={resetCurrentGame}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-100"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Chơi lại từ đầu
          </button>
        </div>

        {resultBanner && (
          <div className="p-4 rounded-xl bg-[#FAF7F0] border border-[#C89B3C] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-[#0B132B] flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#8B1E24]" />
                Kết quả lượt chơi:{' '}
                <span className="font-mono-num text-[#8B1E24]">
                  {resultBanner.score} / {resultBanner.maxScore} điểm
                </span>
              </p>
              <p className="text-xs text-stone-600">{resultBanner.note}</p>
            </div>
            <button
              type="button"
              onClick={resetCurrentGame}
              className="px-3.5 py-1.5 rounded-lg bg-[#0B132B] text-white text-xs font-semibold shrink-0"
            >
              Thử lại nâng điểm
            </button>
          </div>
        )}

        {/* GAME 1: TIMELINE MYSTERY */}
        {selectedGame === 'timeline_mystery' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {timelineOrder.map((id, idx) => {
                const ev = TIMELINE_EVENTS.find((e) => e.id === id)!;
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200"
                  >
                    <span className="text-sm text-stone-800">
                      <strong className="font-mono-num text-[#8B1E24] mr-2">Vị trí #{idx + 1}</strong>
                      {ev.text}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        aria-label={`Đưa mốc ${idx + 1} lên`}
                        onClick={() => {
                          const next = [...timelineOrder];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          setTimelineOrder(next);
                        }}
                        className="p-1.5 rounded border border-stone-300 bg-white disabled:opacity-40"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === timelineOrder.length - 1}
                        aria-label={`Đưa mốc ${idx + 1} xuống`}
                        onClick={() => {
                          const next = [...timelineOrder];
                          [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                          setTimelineOrder(next);
                        }}
                        className="p-1.5 rounded border border-stone-300 bg-white disabled:opacity-40"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                const correctOrder = ['ev-938', 'ev-1397', 'ev-1427', 'ev-1789', 'ev-1917'];
                let pts = 0;
                timelineOrder.forEach((id, i) => {
                  if (id === correctOrder[i]) pts += 20;
                });
                persistGameScore('timeline_mystery', pts, 100, activeMeta.lessonId);
              }}
              className="px-5 py-2.5 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
            >
              Chấm điểm Dòng thời gian
            </button>
          </div>
        )}

        {/* GAME 2: WHO IS HISTORIAN */}
        {selectedGame === 'who_is_historian' && (
          <div className="space-y-5">
            {HISTORIAN_QUIZ.map((item, qIdx) => (
              <div key={qIdx} className="p-4 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-2.5">
                <p className="text-sm font-bold text-[#141B2D]">
                  <HelpCircle className="w-4 h-4 inline mr-1.5 text-[#8B1E24]" />
                  Câu {qIdx + 1}: {item.q}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {item.options.map((opt, optIdx) => (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => setHistorianAnswers({ ...historianAnswers, [qIdx]: optIdx })}
                      className={`text-left px-3.5 py-2.5 rounded-lg border text-xs font-medium ${
                        historianAnswers[qIdx] === optIdx
                          ? 'bg-[#0B132B] text-white border-[#0B132B]'
                          : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {String.fromCharCode(65 + optIdx)}. {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                let pts = 0;
                HISTORIAN_QUIZ.forEach((item, idx) => {
                  if (historianAnswers[idx] === item.correct) pts += 20;
                });
                persistGameScore('who_is_historian', pts, 100, activeMeta.lessonId);
              }}
              className="px-5 py-2.5 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
            >
              Nộp bài Ai là Sử gia
            </button>
          </div>
        )}

        {/* GAME 3: HISTORY PUZZLE */}
        {selectedGame === 'history_puzzle' && (
          <div className="space-y-4">
            {PUZZLE_PAIRS.map((pair) => (
              <div
                key={pair.id}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center p-3.5 rounded-xl bg-[#FAF7F0] border border-stone-200"
              >
                <p className="text-sm font-bold text-[#0B132B] flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-[#8B1E24]" /> {pair.left}
                </p>
                <select
                  aria-label={`Ghép cho ${pair.left}`}
                  value={puzzleMap[pair.id] || ''}
                  onChange={(e) => setPuzzleMap({ ...puzzleMap, [pair.id]: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                >
                  <option value="">— Chọn thành tựu / cải cách tương ứng —</option>
                  {[...PUZZLE_PAIRS]
                    .reverse()
                    .map((opt) => (
                      <option key={opt.rightId} value={opt.rightId}>
                        {opt.rightText}
                      </option>
                    ))}
                </select>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                let pts = 0;
                PUZZLE_PAIRS.forEach((p) => {
                  if (puzzleMap[p.id] === p.rightId) pts += 20;
                });
                persistGameScore('history_puzzle', pts, 100, activeMeta.lessonId);
              }}
              className="px-5 py-2.5 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
            >
              Kiểm tra mảnh ghép lịch sử
            </button>
          </div>
        )}

        {/* GAME 4: MAP DECODE */}
        {selectedGame === 'map_decode' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 space-y-3">
              {MAP_CHALLENGES.map((ch, idx) => (
                <button
                  key={ch.targetCode}
                  type="button"
                  onClick={() => setActiveMapStep(idx)}
                  className={`w-full text-left p-3.5 rounded-xl border text-xs transition-colors ${
                    activeMapStep === idx
                      ? 'bg-[#0B132B] text-white border-[#0B132B]'
                      : 'bg-[#FAF7F0] text-stone-800 border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>Nhiệm vụ bản đồ #{idx + 1}</span>
                    <span className="font-mono-num text-[#E6BE68]">
                      {mapSelections[idx]
                        ? `Đã chọn điểm ${MAP_NODES.find((n) => n.code === mapSelections[idx])?.label}`
                        : 'Chưa chọn'}
                    </span>
                  </div>
                  <p>{ch.prompt}</p>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  let pts = 0;
                  MAP_CHALLENGES.forEach((ch, idx) => {
                    if (mapSelections[idx] === ch.targetCode) pts += 20;
                  });
                  persistGameScore('map_decode', pts, 100, activeMeta.lessonId);
                }}
                className="w-full py-2.5 rounded-lg bg-[#C89B3C] text-[#0B132B] text-xs font-bold hover:bg-[#d8ab4c]"
              >
                Xác nhận Giải mã Bản đồ (≥ 80đ mở khóa Huy hiệu Chuyên gia bản đồ)
              </button>
            </div>

            <div className="lg:col-span-6 bg-[#0B132B] p-4 rounded-2xl border border-[#C89B3C]/40">
              <p className="text-xs text-[#E6BE68] mb-2 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Đang chọn vị trí cho Nhiệm vụ #{activeMapStep + 1}: Nhấp vào chữ cái A–E trên bản đồ
              </p>
              <svg viewBox="0 0 460 390" className="w-full h-auto rounded-xl bg-[#102044]">
                <path
                  d="M180,45 L268,52 L275,92 L238,138 L272,205 L280,285 L235,355 L205,342 L224,282 L215,198 L182,138 Z"
                  fill="#1F4238"
                  stroke="#C89B3C"
                  strokeWidth="1.5"
                />
                <text x="345" y="250" fontSize="12" fill="#9EC5FE" fontWeight="bold">
                  BIỂN ĐÔNG
                </text>
                {MAP_NODES.map((node) => {
                  const chosen = mapSelections[activeMapStep] === node.code;
                  return (
                    <g
                      key={node.code}
                      onClick={() => {
                        setMapSelections({ ...mapSelections, [activeMapStep]: node.code });
                        if (activeMapStep < MAP_CHALLENGES.length - 1) {
                          setActiveMapStep(activeMapStep + 1);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={15}
                        fill={chosen ? '#C89B3C' : '#8B1E24'}
                        stroke="#FAF7F0"
                        strokeWidth="2"
                      />
                      <text
                        x={node.x}
                        y={node.y + 4}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="bold"
                        fill={chosen ? '#0B132B' : '#FAF7F0'}
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* GAME 5: EVIDENCE HUNT */}
        {selectedGame === 'evidence_hunt' && (
          <div className="space-y-5">
            {EVIDENCE_ITEMS.map((ev, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#FAF7F0] border border-stone-200 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#8B1E24]">
                  <FileSearch className="w-4 h-4" /> Mảnh tư liệu gốc #{idx + 1}
                </div>
                <blockquote className="text-sm italic text-stone-800 bg-white p-3 rounded-lg border border-stone-200">
                  {ev.excerpt}
                </blockquote>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ev.options.map((opt, optIdx) => (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => setEvidenceAnswers({ ...evidenceAnswers, [idx]: optIdx })}
                      className={`p-2.5 rounded-lg border text-xs font-medium text-left ${
                        evidenceAnswers[idx] === optIdx
                          ? 'bg-[#0B132B] text-white border-[#0B132B]'
                          : 'bg-white text-stone-800 border-stone-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                let pts = 0;
                EVIDENCE_ITEMS.forEach((ev, idx) => {
                  if (evidenceAnswers[idx] === ev.correct) pts += 25;
                });
                persistGameScore('evidence_hunt', pts, 100, activeMeta.lessonId);
              }}
              className="px-5 py-2.5 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
            >
              Xác thực Hồ sơ Chứng cứ
            </button>
          </div>
        )}

        {/* GAME 6: 6-STAGE CHALLENGE JOURNEY */}
        {selectedGame === 'challenge_journey' && (
          <div className="space-y-4">
            {JOURNEY_STAGES.map((st, idx) => {
              const prevUnlocked = idx === 0 || journeyAnswers[idx - 1] !== undefined;
              const isCorrect = journeyAnswers[idx] === st.correct;
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border space-y-2.5 ${
                    prevUnlocked ? 'bg-[#FAF7F0] border-stone-200' : 'bg-stone-100 border-stone-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-[#8B1E24]">
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-4 h-4" /> {st.topic}
                    </span>
                    {journeyAnswers[idx] !== undefined && isCorrect && (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã chọn
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#141B2D]">{st.q}</p>
                  {prevUnlocked && (
                    <div className="space-y-1.5">
                      {st.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => setJourneyAnswers({ ...journeyAnswers, [idx]: optIdx })}
                          className={`w-full text-left px-3.5 py-2 rounded-lg border text-xs font-medium ${
                            journeyAnswers[idx] === optIdx
                              ? 'bg-[#0B132B] text-white border-[#0B132B]'
                              : 'bg-white text-stone-800 border-stone-200'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => {
                let pts = 0;
                JOURNEY_STAGES.forEach((st, idx) => {
                  if (journeyAnswers[idx] === st.correct) pts += 20;
                });
                persistGameScore('challenge_journey', pts, 120, activeMeta.lessonId);
              }}
              className="px-5 py-2.5 rounded-lg bg-[#0B132B] text-white text-xs font-bold hover:bg-[#162447]"
            >
              Hoàn tất Hành trình 6 Chủ đề
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
