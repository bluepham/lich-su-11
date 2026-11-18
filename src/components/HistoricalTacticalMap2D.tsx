import React, { useMemo, useState } from 'react';
import { Box, Compass, Layers, MapPin, RefreshCw } from 'lucide-react';
import type { Model3DItem, ModelHotspot, ModelPhase } from '../types';

interface HistoricalTacticalMap2DProps {
  model: Model3DItem;
  currentPhaseKey: string;
  selectedHotspot: ModelHotspot | null;
  fallbackError?: string;
  onSelectPhase: (phase: ModelPhase) => void;
  onSelectHotspot: (hotspot: ModelHotspot) => void;
  onSwitchTo3D?: () => void;
  onRetry3D?: () => void;
}

function projectWorldToSvg(x: number, z: number): { sx: number; sy: number } {
  // World coordinates span roughly [-30..30] on X and [-30..30] on Z
  const clampedX = Math.max(-28, Math.min(28, x));
  const clampedZ = Math.max(-26, Math.min(26, z));
  const sx = Math.round(340 + (clampedX / 28) * 255);
  const sy = Math.round(240 + (clampedZ / 26) * 175);
  return { sx, sy };
}

export function HistoricalTacticalMap2D({
  model,
  currentPhaseKey,
  selectedHotspot,
  fallbackError,
  onSelectPhase,
  onSelectHotspot,
  onSwitchTo3D,
  onRetry3D,
}: HistoricalTacticalMap2DProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeHotspot =
    selectedHotspot ||
    model.hotspots.find((h) => h.phaseKey === currentPhaseKey) ||
    model.hotspots[0] ||
    null;

  const activePhase =
    model.phases.find((p) => p.key === currentPhaseKey) || model.phases[0] || null;

  const projectedPins = useMemo(() => {
    const raw = model.hotspots.map((hs, idx) => {
      const { sx, sy } = projectWorldToSvg(hs.x, hs.z);
      return { hs, idx, sx, sy };
    });
    // Gentle vertical separation if two pins land very close in 2D projection
    for (let i = 0; i < raw.length; i++) {
      for (let j = i + 1; j < raw.length; j++) {
        const dx = raw[j].sx - raw[i].sx;
        const dy = raw[j].sy - raw[i].sy;
        if (Math.hypot(dx, dy) < 42) {
          raw[j].sy = Math.min(430, raw[j].sy + 26);
          raw[i].sy = Math.max(54, raw[i].sy - 14);
        }
      }
    }
    return raw;
  }, [model.hotspots]);

  const slug = model.slug || '';
  const isLamSon = slug.includes('lam-son');
  const isBachDang = slug.includes('bach-dang');
  const isTayDo = slug.includes('thanh-nha-ho');
  const isMaritime = slug.includes('bien-dong') || slug.includes('dong-nam-a');

  return (
    <div
      data-testid="historical-tactical-map-2d"
      className="w-full h-full bg-[#091326] text-[#FAF7F0] grid grid-cols-1 lg:grid-cols-12 overflow-hidden"
    >
      {/* Left / Center: Illustrated Cartographic War-Room SVG Board */}
      <div className="lg:col-span-7 relative bg-[#0B172E] border-b lg:border-b-0 lg:border-r border-[#C89B3C]/30 flex items-center justify-center p-2 sm:p-3 overflow-hidden">
        <svg
          viewBox="0 0 680 480"
          className="w-full h-full max-h-[580px] select-none"
          role="img"
          aria-label={`Sa bàn chiến lược 2D: ${model.modelName}`}
        >
          <defs>
            <linearGradient id="atlasBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0D1D3A" />
              <stop offset="55%" stopColor="#12274A" />
              <stop offset="100%" stopColor="#0A162B" />
            </linearGradient>
            <linearGradient id="riverFlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#155E75" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#0EA5E9" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0.85" />
            </linearGradient>
            <marker
              id="goldArrowHead"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#E6BE68" />
            </marker>
            <marker
              id="crimsonArrowHead"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
            </marker>
          </defs>

          {/* Base Atlas Surface */}
          <rect x="0" y="0" width="680" height="480" fill="url(#atlasBg)" rx="10" />

          {/* Cartographic Coordinate Grid (64m x 64m Scale) */}
          <g stroke="#C89B3C" strokeOpacity="0.12" strokeWidth="1">
            {[90, 165, 240, 315, 390, 465, 540, 615].map((gx) => (
              <line key={`gx-${gx}`} x1={gx} y1="24" x2={gx} y2="456" />
            ))}
            {[75, 140, 205, 270, 335, 400].map((gy) => (
              <line key={`gy-${gy}`} x1="24" y1={gy} x2="656" y2={gy} />
            ))}
          </g>

          {/* Outer Brass Cartographic Border */}
          <rect
            x="16"
            y="16"
            width="648"
            height="448"
            rx="8"
            fill="none"
            stroke="#C89B3C"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />
          <rect
            x="22"
            y="22"
            width="636"
            height="436"
            rx="5"
            fill="none"
            stroke="#C89B3C"
            strokeOpacity="0.2"
            strokeDasharray="4 4"
          />

          {/* SCENE-SPECIFIC HISTORICAL TOPOGRAPHY */}
          {isLamSon && (
            <g>
              {/* Western Chí Linh - Lam Sơn Mountain Range */}
              <ellipse cx="145" cy="260" rx="105" ry="155" fill="#1E3A2F" fillOpacity="0.55" stroke="#4ADE80" strokeOpacity="0.22" />
              <ellipse cx="125" cy="255" rx="68" ry="110" fill="#234737" fillOpacity="0.6" />
              {/* Mountain Peaks */}
              {[
                [95, 195],
                [125, 245],
                [90, 295],
                [140, 335],
                [355, 82],
                [425, 76],
                [485, 88],
              ].map(([mx, my], idx) => (
                <polygon
                  key={`mtn-${idx}`}
                  points={`${mx - 22},${my + 18} ${mx},${my - 18} ${mx + 22},${my + 18}`}
                  fill="#2D5A43"
                  stroke="#A7F3D0"
                  strokeOpacity="0.35"
                  strokeWidth="1.2"
                />
              ))}

              {/* Rivers: Sông Hồng (North), Sông Mã (Center), Sông Lam (South Nghệ An) */}
              <path
                d="M 220 145 Q 370 175 625 198"
                fill="none"
                stroke="url(#riverFlow)"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <path
                d="M 165 268 Q 345 282 620 302"
                fill="none"
                stroke="url(#riverFlow)"
                strokeWidth="11"
                strokeLinecap="round"
              />
              <path
                d="M 185 375 Q 360 362 615 395"
                fill="none"
                stroke="url(#riverFlow)"
                strokeWidth="13"
                strokeLinecap="round"
              />

              {/* Regional Labels */}
              <text x="72" y="165" fill="#A7F3D0" fillOpacity="0.78" fontSize="10" fontWeight="600">
                NÚI CHÍ LINH – CĂN CỨ LAM SƠN
              </text>
              <text x="352" y="54" fill="#FDE68A" fillOpacity="0.85" fontSize="10" fontWeight="600">
                HẺM NÚI ẢI CHI LĂNG – XƯƠNG GIANG (1427)
              </text>
              <text x="485" y="182" fill="#BAE6FD" fillOpacity="0.8" fontSize="9.5">
                Sông Hồng · Thành Đông Quan
              </text>
              <text x="445" y="382" fill="#BAE6FD" fillOpacity="0.8" fontSize="9.5">
                Sông Lam · Hậu phương Nghệ An (1424)
              </text>

              {/* Strategic Citadels: Đông Quan & Xương Giang */}
              <rect x="448" y="152" width="38" height="28" rx="3" fill="#334155" stroke="#E6BE68" strokeWidth="1.4" />
              <rect x="456" y="96" width="34" height="24" rx="3" fill="#334155" stroke="#E6BE68" strokeWidth="1.4" />

              {/* Strategic Campaign Vectors: 1424 Southward -> 1426 Northward -> 1427 Chi Lăng */}
              <path
                d="M 225 276 Q 245 332 298 352"
                fill="none"
                stroke="#E6BE68"
                strokeWidth="2.6"
                strokeDasharray="6 4"
                markerEnd="url(#goldArrowHead)"
              />
              <path
                d="M 322 344 Q 365 255 392 188"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.8"
                strokeDasharray="7 4"
                markerEnd="url(#crimsonArrowHead)"
              />
              <path
                d="M 405 164 Q 418 134 422 114"
                fill="none"
                stroke="#E6BE68"
                strokeWidth="2.4"
                strokeDasharray="5 4"
                markerEnd="url(#goldArrowHead)"
              />
            </g>
          )}

          {isBachDang && (
            <g>
              {/* Left & Right Tràng Kênh Limestone Banks */}
              <path d="M 24 24 L 215 24 Q 185 240 210 456 L 24 456 Z" fill="#1E3A2F" fillOpacity="0.6" />
              <path d="M 465 24 L 656 24 L 656 456 L 470 456 Q 495 240 465 24 Z" fill="#1E3A2F" fillOpacity="0.6" />
              {/* Bạch Đằng River Channel */}
              <path d="M 215 24 Q 185 240 210 456 L 470 456 Q 495 240 465 24 Z" fill="#0E4A67" fillOpacity="0.68" />
              {/* Iron-Tipped Wooden Stake Grid */}
              {[-3, -2, -1, 0, 1, 2, 3].map((r) =>
                [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((c) => (
                  <circle
                    key={`stk-${r}-${c}`}
                    cx={340 + c * 22 + (r % 2 === 0 ? 6 : -6)}
                    cy={232 + r * 16}
                    r="3.2"
                    fill="#D97706"
                    stroke="#FDE68A"
                    strokeWidth="0.9"
                  />
                )),
              )}
              <text x="255" y="168" fill="#FDE68A" fontSize="10" fontWeight="600">
                TRẬN ĐỊA BÃI CỌC GỖ LIM BỊT SẮT
              </text>
              <text x="54" y="96" fill="#A7F3D0" fontSize="10" fontWeight="600">
                NÚI ĐÁ VÔI TRÀNG KÊNH (TẢ NGẠN)
              </text>
              <text x="488" y="96" fill="#A7F3D0" fontSize="10" fontWeight="600">
                PHỤC BINH HỮU NGẠN ĐẠI VIỆT
              </text>
              {/* Ambush Flanking Arrows */}
              <path d="M 185 215 Q 245 220 295 235" fill="none" stroke="#E6BE68" strokeWidth="2.8" strokeDasharray="6 4" markerEnd="url(#goldArrowHead)" />
              <path d="M 495 215 Q 435 220 385 235" fill="none" stroke="#E6BE68" strokeWidth="2.8" strokeDasharray="6 4" markerEnd="url(#goldArrowHead)" />
              <path d="M 340 420 L 340 278" fill="none" stroke="#EF4444" strokeWidth="2.8" strokeDasharray="7 4" markerEnd="url(#crimsonArrowHead)" />
            </g>
          )}

          {isTayDo && (
            <g>
              {/* Đốn Sơn Mountains North */}
              {[190, 290, 390, 490].map((mx, i) => (
                <polygon
                  key={`td-mtn-${i}`}
                  points={`${mx - 36},86 ${mx},42 ${mx + 36},86`}
                  fill="#244638"
                  stroke="#A7F3D0"
                  strokeOpacity="0.3"
                />
              ))}
              {/* Outer Moat (Hào thành) */}
              <rect x="155" y="102" width="370" height="238" rx="10" fill="none" stroke="#0EA5E9" strokeOpacity="0.55" strokeWidth="12" />
              {/* Stone Citadel Ramparts (Tường thành đá Tây Đô) */}
              <rect x="176" y="120" width="328" height="200" rx="4" fill="#1E293B" fillOpacity="0.78" stroke="#94A3B8" strokeWidth="4" />
              {/* Hoàng Nguyên Palace inside */}
              <rect x="285" y="148" width="110" height="54" rx="3" fill="#7F1D1D" stroke="#E6BE68" strokeWidth="1.6" />
              {/* Royal Hoa Nhai Stone Avenue */}
              <line x1="340" y1="202" x2="340" y2="432" stroke="#CBD5E1" strokeWidth="12" strokeOpacity="0.5" />
              {/* South Three-Arch Stone Gate */}
              <rect x="296" y="308" width="88" height="22" rx="2" fill="#64748B" stroke="#FDE68A" strokeWidth="1.8" />
              <text x="255" y="96" fill="#A7F3D0" fontSize="10" fontWeight="600">
                DÃY NÚI ĐỐN SƠN – THẾ TỰA SƠN HƯỚNG THỦY
              </text>
              <text x="288" y="180" fill="#FDE68A" fontSize="9.5" fontWeight="600">
                ĐIỆN HOÀNG NGUYÊN
              </text>
            </g>
          )}

          {isMaritime && (
            <g>
              {/* Vietnamese Mainland Coastline on West */}
              <path
                d="M 24 24 L 148 24 Q 195 145 178 265 Q 162 365 118 456 L 24 456 Z"
                fill="#1E3A2F"
                fillOpacity="0.72"
                stroke="#86EFAC"
                strokeOpacity="0.35"
              />
              {/* Bathymetric Sea Rings */}
              <circle cx="385" cy="175" r="56" fill="#0EA5E9" fillOpacity="0.14" stroke="#38BDF8" strokeDasharray="4 4" strokeOpacity="0.45" />
              <circle cx="445" cy="335" r="68" fill="#0EA5E9" fillOpacity="0.14" stroke="#38BDF8" strokeDasharray="4 4" strokeOpacity="0.45" />
              {/* International Maritime Route */}
              <path
                d="M 255 435 Q 355 285 565 72"
                fill="none"
                stroke="#E6BE68"
                strokeWidth="2.6"
                strokeDasharray="8 5"
                markerEnd="url(#goldArrowHead)"
              />
              <text x="42" y="220" fill="#A7F3D0" fontSize="10" fontWeight="600">
                ĐẤT LIỀN VIỆT NAM
              </text>
              <text x="335" y="112" fill="#BAE6FD" fontSize="10" fontWeight="600">
                KHÔNG GIAN BIỂN ĐẢO &amp; TUYẾN HÀNG HẢI
              </text>
            </g>
          )}

          {!isLamSon && !isBachDang && !isTayDo && !isMaritime && (
            <g>
              <ellipse cx="340" cy="240" rx="235" ry="155" fill="#173156" fillOpacity="0.45" stroke="#C89B3C" strokeOpacity="0.28" />
              <path d="M 75 345 Q 340 315 615 352" fill="none" stroke="url(#riverFlow)" strokeWidth="14" />
              {projectedPins.length > 1 && (
                <polyline
                  points={projectedPins.map((p) => `${p.sx},${p.sy}`).join(' ')}
                  fill="none"
                  stroke="#E6BE68"
                  strokeOpacity="0.55"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              )}
            </g>
          )}

          {/* Compass Rose (Top Right) */}
          <g transform="translate(612, 64)">
            <circle cx="0" cy="0" r="24" fill="#091326" fillOpacity="0.88" stroke="#C89B3C" strokeWidth="1.2" />
            <polygon points="0,-18 5,0 0,-4 -5,0" fill="#E6BE68" />
            <polygon points="0,18 4,0 0,4 -4,0" fill="#64748B" />
            <text x="-3.5" y="-21" fill="#E6BE68" fontSize="9" fontWeight="700">
              B
            </text>
          </g>

          {/* Scale Bar (Bottom Left) */}
          <g transform="translate(42, 434)">
            <rect x="-6" y="-16" width="142" height="24" rx="4" fill="#091326" fillOpacity="0.82" />
            <line x1="0" y1="0" x2="96" y2="0" stroke="#E6BE68" strokeWidth="2" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="#E6BE68" strokeWidth="2" />
            <line x1="48" y1="-3" x2="48" y2="3" stroke="#E6BE68" strokeWidth="1.5" />
            <line x1="96" y1="-4" x2="96" y2="4" stroke="#E6BE68" strokeWidth="2" />
            <text x="0" y="-6" fill="#E2E8F0" fontSize="8.5">
              Tỉ lệ đại cảnh: 0 — 32m — 64m
            </text>
          </g>

          {/* Interactive Plotted Hotspot Medallions */}
          {projectedPins.map(({ hs, idx, sx, sy }) => {
            const isSelected = activeHotspot?.id === hs.id;
            const isHovered = hoveredId === hs.id;
            const isPhaseMatch = hs.phaseKey === 'all' || hs.phaseKey === currentPhaseKey;
            const labelW = Math.min(205, Math.max(115, hs.title.length * 5.6 + 24));
            const labelX = sx + 18 + labelW > 652 ? sx - 18 - labelW : sx + 16;

            return (
              <g
                key={hs.id}
                transform={`translate(0, 0)`}
                onClick={() => onSelectHotspot(hs)}
                onMouseEnter={() => setHoveredId(hs.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="cursor-pointer"
                opacity={isPhaseMatch || isSelected ? 1 : 0.65}
              >
                {(isSelected || isHovered) && (
                  <circle
                    cx={sx}
                    cy={sy}
                    r="21"
                    fill="#E6BE68"
                    fillOpacity="0.18"
                    stroke="#E6BE68"
                    strokeWidth="1.4"
                    strokeDasharray="3 2"
                  />
                )}
                <circle
                  cx={sx}
                  cy={sy}
                  r={isSelected ? 13 : 11}
                  fill={isSelected ? '#C89B3C' : '#8B1E24'}
                  stroke="#FAF7F0"
                  strokeWidth="1.8"
                />
                <text
                  x={sx}
                  y={sy + 4}
                  textAnchor="middle"
                  fill={isSelected ? '#0B132B' : '#FAF7F0'}
                  fontSize="11"
                  fontWeight="800"
                >
                  {idx + 1}
                </text>

                <rect
                  x={labelX}
                  y={sy - 12}
                  width={labelW}
                  height="24"
                  rx="5"
                  fill={isSelected ? '#16284C' : '#091326'}
                  fillOpacity="0.94"
                  stroke={isSelected ? '#E6BE68' : '#475569'}
                  strokeWidth={isSelected ? 1.4 : 0.9}
                />
                <text
                  x={labelX + 8}
                  y={sy + 3.5}
                  fill={isSelected ? '#FDE68A' : '#E2E8F0'}
                  fontSize="10"
                  fontWeight="600"
                >
                  {hs.title.length > 31 ? `${hs.title.slice(0, 31)}…` : hs.title}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Top-left Map Title Plaque */}
        <div className="absolute top-3.5 left-4 pointer-events-none bg-[#091326]/90 border border-[#C89B3C]/40 rounded-lg px-3 py-1.5 max-w-[78%]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#E6BE68] flex items-center gap-1">
            <Compass className="w-3 h-3" /> Sa bàn Bản đồ Chiến lược 2D Tương tác
          </p>
          <p className="text-xs font-semibold text-white truncate">{model.modelName}</p>
        </div>
      </div>

      {/* Right: Historical Phase & Hotspot Tactical Dossier */}
      <div className="lg:col-span-5 flex flex-col justify-between p-4 sm:p-5 bg-[#091326] overflow-y-auto space-y-4">
        <div className="space-y-3">
          {/* Mode Switch / Recovery Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#E6BE68]">
              <Layers className="w-3.5 h-3.5" /> Hồ sơ Tọa độ Lịch sử
            </span>
            <div className="flex items-center gap-1.5">
              {onRetry3D && fallbackError && (
                <button
                  type="button"
                  onClick={onRetry3D}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#C89B3C] text-[#0B132B] text-xs font-bold hover:bg-[#dfB252]"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Tải lại Đại cảnh 3D
                </button>
              )}
              {onSwitchTo3D && !fallbackError && (
                <button
                  type="button"
                  onClick={onSwitchTo3D}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#C89B3C] text-[#0B132B] text-xs font-bold hover:bg-[#dfB252]"
                >
                  <Box className="w-3.5 h-3.5" /> Chuyển sang Đại cảnh 3D (.glb)
                </button>
              )}
            </div>
          </div>

          {fallbackError && (
            <p className="text-[11px] text-amber-200/90 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2">
              Đang hiển thị Sa bàn Chiến lược 2D trực quan. Bạn có thể tra cứu từng mốc chiến dịch trên bản đồ hoặc nhấn <strong>Tải lại Đại cảnh 3D</strong>.
            </p>
          )}

          {/* Phase Selector Pills */}
          {model.phases.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-slate-400">Diễn biến theo từng giai đoạn:</p>
              <div className="flex flex-wrap gap-1.5">
                {model.phases.map((ph) => {
                  const active = currentPhaseKey === ph.key;
                  return (
                    <button
                      key={ph.key}
                      type="button"
                      onClick={() => onSelectPhase(ph)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                        active
                          ? 'bg-[#C89B3C] text-[#0B132B] font-bold'
                          : 'bg-[#152444] text-slate-200 hover:bg-[#1E325C]'
                      }`}
                    >
                      {ph.label}
                    </button>
                  );
                })}
              </div>
              {activePhase?.summary && (
                <p className="text-xs text-slate-300 bg-[#0F1E3A] border border-white/10 rounded-lg p-2.5 leading-relaxed">
                  {activePhase.summary}
                </p>
              )}
            </div>
          )}

          {/* Selected Hotspot Spotlight */}
          {activeHotspot && (
            <div className="rounded-xl bg-[#122344] border border-[#C89B3C]/60 p-3.5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#E6BE68] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Điểm nhấn đang chọn
              </p>
              <h4 className="text-sm font-bold text-white">{activeHotspot.title}</h4>
              <p className="text-xs text-slate-200 leading-relaxed">{activeHotspot.description}</p>
            </div>
          )}

          {/* Interactive Numbered Hotspot Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {model.hotspots.map((h, i) => {
              const isCurrent = activeHotspot?.id === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onSelectHotspot(h)}
                  className={`text-left p-2.5 rounded-lg border transition-colors ${
                    isCurrent
                      ? 'bg-[#192F59] border-[#E6BE68]'
                      : 'bg-[#0E1B36] border-white/10 hover:border-[#C89B3C]/50'
                  }`}
                >
                  <p className="text-xs font-semibold text-[#E6BE68] line-clamp-1">
                    {i + 1}. {h.title}
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">{h.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 pt-2 border-t border-white/10">
          Nguồn đối chiếu: {model.sourceReference}
        </p>
      </div>
    </div>
  );
}
