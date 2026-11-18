#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BỘ BIÊN DỊCH CỔ PHỤC LỊCH SỬ VIỆT NAM & ĐẠI CẢNH KHÔNG GIAN RỘNG glTF 2.0 (.glb)
Ứng dụng: LỊCH SỬ 11 3D – KHÁM PHÁ LỊCH SỬ QUA KHÔNG GIAN SỐ (Trường THPT Hòa Minh, Vĩnh Long)

Nâng cấp trọng tâm (v3.0):
  1. CỔ PHỤC LỊCH SỬ CHUẨN XÁC CHO MÔ HÌNH NGƯỜI 3D (hmthanh/3d-human-model):
     - Giữ nguyên gương mặt người Việt chân thực (face_texture), đôi mắt, làn da và hệ xương.
     - Loại bỏ triệt để phụ kiện/trang phục hiện đại lạc niên đại (kính sừng tuần lộc, áo thun New Balance, quần jeans, giày sneaker, sơ mi công sở) trong các bối cảnh cổ – trung đại.
     - Dệt kết cấu vải lụa gấm, giáp vảy đồng sơn son, vải chàm Lam Sơn bằng PNG nhị phân (zlib + struct) và gắn trang phục – mũ miện – binh khí 3D đa bộ phận:
       * Nữ Quý tộc / Nữ Tướng Cổ phục Giao Lĩnh – Nhật Bình & Khăn vấn hoàng kim (nguoi_tran_thi_ngoc_tham.glb)
       * Võ Tướng Đại Việt Giáp Đồng Sơn Son, Mũ Đâu Mâu & Bảo kiếm (nguoi_thanh.glb)
       * Thủy Quân Ngô Quyền Thế kỷ X Khăn chít đầu đỏ & Trường thương cờ lệnh (tuong_linh_bach_dang.glb)
       * Nghĩa Quân Lam Sơn Thế kỷ XV Nón gõ, Khiên mây & Giáo dài (nghia_quan_lam_son.glb)
       * Quan Đại Thần Triều Trần – Hồ – Lê Sơ Mũ Cánh Chuồn, Áo Giao Lĩnh & Chiếu thư (quan_vien_trieu_ho.glb)
       * Phụ nữ Đại Việt Áo Ngũ Thân & Nón Lá truyền thống (dan_nu_dai_viet_co_truyen.glb)
       * Công dân Tri thức Cận – Hiện đại lịch sự không kính tuần lộc (cong_dan_tri_thuc_nu.glb, cong_dan_tri_thuc_nam.glb — chỉ dùng riêng cho Bài 2 Đô thị cơ giới).
  2. ĐẠI CẢNH LỊCH SỬ MỞ RỘNG (60m x 60m -> 68m x 68m):
     - Mở rộng gấp ~9 lần diện tích mặt bằng so với sa bàn cũ (từ 22m lên 64m–68m), bao quanh bởi núi đá vôi, sông ngòi uốn lượn, bờ biển, làng mạc, doanh trại, điện đài, cầu đá và rừng cây tự nhiên.
"""

from __future__ import annotations

import copy
import hashlib
import json
import math
import os
import shutil
import struct
import subprocess
import tempfile
import urllib.parse
import urllib.request
import zlib
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from sinh_mo_phong_lich_su_glb import (
    GENERATOR_SIGNATURE,
    AnimationChannel,
    AnimationClip,
    MeshPart,
    compile_glb_bytes,
    create_tactical_arrow,
    quat_from_euler_y,
)

ENHANCED_GENERATOR = f"{GENERATOR_SIGNATURE}-HistoricalWideWorld-v4"

RAW_HUMAN_URLS: Dict[str, Tuple[str, str]] = {
    "raw_tham": (
        "_raw_human_tham.glb",
        "https://raw.githubusercontent.com/hmthanh/3d-human-model/main/TranThiNgocTham.glb",
    ),
    "raw_thanh": (
        "_raw_human_thanh.glb",
        "https://raw.githubusercontent.com/hmthanh/3d-human-model/main/Thanh.glb",
    ),
}

HISTORICAL_HUMAN_ARCHETYPES: Dict[str, Dict[str, object]] = {
    "human_tham": {
        "filename": "nguoi_tran_thi_ngoc_tham.glb",
        "base_raw": "raw_tham",
        "is_female": True,
        "archetype": "noble_lady_nhat_binh",
        "source_repo": "hmthanh/3d-human-model (Cổ phục Giao Lĩnh – Nhật Bình & Khăn vấn)",
    },
    "human_thanh": {
        "filename": "nguoi_thanh.glb",
        "base_raw": "raw_thanh",
        "is_female": False,
        "archetype": "general_dau_mau_armor",
        "source_repo": "hmthanh/3d-human-model (Võ Tướng Đại Việt Giáp Đồng & Mũ Đâu Mâu)",
    },
    "human_bach_dang": {
        "filename": "tuong_linh_bach_dang.glb",
        "base_raw": "raw_thanh",
        "is_female": False,
        "archetype": "naval_warrior_bach_dang",
        "source_repo": "hmthanh/3d-human-model (Thủy Quân Ngô Quyền TK X & Cờ lệnh)",
    },
    "human_lam_son": {
        "filename": "nghia_quan_lam_son.glb",
        "base_raw": "raw_thanh",
        "is_female": False,
        "archetype": "insurgent_lam_son",
        "source_repo": "hmthanh/3d-human-model (Nghĩa Quân Lam Sơn TK XV Khiên mây Giáo dài)",
    },
    "human_mandarin": {
        "filename": "quan_vien_trieu_ho.glb",
        "base_raw": "raw_thanh",
        "is_female": False,
        "archetype": "court_scholar_mandarin",
        "source_repo": "hmthanh/3d-human-model (Quan Đại Thần Mũ Cánh Chuồn & Áo Giao Lĩnh)",
    },
    "human_viet_folk_f": {
        "filename": "dan_nu_dai_viet_co_truyen.glb",
        "base_raw": "raw_tham",
        "is_female": True,
        "archetype": "folk_woman_ao_ngu_than_non_la",
        "source_repo": "hmthanh/3d-human-model (Phụ nữ Đại Việt Áo Ngũ Thân & Nón Lá)",
    },
    "human_modern_f": {
        "filename": "cong_dan_tri_thuc_nu.glb",
        "base_raw": "raw_tham",
        "is_female": True,
        "archetype": "modern_citizen_f",
        "source_repo": "hmthanh/3d-human-model (Công dân Đô thị Cận – Hiện đại)",
    },
    "human_modern_m": {
        "filename": "cong_dan_tri_thuc_nam.glb",
        "base_raw": "raw_thanh",
        "is_female": False,
        "archetype": "modern_citizen_m",
        "source_repo": "hmthanh/3d-human-model (Kỹ sư Đô thị Cận – Hiện đại)",
    },
}

ASSET_CATALOG: Dict[str, Dict[str, object]] = {
    # 2. MÔ HÌNH XE CỘ & THUYỀN CHIẾN (Hidencod/tge-assets)
    "ship_royal": {
        "category": "vehicle",
        "filename": "thuyen_chien_lon.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/pirate-kit/ship-large.glb",
        "max_tex_px": 512,
        "roughness": 0.68,
        "metallic": 0.08,
        "source_repo": "Hidencod/tge-assets",
    },
    "ship_armada": {
        "category": "vehicle",
        "filename": "thuyen_chien_vua.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/pirate-kit/ship-pirate-large.glb",
        "max_tex_px": 512,
        "roughness": 0.68,
        "metallic": 0.08,
        "source_repo": "Hidencod/tge-assets",
    },
    "boat_row": {
        "category": "vehicle",
        "filename": "thuyen_cheo_nhanh.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/pirate-kit/boat-row-large.glb",
        "max_tex_px": 512,
        "roughness": 0.72,
        "metallic": 0.06,
        "source_repo": "Hidencod/tge-assets",
    },
    "cannon_mobile": {
        "category": "vehicle",
        "filename": "phao_than_cong_co_dong.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/pirate-kit/cannon-mobile.glb",
        "max_tex_px": 512,
        "roughness": 0.55,
        "metallic": 0.35,
        "source_repo": "Hidencod/tge-assets",
    },
    "vehicle_truck": {
        "category": "vehicle",
        "filename": "xe_tai_co_gioi.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/car-kit/truck.glb",
        "max_tex_px": 512,
        "roughness": 0.45,
        "metallic": 0.22,
        "source_repo": "Hidencod/tge-assets",
    },
    "vehicle_delivery": {
        "category": "vehicle",
        "filename": "xe_van_tai_thuong_mai.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/car-kit/delivery.glb",
        "max_tex_px": 512,
        "roughness": 0.45,
        "metallic": 0.22,
        "source_repo": "Hidencod/tge-assets",
    },
    "vehicle_sedan": {
        "category": "vehicle",
        "filename": "xe_oto_sedan.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/car-kit/sedan-sports.glb",
        "max_tex_px": 512,
        "roughness": 0.38,
        "metallic": 0.28,
        "source_repo": "Hidencod/tge-assets",
    },
    "vehicle_suv": {
        "category": "vehicle",
        "filename": "xe_oto_suv.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/car-kit/suv-luxury.glb",
        "max_tex_px": 512,
        "roughness": 0.40,
        "metallic": 0.25,
        "source_repo": "Hidencod/tge-assets",
    },
    "vehicle_tractor": {
        "category": "vehicle",
        "filename": "may_keo_co_gioi.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/car-kit/tractor.glb",
        "max_tex_px": 512,
        "roughness": 0.52,
        "metallic": 0.20,
        "source_repo": "Hidencod/tge-assets",
    },
    # 3. ĐỘNG VẬT (Ariescar/gobkit-free-assets & Hidencod/tge-assets)
    "animal_shark": {
        "category": "animal",
        "filename": "ca_map_bien_dong.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Ariescar/gobkit-free-assets/main/animal/Shark.glb",
        "max_tex_px": 512,
        "roughness": 0.42,
        "metallic": 0.08,
        "source_repo": "Ariescar/gobkit-free-assets",
    },
    "animal_duck": {
        "category": "animal",
        "filename": "chim_thuy_cam_vit.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Ariescar/gobkit-free-assets/main/animal/Duck.glb",
        "max_tex_px": 512,
        "roughness": 0.65,
        "metallic": 0.04,
        "source_repo": "Ariescar/gobkit-free-assets",
    },
    "animal_jellyfish": {
        "category": "animal",
        "filename": "sua_bien_dai_duong.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Ariescar/gobkit-free-assets/main/animal/Jellyfish.glb",
        "max_tex_px": 512,
        "roughness": 0.35,
        "metallic": 0.05,
        "source_repo": "Ariescar/gobkit-free-assets",
    },
    "animal_corgi": {
        "category": "animal",
        "filename": "khuyen_canh_corgi.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Ariescar/gobkit-free-assets/main/animal/Corgi.glb",
        "max_tex_px": 512,
        "roughness": 0.72,
        "metallic": 0.04,
        "source_repo": "Ariescar/gobkit-free-assets",
    },
    "animal_hippo": {
        "category": "animal",
        "filename": "ha_ma_sinh_thai.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Ariescar/gobkit-free-assets/main/animal/Hippo.glb",
        "max_tex_px": 512,
        "roughness": 0.60,
        "metallic": 0.05,
        "source_repo": "Ariescar/gobkit-free-assets",
    },
    "animal_horse": {
        "category": "animal",
        "filename": "chien_ma_ky_binh.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/prototype-kit/animal-horse.glb",
        "max_tex_px": 512,
        "roughness": 0.68,
        "metallic": 0.05,
        "source_repo": "Hidencod/tge-assets",
    },
    "animal_deer": {
        "category": "animal",
        "filename": "huou_rung_lam_son.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/cube-pets/animal-deer.glb",
        "max_tex_px": 512,
        "roughness": 0.70,
        "metallic": 0.04,
        "source_repo": "Hidencod/tge-assets",
    },
    # 4. CÂY CỐI & CẢNH QUAN (agentkaerf/FreeModels & GeorgeQLe/assets-kaykit-3d-environments)
    "nature_tree_freemodels": {
        "category": "landscape",
        "filename": "cay_co_thu_freemodels.glb",
        "type": "gltf",
        "base_url": "https://raw.githubusercontent.com/agentkaerf/FreeModels/main/Stylized%20Nature%20MegaKit%5BStandard%5D/glTF",
        "entry": "CommonTree_1.gltf",
        "tex_fallback_url": "https://raw.githubusercontent.com/agentkaerf/FreeModels/main/Stylized%20Nature%20MegaKit%5BStandard%5D/glTF",
        "alpha_mask": True,
        "max_tex_px": 512,
        "roughness": 0.80,
        "metallic": 0.02,
        "source_repo": "agentkaerf/FreeModels",
    },
    "nature_flower_bush_freemodels": {
        "category": "landscape",
        "filename": "bui_hoa_freemodels.glb",
        "type": "gltf",
        "base_url": "https://raw.githubusercontent.com/agentkaerf/FreeModels/main/Stylized%20Nature%20MegaKit%5BStandard%5D/glTF",
        "entry": "Bush_Common_Flowers.gltf",
        "tex_fallback_url": "https://raw.githubusercontent.com/agentkaerf/FreeModels/main/Stylized%20Nature%20MegaKit%5BStandard%5D/glTF",
        "alpha_mask": True,
        "max_tex_px": 512,
        "roughness": 0.82,
        "metallic": 0.02,
        "source_repo": "agentkaerf/FreeModels",
    },
    "nature_rock_freemodels": {
        "category": "landscape",
        "filename": "tang_da_freemodels.glb",
        "type": "gltf",
        "base_url": "https://raw.githubusercontent.com/agentkaerf/FreeModels/main/Stylized%20Nature%20MegaKit%5BStandard%5D/glTF",
        "entry": "Rock_Medium_1.gltf",
        "tex_fallback_url": "https://raw.githubusercontent.com/agentkaerf/FreeModels/main/Stylized%20Nature%20MegaKit%5BStandard%5D/glTF",
        "alpha_mask": False,
        "max_tex_px": 512,
        "roughness": 0.86,
        "metallic": 0.04,
        "source_repo": "agentkaerf/FreeModels",
    },
    "nature_tree_kaykit": {
        "category": "landscape",
        "filename": "cay_rung_kaykit.glb",
        "type": "gltf",
        "base_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/forest-nature-pack-1.0/Assets/gltf/Color1",
        "entry": "Tree_1_A_Color1.gltf",
        "tex_fallback_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/forest-nature-pack-1.0/Assets/fbx(unity)/Color1",
        "alpha_mask": False,
        "max_tex_px": 512,
        "roughness": 0.78,
        "metallic": 0.02,
        "source_repo": "GeorgeQLe/assets-kaykit-3d-environments",
    },
    "nature_pine_kaykit": {
        "category": "landscape",
        "filename": "cay_thong_kaykit.glb",
        "type": "gltf",
        "base_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/forest-nature-pack-1.0/Assets/gltf/Color1",
        "entry": "Tree_4_A_Color1.gltf",
        "tex_fallback_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/forest-nature-pack-1.0/Assets/fbx(unity)/Color1",
        "alpha_mask": False,
        "max_tex_px": 512,
        "roughness": 0.78,
        "metallic": 0.02,
        "source_repo": "GeorgeQLe/assets-kaykit-3d-environments",
    },
    "nature_rock_kaykit": {
        "category": "landscape",
        "filename": "da_nui_kaykit.glb",
        "type": "gltf",
        "base_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/forest-nature-pack-1.0/Assets/gltf/Color1",
        "entry": "Rock_1_A_Color1.gltf",
        "tex_fallback_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/forest-nature-pack-1.0/Assets/fbx(unity)/Color1",
        "alpha_mask": False,
        "max_tex_px": 512,
        "roughness": 0.85,
        "metallic": 0.04,
        "source_repo": "GeorgeQLe/assets-kaykit-3d-environments",
    },
    "castle_kaykit": {
        "category": "landscape",
        "filename": "thanh_luy_kaykit.glb",
        "type": "gltf",
        "base_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/medieval-hexagon-pack-1.0.1/Assets/gltf/buildings/blue",
        "entry": "building_castle_blue.gltf",
        "tex_fallback_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/medieval-hexagon-pack-1.0.1/Assets/fbx(unity)/buildings/blue",
        "alpha_mask": False,
        "max_tex_px": 512,
        "roughness": 0.75,
        "metallic": 0.06,
        "source_repo": "GeorgeQLe/assets-kaykit-3d-environments",
    },
    "shipyard_kaykit": {
        "category": "landscape",
        "filename": "thuong_cang_kaykit.glb",
        "type": "gltf",
        "base_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/medieval-hexagon-pack-1.0.1/Assets/gltf/buildings/blue",
        "entry": "building_shipyard_blue.gltf",
        "tex_fallback_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/medieval-hexagon-pack-1.0.1/Assets/fbx(unity)/buildings/blue",
        "alpha_mask": False,
        "max_tex_px": 512,
        "roughness": 0.75,
        "metallic": 0.06,
        "source_repo": "GeorgeQLe/assets-kaykit-3d-environments",
    },
    "building_city_kaykit": {
        "category": "landscape",
        "filename": "toa_nha_do_thi_kaykit.glb",
        "type": "gltf",
        "base_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/city-builder-bits-1.0/Assets/gltf",
        "entry": "building_F.gltf",
        "tex_fallback_url": "https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-environments/main/assets/kaykit/city-builder-bits-1.0/Assets/gltf",
        "alpha_mask": False,
        "max_tex_px": 512,
        "roughness": 0.70,
        "metallic": 0.08,
        "source_repo": "GeorgeQLe/assets-kaykit-3d-environments",
    },
    "palm_bend_tge": {
        "category": "landscape",
        "filename": "cay_dua_bien.glb",
        "type": "glb",
        "url": "https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/pirate-kit/palm-detailed-bend.glb",
        "max_tex_px": 512,
        "roughness": 0.78,
        "metallic": 0.03,
        "source_repo": "Hidencod/tge-assets",
    },
}


# ==============================================================================
# BỘ DỆT KẾT CẤU VẢI LỤA GẤM, GIÁP ĐỒNG & TÓC ĐEN BẰNG PNG THUẦN PYTHON
# ==============================================================================


def encode_rgba_png(width: int, height: int, rows_rgba: List[bytes]) -> bytes:
    def chunk(tag: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(tag + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)

    raw_scanlines = b"".join(b"\x00" + r for r in rows_rgba)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw_scanlines, 6)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


_PNG_CACHE: Dict[str, bytes] = {}


def make_historical_png(style: str, width: int = 128, height: int = 128) -> bytes:
    if style in _PNG_CACHE:
        return _PNG_CACHE[style]

    rows: List[bytes] = []
    for y in range(height):
        row = bytearray(width * 4)
        for x in range(width):
            weave = ((x * 3 + y * 5) % 7) - 3
            if style == "ebony_hair":
                strand = int(9 * math.sin(x * 0.45 + y * 0.08))
                r = max(12, min(46, 24 + strand))
                g = max(10, min(38, 19 + strand))
                b = max(9, min(35, 17 + strand))
            elif style == "brocade_crimson_gold":
                # Gấm đỏ thẫm thêu hoa văn mây phượng ánh kim (Nhật Bình / Giao Lĩnh quý tộc)
                medallion = ((x % 32) - 16) ** 2 + ((y % 32) - 16) ** 2
                border = (y % 32 in (0, 1, 30, 31)) or (x % 32 in (0, 31))
                if 28 <= medallion <= 62 or border:
                    r, g, b = 212 + weave, 168 + weave, 66
                else:
                    r, g, b = 138 + weave * 2, 24 + weave, 30 + weave
            elif style == "brocade_indigo_jade":
                # Gấm chàm lam thêu vân mây cổ phục quan đại thần Triều Trần – Hồ – Lê Sơ
                cloud = ((x + (y // 2)) % 28 < 4) and ((y % 24) < 5)
                if cloud:
                    r, g, b = 196 + weave, 158 + weave, 72
                else:
                    r, g, b = 26 + weave, 46 + weave, 86 + weave * 2
            elif style == "lamellar_bronze_crimson":
                # Giáp vảy đồng sơn son thếp vàng (Võ tướng Đại Việt)
                row_idx = y // 12
                sx = (x + (8 if row_idx % 2 else 0)) % 16
                sy = y % 12
                is_cord = (sy in (2, 3) and sx in (7, 8))
                is_edge = sx in (0, 15) or sy == 11
                if is_cord:
                    r, g, b = 165, 28, 30
                elif is_edge:
                    r, g, b = 72, 52, 26
                else:
                    shimmer = int(14 * math.cos(sx * 0.35))
                    r, g, b = 178 + shimmer, 136 + shimmer, 58 + shimmer // 2
            elif style == "naval_leather_crimson":
                # Giáp da thuộc viền đồng & chiến bào thủy quân Bạch Đằng TK X
                plate = (x % 20 < 2) or (y % 18 < 2)
                if plate:
                    r, g, b = 158 + weave, 118 + weave, 52
                else:
                    r, g, b = 108 + weave * 2, 34 + weave, 26 + weave
            elif style == "hemp_lam_son":
                # Áo vải chàm – nâu sồng nghĩa quân Lam Sơn TK XV
                cross_stitch = (x + y) % 19 == 0
                if cross_stitch:
                    r, g, b = 146, 116, 74
                else:
                    r, g, b = 58 + weave * 2, 48 + weave, 38 + weave
            elif style == "silk_lotus_ao_ngu_than":
                # Lụa ngũ thân nâu non – sen trầm truyền thống Việt Nam
                motif = ((x % 24) - 12) ** 2 + ((y % 24) - 12) ** 2 <= 14
                if motif:
                    r, g, b = 196, 156, 88
                else:
                    r, g, b = 124 + weave * 2, 64 + weave, 54 + weave
            elif style == "trousers_silk_dark":
                # Quần lĩnh đen / chàm sẫm cổ truyền
                r, g, b = 28 + weave, 28 + weave, 34 + weave
            elif style == "armor_greaves_bronze":
                # Quần chiến bào & xà cạp đồng võ tướng
                stripe = (y % 16) < 3
                if stripe:
                    r, g, b = 156 + weave, 118 + weave, 52
                else:
                    r, g, b = 54 + weave, 24 + weave, 24 + weave
            elif style == "footwear_embroidered":
                # Hài thêu / ủng chiến cổ truyền màu mun sẫm đồng nhất (xóa sạch đế trắng giày thể thao hiện đại)
                r, g, b = 34 + weave, 23 + weave, 19 + weave
            elif style == "modern_coat_navy":
                r, g, b = 34 + weave, 54 + weave, 84 + weave
            elif style == "modern_coat_ivory":
                r, g, b = 216 + weave, 208 + weave, 194 + weave
            else:
                r, g, b = 44 + weave, 48 + weave, 56 + weave

            off = x * 4
            row[off] = max(0, min(255, r))
            row[off + 1] = max(0, min(255, g))
            row[off + 2] = max(0, min(255, b))
            row[off + 3] = 255
        rows.append(bytes(row))

    png_bytes = encode_rgba_png(width, height, rows)
    _PNG_CACHE[style] = png_bytes
    return png_bytes


def http_get_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (LichSu11-3D-AssetCompiler)"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read()


def optimize_image_bytes(img_bytes: bytes, mime_type: str, max_px: int = 512) -> Tuple[bytes, str]:
    if len(img_bytes) < 42_000:
        return img_bytes, mime_type

    convert_bin = shutil.which("convert")
    ffmpeg_bin = shutil.which("ffmpeg")
    if not convert_bin and not ffmpeg_bin:
        return img_bytes, mime_type

    is_png = mime_type == "image/png" or img_bytes[:8] == b"\x89PNG\r\n\x1a\n"
    ext = ".png" if is_png else ".jpg"
    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = os.path.join(tmpdir, f"in{ext}")
        out_path = os.path.join(tmpdir, f"out{ext}")
        with open(in_path, "wb") as f:
            f.write(img_bytes)
        if convert_bin:
            cmd = [convert_bin, in_path, "-resize", f"{max_px}x{max_px}>", "-strip"]
            if not is_png:
                cmd.extend(["-quality", "84"])
            cmd.append(out_path)
        else:
            cmd = [
                str(ffmpeg_bin),
                "-y",
                "-i",
                in_path,
                "-vf",
                f"scale='min({max_px},iw)':'min({max_px},ih)':force_original_aspect_ratio=decrease",
                "-frames:v",
                "1",
                out_path,
            ]
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
            optimized = Path(out_path).read_bytes()
            if len(optimized) < len(img_bytes):
                return optimized, ("image/png" if is_png else "image/jpeg")
        except Exception:
            pass
    return img_bytes, mime_type


def unpack_glb(glb_bytes: bytes) -> Tuple[Dict[str, object], bytes]:
    magic, version, _total_len, json_len, json_type = struct.unpack("<IIIII", glb_bytes[:20])
    if magic != 0x46546C67 or version != 2 or json_type != 0x4E4F534A:
        raise ValueError("Invalid GLB binary header")
    gltf_dict = json.loads(glb_bytes[20 : 20 + json_len].decode("utf-8"))
    bin_start = 20 + json_len
    bin_blob = b""
    if bin_start + 8 <= len(glb_bytes):
        bin_len, bin_type = struct.unpack("<II", glb_bytes[bin_start : bin_start + 8])
        if bin_type == 0x004E4942:
            bin_blob = glb_bytes[bin_start + 8 : bin_start + 8 + bin_len]
    return gltf_dict, bin_blob


def pack_glb(gltf_dict: Dict[str, object], bin_blob: bytes) -> bytes:
    pad_bin = (4 - (len(bin_blob) % 4)) % 4
    bin_aligned = bin_blob + (b"\x00" * pad_bin)
    gltf_dict = copy.deepcopy(gltf_dict)
    gltf_dict["buffers"] = [{"byteLength": len(bin_aligned)}]

    json_raw = json.dumps(gltf_dict, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    pad_json = (4 - (len(json_raw) % 4)) % 4
    json_aligned = json_raw + (b" " * pad_json)

    total_len = 12 + 8 + len(json_aligned) + 8 + len(bin_aligned)
    header = struct.pack("<III", 0x46546C67, 2, total_len)
    json_hdr = struct.pack("<II", len(json_aligned), 0x4E4F534A)
    bin_hdr = struct.pack("<II", len(bin_aligned), 0x004E4942)
    return header + json_hdr + json_aligned + bin_hdr + bin_aligned


def beautify_and_repack_gltf(
    gltf: Dict[str, object],
    raw_bin: bytes,
    max_tex_px: int = 512,
    roughness: float = 0.70,
    metallic: float = 0.06,
    alpha_mask: bool = False,
    source_repo: str = "",
) -> bytes:
    g = copy.deepcopy(gltf)
    old_views: List[Dict[str, object]] = list(g.get("bufferViews", []))  # type: ignore[arg-type]
    images: List[Dict[str, object]] = list(g.get("images", []))  # type: ignore[arg-type]
    image_view_map: Dict[int, Tuple[bytes, str]] = {}

    for im in images:
        bv_idx = im.get("bufferView")
        if isinstance(bv_idx, int) and 0 <= bv_idx < len(old_views):
            bv = old_views[bv_idx]
            off = int(bv.get("byteOffset", 0))
            ln = int(bv.get("byteLength", 0))
            mime = str(im.get("mimeType") or "image/png")
            opt_bytes, opt_mime = optimize_image_bytes(raw_bin[off : off + ln], mime, max_tex_px)
            im["mimeType"] = opt_mime
            image_view_map[bv_idx] = (opt_bytes, opt_mime)

    new_views: List[Dict[str, object]] = []
    chunks: List[bytes] = []
    cur_offset = 0

    for idx, bv in enumerate(old_views):
        if idx in image_view_map:
            chunk = image_view_map[idx][0]
        else:
            off = int(bv.get("byteOffset", 0))
            ln = int(bv.get("byteLength", 0))
            chunk = raw_bin[off : off + ln]

        pad = (4 - (len(chunk) % 4)) % 4
        nbv = copy.deepcopy(bv)
        nbv["buffer"] = 0
        nbv["byteOffset"] = cur_offset
        nbv["byteLength"] = len(chunk)
        new_views.append(nbv)
        chunks.append(chunk + (b"\x00" * pad))
        cur_offset += len(chunk) + pad

    g["bufferViews"] = new_views

    materials: List[Dict[str, object]] = list(g.get("materials", []))  # type: ignore[arg-type]
    for mat in materials:
        pbr = mat.setdefault("pbrMetallicRoughness", {})
        if isinstance(pbr, dict):
            pbr["roughnessFactor"] = round(float(pbr.get("roughnessFactor", roughness)), 4)
            pbr["metallicFactor"] = min(0.45, round(float(pbr.get("metallicFactor", metallic)), 4))
        mat["doubleSided"] = True
        mat_name = str(mat.get("name", "")).lower()
        if alpha_mask and any(k in mat_name for k in ("leaf", "leaves", "flower", "bush", "foliage", "plant")):
            mat["alphaMode"] = "MASK"
            mat["alphaCutoff"] = 0.42

    asset = g.setdefault("asset", {})
    if isinstance(asset, dict):
        asset["version"] = "2.0"
        asset["generator"] = ENHANCED_GENERATOR
        if source_repo:
            asset["extras"] = {"sourceRepository": source_repo}

    return pack_glb(g, b"".join(chunks))


def download_and_convert_gltf_to_glb(spec: Dict[str, object]) -> bytes:
    base_url = str(spec["base_url"])
    entry = str(spec["entry"])
    tex_fallback = str(spec.get("tex_fallback_url", base_url))

    gltf_raw = http_get_bytes(f"{base_url}/{urllib.parse.quote(entry)}")
    g = json.loads(gltf_raw.decode("utf-8"))

    buffers: List[Dict[str, object]] = list(g.get("buffers", []))
    buf_offsets: List[int] = []
    bin_parts: List[bytes] = []
    running = 0
    for b in buffers:
        uri = str(b.get("uri", ""))
        b_data = http_get_bytes(f"{base_url}/{urllib.parse.quote(uri)}")
        pad = (4 - (len(b_data) % 4)) % 4
        buf_offsets.append(running)
        bin_parts.append(b_data + (b"\x00" * pad))
        running += len(b_data) + pad

    bvs: List[Dict[str, object]] = list(g.get("bufferViews", []))
    for bv in bvs:
        b_idx = int(bv.get("buffer", 0))
        bv["buffer"] = 0
        bv["byteOffset"] = int(bv.get("byteOffset", 0)) + buf_offsets[b_idx]

    for im in g.get("images", []):
        uri = im.get("uri")
        if not uri:
            continue
        fname = os.path.basename(str(uri))
        try:
            img_bytes = http_get_bytes(f"{base_url}/{urllib.parse.quote(str(uri))}")
        except Exception:
            img_bytes = http_get_bytes(f"{tex_fallback}/{urllib.parse.quote(fname)}")

        mime = "image/png" if fname.lower().endswith(".png") else "image/jpeg"
        pad = (4 - (len(img_bytes) % 4)) % 4
        bv_idx = len(bvs)
        bvs.append({"buffer": 0, "byteOffset": running, "byteLength": len(img_bytes)})
        bin_parts.append(img_bytes + (b"\x00" * pad))
        running += len(img_bytes) + pad
        im.pop("uri", None)
        im["bufferView"] = bv_idx
        im["mimeType"] = mime

    g["bufferViews"] = bvs
    return beautify_and_repack_gltf(
        g,
        b"".join(bin_parts),
        max_tex_px=int(spec.get("max_tex_px", 512)),  # type: ignore[arg-type]
        roughness=float(spec.get("roughness", 0.78)),  # type: ignore[arg-type]
        metallic=float(spec.get("metallic", 0.03)),  # type: ignore[arg-type]
        alpha_mask=bool(spec.get("alpha_mask", False)),
        source_repo=str(spec.get("source_repo", "")),
    )


# ==============================================================================
# MA TRẬN 4x4 & BỘ HỢP NHẤT ĐA TÀI NGUYÊN GLB
# ==============================================================================


def mat4_identity() -> List[float]:
    return [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0]


def mat4_mul(a: Sequence[float], b: Sequence[float]) -> List[float]:
    out = [0.0] * 16
    for col in range(4):
        for row in range(4):
            out[col * 4 + row] = (
                a[0 * 4 + row] * b[col * 4 + 0]
                + a[1 * 4 + row] * b[col * 4 + 1]
                + a[2 * 4 + row] * b[col * 4 + 2]
                + a[3 * 4 + row] * b[col * 4 + 3]
            )
    return out


def mat4_from_trs(t: Sequence[float], q: Sequence[float], s: Sequence[float]) -> List[float]:
    x, y, z, w = q[0], q[1], q[2], q[3]
    x2, y2, z2 = x + x, y + y, z + z
    xx, xy, xz = x * x2, x * y2, x * z2
    yy, yz, zz = y * y2, y * z2, z * z2
    wx, wy, wz = w * x2, w * y2, w * z2
    sx, sy, sz = s[0], s[1], s[2]
    return [
        (1.0 - (yy + zz)) * sx,
        (xy + wz) * sx,
        (xz - wy) * sx,
        0.0,
        (xy - wz) * sy,
        (1.0 - (xx + zz)) * sy,
        (yz + wx) * sy,
        0.0,
        (xz + wy) * sz,
        (yz - wx) * sz,
        (1.0 - (xx + yy)) * sz,
        0.0,
        t[0],
        t[1],
        t[2],
        1.0,
    ]


def mat4_apply(m: Sequence[float], vx: float, vy: float, vz: float) -> Tuple[float, float, float]:
    return (
        m[0] * vx + m[4] * vy + m[8] * vz + m[12],
        m[1] * vx + m[5] * vy + m[9] * vz + m[13],
        m[2] * vx + m[6] * vy + m[10] * vz + m[14],
    )


def compute_glb_world_bounds(
    gltf: Dict[str, object], bin_blob: bytes
) -> Tuple[Tuple[float, float, float], Tuple[float, float, float]]:
    nodes: List[Dict[str, object]] = list(gltf.get("nodes", []))  # type: ignore[arg-type]
    meshes: List[Dict[str, object]] = list(gltf.get("meshes", []))  # type: ignore[arg-type]
    accessors: List[Dict[str, object]] = list(gltf.get("accessors", []))  # type: ignore[arg-type]
    bvs: List[Dict[str, object]] = list(gltf.get("bufferViews", []))  # type: ignore[arg-type]
    scenes: List[Dict[str, object]] = list(gltf.get("scenes", []))  # type: ignore[arg-type]
    root_indices: List[int] = list(scenes[0].get("nodes", [])) if scenes else []  # type: ignore[arg-type]

    mins = [float("inf"), float("inf"), float("inf")]
    maxs = [float("-inf"), float("-inf"), float("-inf")]

    def visit(n_idx: int, parent_m: Sequence[float]) -> None:
        if n_idx < 0 or n_idx >= len(nodes):
            return
        node = nodes[n_idx]
        if "matrix" in node:
            local_m = [float(v) for v in node["matrix"]]  # type: ignore[index]
        else:
            t = [float(v) for v in node.get("translation", [0.0, 0.0, 0.0])]  # type: ignore[union-attr]
            r = [float(v) for v in node.get("rotation", [0.0, 0.0, 0.0, 1.0])]  # type: ignore[union-attr]
            s = [float(v) for v in node.get("scale", [1.0, 1.0, 1.0])]  # type: ignore[union-attr]
            local_m = mat4_from_trs(t, r, s)
        world_m = mat4_mul(parent_m, local_m)

        m_idx = node.get("mesh")
        if isinstance(m_idx, int) and 0 <= m_idx < len(meshes):
            for prim in meshes[m_idx].get("primitives", []):  # type: ignore[union-attr]
                pos_acc_idx = prim.get("attributes", {}).get("POSITION")
                if not isinstance(pos_acc_idx, int):
                    continue
                acc = accessors[pos_acc_idx]
                if "min" in acc and "max" in acc:
                    pmin = [float(v) for v in acc["min"]]  # type: ignore[index]
                    pmax = [float(v) for v in acc["max"]]  # type: ignore[index]
                else:
                    bv = bvs[int(acc["bufferView"])]
                    off = int(bv.get("byteOffset", 0)) + int(acc.get("byteOffset", 0))
                    cnt = int(acc["count"])
                    vals = struct.unpack_from(f"<{cnt * 3}f", bin_blob, off)
                    xs, ys, zs = vals[0::3], vals[1::3], vals[2::3]
                    pmin = [min(xs), min(ys), min(zs)]
                    pmax = [max(xs), max(ys), max(zs)]

                for cx in (pmin[0], pmax[0]):
                    for cy in (pmin[1], pmax[1]):
                        for cz in (pmin[2], pmax[2]):
                            wx, wy, wz = mat4_apply(world_m, cx, cy, cz)
                            mins[0] = min(mins[0], wx)
                            mins[1] = min(mins[1], wy)
                            mins[2] = min(mins[2], wz)
                            maxs[0] = max(maxs[0], wx)
                            maxs[1] = max(maxs[1], wy)
                            maxs[2] = max(maxs[2], wz)

        for ch in node.get("children", []):  # type: ignore[union-attr]
            visit(int(ch), world_m)

    for r_idx in root_indices:
        visit(int(r_idx), mat4_identity())

    if mins[0] == float("inf"):
        return ((-0.5, 0.0, -0.5), (0.5, 1.0, 0.5))
    return ((mins[0], mins[1], mins[2]), (maxs[0], maxs[1], maxs[2]))


class GlbSceneComposer:
    """Hợp nhất địa hình/kiến trúc Python với mô hình .glb (Người cổ phục, Chiến thuyền, Kỵ binh, Động vật, Cây cối)."""

    def __init__(self, base_glb_bytes: bytes, scene_name: str = "LichSu11_WideHistoricalWorld") -> None:
        self.gltf, base_bin = unpack_glb(base_glb_bytes)
        pad = (4 - (len(base_bin) % 4)) % 4
        self.bin_chunks: List[bytes] = [base_bin + (b"\x00" * pad)]
        self.byte_offset: int = len(self.bin_chunks[0])
        self.scene_name = scene_name
        self._static_cache: Dict[str, Dict[str, object]] = {}
        self._bv_dedup_map: Dict[Tuple[str, object, object], int] = {}

        self.gltf.setdefault("bufferViews", [])
        self.gltf.setdefault("accessors", [])
        self.gltf.setdefault("images", [])
        self.gltf.setdefault("textures", [])
        self.gltf.setdefault("samplers", [])
        self.gltf.setdefault("materials", [])
        self.gltf.setdefault("meshes", [])
        self.gltf.setdefault("skins", [])
        self.gltf.setdefault("nodes", [])
        self.gltf.setdefault("animations", [])
        self.gltf.setdefault("extensionsUsed", [])

        scenes = self.gltf.setdefault("scenes", [{"name": scene_name, "nodes": []}])
        if isinstance(scenes, list) and scenes:
            scenes[0]["name"] = scene_name
        asset = self.gltf.setdefault("asset", {})
        if isinstance(asset, dict):
            asset["generator"] = ENHANCED_GENERATOR

    def _append_bin(self, raw: bytes) -> int:
        base = self.byte_offset
        pad = (4 - (len(raw) % 4)) % 4
        self.bin_chunks.append(raw + (b"\x00" * pad))
        self.byte_offset += len(raw) + pad
        return base

    def _embed_resources_once(self, cache_key: str, src_gltf: Dict[str, object], src_bin: bytes) -> Dict[str, object]:
        bvs_list: List[Dict[str, object]] = self.gltf["bufferViews"]  # type: ignore[assignment]
        accs_list: List[Dict[str, object]] = self.gltf["accessors"]  # type: ignore[assignment]
        imgs_list: List[Dict[str, object]] = self.gltf["images"]  # type: ignore[assignment]
        texs_list: List[Dict[str, object]] = self.gltf["textures"]  # type: ignore[assignment]
        smps_list: List[Dict[str, object]] = self.gltf["samplers"]  # type: ignore[assignment]
        mats_list: List[Dict[str, object]] = self.gltf["materials"]  # type: ignore[assignment]
        mshs_list: List[Dict[str, object]] = self.gltf["meshes"]  # type: ignore[assignment]
        exts_used: List[str] = self.gltf["extensionsUsed"]  # type: ignore[assignment]

        for ext in src_gltf.get("extensionsUsed", []):  # type: ignore[union-attr]
            if ext not in exts_used:
                exts_used.append(str(ext))

        bv_remap: Dict[int, int] = {}
        for old_bv_i, bv in enumerate(src_gltf.get("bufferViews", [])):  # type: ignore[arg-type]
            off = int(bv.get("byteOffset", 0))
            ln = int(bv.get("byteLength", 0))
            raw_slice = src_bin[off : off + ln]
            stride = bv.get("byteStride")
            target = bv.get("target")
            dedup_key = (hashlib.sha1(raw_slice).hexdigest(), stride, target)
            if dedup_key in self._bv_dedup_map:
                bv_remap[old_bv_i] = self._bv_dedup_map[dedup_key]
            else:
                slice_base = self._append_bin(raw_slice)
                nbv: Dict[str, object] = {
                    "buffer": 0,
                    "byteOffset": slice_base,
                    "byteLength": len(raw_slice),
                }
                if stride is not None:
                    nbv["byteStride"] = int(stride)
                if target is not None:
                    nbv["target"] = int(target)
                new_bv_idx = len(bvs_list)
                bvs_list.append(nbv)
                self._bv_dedup_map[dedup_key] = new_bv_idx
                bv_remap[old_bv_i] = new_bv_idx

        acc_off = len(accs_list)
        for acc in src_gltf.get("accessors", []):  # type: ignore[union-attr]
            nacc = copy.deepcopy(acc)
            if "bufferView" in nacc:
                nacc["bufferView"] = bv_remap[int(nacc["bufferView"])]
            if "sparse" in nacc and isinstance(nacc["sparse"], dict):
                sp = nacc["sparse"]
                if "indices" in sp and "bufferView" in sp["indices"]:
                    sp["indices"]["bufferView"] = bv_remap[int(sp["indices"]["bufferView"])]
                if "values" in sp and "bufferView" in sp["values"]:
                    sp["values"]["bufferView"] = bv_remap[int(sp["values"]["bufferView"])]
            accs_list.append(nacc)

        smp_off = len(smps_list)
        for smp in src_gltf.get("samplers", []):  # type: ignore[union-attr]
            smps_list.append(copy.deepcopy(smp))

        img_off = len(imgs_list)
        for im in src_gltf.get("images", []):  # type: ignore[union-attr]
            nim = copy.deepcopy(im)
            if "bufferView" in nim:
                nim["bufferView"] = bv_remap[int(nim["bufferView"])]
            imgs_list.append(nim)

        tex_off = len(texs_list)
        for tx in src_gltf.get("textures", []):  # type: ignore[union-attr]
            ntx = copy.deepcopy(tx)
            if "source" in ntx:
                ntx["source"] = int(ntx["source"]) + img_off
            if "sampler" in ntx:
                ntx["sampler"] = int(ntx["sampler"]) + smp_off
            texs_list.append(ntx)

        mat_off = len(mats_list)
        for mat in src_gltf.get("materials", []):  # type: ignore[union-attr]
            nmat = copy.deepcopy(mat)
            pbr = nmat.get("pbrMetallicRoughness")
            if isinstance(pbr, dict):
                for tkey in ("baseColorTexture", "metallicRoughnessTexture"):
                    if tkey in pbr and isinstance(pbr[tkey], dict) and "index" in pbr[tkey]:
                        pbr[tkey]["index"] = int(pbr[tkey]["index"]) + tex_off
            for tkey in ("normalTexture", "occlusionTexture", "emissiveTexture"):
                if tkey in nmat and isinstance(nmat[tkey], dict) and "index" in nmat[tkey]:
                    nmat[tkey]["index"] = int(nmat[tkey]["index"]) + tex_off
            mats_list.append(nmat)

        mesh_off = len(mshs_list)
        for msh in src_gltf.get("meshes", []):  # type: ignore[union-attr]
            nmsh = copy.deepcopy(msh)
            for prim in nmsh.get("primitives", []):
                attrs = prim.get("attributes", {})
                for akey in list(attrs.keys()):
                    attrs[akey] = int(attrs[akey]) + acc_off
                if "indices" in prim:
                    prim["indices"] = int(prim["indices"]) + acc_off
                if "material" in prim:
                    prim["material"] = int(prim["material"]) + mat_off
                if "targets" in prim and isinstance(prim["targets"], list):
                    for tgt in prim["targets"]:
                        for tkey in list(tgt.keys()):
                            tgt[tkey] = int(tgt[tkey]) + acc_off
            mshs_list.append(nmsh)

        bmin, bmax = compute_glb_world_bounds(src_gltf, src_bin)
        info = {
            "acc_off": acc_off,
            "mesh_off": mesh_off,
            "bounds": (bmin, bmax),
            "src_gltf": src_gltf,
        }
        self._static_cache[cache_key] = info
        return info

    def add_mesh_parts_exact(self, parts: Sequence[MeshPart], cache_tag: str) -> List[int]:
        """Gắn trực tiếp các khối trang phục / mũ miện / binh khí 3D theo đúng hệ tọa độ gốc 1:1 (không co giãn)."""
        if not parts:
            return []
        regalia_glb = compile_glb_bytes(list(parts), [], cache_tag)
        src_gltf, src_bin = unpack_glb(regalia_glb)
        info = self._embed_resources_once(f"exact::{cache_tag}", src_gltf, src_bin)
        mesh_off = int(info["mesh_off"])  # type: ignore[arg-type]
        nodes_list: List[Dict[str, object]] = self.gltf["nodes"]  # type: ignore[assignment]
        scene_roots: List[int] = self.gltf["scenes"][0]["nodes"]  # type: ignore[index]

        node_off = len(nodes_list)
        added: List[int] = []
        for nd in src_gltf.get("nodes", []):  # type: ignore[union-attr]
            nnd = copy.deepcopy(nd)
            if "mesh" in nnd:
                nnd["mesh"] = int(nnd["mesh"]) + mesh_off
            if "children" in nnd:
                nnd["children"] = [int(c) + node_off for c in nnd["children"]]
            idx = len(nodes_list)
            nodes_list.append(nnd)
            added.append(idx)

        for r in src_gltf.get("scenes", [{}])[0].get("nodes", []):  # type: ignore[index]
            scene_roots.append(int(r) + node_off)
        return added

    def place_glb(
        self,
        glb_path: Path,
        instance_name: str,
        position: Tuple[float, float, float],
        target_size: float = 1.8,
        rot_y: float = 0.0,
        include_internal_animations: bool = True,
    ) -> int:
        cache_key = str(glb_path.resolve())
        if cache_key in self._static_cache:
            info = self._static_cache[cache_key]
            src_gltf: Dict[str, object] = info["src_gltf"]  # type: ignore[assignment]
        else:
            raw = glb_path.read_bytes()
            src_gltf, src_bin = unpack_glb(raw)
            info = self._embed_resources_once(cache_key, src_gltf, src_bin)

        acc_off = int(info["acc_off"])  # type: ignore[arg-type]
        mesh_off = int(info["mesh_off"])  # type: ignore[arg-type]
        bmin, bmax = info["bounds"]  # type: ignore[misc]

        nodes_list: List[Dict[str, object]] = self.gltf["nodes"]  # type: ignore[assignment]
        skins_list: List[Dict[str, object]] = self.gltf["skins"]  # type: ignore[assignment]
        anims_list: List[Dict[str, object]] = self.gltf["animations"]  # type: ignore[assignment]

        node_off = len(nodes_list)
        skin_off = len(skins_list)

        for nd in src_gltf.get("nodes", []):  # type: ignore[union-attr]
            nnd = copy.deepcopy(nd)
            orig_name = str(nnd.get("name", "ChiTiet"))
            nnd["name"] = f"{instance_name}_{orig_name}"
            if "mesh" in nnd:
                nnd["mesh"] = int(nnd["mesh"]) + mesh_off
            if "skin" in nnd:
                nnd["skin"] = int(nnd["skin"]) + skin_off
            if "children" in nnd:
                nnd["children"] = [int(c) + node_off for c in nnd["children"]]
            nodes_list.append(nnd)

        for sk in src_gltf.get("skins", []):  # type: ignore[union-attr]
            nsk = copy.deepcopy(sk)
            if "inverseBindMatrices" in nsk:
                nsk["inverseBindMatrices"] = int(nsk["inverseBindMatrices"]) + acc_off
            if "skeleton" in nsk:
                nsk["skeleton"] = int(nsk["skeleton"]) + node_off
            if "joints" in nsk:
                nsk["joints"] = [int(j) + node_off for j in nsk["joints"]]
            skins_list.append(nsk)

        if include_internal_animations and src_gltf.get("animations"):
            for a_idx, anim in enumerate(src_gltf.get("animations", [])):  # type: ignore[arg-type]
                nanim = copy.deepcopy(anim)
                nanim["name"] = f"HoatAnh_{instance_name}" if a_idx == 0 else f"HoatAnh_{instance_name}_{a_idx + 1}"
                for sm in nanim.get("samplers", []):
                    sm["input"] = int(sm["input"]) + acc_off
                    sm["output"] = int(sm["output"]) + acc_off
                for ch in nanim.get("channels", []):
                    tgt = ch.get("target", {})
                    if "node" in tgt:
                        tgt["node"] = int(tgt["node"]) + node_off
                anims_list.append(nanim)

                if anims_list and anims_list[0] is not nanim:
                    primary = anims_list[0]
                    s_base = len(primary["samplers"])
                    primary["samplers"].extend(copy.deepcopy(nanim["samplers"]))
                    for ch in copy.deepcopy(nanim["channels"]):
                        ch["sampler"] = int(ch["sampler"]) + s_base
                        primary["channels"].append(ch)

        src_scenes: List[Dict[str, object]] = list(src_gltf.get("scenes", []))  # type: ignore[arg-type]
        src_roots = [int(r) + node_off for r in (src_scenes[0].get("nodes", []) if src_scenes else [])]  # type: ignore[union-attr]

        span_x = max(1e-4, bmax[0] - bmin[0])
        span_y = max(1e-4, bmax[1] - bmin[1])
        span_z = max(1e-4, bmax[2] - bmin[2])
        max_span = max(span_x, span_y, span_z)
        s = target_size / max_span
        cx = (bmin[0] + bmax[0]) * 0.5
        cz = (bmin[2] + bmax[2]) * 0.5

        norm_idx = len(nodes_list)
        nodes_list.append(
            {
                "name": f"{instance_name}_ChuanHoa",
                "translation": [round(-cx * s, 5), round(-bmin[1] * s, 5), round(-cz * s, 5)],
                "scale": [round(s, 6), round(s, 6), round(s, 6)],
                "children": src_roots,
            }
        )

        place_idx = len(nodes_list)
        q = quat_from_euler_y(rot_y)
        nodes_list.append(
            {
                "name": instance_name,
                "translation": [round(position[0], 5), round(position[1], 5), round(position[2], 5)],
                "rotation": [round(q[0], 6), round(q[1], 6), round(q[2], 6), round(q[3], 6)],
                "children": [norm_idx],
            }
        )

        scene_roots: List[int] = self.gltf["scenes"][0]["nodes"]  # type: ignore[index]
        scene_roots.append(place_idx)
        return place_idx

    def add_node_animation_to_clip(
        self,
        clip_index: int,
        node_idx: int,
        path: str,
        times: Sequence[float],
        values: Sequence[float],
    ) -> None:
        anims_list: List[Dict[str, object]] = self.gltf["animations"]  # type: ignore[assignment]
        while len(anims_list) <= clip_index:
            anims_list.append({"name": f"ChuyenDongCanh_{len(anims_list) + 1}", "samplers": [], "channels": []})

        bvs_list: List[Dict[str, object]] = self.gltf["bufferViews"]  # type: ignore[assignment]
        accs_list: List[Dict[str, object]] = self.gltf["accessors"]  # type: ignore[assignment]

        t_bytes = struct.pack(f"<{len(times)}f", *times)
        t_off = self._append_bin(t_bytes)
        t_bv = len(bvs_list)
        bvs_list.append({"buffer": 0, "byteOffset": t_off, "byteLength": len(t_bytes)})
        in_acc = len(accs_list)
        accs_list.append(
            {
                "bufferView": t_bv,
                "componentType": 5126,
                "count": len(times),
                "type": "SCALAR",
                "min": [float(min(times))],
                "max": [float(max(times))],
            }
        )

        stride = 4 if path == "rotation" else 3
        v_bytes = struct.pack(f"<{len(values)}f", *values)
        v_off = self._append_bin(v_bytes)
        v_bv = len(bvs_list)
        bvs_list.append({"buffer": 0, "byteOffset": v_off, "byteLength": len(v_bytes)})
        out_acc = len(accs_list)
        accs_list.append(
            {
                "bufferView": v_bv,
                "componentType": 5126,
                "count": len(values) // stride,
                "type": "VEC4" if stride == 4 else "VEC3",
            }
        )

        clip = anims_list[clip_index]
        smp_idx = len(clip["samplers"])  # type: ignore[arg-type]
        clip["samplers"].append({"input": in_acc, "interpolation": "LINEAR", "output": out_acc})  # type: ignore[union-attr]
        clip["channels"].append({"sampler": smp_idx, "target": {"node": node_idx, "path": path}})  # type: ignore[union-attr]

    def export_bytes(self) -> bytes:
        for key in ("images", "textures", "samplers", "skins", "animations", "extensionsUsed"):
            if not self.gltf.get(key):
                self.gltf.pop(key, None)
        return pack_glb(self.gltf, b"".join(self.bin_chunks))


# ==============================================================================
# BỘ CHẾ TÁC CỔ PHỤC LỊCH SỬ VIỆT NAM CHO NHÂN VẬT 3D (.GLB)
# ==============================================================================


def build_regalia_for_archetype(archetype: str) -> List[MeshPart]:
    """
    Chế tác mũ miện, cổ áo Giao Lĩnh / Nhật Bình / Ngũ Thân, bổ tử, đai ngọc, tà áo thon thả, giáp trụ và binh khí 3D
    ôm sát tỷ lệ cơ thể tư thế đứng tự nhiên (A-pose) của TranThiNgocTham.glb (cao 1.765m) và Thanh.glb (cao 1.856m).
    """
    parts: List[MeshPart] = []

    if archetype == "noble_lady_nhat_binh":
        # Nữ Quý tộc / Nữ Tướng Đại Việt: Khăn vấn hoàng kim + Trâm phượng + Cổ Nhật Bình gấm đỏ thêu vàng + Tà áo buông thon
        khan_van = MeshPart("CoPhuc_Khan_Van_Hoang_Kim", (0.78, 0.56, 0.16, 1.0), metallic=0.45, roughness=0.34)
        khan_van.add_frustum(0.112, 0.106, 0.062, 22, 0.0, 1.712, 0.028, tilt_x=-0.06)
        khan_van.add_frustum(0.120, 0.114, 0.038, 22, 0.0, 1.744, 0.025, tilt_x=-0.06)
        parts.append(khan_van)

        tram_ngoc = MeshPart("CoPhuc_Tram_Cai_Phuong", (0.64, 0.08, 0.12, 1.0), metallic=0.25, roughness=0.32)
        tram_ngoc.add_box(0.042, 0.042, 0.020, 0.0, 1.742, 0.142)
        parts.append(tram_ngoc)

        ta_ao = MeshPart("CoPhuc_Ta_Ao_Giao_Linh_Nhat_Binh", (0.42, 0.05, 0.08, 1.0), metallic=0.06, roughness=0.66)
        # Vạt trước và vạt sau thon gọn ôm thân, buông mềm từ thắt lưng xuống cổ chân (không chèn khối hộp ở bắp tay)
        ta_ao.add_box(0.28, 0.78, 0.018, 0.0, 0.62, 0.132, tilt_x=0.025)
        ta_ao.add_box(0.29, 0.78, 0.018, 0.0, 0.62, -0.092, tilt_x=-0.025)
        parts.append(ta_ao)

        vien_kim = MeshPart("CoPhuc_Hoa_Van_Nhat_Binh_Dai_Lung", (0.82, 0.62, 0.18, 1.0), metallic=0.46, roughness=0.33)
        # Hoa văn cổ Nhật Bình chữ nhật trước ngực + Đai ngọc vừa khít vòng eo + Dải thêu trung tâm
        vien_kim.add_box(0.20, 0.11, 0.016, 0.0, 1.37, 0.146, tilt_x=-0.08)
        vien_kim.add_box(0.295, 0.050, 0.215, 0.0, 1.03, 0.020)
        vien_kim.add_box(0.065, 0.72, 0.022, 0.0, 0.63, 0.138, tilt_x=0.025)
        parts.append(vien_kim)

    elif archetype == "folk_woman_ao_ngu_than_non_la":
        # Phụ nữ Việt Nam truyền thống: Nón lá tre đan thanh thoát + Áo Ngũ Thân lụa nâu non + Dải lụa thắt eo
        non_la = MeshPart("CoPhuc_Non_La_Truyen_Thong", (0.76, 0.67, 0.46, 1.0), metallic=0.04, roughness=0.78)
        non_la.add_frustum(0.014, 0.275, 0.175, 24, 0.0, 1.80, 0.028, tilt_x=-0.08)
        parts.append(non_la)

        quai_non = MeshPart("CoPhuc_Quai_Lua_Va_Dai_Ao", (0.58, 0.12, 0.15, 1.0), metallic=0.06, roughness=0.62)
        quai_non.add_box(0.29, 0.046, 0.21, 0.0, 1.025, 0.020)
        quai_non.add_box(0.05, 0.60, 0.018, 0.075, 0.69, 0.138, tilt_x=0.025)
        parts.append(quai_non)

        ao_ngu_than = MeshPart("CoPhuc_Ta_Ao_Ngu_Than", (0.38, 0.19, 0.15, 1.0), metallic=0.04, roughness=0.74)
        ao_ngu_than.add_box(0.27, 0.75, 0.018, 0.0, 0.63, 0.130, tilt_x=0.02)
        ao_ngu_than.add_box(0.28, 0.75, 0.018, 0.0, 0.63, -0.090, tilt_x=-0.02)
        parts.append(ao_ngu_than)

    elif archetype == "general_dau_mau_armor":
        # Võ Tướng Đại Việt (Ngô Quyền / Lê Lợi / Danh tướng): Mũ Đâu Mâu đồng thau chóp đỏ + Hộ tâm kính + Giáp đùi + Chiến bào đỏ + Bảo kiếm
        helmet = MeshPart("CoPhuc_Mu_Dau_Mau_Giap_Dong", (0.74, 0.55, 0.19, 1.0), metallic=0.68, roughness=0.28)
        helmet.add_frustum(0.040, 0.112, 0.160, 18, 0.0, 1.885, 0.014)
        helmet.add_frustum(0.114, 0.132, 0.042, 18, 0.0, 1.805, 0.010)
        helmet.add_frustum(0.012, 0.024, 0.075, 10, 0.0, 1.985, 0.014)
        # Hộ tâm kính tròn trước ngực + giáp vai gọn + đai lưng đồng ôm hông + giáp đùi
        helmet.add_frustum(0.082, 0.082, 0.022, 16, 0.0, 1.37, 0.142, tilt_x=1.57)
        helmet.add_box(0.12, 0.065, 0.18, -0.205, 1.50, -0.005, rot_y=0.05)
        helmet.add_box(0.12, 0.065, 0.18, 0.205, 1.50, -0.005, rot_y=-0.05)
        helmet.add_box(0.335, 0.060, 0.245, 0.0, 1.04, 0.008)
        helmet.add_box(0.135, 0.36, 0.024, -0.095, 0.82, 0.138, tilt_x=0.03)
        helmet.add_box(0.135, 0.36, 0.024, 0.095, 0.82, 0.138, tilt_x=0.03)
        parts.append(helmet)

        cape = MeshPart("CoPhuc_Chien_Bao_Do_Va_Chop_Mu", (0.56, 0.08, 0.10, 1.0), metallic=0.08, roughness=0.68)
        cape.add_frustum(0.044, 0.014, 0.115, 10, 0.0, 2.055, -0.005, tilt_x=-0.25)
        cape.add_box(0.38, 1.08, 0.020, 0.0, 0.88, -0.138, tilt_x=-0.04)
        cape.add_box(0.11, 0.42, 0.020, 0.0, 0.78, 0.144, tilt_x=0.03)
        parts.append(cape)

        sword = MeshPart("BinhKhi_Bao_Kiem_Dai_Viet", (0.76, 0.80, 0.84, 1.0), metallic=0.84, roughness=0.19)
        sword.add_box(0.030, 0.15, 0.030, -0.34, 0.94, 0.06, tilt_x=0.58)
        sword.add_box(0.12, 0.026, 0.038, -0.34, 1.01, 0.11, tilt_x=0.58)
        sword.add_box(0.016, 0.74, 0.040, -0.34, 1.32, 0.32, tilt_x=0.58)
        parts.append(sword)

    elif archetype == "naval_warrior_bach_dang":
        # Tướng / Thủy binh Ngô Quyền Thế kỷ X: Khăn chít đầu đỏ + Giáp ngực đồng da + Trường thương cờ lệnh
        headband = MeshPart("CoPhuc_Khan_Chit_Dau_Thuy_Quan", (0.62, 0.09, 0.11, 1.0), metallic=0.06, roughness=0.70)
        headband.add_frustum(0.103, 0.101, 0.050, 18, 0.0, 1.785, 0.014)
        headband.add_box(0.06, 0.20, 0.018, 0.0, 1.68, -0.102, tilt_x=-0.18)
        headband.add_box(0.33, 0.058, 0.24, 0.0, 1.04, 0.008)
        headband.add_box(0.26, 0.40, 0.020, 0.0, 0.80, 0.136, tilt_x=0.025)
        parts.append(headband)

        cuirass = MeshPart("CoPhuc_Ho_Tam_Dong_Thuy_Binh", (0.68, 0.50, 0.19, 1.0), metallic=0.62, roughness=0.32)
        cuirass.add_box(0.25, 0.28, 0.022, 0.0, 1.34, 0.138)
        cuirass.add_box(0.25, 0.28, 0.022, 0.0, 1.34, -0.126)
        parts.append(cuirass)

        spear_shaft = MeshPart("BinhKhi_Truong_Thuong_Bach_Dang", (0.40, 0.24, 0.11, 1.0), metallic=0.12, roughness=0.72)
        spear_shaft.add_frustum(0.017, 0.021, 2.24, 10, -0.35, 1.12, 0.10)
        parts.append(spear_shaft)

        spear_tip = MeshPart("BinhKhi_Mui_Thuong_Thep", (0.78, 0.82, 0.86, 1.0), metallic=0.85, roughness=0.18)
        spear_tip.add_frustum(0.004, 0.034, 0.27, 8, -0.35, 2.36, 0.10)
        parts.append(spear_tip)

        pennant = MeshPart("BinhKhi_Co_Lenh_Ngo_Quyen", (0.74, 0.12, 0.12, 1.0), metallic=0.08, roughness=0.65)
        pennant.add_box(0.38, 0.24, 0.018, -0.15, 2.06, 0.10)
        parts.append(pennant)

    elif archetype == "insurgent_lam_son":
        # Nghĩa quân Lam Sơn Thế kỷ XV: Nón gõ tre đan + Áo chàm đai vải + Khiên mây đan tay trái + Giáo dài tay phải
        hat_shield = MeshPart("CoPhuc_Non_Go_Va_Khien_May_Lam_Son", (0.68, 0.52, 0.28, 1.0), metallic=0.08, roughness=0.76)
        hat_shield.add_frustum(0.020, 0.225, 0.140, 20, 0.0, 1.865, 0.014)
        # Khiên mây đan tròn gắn sát cẳng tay trái (+0.36, 1.02, 0.08)
        hat_shield.add_frustum(0.245, 0.265, 0.034, 20, 0.36, 1.02, 0.08, tilt_z=1.45)
        parts.append(hat_shield)

        boss_spear = MeshPart("BinhKhi_Num_Dong_Va_Mui_Giao", (0.72, 0.58, 0.24, 1.0), metallic=0.72, roughness=0.26)
        boss_spear.add_frustum(0.060, 0.080, 0.045, 12, 0.38, 1.02, 0.08, tilt_z=1.45)
        boss_spear.add_frustum(0.004, 0.032, 0.26, 8, -0.35, 2.32, 0.09)
        parts.append(boss_spear)

        sash = MeshPart("CoPhuc_Dai_Vai_Nghia_Quan", (0.56, 0.12, 0.12, 1.0), metallic=0.05, roughness=0.74)
        sash.add_box(0.33, 0.058, 0.24, 0.0, 1.04, 0.008)
        sash.add_box(0.27, 0.38, 0.018, 0.0, 0.82, 0.135, tilt_x=0.025)
        parts.append(sash)

        pole = MeshPart("BinhKhi_Can_Giao_Tre_Lam_Son", (0.44, 0.29, 0.14, 1.0), metallic=0.10, roughness=0.75)
        pole.add_frustum(0.016, 0.020, 2.20, 10, -0.35, 1.10, 0.09)
        parts.append(pole)

    elif archetype == "court_scholar_mandarin":
        # Quan Đại Thần / Danh Nho (Nguyễn Trãi / Hồ Nguyên Trừng): Mũ Ô Sa Cánh Chuồn + Bổ tử Hạc vàng + Áo Giao Lĩnh chàm + Chiếu thư
        cap = MeshPart("CoPhuc_Mu_Canh_Chuon_Quan_Dai_Than", (0.11, 0.12, 0.15, 1.0), metallic=0.18, roughness=0.45)
        cap.add_frustum(0.095, 0.104, 0.105, 20, 0.0, 1.845, 0.012)
        cap.add_frustum(0.080, 0.092, 0.092, 18, 0.0, 1.928, -0.018)
        cap.add_box(0.44, 0.044, 0.014, 0.0, 1.88, -0.035)
        parts.append(cap)

        robe = MeshPart("CoPhuc_Ta_Ao_Giao_Linh_Dai_Trieu", (0.09, 0.17, 0.34, 1.0), metallic=0.06, roughness=0.66)
        robe.add_box(0.32, 0.82, 0.020, 0.0, 0.60, 0.136, tilt_x=0.02)
        robe.add_box(0.33, 0.82, 0.020, 0.0, 0.60, -0.126, tilt_x=-0.02)
        parts.append(robe)

        badge_scroll = MeshPart("CoPhuc_Bo_Tu_Dai_Ngoc_Chieu_Thu", (0.82, 0.64, 0.20, 1.0), metallic=0.42, roughness=0.34)
        badge_scroll.add_box(0.165, 0.165, 0.018, 0.0, 1.35, 0.142)
        badge_scroll.add_box(0.34, 0.054, 0.245, 0.0, 1.04, 0.008)
        badge_scroll.add_frustum(0.024, 0.024, 0.32, 12, 0.35, 0.96, 0.10, tilt_z=1.35)
        parts.append(badge_scroll)

    return parts


def build_historical_human_glb(
    raw_glb_bytes: bytes,
    is_female: bool,
    archetype: str,
    source_repo: str,
) -> bytes:
    """
    Chuyển đổi mô hình người 3D sang cổ phục lịch sử từng thời kỳ & tối ưu hóa dung lượng < 650KB/người:
      - Xóa triệt để lưới Wolf3D_Glasses (kính sừng tuần lộc Giáng sinh).
      - Cắt bỏ 252 morph targets khẩu hình ARKit không sử dụng (giảm ~4MB/người -> tải tức thì qua Cloud Run).
      - Dệt vải gấm Nhật Bình, Giao Lĩnh, Ngũ Thân, giáp đồng sơn son & hài mun cổ truyền thay thế hoàn toàn trang phục hiện đại.
      - Gắn trang phục – mũ miện – binh khí 3D đa bộ phận chuẩn tỷ lệ 1:1.
    """
    g, raw_bin = unpack_glb(raw_glb_bytes)
    nodes: List[Dict[str, object]] = list(g.get("nodes", []))  # type: ignore[arg-type]
    meshes_list: List[Dict[str, object]] = list(g.get("meshes", []))  # type: ignore[arg-type]
    accessors: List[Dict[str, object]] = list(g.get("accessors", []))  # type: ignore[arg-type]
    materials: List[Dict[str, object]] = list(g.get("materials", []))  # type: ignore[arg-type]
    textures: List[Dict[str, object]] = list(g.get("textures", []))  # type: ignore[arg-type]
    images: List[Dict[str, object]] = list(g.get("images", []))  # type: ignore[arg-type]
    old_views: List[Dict[str, object]] = list(g.get("bufferViews", []))  # type: ignore[arg-type]

    # 1. Xóa triệt để mắt kính hiện đại Wolf3D_Glasses & cắt bỏ morph targets dư thừa
    glasses_node_indices = set()
    for idx, nd in enumerate(nodes):
        nd.pop("weights", None)
        if "glasses" in str(nd.get("name", "")).lower():
            nd.pop("mesh", None)
            nd.pop("skin", None)
            glasses_node_indices.add(idx)
    if glasses_node_indices:
        for nd in nodes:
            if "children" in nd and isinstance(nd["children"], list):
                nd["children"] = [c for c in nd["children"] if int(c) not in glasses_node_indices]
        for sc in g.get("scenes", []):  # type: ignore[union-attr]
            if "nodes" in sc and isinstance(sc["nodes"], list):
                sc["nodes"] = [n for n in sc["nodes"] if int(n) not in glasses_node_indices]

    for msh in meshes_list:
        msh.pop("weights", None)
        if isinstance(msh.get("extras"), dict):
            msh["extras"].pop("targetNames", None)  # type: ignore[union-attr]
        for prim in msh.get("primitives", []):  # type: ignore[union-attr]
            prim.pop("targets", None)

    # 2. Ánh xạ phong cách vải lịch sử cho từng nguyên mẫu nhân vật
    style_map: Dict[str, Tuple[str, str, str, float, float]] = {
        "noble_lady_nhat_binh": ("brocade_crimson_gold", "trousers_silk_dark", "footwear_embroidered", 0.58, 0.10),
        "folk_woman_ao_ngu_than_non_la": ("silk_lotus_ao_ngu_than", "trousers_silk_dark", "footwear_embroidered", 0.72, 0.04),
        "general_dau_mau_armor": ("lamellar_bronze_crimson", "armor_greaves_bronze", "footwear_embroidered", 0.38, 0.42),
        "naval_warrior_bach_dang": ("naval_leather_crimson", "armor_greaves_bronze", "footwear_embroidered", 0.52, 0.24),
        "insurgent_lam_son": ("hemp_lam_son", "trousers_silk_dark", "footwear_embroidered", 0.80, 0.04),
        "court_scholar_mandarin": ("brocade_indigo_jade", "trousers_silk_dark", "footwear_embroidered", 0.62, 0.08),
        "modern_citizen_f": ("modern_coat_ivory", "trousers_silk_dark", "footwear_embroidered", 0.66, 0.05),
        "modern_citizen_m": ("modern_coat_navy", "trousers_silk_dark", "footwear_embroidered", 0.66, 0.05),
    }
    top_style, bot_style, shoe_style, out_rough, out_metal = style_map.get(
        archetype, ("brocade_crimson_gold", "trousers_silk_dark", "footwear_embroidered", 0.65, 0.08)
    )

    replaced_img_bytes: Dict[int, bytes] = {}

    def set_mat_base_png(mat: Dict[str, object], png_data: bytes, strip_relief: bool, rough: float, metal: float) -> None:
        pbr = mat.setdefault("pbrMetallicRoughness", {})
        if isinstance(pbr, dict):
            bct = pbr.get("baseColorTexture")
            if isinstance(bct, dict) and "index" in bct:
                t_idx = int(bct["index"])
                if 0 <= t_idx < len(textures) and "source" in textures[t_idx]:
                    im_idx = int(textures[t_idx]["source"])  # type: ignore[arg-type]
                    replaced_img_bytes[im_idx] = png_data
                    images[im_idx]["mimeType"] = "image/png"
            pbr["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
            pbr["roughnessFactor"] = rough
            pbr["metallicFactor"] = metal
            if strip_relief:
                pbr.pop("metallicRoughnessTexture", None)
        if strip_relief:
            mat.pop("normalTexture", None)
            mat.pop("occlusionTexture", None)
        mat["doubleSided"] = True

    for mat in materials:
        mname = str(mat.get("name", "")).lower()
        if is_female and "hair" in mname:
            set_mat_base_png(mat, make_historical_png("ebony_hair"), strip_relief=False, rough=0.52, metal=0.04)
        elif "outfit_top" in mname:
            set_mat_base_png(mat, make_historical_png(top_style), strip_relief=True, rough=out_rough, metal=out_metal)
        elif "outfit_bottom" in mname:
            set_mat_base_png(mat, make_historical_png(bot_style), strip_relief=True, rough=0.72, metal=0.06)
        elif "outfit_footwear" in mname:
            set_mat_base_png(mat, make_historical_png(shoe_style), strip_relief=True, rough=0.68, metal=0.04)
        elif "glasses" in mname:
            set_mat_base_png(mat, make_historical_png("trousers_silk_dark", 16, 16), strip_relief=True, rough=0.8, metal=0.0)

    # 3. Lọc sạch các accessor & bufferView đang thực sự được sử dụng (loại bỏ ~4.0MB morph targets)
    active_mesh_indices = {int(nd["mesh"]) for nd in nodes if "mesh" in nd}  # type: ignore[arg-type]
    for m_idx, msh in enumerate(meshes_list):
        if m_idx not in active_mesh_indices:
            msh["primitives"] = []

    used_acc_set = set()
    for msh in meshes_list:
        for prim in msh.get("primitives", []):  # type: ignore[union-attr]
            for a_i in prim.get("attributes", {}).values():
                used_acc_set.add(int(a_i))
            if "indices" in prim:
                used_acc_set.add(int(prim["indices"]))
    for sk in g.get("skins", []):  # type: ignore[union-attr]
        if "inverseBindMatrices" in sk:
            used_acc_set.add(int(sk["inverseBindMatrices"]))
    for anim in g.get("animations", []):  # type: ignore[union-attr]
        for smp in anim.get("samplers", []):
            used_acc_set.add(int(smp["input"]))
            used_acc_set.add(int(smp["output"]))

    sorted_accs = sorted(used_acc_set)
    acc_remap = {old_i: new_i for new_i, old_i in enumerate(sorted_accs)}
    new_accessors = [copy.deepcopy(accessors[old_i]) for old_i in sorted_accs]

    for msh in meshes_list:
        for prim in msh.get("primitives", []):  # type: ignore[union-attr]
            attrs = prim.get("attributes", {})
            for k in list(attrs.keys()):
                attrs[k] = acc_remap[int(attrs[k])]
            if "indices" in prim:
                prim["indices"] = acc_remap[int(prim["indices"])]
    for sk in g.get("skins", []):  # type: ignore[union-attr]
        if "inverseBindMatrices" in sk:
            sk["inverseBindMatrices"] = acc_remap[int(sk["inverseBindMatrices"])]
    for anim in g.get("animations", []):  # type: ignore[union-attr]
        for smp in anim.get("samplers", []):
            smp["input"] = acc_remap[int(smp["input"])]
            smp["output"] = acc_remap[int(smp["output"])]
    g["accessors"] = new_accessors

    active_mat_indices = {
        int(prim["material"])
        for m_i in active_mesh_indices
        if 0 <= m_i < len(meshes_list)
        for prim in meshes_list[m_i].get("primitives", [])  # type: ignore[union-attr]
        if "material" in prim
    }
    referenced_tex_indices = set()
    for m_i in active_mat_indices:
        if 0 <= m_i < len(materials):
            mat = materials[m_i]
            pbr = mat.get("pbrMetallicRoughness", {})
            if isinstance(pbr, dict):
                for tk in ("baseColorTexture", "metallicRoughnessTexture"):
                    if tk in pbr and isinstance(pbr[tk], dict) and "index" in pbr[tk]:
                        referenced_tex_indices.add(int(pbr[tk]["index"]))
            for tk in ("normalTexture", "occlusionTexture", "emissiveTexture"):
                if tk in mat and isinstance(mat[tk], dict) and "index" in mat[tk]:
                    referenced_tex_indices.add(int(mat[tk]["index"]))

    referenced_img_indices = {
        int(textures[t_i]["source"])  # type: ignore[arg-type]
        for t_i in referenced_tex_indices
        if 0 <= t_i < len(textures) and "source" in textures[t_i]
    }

    img_bv_override: Dict[int, bytes] = {}
    tiny_png = make_historical_png("trousers_silk_dark", 4, 4)
    for im_idx, im in enumerate(images):
        bv_idx = im.get("bufferView")
        if not isinstance(bv_idx, int) or not (0 <= bv_idx < len(old_views)):
            continue
        if im_idx not in referenced_img_indices:
            im["mimeType"] = "image/png"
            img_bv_override[bv_idx] = tiny_png
        elif im_idx in replaced_img_bytes:
            img_bv_override[bv_idx] = replaced_img_bytes[im_idx]
        else:
            bv = old_views[bv_idx]
            off = int(bv.get("byteOffset", 0))
            ln = int(bv.get("byteLength", 0))
            mime = str(im.get("mimeType") or "image/png")
            opt_bytes, opt_mime = optimize_image_bytes(raw_bin[off : off + ln], mime, 512)
            im["mimeType"] = opt_mime
            img_bv_override[bv_idx] = opt_bytes

    used_bv_set = set()
    for acc in new_accessors:
        if "bufferView" in acc:
            used_bv_set.add(int(acc["bufferView"]))
        if "sparse" in acc and isinstance(acc["sparse"], dict):
            sp = acc["sparse"]
            if "indices" in sp and "bufferView" in sp["indices"]:
                used_bv_set.add(int(sp["indices"]["bufferView"]))
            if "values" in sp and "bufferView" in sp["values"]:
                used_bv_set.add(int(sp["values"]["bufferView"]))
    for im in images:
        if "bufferView" in im:
            used_bv_set.add(int(im["bufferView"]))

    sorted_bvs = sorted(used_bv_set)
    bv_remap = {old_bv: new_bv for new_bv, old_bv in enumerate(sorted_bvs)}
    for acc in new_accessors:
        if "bufferView" in acc:
            acc["bufferView"] = bv_remap[int(acc["bufferView"])]
        if "sparse" in acc and isinstance(acc["sparse"], dict):
            sp = acc["sparse"]
            if "indices" in sp and "bufferView" in sp["indices"]:
                sp["indices"]["bufferView"] = bv_remap[int(sp["indices"]["bufferView"])]
            if "values" in sp and "bufferView" in sp["values"]:
                sp["values"]["bufferView"] = bv_remap[int(sp["values"]["bufferView"])]
    for im in images:
        if "bufferView" in im:
            im["bufferView"] = bv_remap[int(im["bufferView"])]

    new_views: List[Dict[str, object]] = []
    chunks: List[bytes] = []
    cur_offset = 0
    for old_bv_idx in sorted_bvs:
        bv = old_views[old_bv_idx]
        if old_bv_idx in img_bv_override:
            chunk = img_bv_override[old_bv_idx]
        else:
            off = int(bv.get("byteOffset", 0))
            ln = int(bv.get("byteLength", 0))
            chunk = raw_bin[off : off + ln]
        pad = (4 - (len(chunk) % 4)) % 4
        nbv = copy.deepcopy(bv)
        nbv["buffer"] = 0
        nbv["byteOffset"] = cur_offset
        nbv["byteLength"] = len(chunk)
        new_views.append(nbv)
        chunks.append(chunk + (b"\x00" * pad))
        cur_offset += len(chunk) + pad

    g["bufferViews"] = new_views
    asset_meta = g.setdefault("asset", {})
    if isinstance(asset_meta, dict):
        asset_meta["version"] = "2.0"
        asset_meta["generator"] = ENHANCED_GENERATOR
        asset_meta["extras"] = {"sourceRepository": source_repo, "historicalArchetype": archetype}

    retextured_avatar_glb = pack_glb(g, b"".join(chunks))

    # 4. Gắn thêm các bộ phận cổ phục – mũ miện – giáp trụ – binh khí 3D khớp 1:1
    regalia_parts = build_regalia_for_archetype(archetype)
    if not regalia_parts:
        return retextured_avatar_glb

    composer = GlbSceneComposer(retextured_avatar_glb, f"NhanVatLichSu_{archetype}")
    composer.add_mesh_parts_exact(regalia_parts, f"Regalia_{archetype}")
    return composer.export_bytes()


def ensure_curated_asset_pack(pack_dir: Path) -> Dict[str, Path]:
    """Đảm bảo toàn bộ tài nguyên .glb từ 5 kho GitHub và 8 nguyên mẫu nhân vật cổ phục đã sẵn sàng tại pack_dir."""
    pack_dir.mkdir(parents=True, exist_ok=True)
    resolved: Dict[str, Path] = {}

    # 1. Bộ nạp lười (in-memory) mô hình người gốc chỉ khi cần biên dịch lại cổ phục (không lưu tệp _raw_*.glb thừa)
    raw_human_bytes: Dict[str, bytes] = {}

    def get_raw_human_bytes(raw_key: str) -> bytes:
        if raw_key not in raw_human_bytes:
            raw_fname, raw_url = RAW_HUMAN_URLS[raw_key]
            legacy_raw_path = pack_dir / raw_fname
            if legacy_raw_path.exists() and legacy_raw_path.stat().st_size >= 10_000:
                raw_human_bytes[raw_key] = legacy_raw_path.read_bytes()
            else:
                raw_glb = http_get_bytes(raw_url)
                g_raw, b_raw = unpack_glb(raw_glb)
                raw_human_bytes[raw_key] = beautify_and_repack_gltf(
                    g_raw, b_raw, max_tex_px=512, source_repo="hmthanh/3d-human-model"
                )
        return raw_human_bytes[raw_key]

    # 2. Chế tác các mô hình Người 3D mặc cổ phục đúng lịch sử
    for h_key, h_spec in HISTORICAL_HUMAN_ARCHETYPES.items():
        out_path = pack_dir / str(h_spec["filename"])
        must_rebuild = not out_path.exists() or out_path.stat().st_size < 1024
        if not must_rebuild:
            try:
                g_chk, _ = unpack_glb(out_path.read_bytes())
                gen = str(g_chk.get("asset", {}).get("generator", ""))  # type: ignore[union-attr]
                has_glasses = any("glasses" in str(nd.get("name", "")).lower() and "mesh" in nd for nd in g_chk.get("nodes", []))  # type: ignore[union-attr]
                if gen != ENHANCED_GENERATOR or has_glasses:
                    must_rebuild = True
            except Exception:
                must_rebuild = True

        if must_rebuild:
            base_bytes = get_raw_human_bytes(str(h_spec["base_raw"]))
            costumed_glb = build_historical_human_glb(
                base_bytes,
                is_female=bool(h_spec["is_female"]),
                archetype=str(h_spec["archetype"]),
                source_repo=str(h_spec["source_repo"]),
            )
            out_path.write_bytes(costumed_glb)
        resolved[h_key] = out_path

    # 3. Đảm bảo các mô hình Thuyền, Xe cộ, Động vật & Cây cối cảnh quan
    for key, spec in ASSET_CATALOG.items():
        out_path = pack_dir / str(spec["filename"])
        if not out_path.exists() or out_path.stat().st_size < 128:
            if spec["type"] == "glb":
                raw_glb = http_get_bytes(str(spec["url"]))
                g, bin_blob = unpack_glb(raw_glb)
                clean_glb = beautify_and_repack_gltf(
                    g,
                    bin_blob,
                    max_tex_px=int(spec.get("max_tex_px", 512)),  # type: ignore[arg-type]
                    roughness=float(spec.get("roughness", 0.70)),  # type: ignore[arg-type]
                    metallic=float(spec.get("metallic", 0.06)),  # type: ignore[arg-type]
                    alpha_mask=bool(spec.get("alpha_mask", False)),
                    source_repo=str(spec.get("source_repo", "")),
                )
                out_path.write_bytes(clean_glb)
            else:
                clean_glb = download_and_convert_gltf_to_glb(spec)
                out_path.write_bytes(clean_glb)
        resolved[key] = out_path

    return resolved


# ==============================================================================
# CÁC HÀM KIẾN TRÚC LỊCH SỬ ĐẠI VIỆT (ĐÌNH ĐIỆN, CHÒI CANH, DOANH TRẠI, CẦU ĐÁ, NÚI)
# ==============================================================================


def add_viet_temple_hall(
    meshes: List[MeshPart],
    prefix: str,
    pos: Tuple[float, float, float],
    rot_y: float = 0.0,
    scale_f: float = 1.0,
    roof_rgba: Tuple[float, float, float, float] = (0.48, 0.12, 0.09, 1.0),
) -> None:
    """Kiến trúc Điện / Đình cổ truyền Việt Nam: nền đá xanh tam cấp, hàng cột gỗ lim sơn son, mái ngói hai tầng đao cong."""
    quat = quat_from_euler_y(rot_y)
    sv = (scale_f, scale_f, scale_f) if abs(scale_f - 1.0) > 1e-4 else None

    plinth = MeshPart(f"{prefix}_Nen_Da_Tam_Cap", (0.44, 0.44, 0.40, 1.0), metallic=0.06, roughness=0.84, translation=pos, rotation=quat, scale=sv)
    plinth.add_box(6.4, 0.36, 4.4, 0.0, 0.18, 0.0)
    plinth.add_box(5.8, 0.26, 3.8, 0.0, 0.48, 0.0)
    plinth.add_box(1.8, 0.30, 0.9, 0.0, 0.22, 2.25, tilt_x=0.28)
    meshes.append(plinth)

    pillars = MeshPart(f"{prefix}_Cot_Go_Lim_Son_Son", (0.38, 0.10, 0.08, 1.0), metallic=0.10, roughness=0.64, translation=pos, rotation=quat, scale=sv)
    for px in (-2.4, -1.2, 0.0, 1.2, 2.4):
        for pz in (-1.45, 1.45):
            pillars.add_frustum(0.11, 0.13, 2.15, 10, px, 1.68, pz)
    pillars.add_box(4.6, 1.85, 0.18, 0.0, 1.54, -1.35)
    pillars.add_box(0.18, 1.85, 2.7, -2.35, 1.54, 0.0)
    pillars.add_box(0.18, 1.85, 2.7, 2.35, 1.54, 0.0)
    meshes.append(pillars)

    roof = MeshPart(f"{prefix}_Mai_Ngoi_Dao_Cong", roof_rgba, metallic=0.08, roughness=0.68, translation=pos, rotation=quat, scale=sv)
    roof.add_box(6.9, 0.26, 2.5, 0.0, 2.95, 0.95, tilt_x=0.42)
    roof.add_box(6.9, 0.26, 2.5, 0.0, 2.95, -0.95, tilt_x=-0.42)
    roof.add_box(5.2, 0.24, 1.9, 0.0, 3.65, 0.68, tilt_x=0.46)
    roof.add_box(5.2, 0.24, 1.9, 0.0, 3.65, -0.68, tilt_x=-0.46)
    # Đầu đao cong bốn góc mái cổ truyền
    for sx in (-1.0, 1.0):
        for sz in (-1.0, 1.0):
            roof.add_box(0.55, 0.18, 0.55, sx * 3.35, 2.78, sz * 1.95, tilt_x=-sz * 0.45, rot_y=sx * 0.4)
    meshes.append(roof)

    ridge = MeshPart(f"{prefix}_Bo_Noc_Hoang_Kim", (0.78, 0.58, 0.18, 1.0), metallic=0.42, roughness=0.36, translation=pos, rotation=quat, scale=sv)
    ridge.add_box(5.3, 0.20, 0.22, 0.0, 4.02, 0.0)
    ridge.add_frustum(0.08, 0.18, 0.36, 10, 0.0, 4.28, 0.0)
    meshes.append(ridge)


def add_watchtower_and_camp(
    meshes: List[MeshPart],
    prefix: str,
    pos: Tuple[float, float, float],
    rot_y: float = 0.0,
) -> None:
    """Chòi canh gỗ 4 trụ cao + trống trận + lều trướng chỉ huy quân sự cổ truyền."""
    quat = quat_from_euler_y(rot_y)
    timber = MeshPart(f"{prefix}_Choi_Canh_Go", (0.38, 0.24, 0.12, 1.0), metallic=0.08, roughness=0.78, translation=pos, rotation=quat)
    for lx in (-0.95, 0.95):
        for lz in (-0.95, 0.95):
            timber.add_frustum(0.09, 0.12, 3.6, 8, lx, 1.80, lz)
    timber.add_box(2.35, 0.16, 2.35, 0.0, 2.75, 0.0)
    for rx, rz, rw, rd in ((0.0, 1.12, 2.3, 0.08), (0.0, -1.12, 2.3, 0.08), (-1.12, 0.0, 0.08, 2.3), (1.12, 0.0, 0.08, 2.3)):
        timber.add_box(rw, 0.55, rd, rx, 3.08, rz)
    timber.add_frustum(0.32, 0.28, 0.42, 14, 0.0, 3.12, 0.35, tilt_x=1.57)
    meshes.append(timber)

    thatch = MeshPart(f"{prefix}_Mai_Choi_Va_Truong_Chi_Huy", (0.60, 0.48, 0.28, 1.0), metallic=0.04, roughness=0.86, translation=pos, rotation=quat)
    thatch.add_frustum(0.12, 1.85, 0.95, 4, 0.0, 4.05, 0.0)
    thatch.add_box(3.4, 1.65, 2.6, 3.6, 0.82, 0.0)
    thatch.add_frustum(0.25, 2.45, 1.15, 4, 3.6, 2.15, 0.0)
    meshes.append(thatch)

    banner = MeshPart(f"{prefix}_Co_Dai_Tuong", (0.68, 0.10, 0.10, 1.0), metallic=0.10, roughness=0.62, translation=pos, rotation=quat)
    banner.add_frustum(0.04, 0.05, 4.6, 8, 2.1, 2.3, 1.35)
    banner.add_box(1.25, 0.78, 0.04, 2.72, 4.05, 1.35)
    meshes.append(banner)


def add_village_houses(
    meshes: List[MeshPart],
    prefix: str,
    coords: Sequence[Tuple[float, float, float, float]],
) -> None:
    """Cụm nhà mái tranh vách gỗ làng quê Đại Việt truyền thống."""
    walls = MeshPart(f"{prefix}_Vach_Nha_Lang_Viet", (0.54, 0.43, 0.28, 1.0), metallic=0.04, roughness=0.86)
    roofs = MeshPart(f"{prefix}_Mai_La_Lang_Viet", (0.46, 0.34, 0.18, 1.0), metallic=0.04, roughness=0.88)
    for hx, hy, hz, hrot in coords:
        walls.add_box(2.8, 1.45, 2.1, hx, hy + 0.72, hz, rot_y=hrot)
        roofs.add_box(3.3, 0.22, 1.55, hx, hy + 1.78, hz + 0.55 * math.cos(hrot), tilt_x=0.48, rot_y=hrot)
        roofs.add_box(3.3, 0.22, 1.55, hx, hy + 1.78, hz - 0.55 * math.cos(hrot), tilt_x=-0.48, rot_y=hrot)
    meshes.append(walls)
    meshes.append(roofs)


def add_karst_mountains(
    meshes: List[MeshPart],
    name: str,
    peaks: Sequence[Tuple[float, float, float, float, float]],
    color: Tuple[float, float, float, float] = (0.20, 0.33, 0.22, 1.0),
) -> None:
    """Dãy núi đá vôi hùng vĩ bao bọc đường chân trời (Tràng Kênh, Chí Linh, Đốn Sơn, Trường Sơn)."""
    mt = MeshPart(name, color, metallic=0.05, roughness=0.88)
    for mx, my, mz, rad, hgt in peaks:
        mt.add_frustum(rad * 0.16, rad, hgt, 9, mx, my + hgt * 0.45, mz)
        mt.add_frustum(rad * 0.10, rad * 0.68, hgt * 0.72, 8, mx + rad * 0.36, my + hgt * 0.32, mz + rad * 0.22)
    meshes.append(mt)


def add_arched_stone_bridge(
    meshes: List[MeshPart],
    name: str,
    pos: Tuple[float, float, float],
    width: float = 3.8,
    span: float = 4.6,
) -> None:
    """Cầu đá vòm cổ bắc qua hào nước Thành nhà Hồ / sông làng."""
    br = MeshPart(name, (0.48, 0.47, 0.43, 1.0), metallic=0.07, roughness=0.80, translation=pos)
    br.add_stone_arch(span * 0.34, 0.36, width, 9, 0.0, 0.05, 0.0)
    br.add_box(width, 0.22, span * 0.55, 0.0, 0.68, 0.0)
    br.add_box(width, 0.20, span * 0.32, 0.0, 0.42, span * 0.36, tilt_x=0.22)
    br.add_box(width, 0.20, span * 0.32, 0.0, 0.42, -span * 0.36, tilt_x=-0.22)
    for rx in (-width * 0.46, width * 0.46):
        br.add_box(0.18, 0.45, span * 0.92, rx, 0.92, 0.0)
    meshes.append(br)


# ==============================================================================
# 7 ĐẠI CẢNH LỊCH SỬ MỞ RỘNG (62m -> 68m) VỚI NHÂN VẬT MẶC CỔ PHỤC ĐÚNG LỊCH SỬ
# ==============================================================================


def build_beautified_bach_dang_938(assets: Dict[str, Path]) -> bytes:
    """1. Chiến thắng Bạch Đằng 938 (Đại cảnh mở rộng 64m x 64m): Cửa sông rộng, dãy núi Tràng Kênh, doanh trại Ngô Quyền, >95 cọc gỗ bịt sắt, hạm đội Nam Hán & thủy quân Đại Việt cổ phục."""
    meshes: List[MeshPart] = []

    def river_relief(x: float, z: float) -> float:
        meander = 1.8 * math.sin(z * 0.085)
        dist = abs(x - meander)
        if dist < 9.2:
            return -1.05 + 0.14 * math.cos(dist * 0.32)
        bank = min(1.0, (dist - 9.2) / 6.8)
        ridge = 1.45 * (0.55 + 0.45 * math.sin(x * 0.22) * math.cos(z * 0.16)) * (bank ** 1.3)
        outer_mtn = max(0.0, (dist - 19.5) * 0.32) * (0.7 + 0.3 * math.cos(z * 0.21))
        return -0.95 + bank * 2.15 + ridge + outer_mtn

    terrain = MeshPart("Dia_Hinh_Cua_Song_Bach_Dang_Mo_Rong", (0.21, 0.38, 0.19, 1.0), metallic=0.04, roughness=0.88)
    terrain.add_terrain_grid(64.0, 64.0, 48, 48, river_relief, 0.0, 0.0, 0.0, skirt_depth=1.2)
    meshes.append(terrain)

    silt = MeshPart("Long_Song_Va_Bai_Boi_Bach_Dang", (0.28, 0.22, 0.15, 1.0), metallic=0.05, roughness=0.92)
    silt.add_box(22.0, 0.24, 63.2, 0.0, -1.02, 0.0)
    meshes.append(silt)

    # Dãy núi đá vôi Tràng Kênh – Yên Hưng bao bọc hai bên bờ hạ lưu
    add_karst_mountains(
        meshes,
        "Day_Nui_Da_Voi_Trang_Kenh",
        [
            (-24.5, 2.2, -22.0, 6.2, 10.5),
            (-26.0, 2.4, -8.5, 5.8, 9.6),
            (-25.2, 2.2, 7.5, 6.5, 11.2),
            (-24.0, 2.0, 21.5, 5.6, 8.8),
            (24.8, 2.2, -20.5, 6.0, 9.8),
            (26.2, 2.5, -5.0, 6.4, 10.8),
            (25.0, 2.2, 10.5, 5.9, 9.4),
            (24.2, 2.0, 23.0, 5.5, 8.6),
        ],
        color=(0.24, 0.34, 0.26, 1.0),
    )

    # Trận địa cọc gỗ lim bịt sắt rộng khắp cửa sông (7 hàng x 15 cột = 105 cọc nhọn)
    stakes_wood = MeshPart("Bai_Coc_Go_Bit_Sat", (0.42, 0.26, 0.12, 1.0), metallic=0.10, roughness=0.78)
    stakes_iron = MeshPart("Dau_Sat_Bit_Coc_Bach_Dang", (0.52, 0.56, 0.62, 1.0), metallic=0.85, roughness=0.22)
    for row in range(-3, 4):
        for col in range(-7, 8):
            meander_x = 1.8 * math.sin((row * 1.35 - 1.2) * 0.085)
            sx = meander_x + col * 1.08 + (0.28 if row % 2 == 0 else -0.28)
            sz = row * 1.38 - 1.2
            stakes_wood.add_frustum(0.11, 0.16, 1.48, 9, sx, -0.20, sz, tilt_x=0.20)
            stakes_iron.add_frustum(0.014, 0.118, 0.42, 9, sx, 0.68, sz + 0.16, tilt_x=0.20)
    meshes.append(stakes_wood)
    meshes.append(stakes_iron)

    water = MeshPart(
        "Mat_Nuoc_Thuy_Trieu",
        (0.08, 0.36, 0.50, 0.88),
        metallic=0.28,
        roughness=0.18,
        translation=(0.0, 0.26, 0.0),
        alpha_blend=True,
    )
    water.add_box(23.5, 0.18, 63.6, 0.0, -0.04, 0.0)
    meshes.append(water)

    # Đại bản doanh chỉ huy Ngô Quyền bên bờ Tả ngạn + Chòi canh Hữu ngạn + Làng chài hậu phương
    cmd_x, cmd_z = -14.2, -3.5
    cmd_y = river_relief(cmd_x, cmd_z)
    add_watchtower_and_camp(meshes, "Dai_Chi_Huy_Ngo_Quyen_Ta_Ngan", (cmd_x, cmd_y - 0.05, cmd_z), rot_y=1.45)
    obs_plinth = MeshPart("Be_Da_Chi_Huy_Tien_Tuyen", (0.46, 0.44, 0.38, 1.0), metallic=0.08, roughness=0.78)
    p_x, p_z = -11.4, -2.2
    p_y = river_relief(p_x, p_z)
    obs_plinth.add_frustum(1.35, 1.65, 0.36, 16, p_x, p_y + 0.14, p_z)
    meshes.append(obs_plinth)

    r_x, r_z = 14.6, -4.2
    add_watchtower_and_camp(meshes, "Don_Phuc_Binh_Huu_Ngan", (r_x, river_relief(r_x, r_z) - 0.05, r_z), rot_y=-1.55)
    add_village_houses(
        meshes,
        "Lang_Chai_Ha_Luu_Ung_Nghia",
        [
            (-18.5, river_relief(-18.5, -15.0) - 0.05, -15.0, 0.9),
            (-19.8, river_relief(-19.8, -11.2) - 0.05, -11.2, 1.2),
            (18.6, river_relief(18.6, -14.5) - 0.05, -14.5, -1.1),
        ],
    )

    meshes.append(create_tactical_arrow("Mui_Ten_Phan_Cong_Ta_Ngan", (0.84, 0.62, 0.16, 1.0), (-5.8, 0.78, -4.6), 0.42, 3.8))
    meshes.append(create_tactical_arrow("Mui_Ten_Phan_Cong_Huu_Ngan", (0.84, 0.62, 0.16, 1.0), (5.8, 0.78, -4.6), -0.42, 3.8))

    base_anims = [
        AnimationClip(
            "Toan_Canh_Thuy_Trieu_Va_Phan_Cong",
            [
                AnimationChannel(
                    "Mat_Nuoc_Thuy_Trieu",
                    "translation",
                    [0.0, 2.5, 5.5, 8.0],
                    [0.0, 0.48, 0.0, 0.0, 0.30, 0.0, 0.0, -0.22, 0.0, 0.0, 0.48, 0.0],
                )
            ],
        ),
        AnimationClip(
            "Giai_Doan_2_Nhu_Dich_Trieu_Len",
            [
                AnimationChannel(
                    "Mat_Nuoc_Thuy_Trieu",
                    "translation",
                    [0.0, 2.0, 4.0],
                    [0.0, 0.38, 0.0, 0.0, 0.52, 0.0, 0.0, 0.38, 0.0],
                )
            ],
        ),
    ]
    composer = GlbSceneComposer(compile_glb_bytes(meshes, base_anims, "BachDang938_WideHistoricalGLB"), "BachDang938_WideHistoricalGLB")

    # 1. Đức Vương Ngô Quyền (Giáp đồng Mũ Đâu Mâu), Nữ Tướng cổ phục & Đội hình Thủy quân Bạch Đằng hai bên bờ
    composer.place_glb(assets["human_thanh"], "Duc_Vuong_Ngo_Quyen_Chi_Huy", (p_x, p_y + 0.32, p_z), target_size=2.05, rot_y=1.42)
    composer.place_glb(assets["human_tham"], "Nu_Tuong_Tham_Muu_Co_Phuc", (p_x - 0.85, p_y + 0.32, p_z + 0.75), target_size=1.88, rot_y=1.35)

    warrior_posts = [
        (-10.8, 1.8, 1.45),
        (-11.2, -5.8, 1.30),
        (-10.6, 5.6, 1.55),
        (11.0, -2.0, -1.45),
        (11.4, 2.6, -1.55),
        (10.8, -6.4, -1.25),
    ]
    for idx, (wx, wz, wrot) in enumerate(warrior_posts):
        composer.place_glb(
            assets["human_bach_dang"],
            f"Thuy_Binh_Ngo_Quyen_{idx + 1}",
            (wx, river_relief(wx, wz), wz),
            target_size=2.25,
            rot_y=wrot,
        )

    # 2. Hạm đội 4 Chiến thuyền lớn Nam Hán (Lưu Hoằng Thao) tiến từ cửa biển vào bãi cọc
    han_specs = [
        ("Chien_Thuyen_Nam_Han_1", -3.2, 13.5, 0.2, 5.4),
        ("Chien_Thuyen_Nam_Han_2", 3.0, 15.2, 0.8, 5.2),
        ("Chien_Thuyen_Nam_Han_3", -0.4, 20.5, -1.2, 5.0),
        ("Chien_Thuyen_Nam_Han_4", 4.6, 23.0, 2.1, 4.8),
    ]
    for sname, sx0, sz0, sz_end, ssize in han_specs:
        ship_node = composer.place_glb(assets["ship_armada"], sname, (sx0, 0.05, sz0), target_size=ssize, rot_y=math.pi)
        composer.add_node_animation_to_clip(
            0,
            ship_node,
            "translation",
            [0.0, 3.0, 5.5, 8.0],
            [sx0, 0.26, sz0, sx0 * 0.85, 0.16, sz_end + 4.5, sx0 * 0.75, -0.20, sz_end, sx0, 0.26, sz0],
        )

    # 3. Soái thuyền Ngô Quyền thượng lưu + 2 Thuyền nhẹ nhử địch + 4 Thuyền chèo phục kích từ rừng lau hai bờ
    composer.place_glb(assets["ship_royal"], "Soai_Thuyen_Chu_Luc_Ngo_Quyen", (-0.8, 0.08, -15.5), target_size=5.2, rot_y=0.05)
    composer.place_glb(assets["ship_royal"], "Chien_Thuyen_Ho_Ve_Dai_Viet", (3.6, 0.08, -18.2), target_size=4.6, rot_y=-0.08)

    lure1 = composer.place_glb(assets["boat_row"], "Thuyen_Nhe_Nhu_Dich_1", (-1.2, 0.12, -7.2), target_size=2.6, rot_y=0.0)
    lure2 = composer.place_glb(assets["boat_row"], "Thuyen_Nhe_Nhu_Dich_2", (1.8, 0.12, -8.4), target_size=2.5, rot_y=0.0)
    composer.add_node_animation_to_clip(1, lure1, "translation", [0.0, 2.0, 4.0], [-1.2, 0.26, 3.5, -1.2, 0.30, -6.8, -1.2, 0.26, 3.5])
    composer.add_node_animation_to_clip(1, lure2, "translation", [0.0, 2.0, 4.0], [1.8, 0.26, 4.8, 1.8, 0.30, -7.8, 1.8, 0.26, 4.8])

    ambush_boats = [
        ("Thuyen_Phuc_Kich_Ta_Ngan_1", -7.8, -7.2, -3.6, -2.4, 0.55),
        ("Thuyen_Phuc_Kich_Ta_Ngan_2", -8.0, -11.5, -4.0, -5.2, 0.48),
        ("Thuyen_Phuc_Kich_Huu_Ngan_1", 7.8, -7.4, 3.6, -2.5, -0.55),
        ("Thuyen_Phuc_Kich_Huu_Ngan_2", 8.1, -11.8, 4.1, -5.4, -0.48),
    ]
    for bname, bx0, bz0, bx1, bz1, brot in ambush_boats:
        bnode = composer.place_glb(assets["boat_row"], bname, (bx0, 0.10, bz0), target_size=2.7, rot_y=brot)
        composer.add_node_animation_to_clip(
            0, bnode, "translation", [0.0, 3.5, 6.2, 8.0], [bx0, 0.18, bz0, bx0 * 0.92, 0.14, bz0 + 1.0, bx1, -0.02, bz1, bx0, 0.18, bz0]
        )

    # 4. Đàn chim thủy cầm ven bãi bồi yên ả thượng lưu
    duck1 = composer.place_glb(assets["animal_duck"], "Chim_Thuy_Cam_Cua_Song_1", (-6.8, 0.18, 16.5), target_size=0.75, rot_y=0.8)
    composer.place_glb(assets["animal_duck"], "Chim_Thuy_Cam_Cua_Song_2", (-7.5, 0.18, 18.2), target_size=0.68, rot_y=0.5)
    composer.add_node_animation_to_clip(0, duck1, "translation", [0.0, 4.0, 8.0], [-6.8, 0.24, 16.5, -5.4, 0.14, 13.8, -6.8, 0.24, 16.5])

    # 5. Rừng đại ngàn ven sông & ghềnh đá Tràng Kênh trải rộng 64m
    forest_spots = [
        ("nature_tree_freemodels", -13.5, -20.0, 5.2, 0.4),
        ("nature_tree_kaykit", -16.8, -12.5, 4.8, 1.2),
        ("nature_pine_kaykit", -15.5, -0.5, 5.0, 2.1),
        ("nature_tree_freemodels", -14.2, 7.8, 5.4, 0.9),
        ("nature_pine_kaykit", -17.5, 14.5, 5.1, 1.7),
        ("nature_tree_kaykit", -13.8, 21.0, 4.9, 0.3),
        ("nature_tree_freemodels", -21.5, -5.2, 5.8, 1.1),
        ("nature_pine_kaykit", -22.0, 4.5, 5.5, 2.4),
        ("nature_tree_freemodels", 13.8, -19.5, 5.2, -0.7),
        ("nature_pine_kaykit", 16.4, -10.8, 4.9, 1.5),
        ("nature_tree_kaykit", 15.2, 0.8, 4.8, -1.3),
        ("nature_tree_freemodels", 14.0, 8.6, 5.3, 0.5),
        ("nature_pine_kaykit", 17.2, 15.8, 5.0, -0.9),
        ("nature_tree_kaykit", 14.5, 22.0, 4.8, 1.9),
        ("nature_tree_freemodels", 21.8, -3.5, 5.7, -0.4),
        ("nature_pine_kaykit", 22.4, 6.2, 5.5, 0.8),
        ("nature_rock_kaykit", -10.2, 4.2, 2.8, 0.3),
        ("nature_rock_freemodels", -10.5, -9.2, 2.6, 1.4),
        ("nature_rock_freemodels", 10.4, -8.5, 2.7, 1.7),
        ("nature_rock_kaykit", 10.2, 5.4, 2.9, -0.6),
        ("nature_rock_kaykit", -11.0, 13.0, 3.1, 0.9),
        ("nature_rock_freemodels", 11.2, 14.2, 3.0, -1.1),
        ("nature_flower_bush_freemodels", -12.4, -1.2, 1.45, 0.6),
        ("nature_flower_bush_freemodels", 12.6, -2.0, 1.45, -0.4),
    ]
    for idx, (akey, fx, fz, fsize, frot) in enumerate(forest_spots):
        composer.place_glb(assets[akey], f"Rung_Ven_Song_Bach_Dang_{idx + 1}", (fx, river_relief(fx, fz) - 0.06, fz), target_size=fsize, rot_y=frot)

    return composer.export_bytes()


def build_beautified_lam_son(assets: Dict[str, Path]) -> bytes:
    """2. Khởi nghĩa Lam Sơn 1418 – 1427 (Đại cảnh mở rộng 64m x 64m): Núi rừng Chí Linh – Lam Sơn, Đài Thề Lũng Nhai, Hậu phương Nghệ An, Thành Đông Quan & Ải Chi Lăng – Xương Giang."""
    meshes: List[MeshPart] = []

    def dai_viet_relief(x: float, z: float) -> float:
        west_mountains = max(0.0, (-x + 3.5) * 0.16) * (0.68 + 0.32 * math.cos(z * 0.15))
        chi_lang_gorge = 1.65 * math.exp(-((x - 4.5) ** 2 + (z + 18.5) ** 2) / 26.0)
        east_plain = -0.15 if x > 12.0 else 0.0
        return 0.08 + west_mountains + chi_lang_gorge + east_plain

    base = MeshPart("Dia_Hinh_Dai_Viet_Lam_Son_Mo_Rong", (0.26, 0.39, 0.21, 1.0), metallic=0.04, roughness=0.88)
    base.add_terrain_grid(64.0, 64.0, 46, 46, dai_viet_relief, 0.0, 0.0, 0.0, skirt_depth=1.2)
    meshes.append(base)

    # Dãy núi Chí Linh – Lam Sơn phía Tây & dãy núi đá Quỷ Môn Quan – Ải Chi Lăng phía Bắc
    add_karst_mountains(
        meshes,
        "Day_Nui_Chi_Linh_Va_Ai_Chi_Lang",
        [
            (-24.0, dai_viet_relief(-24.0, 6.0), 6.0, 6.8, 12.2),
            (-25.5, dai_viet_relief(-25.5, -6.0), -6.0, 6.4, 10.8),
            (-22.5, dai_viet_relief(-22.5, 18.5), 18.5, 6.2, 10.2),
            (-21.0, dai_viet_relief(-21.0, -18.0), -18.0, 5.8, 9.6),
            (0.2, dai_viet_relief(0.2, -23.5), -23.5, 5.5, 9.5),
            (5.2, dai_viet_relief(5.2, -24.5), -24.5, 5.8, 10.2),
            (10.5, dai_viet_relief(10.5, -23.0), -23.0, 5.2, 9.0),
        ],
        color=(0.20, 0.33, 0.21, 1.0),
    )

    rivers = MeshPart("He_Thong_Song_Hong_Song_Ma_Song_Lam", (0.09, 0.37, 0.54, 0.92), metallic=0.28, roughness=0.18, alpha_blend=True)
    rivers.add_box(26.0, 0.12, 1.65, 6.0, 0.34, -9.2, rot_y=0.25)
    rivers.add_box(24.0, 0.12, 1.50, 2.5, 0.36, 4.8, rot_y=0.20)
    rivers.add_box(23.0, 0.12, 1.65, 3.8, 0.32, 16.5, rot_y=0.28)
    meshes.append(rivers)

    # Cầu đá cổ Tốt Động – Chúc Động & Cầu đá hậu phương Lam Giang (Nghệ An)
    add_arched_stone_bridge(meshes, "Cau_Da_Tot_Dong_Chuc_Dong", (3.2, 0.22, -9.0), width=3.4, span=4.2)
    add_arched_stone_bridge(meshes, "Cau_Da_Hau_Phuong_Song_Lam", (-1.5, 0.22, 15.8), width=3.2, span=4.0)

    # Đại bản doanh tụ nghĩa Lam Sơn (Điện hội thề Lũng Nhai + Đài Thề Đá Xanh + Rào tre chiến lũy + Chòi canh Chi Lăng + Làng dân Nghệ An)
    hq_x, hq_z = -12.5, 5.5
    add_viet_temple_hall(meshes, "Dai_Ban_Doanh_Tu_Nghia_Lam_Son", (hq_x, dai_viet_relief(hq_x, hq_z) - 0.06, hq_z), rot_y=1.15, scale_f=0.92)
    oath_altar = MeshPart("Dai_The_Lung_Nhai_Lam_Son", (0.46, 0.44, 0.39, 1.0), metallic=0.08, roughness=0.80)
    oath_altar.add_frustum(1.65, 2.05, 0.38, 12, -8.9, dai_viet_relief(-8.9, 5.4) + 0.16, 5.4)
    meshes.append(oath_altar)

    palisade = MeshPart("Rao_Tre_Chien_Luy_Lam_Son", (0.44, 0.33, 0.17, 1.0), metallic=0.06, roughness=0.82)
    for pi in range(-5, 6):
        pz = 5.5 + pi * 0.72
        px = -6.8 + abs(pi) * 0.12
        palisade.add_frustum(0.06, 0.08, 1.45, 7, px, dai_viet_relief(px, pz) + 0.68, pz)
    meshes.append(palisade)

    add_watchtower_and_camp(meshes, "Cua_Ai_Chi_Lang_Phuc_Kich", (-0.8, dai_viet_relief(-0.8, -18.5) - 0.05, -18.5), rot_y=0.35)
    add_watchtower_and_camp(meshes, "Doanh_Trai_Hau_Phuong_Nghe_An", (-8.5, dai_viet_relief(-8.5, 17.2) - 0.05, 17.2), rot_y=0.75)
    add_village_houses(
        meshes,
        "Lang_Mac_Nghe_An_Thanh_Hoa",
        [
            (-6.5, dai_viet_relief(-6.5, 19.8) - 0.05, 19.8, 0.4),
            (-3.2, dai_viet_relief(-3.2, 21.2) - 0.05, 21.2, -0.3),
            (2.8, dai_viet_relief(2.8, 20.4) - 0.05, 20.4, 0.6),
            (11.5, dai_viet_relief(11.5, 2.0) - 0.05, 2.0, -1.2),
        ],
    )

    milestones = [
        ("Moc_1418_Can_Cu_Lam_Son", (-7.2, dai_viet_relief(-7.2, 4.2) + 0.85, 4.2), (0.72, 0.14, 0.14, 1.0)),
        ("Moc_1424_Tien_Vao_Nghe_An", (-2.6, dai_viet_relief(-2.6, 15.2) + 0.85, 15.2), (0.78, 0.50, 0.12, 1.0)),
        ("Moc_1426_Tot_Dong_Chuc_Dong", (3.8, dai_viet_relief(3.8, -8.4) + 0.85, -8.4), (0.80, 0.58, 0.14, 1.0)),
        ("Moc_1427_Chi_Lang_Xuong_Giang", (5.2, dai_viet_relief(5.2, -18.5) + 0.85, -18.5), (0.14, 0.48, 0.30, 1.0)),
    ]
    for m_name, m_pos, m_col in milestones:
        beacon = MeshPart(m_name, m_col, metallic=0.26, roughness=0.42, translation=m_pos)
        beacon.add_frustum(0.52, 0.68, 0.42, 12, 0.0, -0.65, 0.0)
        beacon.add_frustum(0.07, 0.09, 2.15, 8, 0.0, 0.42, 0.0)
        beacon.add_box(1.28, 0.72, 0.08, 0.64, 1.12, 0.0)
        meshes.append(beacon)

    meshes.append(create_tactical_arrow("Huong_Tien_1424_Nam_Tien", (0.82, 0.54, 0.12, 1.0), (-4.8, 1.35, 9.8), 0.32, 6.8))
    meshes.append(create_tactical_arrow("Huong_Tien_1426_Bac_Tien", (0.74, 0.14, 0.14, 1.0), (1.2, 0.95, 2.4), math.pi - 0.24, 11.5))

    channels = [
        AnimationChannel(
            m_name,
            "scale",
            [0.0, idx * 1.2 + 0.6, idx * 1.2 + 1.2, 6.0],
            [1.0, 1.0, 1.0, 1.24, 1.30, 1.24, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
        )
        for idx, (m_name, _, _) in enumerate(milestones)
    ]
    composer = GlbSceneComposer(
        compile_glb_bytes(meshes, [AnimationClip("Dien_Bien_Hanh_Quan_1418_1427", channels)], "KhoiNghiaLamSon_WideHistoricalGLB"),
        "KhoiNghiaLamSon_WideHistoricalGLB",
    )

    # Thành Đông Quan & Thành Xương Giang quy mô lớn + Thuyền vận lương trên Sông Lam (Nghệ An)
    composer.place_glb(assets["castle_kaykit"], "Thanh_Dong_Quan", (9.2, dai_viet_relief(9.2, -9.6), -9.6), target_size=5.4, rot_y=-0.35)
    composer.place_glb(assets["castle_kaykit"], "Thanh_Xuong_Giang", (9.6, dai_viet_relief(9.6, -17.2), -17.2), target_size=4.5, rot_y=-0.50)
    composer.place_glb(assets["boat_row"], "Thuyen_Tiep_Luong_Song_Lam_1", (2.8, 0.32, 16.2), target_size=2.6, rot_y=1.25)
    composer.place_glb(assets["boat_row"], "Thuyen_Tiep_Luong_Song_Lam_2", (6.8, 0.32, 17.4), target_size=2.5, rot_y=1.25)

    # Bình Định Vương Lê Lợi, Danh Nho Nguyễn Trãi, Nữ tướng vận lương, Thôn nữ Nghệ An & Đội hình Nghĩa quân Lam Sơn cổ phục
    composer.place_glb(assets["human_thanh"], "Binh_Dinh_Vuong_Le_Loi", (-8.8, dai_viet_relief(-8.8, 5.2) + 0.32, 5.2), target_size=2.08, rot_y=1.15)
    composer.place_glb(assets["human_mandarin"], "Quan_Su_Nguyen_Trai_Binh_Ngo", (-9.4, dai_viet_relief(-9.4, 6.4) + 0.32, 6.4), target_size=1.98, rot_y=1.08)
    composer.place_glb(assets["human_tham"], "Nu_Tuong_Hau_Can_Lam_Son", (-9.8, dai_viet_relief(-9.8, 3.8), 3.8), target_size=1.86, rot_y=1.22)
    composer.place_glb(assets["human_viet_folk_f"], "Dan_Nu_Tiep_Luong_Nghe_An_1", (-4.4, dai_viet_relief(-4.4, 17.6), 17.6), target_size=1.82, rot_y=0.65)
    composer.place_glb(assets["human_viet_folk_f"], "Dan_Nu_Tiep_Luong_Nghe_An_2", (-1.8, dai_viet_relief(-1.8, 18.4), 18.4), target_size=1.80, rot_y=-0.35)

    insurgent_posts = [
        (-6.2, 6.0, 0.9),
        (-3.6, 13.8, 0.25),
        (1.8, -6.8, 2.7),
        (4.8, -10.8, 2.2),
        (3.8, -16.8, 2.6),
        (6.4, -18.8, -2.2),
    ]
    for idx, (ix, iz, irot) in enumerate(insurgent_posts):
        composer.place_glb(assets["human_lam_son"], f"Nghia_Quan_Lam_Son_{idx + 1}", (ix, dai_viet_relief(ix, iz), iz), target_size=2.22, rot_y=irot)

    # Đoàn Kỵ binh Chiến mã Bắc tiến & Hỏa pháo vây thành
    horse1 = composer.place_glb(assets["animal_horse"], "Chien_Ma_Lam_Son_Bac_Tien_1", (-0.6, dai_viet_relief(-0.6, 6.5), 6.5), target_size=1.95, rot_y=math.pi - 0.22)
    horse2 = composer.place_glb(assets["animal_horse"], "Chien_Ma_Lam_Son_Bac_Tien_2", (1.2, dai_viet_relief(1.2, -3.5), -3.5), target_size=1.90, rot_y=math.pi - 0.18)
    composer.place_glb(assets["animal_horse"], "Ky_Binh_Phuc_Kich_Chi_Lang_1", (3.2, dai_viet_relief(3.2, -19.2), -19.2), target_size=1.92, rot_y=1.4)
    composer.place_glb(assets["animal_horse"], "Ky_Binh_Phuc_Kich_Chi_Lang_2", (7.0, dai_viet_relief(7.0, -19.6), -19.6), target_size=1.90, rot_y=-1.4)
    composer.add_node_animation_to_clip(
        0, horse1, "translation", [0.0, 3.0, 6.0], [-1.2, dai_viet_relief(-1.2, 8.5), 8.5, 1.8, dai_viet_relief(1.8, -4.5), -4.5, -1.2, dai_viet_relief(-1.2, 8.5), 8.5]
    )
    composer.add_node_animation_to_clip(
        0, horse2, "translation", [0.0, 3.0, 6.0], [0.8, dai_viet_relief(0.8, 1.5), 1.5, 3.2, dai_viet_relief(3.2, -10.5), -10.5, 0.8, dai_viet_relief(0.8, 1.5), 1.5]
    )

    composer.place_glb(assets["cannon_mobile"], "Hoa_Phao_Cong_Thanh_Dong_Quan_1", (6.2, dai_viet_relief(6.2, -10.6), -10.6), target_size=1.65, rot_y=0.9)
    composer.place_glb(assets["cannon_mobile"], "Hoa_Phao_Cong_Thanh_Dong_Quan_2", (6.5, dai_viet_relief(6.5, -8.2), -8.2), target_size=1.65, rot_y=1.3)
    composer.place_glb(assets["cannon_mobile"], "Hoa_Phao_Chan_Ai_Chi_Lang", (2.2, dai_viet_relief(2.2, -17.8), -17.8), target_size=1.60, rot_y=0.45)
    composer.place_glb(assets["animal_deer"], "Huou_Rung_Chi_Linh_1", (-16.2, dai_viet_relief(-16.2, 1.2), 1.2), target_size=1.35, rot_y=1.1)
    composer.place_glb(assets["animal_deer"], "Huou_Rung_Chi_Linh_2", (-17.5, dai_viet_relief(-17.5, -3.4), -3.4), target_size=1.22, rot_y=0.6)

    mountain_props = [
        ("nature_rock_kaykit", -14.2, 2.2, 3.6, 0.2),
        ("nature_rock_freemodels", -15.4, -4.8, 3.4, 1.1),
        ("nature_rock_kaykit", 2.2, -20.5, 4.2, 0.6),
        ("nature_rock_freemodels", 7.8, -20.2, 4.0, -0.8),
        ("nature_rock_kaykit", 4.6, -21.8, 3.8, 1.4),
        ("nature_tree_freemodels", -14.8, 11.2, 5.2, 0.4),
        ("nature_pine_kaykit", -18.2, 8.6, 5.0, 1.3),
        ("nature_pine_kaykit", -16.4, 17.5, 4.9, 0.8),
        ("nature_tree_kaykit", -10.5, 22.0, 4.8, -0.5),
        ("nature_pine_kaykit", -17.8, -11.5, 5.1, 1.7),
        ("nature_tree_freemodels", -12.6, -15.4, 5.0, 0.6),
        ("nature_pine_kaykit", -2.8, -21.2, 4.8, 0.9),
        ("nature_tree_kaykit", 14.5, -14.0, 4.6, -0.7),
        ("nature_tree_freemodels", 15.2, 8.5, 4.9, 0.3),
        ("nature_pine_kaykit", 16.8, -2.5, 4.7, 1.2),
        ("nature_flower_bush_freemodels", -10.2, 2.4, 1.4, 0.3),
        ("nature_flower_bush_freemodels", -7.8, 16.8, 1.4, -0.5),
    ]
    for idx, (akey, mx, mz, msize, mrot) in enumerate(mountain_props):
        composer.place_glb(assets[akey], f"Rung_Nui_Lam_Son_{idx + 1}", (mx, dai_viet_relief(mx, mz) - 0.05, mz), target_size=msize, rot_y=mrot)

    return composer.export_bytes()


def build_beautified_thanh_nha_ho(assets: Dict[str, Path]) -> bytes:
    """3. Di sản Thành nhà Hồ – Kinh đô Tây Đô 1397 (Đại cảnh mở rộng 62m x 62m): Cổng Nam 3 vòm đá cuốn, tường thành bao quanh Điện Hoàng Nguyên, cầu đá bắc qua hào thành, Hồ Nguyên Trừng & Súng Thần Cơ."""
    meshes: List[MeshPart] = []

    def tay_do_relief(x: float, z: float) -> float:
        if z < -20.0:
            return max(0.0, (-z - 20.0) * 0.36) * (0.65 + 0.35 * math.cos(x * 0.18))
        return 0.0

    ground = MeshPart("Khong_Gian_Thung_Lung_Tay_Do", (0.25, 0.39, 0.21, 1.0), metallic=0.04, roughness=0.90)
    ground.add_terrain_grid(62.0, 62.0, 40, 40, tay_do_relief, 0.0, 0.0, 0.0, skirt_depth=1.1)
    meshes.append(ground)

    # Dãy núi Đốn Sơn & Xuân Giai phía Bắc làm thế "tựa sơn hướng thủy" cho Kinh đô Tây Đô
    add_karst_mountains(
        meshes,
        "Day_Nui_Don_Son_Tay_Do",
        [
            (-19.5, 0.5, -25.5, 6.2, 10.5),
            (-6.5, 0.8, -26.8, 6.8, 11.8),
            (7.2, 0.8, -26.5, 6.5, 11.2),
            (20.0, 0.5, -25.0, 6.0, 10.0),
        ],
        color=(0.22, 0.34, 0.24, 1.0),
    )

    # Con đường Hoàng Gia (Hoa Nhai) lát đá xanh xuyên suốt từ Nam Giao qua Cổng Nam vào Chính điện
    road = MeshPart("Duong_Hoang_Gia_Lat_Da", (0.52, 0.50, 0.44, 1.0), metallic=0.06, roughness=0.78)
    road.add_box(4.4, 0.10, 44.0, 0.0, 0.05, 4.0)
    meshes.append(road)

    # Cổng Nam ba vòm đá cuốn ghép khít không chất kết dính (đá xanh Thanh Hóa trầm cổ kính)
    gate = MeshPart("Cong_Nam_Da_Khoi_Ba_Vom", (0.43, 0.46, 0.44, 1.0), metallic=0.08, roughness=0.80)
    for px in (-4.35, -1.45, 1.45, 4.35):
        gate.add_box(1.42, 2.75, 3.25, px, 1.38, 0.0)
    for arch_cx in (-2.90, 0.0, 2.90):
        gate.add_stone_arch(0.88, 0.48, 3.26, 9, arch_cx, 2.25, 0.0)
    gate.add_box(10.4, 1.05, 3.30, 0.0, 3.88, 0.0)
    for bx in [x * 1.08 for x in range(-4, 5)]:
        gate.add_box(0.56, 0.44, 0.40, bx, 4.62, 1.40)
        gate.add_box(0.56, 0.44, 0.40, bx, 4.62, -1.40)
    meshes.append(gate)

    # Tường thành đá khối kết hợp đất đắp bao quanh Nội thành rộng lớn (36m x 22m)
    walls = MeshPart("Tuong_Thanh_Da_Ghep_Khit", (0.37, 0.40, 0.38, 1.0), metallic=0.07, roughness=0.86)
    walls.add_box(12.8, 3.05, 2.85, -11.6, 1.52, 0.0)
    walls.add_box(12.8, 3.05, 2.85, 11.6, 1.52, 0.0)
    walls.add_box(2.85, 3.05, 20.5, -18.0, 1.52, -10.2)
    walls.add_box(2.85, 3.05, 20.5, 18.0, 1.52, -10.2)
    walls.add_box(38.8, 3.05, 2.85, 0.0, 1.52, -20.2)
    meshes.append(walls)

    # Chính điện Hoàng Nguyên bên trong Hoàng thành Tây Đô + Làng cổ Vĩnh Lộc bên ngoài hào
    add_viet_temple_hall(meshes, "Chinh_Dien_Hoang_Nguyen_Tay_Do", (0.0, 0.02, -11.5), rot_y=0.0, scale_f=1.35)
    add_arched_stone_bridge(meshes, "Cau_Da_Nam_Mon_Qua_Hao", (0.0, 0.02, 5.2), width=4.4, span=4.8)
    add_village_houses(
        meshes,
        "Lang_Co_Ven_Thanh_Tay_Do",
        [
            (-16.5, 0.0, 16.5, 0.5),
            (-19.8, 0.0, 13.0, 0.8),
            (16.8, 0.0, 16.0, -0.5),
            (19.5, 0.0, 12.2, -0.9),
        ],
    )

    # Hào thành rộng bốn mặt bảo vệ Kinh đô
    moat = MeshPart("Hao_Thanh_Bao_Ve", (0.11, 0.43, 0.58, 0.90), metallic=0.30, roughness=0.18, alpha_blend=True)
    moat.add_box(18.5, 0.10, 4.2, -11.8, 0.06, 5.2)
    moat.add_box(18.5, 0.10, 4.2, 11.8, 0.06, 5.2)
    meshes.append(moat)

    flag = MeshPart("Ky_Dai_Trieu_Ho", (0.82, 0.58, 0.16, 1.0), metallic=0.25, roughness=0.44, translation=(0.0, 4.42, 0.0))
    flag.add_frustum(0.05, 0.065, 2.15, 8, 0.0, 1.05, 0.0)
    flag.add_box(1.28, 0.72, 0.06, 0.64, 1.72, 0.0)
    meshes.append(flag)

    q0, q1, q2 = quat_from_euler_y(0.0), quat_from_euler_y(0.24), quat_from_euler_y(-0.24)
    anims = [AnimationClip("Ky_Dai_Tung_Bay", [AnimationChannel("Ky_Dai_Trieu_Ho", "rotation", [0.0, 1.5, 3.0, 4.5], [*q0, *q1, *q2, *q0])])]
    composer = GlbSceneComposer(compile_glb_bytes(meshes, anims, "ThanhNhaHo_WideHistoricalGLB"), "ThanhNhaHo_WideHistoricalGLB")

    # Nhân vật lịch sử Triều Hồ năm 1400 (Không dùng khách du lịch hiện đại!)
    composer.place_glb(assets["human_mandarin"], "Ta_Tuong_Quoc_Ho_Nguyen_Trung", (-1.5, 0.10, 9.2), target_size=1.96, rot_y=0.28)
    composer.place_glb(assets["human_thanh"], "Vo_Tuong_Ho_Thanh_Tay_Do", (1.6, 0.10, 9.2), target_size=2.02, rot_y=-0.28)
    composer.place_glb(assets["human_tham"], "Menh_Phu_Trieu_Ho_Co_Phuc", (-0.9, 0.10, -5.2), target_size=1.84, rot_y=0.1)
    composer.place_glb(assets["human_bach_dang"], "Ve_Binh_Canh_Cong_Nam_Trai", (-2.9, 0.10, 2.0), target_size=2.20, rot_y=0.0)
    composer.place_glb(assets["human_bach_dang"], "Ve_Binh_Canh_Cong_Nam_Phai", (2.9, 0.10, 2.0), target_size=2.20, rot_y=0.0)
    composer.place_glb(assets["human_viet_folk_f"], "Dan_Nu_Tay_Do_Non_La_1", (-1.8, 0.10, 15.8), target_size=1.82, rot_y=0.35)
    composer.place_glb(assets["human_viet_folk_f"], "Dan_Nu_Tay_Do_Non_La_2", (2.2, 0.10, 17.4), target_size=1.80, rot_y=-0.45)

    # 4 Khẩu Súng Thần Cơ do Hồ Nguyên Trừng cải tiến & Kỵ binh tuần thành
    for cx, cz, croy in ((-3.8, 2.6, 0.12), (3.8, 2.6, -0.12), (-7.2, 2.6, 0.18), (7.2, 2.6, -0.18)):
        composer.place_glb(assets["cannon_mobile"], f"Sung_Than_Co_Trieu_Ho_{int(cx)}", (cx, 0.02, cz), target_size=1.55, rot_y=croy)
    composer.place_glb(assets["animal_horse"], "Ngua_Tuan_Thanh_Tay_Do_1", (-5.4, 0.02, 11.2), target_size=1.85, rot_y=0.6)
    composer.place_glb(assets["animal_horse"], "Ngua_Tuan_Thanh_Tay_Do_2", (5.8, 0.02, 12.6), target_size=1.85, rot_y=-0.5)

    # Thủy cầm bơi lội trên hào thành Tây Đô
    d1 = composer.place_glb(assets["animal_duck"], "Thuy_Cam_Hao_Thanh_1", (-10.5, 0.09, 5.2), target_size=0.68, rot_y=1.57)
    d2 = composer.place_glb(assets["animal_duck"], "Thuy_Cam_Hao_Thanh_2", (10.5, 0.09, 5.2), target_size=0.68, rot_y=-1.57)
    composer.add_node_animation_to_clip(0, d1, "translation", [0.0, 2.25, 4.5], [-14.2, 0.09, 5.2, -7.4, 0.09, 5.2, -14.2, 0.09, 5.2])
    composer.add_node_animation_to_clip(0, d2, "translation", [0.0, 2.25, 4.5], [14.0, 0.09, 5.2, 7.2, 0.09, 5.2, 14.0, 0.09, 5.2])

    citadel_flora = [
        ("nature_tree_freemodels", -8.5, 12.8, 5.0, 0.3),
        ("nature_tree_freemodels", 8.5, 12.8, 5.0, -0.4),
        ("nature_tree_kaykit", -14.5, 10.6, 4.6, 1.1),
        ("nature_tree_kaykit", 14.5, 10.6, 4.6, -1.0),
        ("nature_tree_freemodels", -22.5, 6.2, 5.4, 0.7),
        ("nature_tree_freemodels", 22.5, 6.2, 5.4, -0.6),
        ("nature_pine_kaykit", -12.8, -8.5, 4.8, 0.8),
        ("nature_pine_kaykit", 12.8, -8.5, 4.8, -0.7),
        ("nature_tree_kaykit", -12.5, -15.8, 4.5, 0.4),
        ("nature_tree_kaykit", 12.5, -15.8, 4.5, -0.5),
        ("nature_pine_kaykit", -23.0, -12.0, 5.2, 1.2),
        ("nature_pine_kaykit", 23.0, -12.0, 5.2, -1.1),
        ("nature_flower_bush_freemodels", -3.4, 10.8, 1.35, 0.2),
        ("nature_flower_bush_freemodels", 3.4, 10.8, 1.35, -0.2),
        ("nature_rock_freemodels", -21.5, 1.8, 2.5, 0.5),
        ("nature_rock_kaykit", 21.5, 1.8, 2.5, -0.6),
    ]
    for idx, (akey, gx, gz, gsize, grot) in enumerate(citadel_flora):
        composer.place_glb(assets[akey], f"Cay_Canh_Di_San_Tay_Do_{idx + 1}", (gx, tay_do_relief(gx, gz), gz), target_size=gsize, rot_y=grot)

    return composer.export_bytes()


def build_beautified_dong_nam_a(assets: Dict[str, Path]) -> bytes:
    """4. Không gian Đông Nam Á Cận – Hiện đại (Đại cảnh mở rộng 68m x 64m): Hải trình eo biển Malacca, Thương cảng cổ, Cải cách Xiêm, Quần đảo Gia vị (Không đặt xe tải hiện đại sai bối cảnh!)."""
    meshes: List[MeshPart] = []

    sea = MeshPart("Vung_Bien_Dong_Nam_A_Mo_Rong", (0.07, 0.31, 0.50, 1.0), metallic=0.28, roughness=0.20)
    sea.add_box(68.0, 0.45, 64.0, 0.0, -0.24, 0.0)
    meshes.append(sea)

    regions = [
        ("Ban_Dao_Dong_Duong_VN_Lao_CPC", 9.2, 14.5, (-3.5, 0.38, -10.2), (0.76, 0.58, 0.24, 1.0)),
        ("Vuong_Quoc_Xiem_Thai_Lan", 7.4, 10.2, (-12.2, 0.35, -9.4), (0.34, 0.58, 0.42, 1.0)),
        ("Myanmar_Miendia", 6.2, 10.8, (-19.8, 0.35, -13.8), (0.62, 0.44, 0.32, 1.0)),
        ("Ban_Dao_Ma_Lai_Singapore", 4.6, 9.8, (-10.2, 0.32, 3.4), (0.50, 0.46, 0.66, 1.0)),
        ("Quan_Dao_Indonesia_Sumatra_Java", 26.5, 5.8, (1.8, 0.32, 15.2), (0.72, 0.34, 0.26, 1.0)),
        ("Dao_Borneo_Kalimantan", 8.2, 7.6, (4.8, 0.32, 4.8), (0.38, 0.56, 0.34, 1.0)),
        ("Quan_Dao_Philippines", 6.8, 12.6, (15.8, 0.34, -3.6), (0.28, 0.54, 0.68, 1.0)),
    ]
    for r_name, rw, rd, rpos, rcol in regions:
        part = MeshPart(r_name, rcol, metallic=0.06, roughness=0.72, translation=rpos)
        part.add_box(rw, 0.68, rd, 0.0, 0.0, 0.0)
        part.add_box(rw * 0.76, 0.32, rd * 0.76, 0.0, 0.48, 0.0)
        meshes.append(part)

    add_karst_mountains(
        meshes,
        "Nui_Non_Luc_Dia_Dong_Nam_A",
        [
            (-4.2, 0.9, -13.5, 2.8, 4.6),
            (-19.8, 0.9, -15.5, 3.0, 5.0),
            (2.2, 0.8, 15.2, 2.6, 4.2),
        ],
        color=(0.28, 0.44, 0.28, 1.0),
    )
    add_viet_temple_hall(meshes, "Kinh_Do_Co_Truyen_Dong_Duong", (-2.8, 0.98, -9.8), rot_y=0.4, scale_f=0.62)

    meshes.append(create_tactical_arrow("Tuyen_Hang_Hai_Eo_Malacca", (0.92, 0.74, 0.22, 1.0), (-14.2, 0.52, 8.2), 0.88, 11.5))
    anims = [
        AnimationClip(
            "Tuyen_Hang_Hai_Va_Doc_Lap",
            [
                AnimationChannel(
                    "Tuyen_Hang_Hai_Eo_Malacca",
                    "translation",
                    [0.0, 2.5, 5.0],
                    [-16.5, 0.52, 10.2, -9.5, 0.64, 4.8, -16.5, 0.52, 10.2],
                )
            ],
        )
    ]
    composer = GlbSceneComposer(compile_glb_bytes(meshes, anims, "DongNamACanDai_WideHistoricalGLB"), "DongNamACanDai_WideHistoricalGLB")

    # Đoàn thương thuyền buồm vượt eo biển Malacca & Thái Bình Dương
    ship_malacca = composer.place_glb(assets["ship_royal"], "Thuong_Thuyen_Eo_Malacca", (-16.2, -0.02, 10.6), target_size=5.2, rot_y=0.95)
    ship_pac = composer.place_glb(assets["ship_armada"], "Tau_Buom_Vien_Duong_Phuong_Tay", (10.5, -0.02, 8.4), target_size=5.0, rot_y=-2.1)
    composer.place_glb(assets["ship_royal"], "Thuyen_Buon_Bien_Dong", (4.2, -0.02, -5.8), target_size=4.4, rot_y=0.45)
    composer.place_glb(assets["boat_row"], "Thuyen_Ban_Dia_Quan_Dao", (-3.8, 0.02, 12.2), target_size=2.6, rot_y=1.1)
    composer.add_node_animation_to_clip(0, ship_malacca, "translation", [0.0, 2.5, 5.0], [-16.8, 0.04, 11.0, -6.2, 0.04, 3.8, -16.8, 0.04, 11.0])
    composer.add_node_animation_to_clip(0, ship_pac, "translation", [0.0, 2.5, 5.0], [11.2, 0.04, 8.8, 4.8, 0.04, 1.2, 11.2, 0.04, 8.8])

    # Thương cảng Malacca – Singapore, Thành lũy Batavia, Manila & Trung tâm cải cách Vương quốc Xiêm
    composer.place_glb(assets["shipyard_kaykit"], "Thuong_Cang_Malacca_Singapore", (-9.8, 0.94, 6.8), target_size=3.2, rot_y=0.6)
    composer.place_glb(assets["shipyard_kaykit"], "Thuong_Cang_Batavia_Indonesia", (-1.5, 0.94, 14.2), target_size=3.0, rot_y=-0.2)
    composer.place_glb(assets["castle_kaykit"], "Phao_Dai_Cang_Manila", (15.4, 0.96, -2.8), target_size=3.2, rot_y=-0.8)
    composer.place_glb(assets["building_city_kaykit"], "Trung_Tam_Cai_Cach_Rama_V_Xiem", (-12.2, 0.96, -9.2), target_size=3.0, rot_y=0.0)
    composer.place_glb(assets["cannon_mobile"], "Phao_Phong_Thu_Bo_Bien", (-8.8, 0.96, 4.5), target_size=1.45, rot_y=1.1)

    # Nhân vật truyền thống tại Đông Dương, Xiêm và Quần đảo (Đúng lịch sử, không xe tải hiện đại!)
    composer.place_glb(assets["human_viet_folk_f"], "Cu_Dan_Ban_Dao_Dong_Duong", (-1.6, 0.98, -7.6), target_size=1.95, rot_y=0.4)
    composer.place_glb(assets["human_mandarin"], "Quan_Cai_Cach_Khu_Vuc", (-10.6, 0.98, -7.8), target_size=1.98, rot_y=0.2)
    composer.place_glb(assets["human_lam_son"], "Nghia_Binh_Chong_Thuc_Dan", (3.8, 0.96, 15.0), target_size=2.15, rot_y=-0.4)

    sea_flora = [
        ("palm_bend_tge", -4.6, 0.98, -12.8, 3.4, 0.5),
        ("palm_bend_tge", -9.2, 0.95, 1.8, 3.2, 1.1),
        ("palm_bend_tge", 6.8, 0.95, 15.4, 3.5, -0.8),
        ("palm_bend_tge", -6.4, 0.95, 15.0, 3.3, 0.4),
        ("palm_bend_tge", 16.2, 0.96, -6.2, 3.4, 1.2),
        ("palm_bend_tge", 5.2, 0.95, 5.4, 3.2, -0.5),
        ("nature_tree_freemodels", -19.5, 0.96, -11.5, 3.8, 0.3),
        ("nature_tree_kaykit", -13.6, 0.96, -11.6, 3.4, -0.4),
        ("nature_tree_freemodels", 11.2, 0.95, 15.6, 3.6, 0.7),
    ]
    for idx, (akey, sx, sy, sz, ssize, srot) in enumerate(sea_flora):
        composer.place_glb(assets[akey], f"Tham_Thuc_Vat_DNA_{idx + 1}", (sx, sy, sz), target_size=ssize, rot_y=srot)

    composer.place_glb(assets["animal_jellyfish"], "Sua_Bien_An_Do_Duong", (-21.5, 0.05, 6.5), target_size=1.45, rot_y=0.4)
    composer.place_glb(assets["animal_shark"], "Ca_Map_Dai_Duong_DNA", (21.5, 0.02, 8.2), target_size=2.15, rot_y=-1.2)

    return composer.export_bytes()


def build_beautified_bien_dong(assets: Dict[str, Path]) -> bytes:
    """5. Không gian Biển Đông & Chủ quyền Việt Nam (Đại cảnh mở rộng 68m x 68m): Bờ biển chữ S + Dãy Trường Sơn + Đình An Vĩnh (Lễ Khao lề thế lính Hoàng Sa) + Hải đội Hoàng Sa + Quần đảo Hoàng Sa & Trường Sa."""
    meshes: List[MeshPart] = []

    ocean = MeshPart("Khong_Gian_Bien_Dong_Mo_Rong", (0.05, 0.34, 0.58, 1.0), metallic=0.32, roughness=0.18)
    ocean.add_box(68.0, 0.48, 68.0, 0.0, -0.24, 0.0)
    meshes.append(ocean)

    # Dải đất liền hình chữ S Việt Nam mở rộng phía Tây kèm thềm lục địa liền mạch
    vn = MeshPart("Dai_Dat_Lien_Va_Bo_Bien_Viet_Nam", (0.24, 0.50, 0.28, 1.0), metallic=0.05, roughness=0.80)
    vn.add_box(11.5, 1.05, 19.0, -19.5, 0.52, -18.5, rot_y=-0.14)
    vn.add_box(7.8, 0.98, 20.5, -16.2, 0.49, -1.2, rot_y=0.16)
    vn.add_box(10.5, 0.92, 17.5, -18.8, 0.46, 16.5, rot_y=-0.18)
    meshes.append(vn)

    add_karst_mountains(
        meshes,
        "Day_Nui_Truong_Son_Hung_Vi",
        [
            (-23.5, 0.9, -22.0, 5.2, 9.2),
            (-21.0, 0.9, -9.5, 4.8, 8.4),
            (-20.2, 0.9, 2.5, 4.6, 8.0),
            (-22.5, 0.9, 13.5, 4.4, 7.2),
        ],
        color=(0.24, 0.41, 0.26, 1.0),
    )

    shelf = MeshPart("Them_Luc_Dia_Viet_Nam", (0.15, 0.56, 0.74, 1.0), metallic=0.15, roughness=0.36)
    shelf.add_box(14.5, 0.22, 56.0, -11.8, 0.06, -0.8)
    meshes.append(shelf)

    # Đình An Vĩnh (Quảng Ngãi) – Nơi tổ chức Lễ Khao lề thế lính Hoàng Sa từ thời Chúa Nguyễn – Triều Nguyễn
    add_viet_temple_hall(meshes, "Dinh_An_Vinh_Khao_Le_The_Linh_Hoang_Sa", (-16.8, 0.96, -3.8), rot_y=1.48, scale_f=0.78)
    add_village_houses(
        meshes,
        "Lang_Bien_Duyen_Hai_Viet_Nam",
        [
            (-17.2, 0.96, 4.2, 1.4),
            (-18.5, 0.92, 14.5, 1.2),
        ],
    )

    # Quần đảo Hoàng Sa (Nhiều đảo san hô, Miếu Hoàng Sa, Bia chủ quyền 1816 & Hải đăng)
    hs = MeshPart("Quan_Dao_Hoang_Sa", (0.86, 0.72, 0.42, 1.0), metallic=0.14, roughness=0.58, translation=(-1.8, 0.08, -8.2))
    hs.add_frustum(2.8, 3.6, 0.44, 16, 0.0, 0.22, 0.0)
    hs.add_frustum(1.3, 1.8, 0.30, 12, -3.2, 0.15, 1.8)
    hs.add_frustum(1.1, 1.5, 0.28, 12, 2.9, 0.14, -1.6)
    hs.add_box(0.68, 1.95, 0.38, -0.45, 1.28, 0.0)
    hs.add_frustum(0.18, 0.32, 2.65, 12, 0.95, 1.58, 0.35)
    meshes.append(hs)
    add_viet_temple_hall(meshes, "Mieu_Co_Hoang_Sa_Trieu_Nguyen", (-2.6, 0.48, -8.6), rot_y=0.5, scale_f=0.36)

    # Quần đảo Trường Sa (Vạn Lý Trường Sa: cụm đảo lớn, Bia chủ quyền & Hải đăng)
    ts = MeshPart("Quan_Dao_Truong_Sa", (0.86, 0.70, 0.44, 1.0), metallic=0.14, roughness=0.58, translation=(4.6, 0.08, 10.4))
    ts.add_frustum(3.2, 4.1, 0.46, 16, 0.0, 0.23, 0.0)
    ts.add_frustum(1.4, 1.9, 0.32, 12, -3.6, 0.16, -2.0)
    ts.add_frustum(1.2, 1.7, 0.30, 12, 3.4, 0.15, 2.1)
    ts.add_box(0.72, 2.05, 0.40, -0.50, 1.35, 0.0)
    ts.add_frustum(0.20, 0.34, 2.85, 12, 1.05, 1.68, -0.35)
    meshes.append(ts)

    sovereignty_flags = MeshPart("Co_Chu_Quyen_Hoang_Sa_Truong_Sa", (0.82, 0.14, 0.14, 1.0), metallic=0.12, roughness=0.55)
    sovereignty_flags.add_frustum(0.04, 0.05, 2.8, 8, -1.8, 1.85, -7.6)
    sovereignty_flags.add_box(1.1, 0.68, 0.04, -1.25, 2.95, -7.6)
    sovereignty_flags.add_frustum(0.04, 0.05, 3.0, 8, 4.6, 1.95, 11.0)
    sovereignty_flags.add_box(1.15, 0.72, 0.04, 5.18, 3.12, 11.0)
    meshes.append(sovereignty_flags)

    meshes.append(
        create_tactical_arrow("Tuyen_Hang_Hai_Thai_Binh_Duong_An_Do_Duong", (0.92, 0.74, 0.22, 1.0), (10.2, 0.38, 1.5), -0.28, 22.0)
    )

    anims = [
        AnimationClip(
            "Luu_Thong_Tuyen_Hang_Hai_Quoc_Te",
            [
                AnimationChannel(
                    "Tuyen_Hang_Hai_Thai_Binh_Duong_An_Do_Duong",
                    "translation",
                    [0.0, 3.0, 6.0],
                    [10.2, 0.38, 3.5, 10.2, 0.52, -1.5, 10.2, 0.38, 3.5],
                )
            ],
        )
    ]
    composer = GlbSceneComposer(compile_glb_bytes(meshes, anims, "KhongGianBienDong_WideHistoricalGLB"), "KhongGianBienDong_WideHistoricalGLB")

    # Cai đội Hoàng Sa, Thủy binh cắm mốc chủ quyền & Phụ nữ Việt Nam Áo Ngũ Thân – Nón Lá bên bờ biển miền Trung
    composer.place_glb(assets["human_mandarin"], "Cai_Doi_Hoang_Sa_Trieu_Nguyen", (-13.6, 0.98, -3.2), target_size=1.98, rot_y=1.45)
    composer.place_glb(assets["human_viet_folk_f"], "Phu_Nu_Mien_Bien_Viet_Nam_1", (-13.4, 0.98, -0.8), target_size=1.88, rot_y=1.48)
    composer.place_glb(assets["human_tham"], "Nu_Dan_Toc_Huong_Ve_Bien_Dao", (-14.2, 0.98, 0.8), target_size=1.86, rot_y=1.42)
    composer.place_glb(assets["human_bach_dang"], "Linh_Thu_Hoang_Sa_Cam_Moc", (-1.1, 0.52, -7.5), target_size=2.15, rot_y=0.4)
    composer.place_glb(assets["human_bach_dang"], "Linh_Thu_Truong_Sa_Canh_Bien", (5.3, 0.54, 11.1), target_size=2.15, rot_y=-0.6)
    composer.place_glb(assets["shipyard_kaykit"], "Thuong_Cang_Hoi_An_Da_Nang", (-13.2, 0.94, -7.8), target_size=3.2, rot_y=1.52)

    # Hải đội Hoàng Sa – Bắc Hải căng buồm ra khơi & Tàu hàng hải quốc tế
    hd_ship1 = composer.place_glb(assets["ship_royal"], "Thuyen_Hai_Doi_Hoang_Sa_1", (-8.8, 0.06, -6.2), target_size=4.8, rot_y=1.32)
    hd_ship2 = composer.place_glb(assets["boat_row"], "Thuyen_Cau_Hai_Doi_Bac_Hai", (-6.2, 0.08, 4.8), target_size=3.0, rot_y=1.18)
    intl_ship = composer.place_glb(assets["ship_armada"], "Tau_Hang_Hai_Quoc_Te_1", (8.2, 0.06, 20.5), target_size=5.4, rot_y=2.9)
    composer.place_glb(assets["ship_royal"], "Tau_Hang_Hai_Quoc_Te_2", (13.8, 0.06, -14.5), target_size=5.0, rot_y=-0.25)

    composer.add_node_animation_to_clip(0, hd_ship1, "translation", [0.0, 3.0, 6.0], [-9.6, 0.08, -5.6, -5.4, 0.08, -7.4, -9.6, 0.08, -5.6])
    composer.add_node_animation_to_clip(0, hd_ship2, "translation", [0.0, 3.0, 6.0], [-7.2, 0.08, 4.2, -1.8, 0.08, 7.6, -7.2, 0.08, 4.2])
    composer.add_node_animation_to_clip(0, intl_ship, "translation", [0.0, 3.0, 6.0], [7.6, 0.08, 21.0, 11.4, 0.08, 2.5, 7.6, 0.08, 21.0])

    # Hệ sinh thái sinh vật biển Biển Đông
    shark1 = composer.place_glb(assets["animal_shark"], "Ca_Map_Sinh_Thai_Bien_Dong", (9.8, 0.04, -10.5), target_size=2.2, rot_y=-0.6)
    composer.add_node_animation_to_clip(0, shark1, "translation", [0.0, 3.0, 6.0], [9.8, 0.06, -10.5, 5.4, 0.06, -4.2, 9.8, 0.06, -10.5])
    composer.place_glb(assets["animal_jellyfish"], "Sua_Bien_Truong_Sa", (10.5, 0.10, 13.5), target_size=1.45, rot_y=0.5)
    composer.place_glb(assets["animal_duck"], "Chim_Hai_Au_Hoang_Sa", (-0.4, 0.52, -8.8), target_size=0.68, rot_y=0.9)
    composer.place_glb(assets["animal_duck"], "Chim_Bien_Truong_Sa", (3.2, 0.54, 9.8), target_size=0.68, rot_y=-0.7)

    coastal_landscape = [
        ("palm_bend_tge", -1.0, 0.48, -9.4, 2.6, 0.8),
        ("palm_bend_tge", -3.4, 0.46, -7.0, 2.4, -0.5),
        ("palm_bend_tge", 5.8, 0.50, 11.8, 2.7, -0.7),
        ("palm_bend_tge", 3.2, 0.48, 9.2, 2.5, 1.1),
        ("palm_bend_tge", -13.8, 0.98, 6.8, 3.4, 0.9),
        ("nature_rock_kaykit", -17.5, 0.98, -1.4, 3.2, 0.3),
        ("nature_tree_freemodels", -18.8, 1.02, -15.8, 4.8, 0.5),
        ("nature_pine_kaykit", -17.6, 0.98, 9.6, 4.5, 1.1),
        ("nature_tree_kaykit", -18.2, 0.94, 19.4, 4.6, -0.4),
    ]
    for idx, (akey, cx, cy, cz, csize, crot) in enumerate(coastal_landscape):
        composer.place_glb(assets[akey], f"Canh_Quan_Bo_Bien_Dao_{idx + 1}", (cx, cy, cz), target_size=csize, rot_y=crot)

    return composer.export_bytes()


def build_industrial_urban_vehicles_glb(assets: Dict[str, Path]) -> bytes:
    """6. Văn minh Công nghiệp – Đô thị Cơ giới Cận – Hiện đại (Bài 2 – Đại cảnh 62m x 60m): Đại lộ giao thông, khu tài chính, cảng công nghiệp, nông trang cơ giới hóa & công viên sinh thái."""
    meshes: List[MeshPart] = []

    park_ground = MeshPart("Nen_Do_Thi_Va_Nong_Trang_Co_Gioi", (0.29, 0.48, 0.27, 1.0), metallic=0.04, roughness=0.88)
    park_ground.add_box(62.0, 0.65, 60.0, 0.0, -0.33, 0.0)
    meshes.append(park_ground)

    road = MeshPart("Dai_Lo_Giao_Thong_Co_Gioi", (0.19, 0.21, 0.25, 1.0), metallic=0.08, roughness=0.72)
    road.add_box(58.0, 0.08, 6.2, 0.0, 0.04, 2.0)
    road.add_box(5.6, 0.07, 52.0, 0.0, 0.035, -1.5)
    meshes.append(road)

    stripes = MeshPart("Vach_Phan_Lan_Dai_Lo", (0.94, 0.82, 0.28, 1.0), metallic=0.10, roughness=0.50)
    for sx in range(-26, 27, 4):
        stripes.add_box(1.8, 0.09, 0.20, float(sx), 0.05, 2.0)
    for sz in range(-24, 23, 4):
        if abs(sz - 2) > 4:
            stripes.add_box(0.20, 0.085, 1.8, 0.0, 0.048, float(sz))
    meshes.append(stripes)

    sidewalk = MeshPart("Quang_Truong_Lat_Da_Do_Thi", (0.74, 0.72, 0.67, 1.0), metallic=0.06, roughness=0.76)
    sidewalk.add_box(58.0, 0.10, 1.6, 0.0, 0.05, -1.9)
    sidewalk.add_box(58.0, 0.10, 1.6, 0.0, 0.05, 5.9)
    meshes.append(sidewalk)

    pond = MeshPart("Ho_Dieu_Hoa_Cong_Vien", (0.12, 0.45, 0.62, 0.90), metallic=0.30, roughness=0.18, alpha_blend=True)
    pond.add_frustum(6.2, 6.6, 0.10, 24, 14.5, 0.05, 14.5)
    meshes.append(pond)

    # Cánh đồng cơ giới hóa nông nghiệp ngoại ô phía Tây Bắc
    farmland = MeshPart("Canh_Dong_Co_Gioi_Hoa_Ngoai_O", (0.58, 0.52, 0.26, 1.0), metallic=0.04, roughness=0.88)
    for row in range(5):
        farmland.add_box(16.0, 0.12, 1.6, -18.0, 0.06, -10.0 - row * 2.6)
    meshes.append(farmland)

    anims = [
        AnimationClip(
            "Nhip_Song_Giao_Thong_Do_Thi_Hien_Dai",
            [AnimationChannel("Vach_Phan_Lan_Dai_Lo", "scale", [0.0, 3.0, 6.0], [1.0, 1.0, 1.0, 1.0, 1.02, 1.0, 1.0, 1.0, 1.0])],
        )
    ]
    composer = GlbSceneComposer(compile_glb_bytes(meshes, anims, "DoThiCoGioiHienDai_WideGLB"), "DoThiCoGioiHienDai_WideGLB")

    # Tổ hợp Kiến trúc Tài chính – Thương mại – Bảo tàng & Cảng logistics
    buildings = [
        ("building_city_kaykit", -9.5, -9.8, 6.2, 0.0),
        ("building_city_kaykit", 9.5, -9.8, 6.6, 0.0),
        ("building_city_kaykit", 18.5, -9.8, 5.8, 0.0),
        ("building_city_kaykit", 9.8, -18.5, 6.0, 1.57),
        ("castle_kaykit", -12.5, 14.5, 4.8, 0.35),
        ("shipyard_kaykit", 22.0, 12.5, 4.2, -0.5),
    ]
    for idx, (bkey, bx, bz, bsz, brot) in enumerate(buildings):
        composer.place_glb(assets[bkey], f"Kien_Truc_Do_Thi_{idx + 1}", (bx, 0.02, bz), target_size=bsz, rot_y=brot)

    # Đội hình xe cộ cơ giới vận hành trên đại lộ rộng 58m & máy kéo trên nông trang
    truck = composer.place_glb(assets["vehicle_truck"], "Xe_Tai_Van_Chuyen_Cong_Nghiep", (-22.0, 0.08, 0.6), target_size=3.2, rot_y=math.pi * 0.5)
    sedan = composer.place_glb(assets["vehicle_sedan"], "Xe_Oto_Sedan_Hien_Dai", (22.0, 0.08, 3.4), target_size=2.5, rot_y=-math.pi * 0.5)
    delivery = composer.place_glb(assets["vehicle_delivery"], "Xe_Thuong_Mai_Logistics", (8.0, 0.08, 3.4), target_size=2.9, rot_y=-math.pi * 0.5)
    suv = composer.place_glb(assets["vehicle_suv"], "Xe_SUV_Do_Thi", (1.3, 0.08, -18.0), target_size=2.6, rot_y=0.0)
    composer.place_glb(assets["vehicle_tractor"], "May_Keo_Co_Gioi_Nong_Nghiep_1", (-15.5, 0.12, -12.6), target_size=2.6, rot_y=1.57)
    composer.place_glb(assets["vehicle_tractor"], "May_Keo_Co_Gioi_Nong_Nghiep_2", (-20.5, 0.12, -17.8), target_size=2.6, rot_y=-1.57)

    composer.add_node_animation_to_clip(0, truck, "translation", [0.0, 3.0, 6.0], [-22.0, 0.08, 0.6, 20.0, 0.08, 0.6, -22.0, 0.08, 0.6])
    composer.add_node_animation_to_clip(0, sedan, "translation", [0.0, 3.0, 6.0], [22.0, 0.08, 3.4, -20.0, 0.08, 3.4, 22.0, 0.08, 3.4])
    composer.add_node_animation_to_clip(0, delivery, "translation", [0.0, 3.0, 6.0], [12.0, 0.08, 3.4, -14.0, 0.08, 3.4, 12.0, 0.08, 3.4])
    composer.add_node_animation_to_clip(0, suv, "translation", [0.0, 3.0, 6.0], [1.3, 0.08, -20.0, 1.3, 0.08, 18.0, 1.3, 0.08, -20.0])

    # Công dân đô thị thanh lịch (Không đeo kính sừng tuần lộc!)
    composer.place_glb(assets["human_modern_f"], "Cong_Dan_Tri_Thuc_Do_Thi_1", (-4.2, 0.10, 5.9), target_size=1.82, rot_y=2.8)
    composer.place_glb(assets["human_modern_m"], "Ky_Su_Cong_Nghiep_Do_Thi_1", (4.4, 0.10, -1.9), target_size=1.86, rot_y=0.2)
    composer.place_glb(assets["human_modern_f"], "Cong_Dan_Cong_Vien_Xanh", (8.8, 0.04, 12.2), target_size=1.80, rot_y=1.1)

    composer.place_glb(assets["animal_corgi"], "Thu_Cung_Cong_Vien_Corgi", (7.4, 0.04, 12.8), target_size=0.75, rot_y=2.2)
    composer.place_glb(assets["animal_duck"], "Vit_Ho_Sinh_Thai_1", (14.5, 0.10, 14.5), target_size=0.68, rot_y=-0.8)
    composer.place_glb(assets["animal_duck"], "Vit_Ho_Sinh_Thai_2", (16.2, 0.10, 15.8), target_size=0.65, rot_y=0.5)

    urban_trees = [
        ("nature_tree_freemodels", -21.5, 9.5, 5.2, 0.2),
        ("nature_tree_freemodels", -6.5, 11.2, 5.0, 1.1),
        ("nature_tree_kaykit", 6.2, 10.5, 4.6, -0.6),
        ("nature_tree_freemodels", 21.5, 18.5, 5.4, 0.8),
        ("nature_pine_kaykit", -5.2, -16.5, 4.8, 0.7),
        ("nature_pine_kaykit", 24.5, -6.5, 4.9, -0.5),
        ("nature_tree_kaykit", 19.5, 6.8, 4.6, 0.9),
        ("nature_tree_freemodels", -24.0, -4.5, 5.0, 1.4),
        ("nature_flower_bush_freemodels", -7.2, 6.2, 1.4, 0.4),
        ("nature_flower_bush_freemodels", 7.2, 6.2, 1.4, -0.3),
        ("nature_flower_bush_freemodels", 11.2, 16.8, 1.5, 0.8),
        ("nature_rock_freemodels", 18.8, 17.6, 2.2, 0.8),
    ]
    for idx, (akey, ux, uz, usize, urot) in enumerate(urban_trees):
        composer.place_glb(assets[akey], f"Cay_Xanh_Do_Thi_{idx + 1}", (ux, 0.0, uz), target_size=usize, rot_y=urot)

    return composer.export_bytes()


def build_heritage_ecosystem_showcase_glb(assets: Dict[str, Path]) -> bytes:
    """
    7. QUẦN THỂ DI SẢN VĂN HIẾN & QUÂN DÂN ĐẠI VIỆT (Đại cảnh mở rộng 68m x 68m – 100% đúng lịch sử truyền thống, không ô tô hiện đại!):
       - Trung tâm: Đền đài Văn hiến & Sân Rồng quy tụ trọn bộ 6 nguyên mẫu Nhân vật Cổ phục Việt Nam (Nhật Bình, Mũ Đâu Mâu Giáp Đồng, Mũ Cánh Chuồn Giao Lĩnh, Thủy Quân Bạch Đằng, Nghĩa Quân Lam Sơn, Áo Ngũ Thân Nón Lá).
       - Phía Đông: Bến Thủy Quân & Hải Cảng cổ với Soái thuyền, Thuyền chiến, Thuyền chèo & Súng Thần Cơ.
       - Phía Tây: Thành lũy, Chòi canh, Kỵ binh Chiến mã & Rừng núi đá vôi.
       - Phía Nam: Đầm sen sinh thái, cầu đá vòm, làng quê mái tranh & quần thể động vật sinh thái.
    """
    meshes: List[MeshPart] = []

    def heritage_relief(x: float, z: float) -> float:
        if x > 10.5 and z > -14.0:
            return -0.75
        if z < -22.0:
            return max(0.0, (-z - 22.0) * 0.34)
        return 0.0

    meadow = MeshPart("Non_Song_Van_Hien_Dai_Viet", (0.27, 0.47, 0.25, 1.0), metallic=0.04, roughness=0.88)
    meadow.add_terrain_grid(68.0, 68.0, 44, 44, heritage_relief, 0.0, 0.0, 0.0, skirt_depth=1.2)
    meshes.append(meadow)

    add_karst_mountains(
        meshes,
        "Day_Nui_Hung_Thieng_Phia_Bac",
        [
            (-22.0, 0.4, -27.5, 6.5, 11.2),
            (-7.0, 0.6, -28.5, 7.0, 12.4),
            (8.5, 0.6, -28.0, 6.6, 11.6),
            (23.0, 0.4, -26.8, 6.2, 10.4),
        ],
        color=(0.26, 0.40, 0.28, 1.0),
    )

    # Quảng trường Sân Rồng trung tâm & Chính điện Văn Hiến Đại Việt
    plaza = MeshPart("Quang_Truong_Da_Trung_Tam", (0.76, 0.72, 0.64, 1.0), metallic=0.08, roughness=0.68)
    plaza.add_frustum(7.8, 8.4, 0.22, 28, 0.0, 0.11, 0.0)
    plaza.add_frustum(4.4, 4.8, 0.26, 24, 0.0, 0.32, -0.8)
    plaza.add_box(4.2, 0.12, 22.0, 0.0, 0.06, 13.5)
    meshes.append(plaza)

    add_viet_temple_hall(meshes, "Dien_Van_Hien_Dai_Viet", (0.0, 0.04, -12.5), rot_y=0.0, scale_f=1.35)
    add_watchtower_and_camp(meshes, "Doanh_Trai_Quan_Su_Phia_Tay", (-18.5, 0.02, -4.5), rot_y=1.15)
    add_arched_stone_bridge(meshes, "Cau_Da_Qua_Song_Dong", (10.5, 0.04, 4.0), width=4.0, span=5.2)
    add_village_houses(
        meshes,
        "Lang_Co_Van_Hien_Dai_Viet",
        [
            (-18.5, 0.0, 15.5, 0.6),
            (-21.5, 0.0, 11.2, 0.9),
            (-15.2, 0.0, 19.2, 0.3),
        ],
    )

    lagoon = MeshPart("Song_Cang_Va_Vinh_Sinh_Thai", (0.08, 0.41, 0.59, 0.88), metallic=0.32, roughness=0.16, alpha_blend=True)
    lagoon.add_box(22.5, 0.16, 44.0, 21.5, -0.02, 7.0)
    meshes.append(lagoon)

    anims = [
        AnimationClip(
            "Toan_Canh_Bao_Tang_Nhan_Vat_Xe_Co_Dong_Vat_Canh_Quan",
            [AnimationChannel("Quang_Truong_Da_Trung_Tam", "scale", [0.0, 3.0, 6.0], [1.0, 1.0, 1.0, 1.0, 1.008, 1.0, 1.0, 1.0, 1.0])],
        )
    ]
    composer = GlbSceneComposer(compile_glb_bytes(meshes, anims, "QuanTheDiSanDaiViet3D_WideGLB"), "QuanTheDiSanDaiViet3D_WideGLB")

    # 1. TRUNG TÂM SÂN RỒNG: Trọn bộ 6 Nguyên mẫu Nhân vật Cổ phục Lịch sử Việt Nam
    composer.place_glb(assets["human_tham"], "Nu_Quy_Toc_Co_Phuc_Nhat_Binh", (-1.15, 0.45, -0.6), target_size=2.12, rot_y=0.18)
    composer.place_glb(assets["human_thanh"], "Vo_Tuong_Dai_Viet_Giap_Dong", (1.15, 0.45, -0.6), target_size=2.25, rot_y=-0.18)
    composer.place_glb(assets["human_mandarin"], "Quan_Dai_Than_Mu_Canh_Chuon", (-3.1, 0.45, 0.4), target_size=2.14, rot_y=0.35)
    composer.place_glb(assets["human_viet_folk_f"], "Phu_Nu_Ao_Ngu_Than_Non_La", (3.1, 0.45, 0.4), target_size=2.08, rot_y=-0.35)
    composer.place_glb(assets["human_bach_dang"], "Tuong_Thuy_Quan_Bach_Dang", (-2.6, 0.22, 4.2), target_size=2.35, rot_y=0.22)
    composer.place_glb(assets["human_lam_son"], "Nghia_Quan_Lam_Son_Khien_Giao", (2.6, 0.22, 4.2), target_size=2.32, rot_y=-0.22)

    # 2. KHU ĐÔNG – THỦY QUÂN & HẢI CẢNG CỔ TRUYỀN: Soái thuyền, Thuyền chiến, Thuyền chèo & Súng Thần Cơ
    composer.place_glb(assets["shipyard_kaykit"], "Thuong_Cang_Thuy_Quan_Co", (13.2, 0.06, -6.5), target_size=3.8, rot_y=-1.55)
    ship_show = composer.place_glb(assets["ship_royal"], "Soai_Thuyen_Dai_Viet", (18.5, -0.10, 6.8), target_size=5.8, rot_y=-0.25)
    ship_2 = composer.place_glb(assets["ship_armada"], "Chien_Thuyen_Vien_Duong_Co", (23.5, -0.10, -2.5), target_size=5.4, rot_y=-0.35)
    boat_show = composer.place_glb(assets["boat_row"], "Thuyen_Cheo_Tuan_Tieu", (15.2, -0.05, 14.5), target_size=3.0, rot_y=0.4)
    composer.place_glb(assets["cannon_mobile"], "Sung_Than_Co_Ho_Thanh_1", (-5.4, 0.04, 5.8), target_size=1.65, rot_y=0.3)
    composer.place_glb(assets["cannon_mobile"], "Sung_Than_Co_Ho_Thanh_2", (5.4, 0.04, 5.8), target_size=1.65, rot_y=-0.3)

    composer.add_node_animation_to_clip(0, ship_show, "translation", [0.0, 3.0, 6.0], [18.5, -0.06, 9.5, 18.5, -0.06, 2.2, 18.5, -0.06, 9.5])
    composer.add_node_animation_to_clip(0, ship_2, "translation", [0.0, 3.0, 6.0], [23.8, -0.06, -4.5, 23.2, -0.06, 3.5, 23.8, -0.06, -4.5])
    composer.add_node_animation_to_clip(0, boat_show, "translation", [0.0, 3.0, 6.0], [15.2, -0.04, 15.8, 16.4, -0.04, 11.2, 15.2, -0.04, 15.8])

    # 3. KHU TÂY & KHU NAM: Thành cổ, Chiến mã kỵ binh, Hươu sao & Quần thể động vật sinh thái có xương hoạt ảnh
    composer.place_glb(assets["castle_kaykit"], "Thanh_Luy_Co_Phia_Tay_Bac", (-14.5, 0.04, -15.5), target_size=4.8, rot_y=0.45)
    horse_patrol = composer.place_glb(assets["animal_horse"], "Chien_Ma_Ky_Binh_1", (-11.5, 0.02, -3.2), target_size=2.05, rot_y=0.55)
    composer.place_glb(assets["animal_horse"], "Chien_Ma_Ky_Binh_2", (-13.8, 0.02, -6.4), target_size=2.00, rot_y=0.75)
    composer.add_node_animation_to_clip(0, horse_patrol, "translation", [0.0, 3.0, 6.0], [-11.5, 0.02, -3.2, -8.8, 0.02, 3.6, -11.5, 0.02, -3.2])

    composer.place_glb(assets["animal_deer"], "Huou_Sao_Rung_Xanh_1", (-19.5, 0.02, -12.5), target_size=1.45, rot_y=0.75)
    composer.place_glb(assets["animal_shark"], "Ca_Map_Boi_Loi_Gobkit", (25.5, -0.04, 14.2), target_size=2.15, rot_y=0.6)
    composer.place_glb(assets["animal_jellyfish"], "Sua_Bien_Gobkit", (21.2, 0.04, 18.5), target_size=1.35, rot_y=0.3)
    composer.place_glb(assets["animal_duck"], "Chim_Vit_Nuoc_Gobkit", (14.2, 0.02, 8.6), target_size=0.78, rot_y=1.1)
    composer.place_glb(assets["animal_hippo"], "Ha_Ma_Bo_Song_Gobkit", (11.2, 0.02, 16.5), target_size=1.65, rot_y=-0.85)
    composer.place_glb(assets["animal_corgi"], "Khuyen_Canh_Lang_Viet_Gobkit", (-13.2, 0.04, 14.2), target_size=0.78, rot_y=0.55)

    botanical_ring = [
        ("nature_tree_freemodels", -8.8, -14.5, 5.4, 0.3),
        ("nature_tree_freemodels", 8.8, -14.5, 5.4, -0.4),
        ("nature_tree_kaykit", -18.6, -18.2, 5.0, 0.9),
        ("nature_pine_kaykit", 16.8, -18.2, 5.1, -0.7),
        ("palm_bend_tge", 11.8, 19.8, 4.2, 0.6),
        ("palm_bend_tge", 12.2, -1.8, 4.0, -0.5),
        ("nature_tree_kaykit", -6.8, 18.5, 4.9, 2.8),
        ("nature_tree_freemodels", -23.5, 4.5, 5.5, 0.5),
        ("nature_pine_kaykit", -24.0, -9.5, 5.2, 1.4),
        ("nature_tree_freemodels", 5.8, 21.0, 5.0, -0.6),
        ("nature_flower_bush_freemodels", -4.8, -4.2, 1.5, 0.4),
        ("nature_flower_bush_freemodels", 4.8, -4.2, 1.5, -0.4),
        ("nature_flower_bush_freemodels", -3.2, 9.6, 1.5, 0.2),
        ("nature_flower_bush_freemodels", 3.2, 9.6, 1.5, -0.2),
        ("nature_rock_freemodels", -15.5, -9.2, 2.5, 0.5),
        ("nature_rock_kaykit", 8.6, -18.4, 2.6, -0.8),
    ]
    for idx, (akey, bx, bz, bsize, brot) in enumerate(botanical_ring):
        composer.place_glb(assets[akey], f"Canh_Quan_Cay_Coi_{idx + 1}", (bx, heritage_relief(bx, bz), bz), target_size=bsize, rot_y=brot)

    return composer.export_bytes()


def build_custom_ecosystem_preset(params: Dict[str, object], pack_dir: Path) -> Tuple[bytes, Dict[str, object]]:
    """Preset thứ 5 cho Xưởng Python Giáo viên: Tùy biến số lượng Nhân vật Cổ phục, Chiến thuyền/Kỵ mã, Động vật & Cây cối trên không gian rộng 48m."""
    assets = ensure_curated_asset_pack(pack_dir)
    human_count = max(1, min(6, int(params.get("humanCount", 4))))
    vehicle_count = max(1, min(4, int(params.get("vehicleCount", 3))))
    animal_count = max(1, min(5, int(params.get("animalCount", 4))))
    tree_density = max(2, min(12, int(params.get("treeDensity", 8))))

    meshes: List[MeshPart] = []
    ground = MeshPart("Sa_Ban_Lich_Su_Mo_Rong_Tuy_Bien", (0.28, 0.47, 0.26, 1.0), roughness=0.88)
    ground.add_box(48.0, 0.60, 48.0, 0.0, -0.30, 0.0)
    meshes.append(ground)

    plaza = MeshPart("Quang_Truong_Trung_Tam", (0.76, 0.72, 0.64, 1.0), roughness=0.70)
    plaza.add_frustum(5.6, 6.0, 0.18, 24, 0.0, 0.09, 0.0)
    meshes.append(plaza)

    add_viet_temple_hall(meshes, "Dien_Co_Truyen_Trung_Tam", (0.0, 0.02, -9.5), rot_y=0.0, scale_f=0.95)

    water = MeshPart("Song_Nuoc_Sinh_Thai", (0.10, 0.42, 0.60, 0.90), metallic=0.30, roughness=0.18, alpha_blend=True)
    water.add_box(14.0, 0.12, 36.0, 14.5, 0.05, 2.0)
    meshes.append(water)

    anim_name = "Chuyen_Dong_Quan_The_Nguoi_Xe_DongVat"
    base_anims = [AnimationClip(anim_name, [AnimationChannel("Quang_Truong_Trung_Tam", "scale", [0.0, 3.0, 6.0], [1.0, 1.0, 1.0, 1.0, 1.01, 1.0, 1.0, 1.0, 1.0])])]
    composer = GlbSceneComposer(compile_glb_bytes(meshes, base_anims, "CustomHistoricalEcosystem_GLB"), "CustomHistoricalEcosystem_GLB")

    h_keys = ["human_tham", "human_thanh", "human_mandarin", "human_bach_dang", "human_lam_son", "human_viet_folk_f"]
    for i in range(human_count):
        hx = (i - (human_count - 1) * 0.5) * 1.65
        composer.place_glb(assets[h_keys[i % len(h_keys)]], f"Nhan_Vat_Co_Phuc_{i + 1}", (hx, 0.18, 0.5), target_size=2.05, rot_y=0.0)

    v_specs = [
        ("ship_royal", 14.5, 0.05, 6.5, 4.6),
        ("ship_armada", 16.5, 0.05, -4.5, 4.4),
        ("boat_row", 12.2, 0.06, 12.0, 2.6),
        ("cannon_mobile", 4.6, 0.04, 3.6, 1.55),
    ]
    for i in range(vehicle_count):
        vkey, vx, vy, vz, vsz = v_specs[i % len(v_specs)]
        vnode = composer.place_glb(assets[vkey], f"Khi_Cu_Thuyen_Chien_{i + 1}", (vx, vy, vz), target_size=vsz, rot_y=-0.2)
        if "ship" in vkey or "boat" in vkey:
            composer.add_node_animation_to_clip(0, vnode, "translation", [0.0, 3.0, 6.0], [vx, vy, vz, vx, vy, vz - 3.2, vx, vy, vz])

    a_specs = [
        ("animal_horse", -8.5, 0.02, -2.5, 1.85),
        ("animal_deer", -12.5, 0.02, -7.2, 1.35),
        ("animal_duck", 10.5, 0.08, 4.2, 0.68),
        ("animal_shark", 17.5, 0.05, 9.8, 1.85),
        ("animal_corgi", -5.2, 0.04, 4.8, 0.72),
    ]
    for i in range(animal_count):
        akey, ax, ay, az, asz = a_specs[i]
        composer.place_glb(assets[akey], f"Dong_Vat_Sinh_Thai_{i + 1}", (ax, ay, az), target_size=asz, rot_y=0.6)

    t_keys = ["nature_tree_freemodels", "nature_tree_kaykit", "nature_pine_kaykit", "nature_flower_bush_freemodels"]
    for i in range(tree_density):
        ang = (i / max(1, tree_density)) * math.pi * 1.45 + 0.75
        tx = math.cos(ang) * 16.5
        tz = -math.sin(ang) * 16.0
        tkey = t_keys[i % len(t_keys)]
        tsz = 1.45 if "bush" in tkey else 4.6
        composer.place_glb(assets[tkey], f"Cay_Canh_Quan_{i + 1}", (tx, 0.0, tz), target_size=tsz, rot_y=ang)

    glb_bytes = composer.export_bytes()
    meta = {
        "animationNames": [anim_name],
        "cameraSettings": {"position": [16.5, 10.5, 20.5], "target": [0.0, 1.2, 0.0]},
        "phases": [
            {
                "key": "all",
                "label": "Toàn cảnh Quần thể Lịch sử 3D Mở rộng",
                "animationName": anim_name,
                "cameraPosition": [16.5, 10.5, 20.5],
                "cameraTarget": [0.0, 1.2, 0.0],
                "summary": f"Hợp nhất {human_count} nhân vật cổ phục Việt Nam, {vehicle_count} chiến thuyền/khí cụ, {animal_count} động vật và {tree_density} cụm cây cảnh quan trên không gian rộng 48m.",
            }
        ],
        "hotspots": [
            {
                "x": 0.0,
                "y": 2.1,
                "z": 0.5,
                "title": "Đội hình Nhân vật Cổ phục Việt Nam 3D",
                "description": "Tích hợp từ hmthanh/3d-human-model, mặc cổ phục Giao Lĩnh – Nhật Bình, Giáp đồng Mũ Đâu Mâu, Mũ Cánh Chuồn và Áo Ngũ Thân Nón Lá.",
                "phaseKey": "all",
            },
            {
                "x": 14.5,
                "y": 1.8,
                "z": 4.0,
                "title": "Thủy đội Chiến thuyền & Súng Thần Cơ",
                "description": f"Gồm {vehicle_count} phương tiện thủy chiến và hỏa khí cổ truyền từ Hidencod/tge-assets.",
                "phaseKey": "all",
            },
            {
                "x": -9.0,
                "y": 1.4,
                "z": -3.0,
                "title": "Chiến mã, Động vật & Cảnh quan Rừng xanh",
                "description": "Kết hợp động vật có xương hoạt ảnh (gobkit-free-assets) cùng thảm thực vật FreeModels & KayKit.",
                "phaseKey": "all",
            },
        ],
    }
    return glb_bytes, meta


def build_all_beautified_scenes(models_dir: Path) -> List[Dict[str, object]]:
    models_dir.mkdir(parents=True, exist_ok=True)
    pack_dir = models_dir / "assets_pack"
    assets = ensure_curated_asset_pack(pack_dir)

    targets: List[Tuple[str, Callable[[Dict[str, Path]], bytes]]] = [
        ("bach_dang_938.glb", build_beautified_bach_dang_938),
        ("khoi_nghia_lam_son.glb", build_beautified_lam_son),
        ("thanh_nha_ho.glb", build_beautified_thanh_nha_ho),
        ("dong_nam_a_can_dai.glb", build_beautified_dong_nam_a),
        ("khong_gian_bien_dong.glb", build_beautified_bien_dong),
        ("van_minh_cong_nghiep_do_thi.glb", build_industrial_urban_vehicles_glb),
        ("quan_the_nhan_vat_sinh_thai_3d.glb", build_heritage_ecosystem_showcase_glb),
    ]

    results: List[Dict[str, object]] = []
    for filename, builder in targets:
        glb_bytes = builder(assets)
        out_file = models_dir / filename
        out_file.write_bytes(glb_bytes)
        results.append({"filename": filename, "bytes": len(glb_bytes), "generator": ENHANCED_GENERATOR})
    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Biên dịch cổ phục lịch sử & đại cảnh mở rộng .glb")
    parser.add_argument("--build-all", action="store_true", help="Xuất toàn bộ tài nguyên cổ phục và 7 đại cảnh .glb")
    parser.add_argument("--out-dir", type=str, default="public/models", help="Thư mục xuất tệp .glb")
    parser.add_argument("--custom-out", type=str, help="Xuất tệp .glb tùy biến theo --params-json")
    parser.add_argument("--params-json", type=str, default="{}", help="Tham số JSON cho --custom-out")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    if args.custom_out:
        params = json.loads(args.params_json or "{}")
        glb_data, meta = build_custom_ecosystem_preset(params, out_dir / "assets_pack")
        custom_path = Path(args.custom_out)
        custom_path.parent.mkdir(parents=True, exist_ok=True)
        custom_path.write_bytes(glb_data)
        print(
            json.dumps(
                {
                    "ok": True,
                    "outFile": str(custom_path),
                    "bytes": len(glb_data),
                    "generator": ENHANCED_GENERATOR,
                    "meta": meta,
                },
                ensure_ascii=False,
            )
        )
    elif args.build_all:
        built = build_all_beautified_scenes(out_dir)
        print(json.dumps({"ok": True, "built": built}, ensure_ascii=False))
