#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TRÌNH BIÊN DỊCH MÔ PHỎNG LỊCH SỬ 3D TỪ PYTHON SANG CHUẨN NHỊ PHÂN glTF 2.0 (.glb)
Ứng dụng: LỊCH SỬ 11 3D – KHÁM PHÁ LỊCH SỬ QUA KHÔNG GIAN SỐ (Trường THPT Hòa Minh, Vĩnh Long)

Chức năng:
1. Lập trình hình học 3D thủ tục bằng Python 3 thuần (struct, json, math — không phụ thuộc thư viện ngoài):
   - Lưới địa hình cao độ (Relief Terrain Heightfield) với pháp tuyến chuẩn hóa đơn vị.
   - Chiến thuyền cổ nhiều bộ phận (thân thuyền, mũi/lái cong, khoang chỉ huy, cột buồm, cánh buồm, mái chèo).
   - Trận địa cọc gỗ lim bịt sắt nhọn, vòm cuốn đá khối Thành nhà Hồ, quần đảo Hoàng Sa – Trường Sa, bia chủ quyền.
   - Hoạt ảnh khung khóa (Keyframe Animations) cho thủy triều, hướng tiến quân, hải trình quốc tế và kỳ đài.
2. Đóng gói trực tiếp ra tệp nhị phân glTF 2.0 (.glb) tương thích 100% với Three.js GLTFLoader.

Cách chạy dòng lệnh:
  python3 public/python_glb/sinh_mo_phong_lich_su_glb.py --build-all --out-dir public/models
  python3 public/python_glb/sinh_mo_phong_lich_su_glb.py --preset naval_ambush --out-file rach_gam_1785.glb
"""

from __future__ import annotations

import argparse
import json
import math
import os
import struct
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

GENERATOR_SIGNATURE = "Python-3.10-LichSu11-3D-GLB-Compiler"

Vec3 = Tuple[float, float, float]
Vec4 = Tuple[float, float, float, float]


def normalize_vec3(nx: float, ny: float, nz: float) -> Vec3:
    length = math.sqrt(nx * nx + ny * ny + nz * nz)
    if length < 1e-9:
        return (0.0, 1.0, 0.0)
    return (nx / length, ny / length, nz / length)


def quat_from_euler_y(rot_y: float) -> Vec4:
    half = rot_y * 0.5
    return (0.0, math.sin(half), 0.0, math.cos(half))


def quat_from_axis_angle(ax: float, ay: float, az: float, angle: float) -> Vec4:
    ux, uy, uz = normalize_vec3(ax, ay, az)
    half = angle * 0.5
    s = math.sin(half)
    return (ux * s, uy * s, uz * s, math.cos(half))


class MeshPart:
    """Tập hợp đỉnh (positions, normals) và chỉ số tam giác (indices) cho một đối tượng 3D."""

    def __init__(
        self,
        name: str,
        color: Vec4,
        metallic: float = 0.12,
        roughness: float = 0.76,
        translation: Optional[Vec3] = None,
        rotation: Optional[Vec4] = None,
        scale: Optional[Vec3] = None,
        alpha_blend: bool = False,
    ) -> None:
        self.name = name
        self.color = color
        self.metallic = metallic
        self.roughness = roughness
        self.translation = translation
        self.rotation = rotation
        self.scale = scale
        self.alpha_blend = alpha_blend
        self.positions: List[float] = []
        self.normals: List[float] = []
        self.indices: List[int] = []

    def add_box(
        self,
        w: float,
        h: float,
        d: float,
        ox: float = 0.0,
        oy: float = 0.0,
        oz: float = 0.0,
        tilt_x: float = 0.0,
        rot_y: float = 0.0,
    ) -> "MeshPart":
        hw, hh, hd = w * 0.5, h * 0.5, d * 0.5
        faces = [
            ((0.0, 0.0, 1.0), [(-hw, -hh, hd), (hw, -hh, hd), (hw, hh, hd), (-hw, hh, hd)]),
            ((0.0, 0.0, -1.0), [(hw, -hh, -hd), (-hw, -hh, -hd), (-hw, hh, -hd), (hw, hh, -hd)]),
            ((0.0, 1.0, 0.0), [(-hw, hh, hd), (hw, hh, hd), (hw, hh, -hd), (-hw, hh, -hd)]),
            ((0.0, -1.0, 0.0), [(-hw, -hh, -hd), (hw, -hh, -hd), (hw, -hh, hd), (-hw, -hh, hd)]),
            ((1.0, 0.0, 0.0), [(hw, -hh, hd), (hw, -hh, -hd), (hw, hh, -hd), (hw, hh, hd)]),
            ((-1.0, 0.0, 0.0), [(-hw, -hh, -hd), (-hw, -hh, hd), (-hw, hh, hd), (-hw, hh, -hd)]),
        ]

        cx, sx = math.cos(tilt_x), math.sin(tilt_x)
        cy, sy = math.cos(rot_y), math.sin(rot_y)

        def transform_dir(vx: float, vy: float, vz: float) -> Vec3:
            # X-tilt then Y-rotation
            y1 = vy * cx - vz * sx
            z1 = vy * sx + vz * cx
            x2 = vx * cy + z1 * sy
            z2 = -vx * sy + z1 * cy
            return (x2, y1, z2)

        for n_raw, verts in faces:
            base = len(self.positions) // 3
            nx, ny, nz = normalize_vec3(*transform_dir(*n_raw))
            for vx, vy, vz in verts:
                rx, ry, rz = transform_dir(vx, vy, vz)
                self.positions.extend([rx + ox, ry + oy, rz + oz])
                self.normals.extend([nx, ny, nz])
            self.indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])
        return self

    def add_frustum(
        self,
        radius_top: float,
        radius_bottom: float,
        height: float,
        segments: int = 12,
        ox: float = 0.0,
        oy: float = 0.0,
        oz: float = 0.0,
        tilt_x: float = 0.0,
        tilt_z: float = 0.0,
    ) -> "MeshPart":
        half_h = height * 0.5
        base_idx = len(self.positions) // 3
        slope_y = (radius_bottom - radius_top) / max(height, 1e-5)

        cx, sx = math.cos(tilt_x), math.sin(tilt_x)
        cz, sz = math.cos(tilt_z), math.sin(tilt_z)

        def rot_vec(vx: float, vy: float, vz: float) -> Vec3:
            # Rotate around X then Z
            y1 = vy * cx - vz * sx
            z1 = vy * sx + vz * cx
            x2 = vx * cz - y1 * sz
            y2 = vx * sz + y1 * cz
            return (x2, y2, z1)

        for i in range(segments + 1):
            theta = (i / segments) * math.tau
            c = math.cos(theta)
            s = math.sin(theta)
            nx, ny, nz = normalize_vec3(*rot_vec(c, slope_y, s))

            tx, ty, tz = rot_vec(c * radius_top, half_h, s * radius_top)
            bx, by, bz = rot_vec(c * radius_bottom, -half_h, s * radius_bottom)

            self.positions.extend([tx + ox, ty + oy, tz + oz])
            self.normals.extend([nx, ny, nz])
            self.positions.extend([bx + ox, by + oy, bz + oz])
            self.normals.extend([nx, ny, nz])

        for i in range(segments):
            a = base_idx + i * 2
            b = a + 1
            c_idx = a + 2
            d_idx = a + 3
            self.indices.extend([a, b, d_idx, a, d_idx, c_idx])

        if radius_top > 0.002:
            top_center = len(self.positions) // 3
            tnx, tny, tnz = normalize_vec3(*rot_vec(0.0, 1.0, 0.0))
            tcx, tcy, tcz = rot_vec(0.0, half_h, 0.0)
            self.positions.extend([tcx + ox, tcy + oy, tcz + oz])
            self.normals.extend([tnx, tny, tnz])
            for i in range(segments + 1):
                theta = (i / segments) * math.tau
                vx, vy, vz = rot_vec(math.cos(theta) * radius_top, half_h, math.sin(theta) * radius_top)
                self.positions.extend([vx + ox, vy + oy, vz + oz])
                self.normals.extend([tnx, tny, tnz])
            for i in range(segments):
                self.indices.extend([top_center, top_center + 1 + i + 1, top_center + 1 + i])

        if radius_bottom > 0.002:
            bot_center = len(self.positions) // 3
            bnx, bny, bnz = normalize_vec3(*rot_vec(0.0, -1.0, 0.0))
            bcx, bcy, bcz = rot_vec(0.0, -half_h, 0.0)
            self.positions.extend([bcx + ox, bcy + oy, bcz + oz])
            self.normals.extend([bnx, bny, bnz])
            for i in range(segments + 1):
                theta = (i / segments) * math.tau
                vx, vy, vz = rot_vec(math.cos(theta) * radius_bottom, -half_h, math.sin(theta) * radius_bottom)
                self.positions.extend([vx + ox, vy + oy, vz + oz])
                self.normals.extend([bnx, bny, bnz])
            for i in range(segments):
                self.indices.extend([bot_center, bot_center + 1 + i, bot_center + 1 + i + 1])

        return self

    def add_terrain_grid(
        self,
        width: float,
        depth: float,
        seg_x: int,
        seg_z: int,
        height_fn: Callable[[float, float], float],
        ox: float = 0.0,
        oy: float = 0.0,
        oz: float = 0.0,
        skirt_depth: float = 0.55,
    ) -> "MeshPart":
        """Tạo mặt địa hình 3D liên tục từ hàm độ cao y = height_fn(x, z) kèm chân đế (skirt)."""
        base = len(self.positions) // 3
        dx = width / seg_x
        dz = depth / seg_z
        eps = 0.08

        for iz in range(seg_z + 1):
            z = -depth * 0.5 + iz * dz
            for ix in range(seg_x + 1):
                x = -width * 0.5 + ix * dx
                y = height_fn(x, z)
                dhx = (height_fn(x + eps, z) - height_fn(x - eps, z)) / (2.0 * eps)
                dhz = (height_fn(x, z + eps) - height_fn(x, z - eps)) / (2.0 * eps)
                nx, ny, nz = normalize_vec3(-dhx, 1.0, -dhz)
                self.positions.extend([x + ox, y + oy, z + oz])
                self.normals.extend([nx, ny, nz])

        row_stride = seg_x + 1
        for iz in range(seg_z):
            for ix in range(seg_x):
                a = base + iz * row_stride + ix
                b = a + 1
                c_idx = a + row_stride
                d_idx = c_idx + 1
                self.indices.extend([a, c_idx, b, b, c_idx, d_idx])

        # Chân đế sa bàn bảo tàng để khối địa hình có độ dày chắc chắn
        self.add_box(width, skirt_depth, depth, ox, oy - skirt_depth * 0.5 - 0.15, oz)
        return self

    def add_stone_arch(
        self,
        arch_radius: float,
        arch_thickness: float,
        depth: float,
        voussoirs: int = 9,
        ox: float = 0.0,
        oy: float = 0.0,
        oz: float = 0.0,
    ) -> "MeshPart":
        """Xếp các viên đá vòm cuốn hình nêm (voussoirs) chân thực cho cổng thành cổ."""
        for i in range(voussoirs):
            angle = math.pi * ((i + 0.5) / voussoirs)
            cx = math.cos(angle) * (arch_radius + arch_thickness * 0.42)
            cy = math.sin(angle) * (arch_radius + arch_thickness * 0.42)
            wedge_w = (math.pi * arch_radius / voussoirs) * 0.96
            # Rotate block around Z axis to follow semicircular arch
            half_w, half_h, half_d = wedge_w * 0.5, arch_thickness * 0.5, depth * 0.5
            rot_z = angle - math.pi * 0.5
            cz, sz = math.cos(rot_z), math.sin(rot_z)

            faces = [
                ((0.0, 0.0, 1.0), [(-half_w, -half_h, half_d), (half_w, -half_h, half_d), (half_w, half_h, half_d), (-half_w, half_h, half_d)]),
                ((0.0, 0.0, -1.0), [(half_w, -half_h, -half_d), (-half_w, -half_h, -half_d), (-half_w, half_h, -half_d), (half_w, half_h, -half_d)]),
                ((0.0, 1.0, 0.0), [(-half_w, half_h, half_d), (half_w, half_h, half_d), (half_w, half_h, -half_d), (-half_w, half_h, -half_d)]),
                ((0.0, -1.0, 0.0), [(-half_w, -half_h, -half_d), (half_w, -half_h, -half_d), (half_w, -half_h, half_d), (-half_w, -half_h, half_d)]),
                ((1.0, 0.0, 0.0), [(half_w, -half_h, half_d), (half_w, -half_h, -half_d), (half_w, half_h, -half_d), (half_w, half_h, half_d)]),
                ((-1.0, 0.0, 0.0), [(-half_w, -half_h, -half_d), (-half_w, -half_h, half_d), (-half_w, half_h, half_d), (-half_w, half_h, -half_d)]),
            ]
            for n_raw, verts in faces:
                base = len(self.positions) // 3
                nx = n_raw[0] * cz - n_raw[1] * sz
                ny = n_raw[0] * sz + n_raw[1] * cz
                nx, ny, nz = normalize_vec3(nx, ny, n_raw[2])
                for vx, vy, vz in verts:
                    rx = vx * cz - vy * sz
                    ry = vx * sz + vy * cz
                    self.positions.extend([rx + cx + ox, ry + cy + oy, vz + oz])
                    self.normals.extend([nx, ny, nz])
                self.indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])
        return self


class AnimationChannel:
    def __init__(
        self,
        target_node_name: str,
        path: str,
        times: Sequence[float],
        values: Sequence[float],
    ) -> None:
        self.target_node_name = target_node_name
        self.path = path  # 'translation' | 'rotation' | 'scale'
        self.times = list(times)
        self.values = list(values)


class AnimationClip:
    def __init__(self, name: str, channels: Sequence[AnimationChannel]) -> None:
        self.name = name
        self.channels = list(channels)


def create_warship_parts(
    name: str,
    hull_color: Vec4,
    sail_color: Vec4,
    translation: Vec3,
    rot_y: float = 0.0,
    scale_factor: float = 1.0,
) -> List[MeshPart]:
    """Tạo chiến thuyền cổ nhiều chi tiết: thân thuyền, mũi/lái cong, lầu chỉ huy, cột buồm, mái chèo và buồm."""
    quat = quat_from_euler_y(rot_y)
    s_vec = (scale_factor, scale_factor, scale_factor) if abs(scale_factor - 1.0) > 1e-4 else None

    hull = MeshPart(
        name=name,
        color=hull_color,
        metallic=0.14,
        roughness=0.72,
        translation=translation,
        rotation=quat,
        scale=s_vec,
    )
    # 1. Thân chính + be thuyền
    hull.add_box(0.86, 0.28, 2.35, 0.0, 0.16, 0.0)
    hull.add_box(0.94, 0.10, 2.15, 0.0, 0.30, 0.0)
    # 2. Mũi thuyền vươn cao & đuôi thuyền cong
    hull.add_box(0.48, 0.32, 0.68, 0.0, 0.30, 1.22, tilt_x=-0.28)
    hull.add_box(0.54, 0.36, 0.62, 0.0, 0.34, -1.16, tilt_x=0.25)
    # 3. Khoang lầu chỉ huy & trống trận trên boong
    hull.add_box(0.58, 0.32, 0.88, 0.0, 0.44, -0.18)
    hull.add_box(0.68, 0.08, 0.98, 0.0, 0.62, -0.18)
    # 4. Cột buồm chính + xà ngang
    hull.add_frustum(0.038, 0.052, 1.72, 10, 0.0, 1.02, 0.18)
    hull.add_box(1.02, 0.045, 0.045, 0.0, 1.52, 0.20)
    hull.add_box(0.98, 0.04, 0.04, 0.0, 0.68, 0.20)
    # 5. Hai hàng mái chèo bên mạn thuyền
    for z_oar in (-0.65, -0.20, 0.25, 0.70):
        hull.add_box(0.55, 0.03, 0.05, -0.62, 0.14, z_oar, tilt_x=0.1, rot_y=0.25)
        hull.add_box(0.55, 0.03, 0.05, 0.62, 0.14, z_oar, tilt_x=0.1, rot_y=-0.25)

    sail = MeshPart(
        name=f"{name}_Buom",
        color=sail_color,
        metallic=0.04,
        roughness=0.88,
        translation=translation,
        rotation=quat,
        scale=s_vec,
    )
    # Cánh buồm no gió ghép 3 dải nan tre
    sail.add_box(0.96, 0.28, 0.045, 0.0, 1.36, 0.23, tilt_x=0.08)
    sail.add_box(0.98, 0.30, 0.045, 0.0, 1.08, 0.26, tilt_x=0.02)
    sail.add_box(0.94, 0.26, 0.045, 0.0, 0.82, 0.23, tilt_x=-0.06)
    # Cờ đuôi nheo trên đỉnh cột buồm
    sail.add_box(0.42, 0.14, 0.03, 0.21, 1.80, 0.18)

    return [hull, sail]


def create_tactical_arrow(
    name: str,
    color: Vec4,
    translation: Vec3,
    rot_y: float = 0.0,
    length: float = 2.4,
) -> MeshPart:
    part = MeshPart(
        name=name,
        color=color,
        metallic=0.42,
        roughness=0.34,
        translation=translation,
        rotation=quat_from_euler_y(rot_y),
    )
    part.add_box(0.22, 0.08, length, 0.0, 0.0, 0.0)
    tip_z = length * 0.5 + 0.16
    part.add_box(0.46, 0.09, 0.18, -0.14, 0.0, tip_z, rot_y=0.58)
    part.add_box(0.46, 0.09, 0.18, 0.14, 0.0, tip_z, rot_y=-0.58)
    return part


def compile_glb_bytes(
    meshes: Sequence[MeshPart],
    animations: Sequence[AnimationClip] = (),
    scene_name: str = "HistoricalSimulationScene",
) -> bytes:
    """Đóng gói danh sách MeshPart và AnimationClip thành chuỗi byte nhị phân chuẩn glTF 2.0 (.glb)."""
    buffer_views: List[Dict[str, object]] = []
    accessors: List[Dict[str, object]] = []
    materials: List[Dict[str, object]] = []
    gltf_meshes: List[Dict[str, object]] = []
    nodes: List[Dict[str, object]] = []
    binary_chunks: List[bytes] = []
    byte_offset = 0

    def append_aligned(raw: bytes, target: Optional[int] = None) -> int:
        nonlocal byte_offset
        pad = (4 - (len(raw) % 4)) % 4
        aligned = raw + (b"\x00" * pad) if pad else raw
        view_idx = len(buffer_views)
        view: Dict[str, object] = {
            "buffer": 0,
            "byteOffset": byte_offset,
            "byteLength": len(raw),
        }
        if target is not None:
            view["target"] = target
        buffer_views.append(view)
        binary_chunks.append(aligned)
        byte_offset += len(aligned)
        return view_idx

    def min_max_vec(values: Sequence[float], stride: int) -> Tuple[List[float], List[float]]:
        mins = [float("inf")] * stride
        maxs = [float("-inf")] * stride
        for i in range(0, len(values), stride):
            for c in range(stride):
                v = float(values[i + c])
                if v < mins[c]:
                    mins[c] = v
                if v > maxs[c]:
                    maxs[c] = v
        return mins, maxs

    node_name_to_idx: Dict[str, int] = {}

    for m in meshes:
        if not m.positions or not m.indices:
            continue

        mat_idx = len(materials)
        mat_obj: Dict[str, object] = {
            "name": f"{m.name}_Mat",
            "pbrMetallicRoughness": {
                "baseColorFactor": [round(float(x), 5) for x in m.color],
                "metallicFactor": round(float(m.metallic), 4),
                "roughnessFactor": round(float(m.roughness), 4),
            },
            "doubleSided": True,
        }
        if m.alpha_blend or m.color[3] < 0.999:
            mat_obj["alphaMode"] = "BLEND"
        materials.append(mat_obj)

        pos_count = len(m.positions) // 3
        pos_bytes = struct.pack(f"<{len(m.positions)}f", *m.positions)
        pos_view = append_aligned(pos_bytes, 34962)
        p_min, p_max = min_max_vec(m.positions, 3)
        pos_acc = len(accessors)
        accessors.append(
            {
                "bufferView": pos_view,
                "componentType": 5126,
                "count": pos_count,
                "type": "VEC3",
                "min": p_min,
                "max": p_max,
            }
        )

        norm_bytes = struct.pack(f"<{len(m.normals)}f", *m.normals)
        norm_view = append_aligned(norm_bytes, 34962)
        norm_acc = len(accessors)
        accessors.append(
            {
                "bufferView": norm_view,
                "componentType": 5126,
                "count": len(m.normals) // 3,
                "type": "VEC3",
            }
        )

        use_u32 = pos_count > 65530
        idx_fmt = f"<{len(m.indices)}{'I' if use_u32 else 'H'}"
        idx_bytes = struct.pack(idx_fmt, *m.indices)
        idx_view = append_aligned(idx_bytes, 34963)
        idx_acc = len(accessors)
        accessors.append(
            {
                "bufferView": idx_view,
                "componentType": 5125 if use_u32 else 5123,
                "count": len(m.indices),
                "type": "SCALAR",
            }
        )

        mesh_idx = len(gltf_meshes)
        gltf_meshes.append(
            {
                "name": m.name,
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": pos_acc,
                            "NORMAL": norm_acc,
                        },
                        "indices": idx_acc,
                        "material": mat_idx,
                    }
                ],
            }
        )

        node_idx = len(nodes)
        node_obj: Dict[str, object] = {
            "name": m.name,
            "mesh": mesh_idx,
        }
        if m.translation is not None:
            node_obj["translation"] = [round(float(v), 5) for v in m.translation]
        if m.rotation is not None:
            node_obj["rotation"] = [round(float(v), 6) for v in m.rotation]
        if m.scale is not None:
            node_obj["scale"] = [round(float(v), 5) for v in m.scale]
        nodes.append(node_obj)
        node_name_to_idx[m.name] = node_idx

    gltf_animations: List[Dict[str, object]] = []
    for clip in animations:
        samplers: List[Dict[str, object]] = []
        channels: List[Dict[str, object]] = []
        for ch in clip.channels:
            target_idx = node_name_to_idx.get(ch.target_node_name)
            if target_idx is None:
                continue

            t_bytes = struct.pack(f"<{len(ch.times)}f", *ch.times)
            t_view = append_aligned(t_bytes)
            t_min, t_max = min_max_vec(ch.times, 1)
            in_acc = len(accessors)
            accessors.append(
                {
                    "bufferView": t_view,
                    "componentType": 5126,
                    "count": len(ch.times),
                    "type": "SCALAR",
                    "min": t_min,
                    "max": t_max,
                }
            )

            stride = 4 if ch.path == "rotation" else 3
            v_bytes = struct.pack(f"<{len(ch.values)}f", *ch.values)
            v_view = append_aligned(v_bytes)
            out_acc = len(accessors)
            accessors.append(
                {
                    "bufferView": v_view,
                    "componentType": 5126,
                    "count": len(ch.values) // stride,
                    "type": "VEC4" if stride == 4 else "VEC3",
                }
            )

            sampler_idx = len(samplers)
            samplers.append(
                {
                    "input": in_acc,
                    "interpolation": "LINEAR",
                    "output": out_acc,
                }
            )
            channels.append(
                {
                    "sampler": sampler_idx,
                    "target": {
                        "node": target_idx,
                        "path": ch.path,
                    },
                }
            )

        if channels:
            gltf_animations.append(
                {
                    "name": clip.name,
                    "samplers": samplers,
                    "channels": channels,
                }
            )

    bin_blob = b"".join(binary_chunks)
    gltf_dict: Dict[str, object] = {
        "asset": {
            "version": "2.0",
            "generator": GENERATOR_SIGNATURE,
            "copyright": "THPT Hoa Minh - Vinh Long (GDPT 2018)",
        },
        "scene": 0,
        "scenes": [
            {
                "name": scene_name,
                "nodes": list(range(len(nodes))),
            }
        ],
        "nodes": nodes,
        "meshes": gltf_meshes,
        "materials": materials,
        "bufferViews": buffer_views,
        "accessors": accessors,
        "buffers": [{"byteLength": len(bin_blob)}],
    }
    if gltf_animations:
        gltf_dict["animations"] = gltf_animations

    json_raw = json.dumps(gltf_dict, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_pad = (4 - (len(json_raw) % 4)) % 4
    json_aligned = json_raw + (b" " * json_pad)

    total_len = 12 + 8 + len(json_aligned) + 8 + len(bin_blob)
    header = struct.pack("<III", 0x46546C67, 2, total_len)  # 'glTF', version 2, total length
    json_header = struct.pack("<II", len(json_aligned), 0x4E4F534A)  # 'JSON'
    bin_header = struct.pack("<II", len(bin_blob), 0x004E4942)  # 'BIN\0'

    return header + json_header + json_aligned + bin_header + bin_blob


# ==============================================================================
# 5 MÔ HÌNH LỊCH SỬ LỚP 11 CỐT LÕI (SINH TỪ PYTHON 3)
# ==============================================================================


def build_bach_dang_938() -> bytes:
    """1. Chiến thắng Bạch Đằng năm 938 (Bài 7) — Địa hình lòng sông, bãi cọc gỗ bịt sắt, thủy triều & chiến thuyền."""
    meshes: List[MeshPart] = []

    def river_relief(x: float, z: float) -> float:
        meander = 0.65 * math.sin(z * 0.18)
        dist = abs(x - meander)
        if dist < 4.9:
            return -0.78 + 0.08 * math.cos(dist * 0.6)
        bank = min(1.0, (dist - 4.9) / 3.8)
        hill = 0.35 * math.sin(x * 0.55) * math.cos(z * 0.28)
        return -0.70 + bank * 1.95 + max(0.0, hill) * bank

    terrain = MeshPart("Hai_Ben_Bo_Dia_Hinh", (0.22, 0.40, 0.21, 1.0), metallic=0.05, roughness=0.88)
    terrain.add_terrain_grid(22.0, 22.0, 28, 28, river_relief, 0.0, 0.0, 0.0)
    meshes.append(terrain)

    # Bãi bồi phù sa lòng sông
    silt = MeshPart("Long_Song_Bach_Dang", (0.28, 0.22, 0.16, 1.0), metallic=0.06, roughness=0.92)
    silt.add_box(10.8, 0.18, 21.6, 0.0, -0.76, 0.0)
    meshes.append(silt)

    # Rừng cây phục binh hai bên bờ Tả ngạn / Hữu ngạn
    trees = MeshPart("Rung_Phuc_Binh_Ven_Song", (0.14, 0.34, 0.16, 1.0), metallic=0.04, roughness=0.86)
    tree_coords = [
        (-7.4, -7.2), (-8.1, -3.5), (-7.0, 0.4), (-7.8, 4.2), (-6.9, 7.8),
        (7.3, -6.8), (8.0, -2.8), (7.1, 1.2), (7.9, 4.9), (7.2, 8.1),
    ]
    for idx, (tx, tz) in enumerate(tree_coords):
        ty = river_relief(tx, tz)
        sc = 0.92 + (idx % 3) * 0.12
        trees.add_frustum(0.11 * sc, 0.18 * sc, 0.85 * sc, 7, tx, ty + 0.38 * sc, tz)
        trees.add_frustum(0.04, 0.76 * sc, 1.35 * sc, 8, tx, ty + 1.15 * sc, tz)
        trees.add_frustum(0.03, 0.56 * sc, 1.05 * sc, 8, tx, ty + 1.72 * sc, tz)
    meshes.append(trees)

    # Bãi cọc gỗ lim vạt nhọn cắm nghiêng ngược dòng + đầu sắt bịt cọc
    stakes_wood = MeshPart("Bai_Coc_Go_Bit_Sat", (0.45, 0.28, 0.13, 1.0), metallic=0.10, roughness=0.80)
    stakes_iron = MeshPart("Dau_Sat_Bit_Coc_Bach_Dang", (0.36, 0.39, 0.43, 1.0), metallic=0.82, roughness=0.28)
    for row in range(-2, 3):
        for col in range(-5, 6):
            sx = col * 0.80 + (0.22 if row % 2 == 0 else -0.22)
            sz = row * 0.86 - 0.50
            stakes_wood.add_frustum(0.10, 0.145, 1.28, 9, sx, -0.14, sz, tilt_x=0.18)
            stakes_iron.add_frustum(0.012, 0.108, 0.38, 9, sx, 0.64, sz + 0.14, tilt_x=0.18)
    meshes.append(stakes_wood)
    meshes.append(stakes_iron)

    # Mặt nước thủy triều chuyển động lên xuống
    water = MeshPart(
        "Mat_Nuoc_Thuy_Trieu",
        (0.10, 0.39, 0.56, 0.88),
        metallic=0.32,
        roughness=0.18,
        translation=(0.0, 0.20, 0.0),
        alpha_blend=True,
    )
    water.add_box(11.4, 0.16, 21.8, 0.0, -0.04, 0.0)
    meshes.append(water)

    # Thuyền nhẹ nhử địch và thuyền phục kích của Ngô Quyền
    meshes.extend(
        create_warship_parts(
            "Thuyen_Nhu_Dich_Ngo_Quyen",
            (0.44, 0.25, 0.12, 1.0),
            (0.76, 0.16, 0.16, 1.0),
            (0.0, 0.18, -5.2),
            0.0,
            0.95,
        )
    )
    meshes.extend(
        create_warship_parts(
            "Thuyen_Phuc_Kich_Ta_Ngan",
            (0.44, 0.25, 0.12, 1.0),
            (0.82, 0.60, 0.18, 1.0),
            (-4.1, 0.18, -3.2),
            0.55,
            0.95,
        )
    )
    meshes.extend(
        create_warship_parts(
            "Thuyen_Phuc_Kich_Huu_Ngan",
            (0.44, 0.25, 0.12, 1.0),
            (0.82, 0.60, 0.18, 1.0),
            (4.1, 0.18, -3.2),
            -0.55,
            0.95,
        )
    )

    # Chiến thuyền lớn của quân Nam Hán (Lưu Hoằng Tháo)
    meshes.extend(
        create_warship_parts(
            "Chien_Thuyen_Nam_Han_1",
            (0.25, 0.21, 0.19, 1.0),
            (0.24, 0.29, 0.37, 1.0),
            (-1.3, 0.22, 6.2),
            math.pi,
            1.15,
        )
    )
    meshes.extend(
        create_warship_parts(
            "Chien_Thuyen_Nam_Han_2",
            (0.25, 0.21, 0.19, 1.0),
            (0.24, 0.29, 0.37, 1.0),
            (1.4, 0.22, 7.1),
            math.pi,
            1.15,
        )
    )

    # Mũi tên phản công hai bên sườn
    meshes.append(create_tactical_arrow("Mui_Ten_Phan_Cong_1", (0.86, 0.64, 0.16, 1.0), (-2.6, 0.65, -2.2), 0.35, 2.1))
    meshes.append(create_tactical_arrow("Mui_Ten_Phan_Cong_2", (0.86, 0.64, 0.16, 1.0), (2.6, 0.65, -2.2), -0.35, 2.1))

    animations = [
        AnimationClip(
            "Toan_Canh_Thuy_Trieu_Va_Phan_Cong",
            [
                AnimationChannel(
                    "Mat_Nuoc_Thuy_Trieu",
                    "translation",
                    [0.0, 2.5, 5.0, 8.0],
                    [0.0, 0.40, 0.0, 0.0, 0.28, 0.0, 0.0, -0.18, 0.0, 0.0, -0.22, 0.0],
                ),
                AnimationChannel(
                    "Chien_Thuyen_Nam_Han_1",
                    "translation",
                    [0.0, 3.0, 5.5, 8.0],
                    [-1.3, 0.36, 6.2, -1.1, 0.28, 1.8, -0.9, 0.02, -0.4, -0.9, -0.05, -0.5],
                ),
                AnimationChannel(
                    "Chien_Thuyen_Nam_Han_1_Buom",
                    "translation",
                    [0.0, 3.0, 5.5, 8.0],
                    [-1.3, 0.36, 6.2, -1.1, 0.28, 1.8, -0.9, 0.02, -0.4, -0.9, -0.05, -0.5],
                ),
                AnimationChannel(
                    "Chien_Thuyen_Nam_Han_2",
                    "translation",
                    [0.0, 3.0, 5.5, 8.0],
                    [1.4, 0.36, 7.1, 1.2, 0.28, 2.4, 1.0, 0.02, 0.1, 1.0, -0.05, 0.0],
                ),
                AnimationChannel(
                    "Chien_Thuyen_Nam_Han_2_Buom",
                    "translation",
                    [0.0, 3.0, 5.5, 8.0],
                    [1.4, 0.36, 7.1, 1.2, 0.28, 2.4, 1.0, 0.02, 0.1, 1.0, -0.05, 0.0],
                ),
                AnimationChannel(
                    "Thuyen_Phuc_Kich_Ta_Ngan",
                    "translation",
                    [0.0, 3.5, 6.5, 8.0],
                    [-4.1, 0.25, -3.2, -3.8, 0.20, -2.8, -2.1, 0.05, -1.3, -1.9, 0.05, -1.1],
                ),
                AnimationChannel(
                    "Thuyen_Phuc_Kich_Ta_Ngan_Buom",
                    "translation",
                    [0.0, 3.5, 6.5, 8.0],
                    [-4.1, 0.25, -3.2, -3.8, 0.20, -2.8, -2.1, 0.05, -1.3, -1.9, 0.05, -1.1],
                ),
                AnimationChannel(
                    "Thuyen_Phuc_Kich_Huu_Ngan",
                    "translation",
                    [0.0, 3.5, 6.5, 8.0],
                    [4.1, 0.25, -3.2, 3.8, 0.20, -2.8, 2.1, 0.05, -1.3, 1.9, 0.05, -1.1],
                ),
                AnimationChannel(
                    "Thuyen_Phuc_Kich_Huu_Ngan_Buom",
                    "translation",
                    [0.0, 3.5, 6.5, 8.0],
                    [4.1, 0.25, -3.2, 3.8, 0.20, -2.8, 2.1, 0.05, -1.3, 1.9, 0.05, -1.1],
                ),
            ],
        ),
        AnimationClip(
            "Giai_Doan_2_Nhu_Dich_Trieu_Len",
            [
                AnimationChannel(
                    "Mat_Nuoc_Thuy_Trieu",
                    "translation",
                    [0.0, 2.0, 4.0],
                    [0.0, 0.32, 0.0, 0.0, 0.44, 0.0, 0.0, 0.36, 0.0],
                ),
                AnimationChannel(
                    "Thuyen_Nhu_Dich_Ngo_Quyen",
                    "translation",
                    [0.0, 2.0, 4.0],
                    [0.0, 0.35, 1.8, 0.0, 0.38, -1.8, 0.0, 0.35, -4.8],
                ),
                AnimationChannel(
                    "Thuyen_Nhu_Dich_Ngo_Quyen_Buom",
                    "translation",
                    [0.0, 2.0, 4.0],
                    [0.0, 0.35, 1.8, 0.0, 0.38, -1.8, 0.0, 0.35, -4.8],
                ),
            ],
        ),
    ]
    return compile_glb_bytes(meshes, animations, "BachDang938_PythonGLB")


def build_lam_son() -> bytes:
    """2. Khởi nghĩa Lam Sơn 1418 – 1427 (Bài 8) — Sa bàn địa hình Đại Việt & 4 mốc chiến dịch lớn."""
    meshes: List[MeshPart] = []

    def dai_viet_relief(x: float, z: float) -> float:
        west_ridge = max(0.0, (-x + 1.5) * 0.22) * (0.65 + 0.35 * math.cos(z * 0.32))
        chi_lang_pass = 0.55 * math.exp(-((x - 1.5) ** 2 + (z + 7.2) ** 2) / 5.0)
        coast_slope = -0.18 if x > 4.2 else 0.0
        return 0.05 + west_ridge + chi_lang_pass + coast_slope

    base = MeshPart("Ban_Do_Dia_Hinh_Dai_Viet", (0.74, 0.68, 0.54, 1.0), metallic=0.06, roughness=0.86)
    base.add_terrain_grid(18.0, 22.0, 24, 28, dai_viet_relief, 0.0, 0.0, 0.0)
    meshes.append(base)

    # Dãy núi Tây Thanh Hóa – Chí Linh – Ải Chi Lăng
    mts = MeshPart("Nui_Chi_Linh_Lam_Son", (0.22, 0.40, 0.23, 1.0), metallic=0.05, roughness=0.88)
    peaks = [
        (-3.6, 1.5, 2.3, 2.6),
        (-4.9, -0.6, 1.9, 2.1),
        (-2.9, 4.3, 2.0, 2.3),
        (-4.2, 6.8, 1.8, 1.9),
        (0.6, -7.4, 1.7, 2.0),
        (3.1, -7.1, 1.6, 1.9),
    ]
    for px, pz, rad, hgt in peaks:
        py = dai_viet_relief(px, pz)
        mts.add_frustum(0.28, rad, hgt, 8, px, py + hgt * 0.45, pz)
    meshes.append(mts)

    # Sông Hồng, sông Mã, sông Lam trên sa bàn
    rivers = MeshPart("He_Thong_Song_Dai_Viet", (0.14, 0.44, 0.62, 1.0), metallic=0.28, roughness=0.22)
    rivers.add_box(6.5, 0.08, 0.45, 0.5, 0.24, -3.5, rot_y=0.28)
    rivers.add_box(5.8, 0.08, 0.42, -0.4, 0.26, 1.8, rot_y=0.22)
    rivers.add_box(5.4, 0.08, 0.42, 0.2, 0.24, 6.1, rot_y=0.30)
    meshes.append(rivers)

    milestones = [
        ("Moc_1418_Can_Cu_Lam_Son", (-2.2, 1.05, 1.5), (0.78, 0.18, 0.18, 1.0)),
        ("Moc_1424_Tien_Vao_Nghe_An", (-0.8, 0.98, 5.8), (0.82, 0.55, 0.14, 1.0)),
        ("Moc_1426_Tot_Dong_Chuc_Dong", (1.2, 0.92, -3.2), (0.85, 0.64, 0.16, 1.0)),
        ("Moc_1427_Chi_Lang_Xuong_Giang", (1.8, 1.15, -7.2), (0.16, 0.52, 0.34, 1.0)),
    ]

    for m_name, m_pos, m_col in milestones:
        beacon = MeshPart(m_name, m_col, metallic=0.26, roughness=0.44, translation=m_pos)
        beacon.add_frustum(0.36, 0.48, 0.34, 10, 0.0, -0.65, 0.0)
        beacon.add_frustum(0.06, 0.07, 1.68, 8, 0.0, 0.22, 0.0)
        beacon.add_box(0.92, 0.54, 0.07, 0.46, 0.76, 0.0)
        meshes.append(beacon)

    meshes.append(create_tactical_arrow("Huong_Tien_1424_Nam_Tien", (0.84, 0.56, 0.14, 1.0), (-1.4, 0.48, 3.6), 0.25, 2.8))
    meshes.append(create_tactical_arrow("Huong_Tien_1426_Bac_Tien", (0.78, 0.18, 0.18, 1.0), (0.5, 0.48, 1.2), math.pi - 0.2, 4.6))

    channels = [
        AnimationChannel(
            m_name,
            "scale",
            [0.0, idx * 1.2 + 0.6, idx * 1.2 + 1.2, 6.0],
            [1.0, 1.0, 1.0, 1.24, 1.30, 1.24, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
        )
        for idx, (m_name, _, _) in enumerate(milestones)
    ]
    animations = [AnimationClip("Dien_Bien_Hanh_Quan_1418_1427", channels)]
    return compile_glb_bytes(meshes, animations, "KhoiNghiaLamSon_PythonGLB")


def build_thanh_nha_ho() -> bytes:
    """3. Thành nhà Hồ – Tây Đô năm 1397 (Bài 9) — Cổng Nam 3 vòm cuốn đá vôi nguyên khối & tường thành."""
    meshes: List[MeshPart] = []

    ground = MeshPart("Khong_Gian_Tay_Do", (0.33, 0.46, 0.27, 1.0), metallic=0.04, roughness=0.90)
    ground.add_box(24.0, 0.55, 24.0, 0.0, -0.28, 0.0)
    meshes.append(ground)

    road = MeshPart("Duong_Hoang_Gia_Lat_Da", (0.68, 0.65, 0.58, 1.0), metallic=0.06, roughness=0.76)
    road.add_box(3.3, 0.10, 19.0, 0.0, 0.05, 1.8)
    meshes.append(road)

    # Cổng Nam 3 vòm cuốn ghép đá nêm chân thực
    gate = MeshPart("Cong_Nam_Da_Khoi_Ba_Vom", (0.58, 0.59, 0.56, 1.0), metallic=0.08, roughness=0.80)
    pier_xs = [-3.75, -1.25, 1.25, 3.75]
    for px in pier_xs:
        gate.add_box(1.22, 2.35, 2.85, px, 1.18, 0.0)
    for arch_cx in (-2.50, 0.0, 2.50):
        gate.add_stone_arch(0.76, 0.42, 2.86, 9, arch_cx, 1.95, 0.0)
    # Thượng thành phía trên vòm cuốn & hàng lỗ châu mai
    gate.add_box(9.10, 0.92, 2.88, 0.0, 3.36, 0.0)
    for bx in [x * 0.95 for x in range(-4, 5)]:
        gate.add_box(0.52, 0.40, 0.36, bx, 4.02, 1.22)
        gate.add_box(0.52, 0.40, 0.36, bx, 4.02, -1.22)
    meshes.append(gate)

    # Tường thành đá khối ghép khít hai cánh Đông – Tây & lũy đất bên trong
    walls = MeshPart("Tuong_Thanh_Da_Ghep_Khit", (0.51, 0.53, 0.50, 1.0), metallic=0.07, roughness=0.85)
    walls.add_box(6.4, 2.65, 2.45, -7.7, 1.32, 0.0)
    walls.add_box(6.4, 2.65, 2.45, 7.7, 1.32, 0.0)
    walls.add_box(2.45, 2.65, 12.2, -10.3, 1.32, -6.1)
    walls.add_box(2.45, 2.65, 12.2, 10.3, 1.32, -6.1)
    meshes.append(walls)

    # Hào nước bảo vệ quanh chân thành
    moat = MeshPart("Hao_Thanh_Bao_Ve", (0.14, 0.42, 0.56, 1.0), metallic=0.28, roughness=0.20)
    moat.add_box(8.4, 0.08, 2.3, -6.6, 0.04, 3.7)
    moat.add_box(8.4, 0.08, 2.3, 6.6, 0.04, 3.7)
    meshes.append(moat)

    # Kỳ đài Triều Hồ tung bay trên vọng lâu Cổng Nam
    flag = MeshPart("Ky_Dai_Trieu_Ho", (0.80, 0.58, 0.16, 1.0), metallic=0.25, roughness=0.46, translation=(0.0, 3.82, 0.0))
    flag.add_frustum(0.045, 0.058, 1.85, 8, 0.0, 0.92, 0.0)
    flag.add_box(1.12, 0.64, 0.055, 0.56, 1.48, 0.0)
    meshes.append(flag)

    q0 = quat_from_euler_y(0.0)
    q1 = quat_from_euler_y(0.24)
    q2 = quat_from_euler_y(-0.24)
    animations = [
        AnimationClip(
            "Ky_Dai_Tung_Bay",
            [
                AnimationChannel(
                    "Ky_Dai_Trieu_Ho",
                    "rotation",
                    [0.0, 1.5, 3.0, 4.5],
                    [*q0, *q1, *q2, *q0],
                )
            ],
        )
    ]
    return compile_glb_bytes(meshes, animations, "ThanhNhaHo_PythonGLB")


def build_dong_nam_a() -> bytes:
    """4. Không gian Đông Nam Á Cận – Hiện đại (Chủ đề 3) — Lục địa, Hải đảo & Eo biển Malacca."""
    meshes: List[MeshPart] = []

    sea = MeshPart("Vung_Bien_Dong_Nam_A", (0.09, 0.29, 0.46, 1.0), metallic=0.26, roughness=0.24)
    sea.add_box(24.0, 0.36, 20.0, 0.0, -0.20, 0.0)
    meshes.append(sea)

    regions = [
        ("Ban_Dao_Dong_Duong_VN_Lao_CPC", 3.2, 5.2, (-1.2, 0.35, -3.5), (0.78, 0.58, 0.22, 1.0)),
        ("Vuong_Quoc_Xiem_Thai_Lan", 2.6, 3.6, (-4.2, 0.32, -3.2), (0.34, 0.58, 0.42, 1.0)),
        ("Myanmar_Miendia", 2.2, 3.8, (-6.8, 0.32, -4.8), (0.62, 0.42, 0.32, 1.0)),
        ("Ban_Dao_Ma_Lai_Singapore", 1.6, 3.4, (-3.5, 0.30, 1.2), (0.52, 0.46, 0.68, 1.0)),
        ("Quan_Dao_Indonesia", 9.6, 2.2, (0.5, 0.30, 5.2), (0.74, 0.32, 0.26, 1.0)),
        ("Quan_Dao_Philippines", 2.4, 4.4, (5.4, 0.32, -1.2), (0.28, 0.54, 0.68, 1.0)),
    ]

    for r_name, rw, rd, rpos, rcol in regions:
        part = MeshPart(r_name, rcol, metallic=0.08, roughness=0.68, translation=rpos)
        part.add_box(rw, 0.62, rd, 0.0, 0.0, 0.0)
        part.add_box(rw * 0.72, 0.26, rd * 0.72, 0.0, 0.42, 0.0)
        part.add_frustum(0.16, 0.24, 0.88, 8, 0.0, 0.88, 0.0)
        meshes.append(part)

    meshes.append(create_tactical_arrow("Tuyen_Hang_Hai_Eo_Malacca", (0.92, 0.74, 0.22, 1.0), (-4.8, 0.46, 2.8), 0.85, 4.2))
    meshes.extend(
        create_warship_parts(
            "Thuong_Thuyen_Eo_Malacca",
            (0.46, 0.30, 0.16, 1.0),
            (0.92, 0.86, 0.72, 1.0),
            (-5.4, 0.14, 3.3),
            0.85,
            0.82,
        )
    )

    animations = [
        AnimationClip(
            "Tuyen_Hang_Hai_Va_Doc_Lap",
            [
                AnimationChannel(
                    "Tuyen_Hang_Hai_Eo_Malacca",
                    "translation",
                    [0.0, 2.5, 5.0],
                    [-5.8, 0.46, 3.5, -3.2, 0.56, 1.6, -5.8, 0.46, 3.5],
                ),
                AnimationChannel(
                    "Thuong_Thuyen_Eo_Malacca",
                    "translation",
                    [0.0, 2.5, 5.0],
                    [-5.8, 0.14, 3.7, -2.4, 0.14, 1.1, -5.8, 0.14, 3.7],
                ),
                AnimationChannel(
                    "Thuong_Thuyen_Eo_Malacca_Buom",
                    "translation",
                    [0.0, 2.5, 5.0],
                    [-5.8, 0.14, 3.7, -2.4, 0.14, 1.1, -5.8, 0.14, 3.7],
                ),
            ],
        )
    ]
    return compile_glb_bytes(meshes, animations, "DongNamACanDai_PythonGLB")


def build_bien_dong() -> bytes:
    """5. Không gian Biển Đông – Hoàng Sa & Trường Sa (Chủ đề 6: Bài 12 & Bài 13)."""
    meshes: List[MeshPart] = []

    ocean = MeshPart("Khong_Gian_Bien_Dong", (0.07, 0.33, 0.56, 1.0), metallic=0.30, roughness=0.20)
    ocean.add_box(22.0, 0.40, 24.0, 0.0, -0.20, 0.0)
    meshes.append(ocean)

    # Dải đất liền hình chữ S Việt Nam ở phía Tây Biển Đông
    vn = MeshPart("Dai_Dat_Lien_Va_Bo_Bien_Viet_Nam", (0.23, 0.52, 0.29, 1.0), metallic=0.06, roughness=0.78)
    vn.add_box(3.8, 0.92, 6.2, -6.3, 0.46, -6.5, rot_y=-0.12)
    vn.add_box(2.3, 0.86, 6.6, -5.0, 0.43, -0.5, rot_y=0.14)
    vn.add_box(3.3, 0.82, 5.5, -5.9, 0.41, 5.3, rot_y=-0.18)
    # Dãy Trường Sơn dọc dải đất miền Trung
    vn.add_frustum(0.32, 1.35, 1.65, 7, -5.8, 1.22, -1.2)
    vn.add_frustum(0.28, 1.20, 1.45, 7, -5.4, 1.15, 1.4)
    meshes.append(vn)

    # Thềm lục địa Việt Nam mở rộng tự nhiên từ đất liền ra Biển Đông
    shelf = MeshPart("Them_Luc_Dia_Viet_Nam", (0.17, 0.56, 0.72, 1.0), metallic=0.15, roughness=0.40)
    shelf.add_box(5.0, 0.20, 18.8, -3.8, 0.06, -0.4)
    meshes.append(shelf)

    # Quần đảo Hoàng Sa (Đảo san hô + Bia chủ quyền + Hải đăng)
    hs = MeshPart("Quan_Dao_Hoang_Sa", (0.86, 0.66, 0.20, 1.0), metallic=0.28, roughness=0.44, translation=(-0.8, 0.10, -2.6))
    hs.add_frustum(0.88, 1.22, 0.34, 12, 0.0, 0.17, 0.0)
    hs.add_frustum(0.38, 0.52, 0.22, 10, -0.75, 0.11, 0.55)
    hs.add_frustum(0.34, 0.48, 0.22, 10, 0.72, 0.11, -0.48)
    # Bia chủ quyền Việt Nam & Hải đăng Hoàng Sa
    hs.add_box(0.40, 1.25, 0.24, -0.18, 0.92, 0.0)
    hs.add_frustum(0.10, 0.16, 1.45, 10, 0.34, 1.02, 0.12)
    meshes.append(hs)

    # Quần đảo Trường Sa (Cụm đảo san hô + Bia chủ quyền + Hải đăng)
    ts = MeshPart("Quan_Dao_Truong_Sa", (0.85, 0.22, 0.22, 1.0), metallic=0.28, roughness=0.44, translation=(1.4, 0.10, 3.4))
    ts.add_frustum(1.05, 1.38, 0.34, 12, 0.0, 0.17, 0.0)
    ts.add_frustum(0.42, 0.58, 0.22, 10, -0.88, 0.11, -0.52)
    ts.add_frustum(0.40, 0.54, 0.22, 10, 0.82, 0.11, 0.62)
    ts.add_box(0.42, 1.32, 0.25, -0.20, 0.96, 0.0)
    ts.add_frustum(0.11, 0.17, 1.52, 10, 0.38, 1.06, -0.10)
    meshes.append(ts)

    # Hải đội Hoàng Sa thực thi chủ quyền từ đất liền ra quần đảo
    meshes.extend(
        create_warship_parts(
            "Thuyen_Hai_Doi_Hoang_Sa",
            (0.46, 0.27, 0.13, 1.0),
            (0.80, 0.18, 0.18, 1.0),
            (-2.8, 0.16, -2.0),
            1.28,
            0.82,
        )
    )

    # Tàu hàng hải quốc tế & Tuyến hàng hải huyết mạch Thái Bình Dương – Ấn Độ Dương
    meshes.extend(
        create_warship_parts(
            "Tau_Hang_Hai_Quoc_Te",
            (0.82, 0.85, 0.90, 1.0),
            (0.90, 0.66, 0.18, 1.0),
            (2.8, 0.16, 7.5),
            math.pi * 0.88,
            1.02,
        )
    )
    meshes.append(
        create_tactical_arrow(
            "Tuyen_Hang_Hai_Thai_Binh_Duong_An_Do_Duong",
            (0.92, 0.74, 0.22, 1.0),
            (2.4, 0.32, 0.5),
            -0.25,
            9.5,
        )
    )

    animations = [
        AnimationClip(
            "Luu_Thong_Tuyen_Hang_Hai_Quoc_Te",
            [
                AnimationChannel(
                    "Tau_Hang_Hai_Quoc_Te",
                    "translation",
                    [0.0, 3.0, 6.0],
                    [0.2, 0.16, 8.2, 2.4, 0.16, 0.5, 4.6, 0.16, -7.2],
                ),
                AnimationChannel(
                    "Tau_Hang_Hai_Quoc_Te_Buom",
                    "translation",
                    [0.0, 3.0, 6.0],
                    [0.2, 0.16, 8.2, 2.4, 0.16, 0.5, 4.6, 0.16, -7.2],
                ),
                AnimationChannel(
                    "Thuyen_Hai_Doi_Hoang_Sa",
                    "translation",
                    [0.0, 3.0, 6.0],
                    [-3.6, 0.16, -1.6, -2.1, 0.16, -2.3, -3.6, 0.16, -1.6],
                ),
                AnimationChannel(
                    "Thuyen_Hai_Doi_Hoang_Sa_Buom",
                    "translation",
                    [0.0, 3.0, 6.0],
                    [-3.6, 0.16, -1.6, -2.1, 0.16, -2.3, -3.6, 0.16, -1.6],
                ),
            ],
        )
    ]
    return compile_glb_bytes(meshes, animations, "KhongGianBienDong_PythonGLB")


# ==============================================================================
# BỘ SINH MÔ PHỎNG THAM SỐ HÓA CHO GIÁO VIÊN / NGƯỜI DÙNG (PYTHON -> GLB -> UPLOAD)
# ==============================================================================


def build_parameterized_preset(preset: str, params: Dict[str, object]) -> Tuple[bytes, Dict[str, object]]:
    """
    Sinh mô hình .glb tùy biến từ Python dựa theo kịch bản lịch sử và tham số cấu hình,
    trả về (glb_bytes, metadata_dict gồm animationNames, cameraSettings, hotspots, phases).
    """
    if preset == "naval_ambush":
        stake_rows = max(1, min(6, int(params.get("stakeRows", 3))))
        warship_pairs = max(1, min(4, int(params.get("warshipPairs", 2))))
        tidal_amp = max(0.1, min(0.6, float(params.get("tidalAmplitude", 0.32))))

        meshes: List[MeshPart] = []

        def channel_fn(x: float, z: float) -> float:
            meander = 0.55 * math.sin(z * 0.22)
            d = abs(x - meander)
            if d < 4.6:
                return -0.75
            b = min(1.0, (d - 4.6) / 3.5)
            return -0.70 + b * 1.85 + 0.22 * math.cos(z * 0.35) * b

        banks = MeshPart("Bo_Song_Phuc_Binh", (0.20, 0.42, 0.22, 1.0), roughness=0.88)
        banks.add_terrain_grid(20.0, 20.0, 24, 24, channel_fn)
        meshes.append(banks)

        stakes = MeshPart("Tran_Dia_Coc_Ngam", (0.46, 0.29, 0.14, 1.0), roughness=0.78)
        for r in range(stake_rows):
            z_pos = -1.8 + r * 0.95
            for c in range(-4, 5):
                stakes.add_frustum(0.09, 0.14, 1.22, 8, c * 0.85, -0.12, z_pos, tilt_x=0.16)
        meshes.append(stakes)

        water = MeshPart(
            "Mat_Song_Thuy_Trieu",
            (0.11, 0.41, 0.58, 0.88),
            metallic=0.30,
            roughness=0.18,
            translation=(0.0, 0.18, 0.0),
            alpha_blend=True,
        )
        water.add_box(10.6, 0.15, 19.6, 0.0, -0.03, 0.0)
        meshes.append(water)

        anim_channels: List[AnimationChannel] = [
            AnimationChannel(
                "Mat_Song_Thuy_Trieu",
                "translation",
                [0.0, 2.5, 5.0],
                [0.0, tidal_amp, 0.0, 0.0, -tidal_amp * 0.65, 0.0, 0.0, tidal_amp, 0.0],
            )
        ]

        for i in range(warship_pairs):
            z_offset = -3.8 + i * 2.4
            left_name = f"Thuyen_Quan_Ta_Ta_Ngan_{i + 1}"
            right_name = f"Thuyen_Quan_Ta_Huu_Ngan_{i + 1}"
            enemy_name = f"Chien_Thuyen_Doi_Phuong_{i + 1}"

            meshes.extend(
                create_warship_parts(left_name, (0.45, 0.25, 0.12, 1.0), (0.80, 0.18, 0.18, 1.0), (-3.6, 0.16, z_offset), 0.52, 0.92)
            )
            meshes.extend(
                create_warship_parts(right_name, (0.45, 0.25, 0.12, 1.0), (0.84, 0.62, 0.16, 1.0), (3.6, 0.16, z_offset), -0.52, 0.92)
            )
            meshes.extend(
                create_warship_parts(enemy_name, (0.26, 0.22, 0.20, 1.0), (0.26, 0.31, 0.40, 1.0), (-0.8 + i * 1.6, 0.20, 5.4 + i * 1.5), math.pi, 1.1)
            )

            ex = -0.8 + i * 1.6
            ez = 5.4 + i * 1.5
            for suffix in ("", "_Buom"):
                anim_channels.append(
                    AnimationChannel(
                        f"{enemy_name}{suffix}",
                        "translation",
                        [0.0, 2.5, 5.0],
                        [ex, 0.28, ez, ex * 0.7, 0.04, 0.4 + i * 0.6, ex, 0.28, ez],
                    )
                )

        meshes.append(create_tactical_arrow("Mui_Ten_Khoa_Duoi", (0.88, 0.64, 0.16, 1.0), (-2.2, 0.58, 1.2), 0.42, 2.3))
        meshes.append(create_tactical_arrow("Mui_Ten_Chan_Dau", (0.88, 0.64, 0.16, 1.0), (2.2, 0.58, -1.8), -0.42, 2.3))

        anim_name = "Dien_Bien_Phuc_Kich_Duong_Thuy"
        glb = compile_glb_bytes(meshes, [AnimationClip(anim_name, anim_channels)], "NavalAmbush_PythonGLB")
        meta = {
            "animationNames": [anim_name],
            "cameraSettings": {"position": [10.5, 7.8, 12.0], "target": [0.0, 0.3, 0.0]},
            "phases": [
                {
                    "key": "all",
                    "label": "Toàn cảnh trận địa thủy chiến",
                    "animationName": anim_name,
                    "cameraPosition": [10.5, 7.8, 12.0],
                    "cameraTarget": [0.0, 0.3, 0.0],
                    "summary": "Mô phỏng bằng Python: Kết hợp địa hình lòng sông, thủy triều và đội hình phục kích hai bên bờ.",
                },
                {
                    "key": "ambush",
                    "label": "Cận cảnh trận địa khóa chặn",
                    "animationName": anim_name,
                    "cameraPosition": [5.2, 4.2, 5.8],
                    "cameraTarget": [0.0, 0.0, 0.0],
                    "summary": "Khi đội thuyền đối phương lọt vào khu vực quyết chiến, thủy binh hai bờ đồng loạt xuất kích.",
                },
            ],
            "hotspots": [
                {
                    "x": 0.0,
                    "y": 0.35,
                    "z": -0.8,
                    "title": "Khu vực trận địa ngầm quyết chiến",
                    "description": f"Sinh tự động từ Python với {stake_rows} hàng cọc ngầm và biên độ triều {tidal_amp:.2f}m.",
                    "phaseKey": "all",
                },
                {
                    "x": -3.6,
                    "y": 0.85,
                    "z": -2.2,
                    "title": "Cánh thủy binh phục kích",
                    "description": f" Bố trí {warship_pairs * 2} đội thuyền nhẹ cơ động mai phục ven hai bờ sông.",
                    "phaseKey": "all",
                },
            ],
        }
        return glb, meta

    if preset == "maritime_sovereignty":
        island_clusters = max(2, min(6, int(params.get("islandClusters", 3))))
        patrol_ships = max(1, min(4, int(params.get("patrolShips", 2))))

        meshes = []
        ocean = MeshPart("Vung_Bien_Chu_Quyen", (0.07, 0.34, 0.58, 1.0), metallic=0.30, roughness=0.20)
        ocean.add_box(22.0, 0.40, 22.0, 0.0, -0.20, 0.0)
        meshes.append(ocean)

        coast = MeshPart("Bo_Bien_Va_Them_Luc_Dia", (0.22, 0.52, 0.30, 1.0), roughness=0.78)
        coast.add_box(3.4, 0.88, 18.5, -6.2, 0.44, 0.0)
        meshes.append(coast)

        hotspots = []
        for idx in range(island_clusters):
            angle = (idx / max(1, island_clusters - 1) - 0.5) * 1.5
            ix = 0.2 + math.cos(angle) * 2.2
            iz = math.sin(angle) * 5.6
            isl = MeshPart(
                f"Cum_Dao_Chu_Quyen_{idx + 1}",
                (0.86, 0.65, 0.22, 1.0) if idx % 2 == 0 else (0.84, 0.26, 0.24, 1.0),
                metallic=0.26,
                roughness=0.44,
                translation=(ix, 0.10, iz),
            )
            isl.add_frustum(0.82, 1.15, 0.32, 12, 0.0, 0.16, 0.0)
            isl.add_box(0.36, 1.18, 0.22, -0.18, 0.88, 0.0)
            isl.add_frustum(0.09, 0.15, 1.40, 10, 0.32, 0.96, 0.0)
            meshes.append(isl)
            hotspots.append(
                {
                    "x": round(ix, 2),
                    "y": 1.1,
                    "z": round(iz, 2),
                    "title": f"Cụm đảo & Mốc chủ quyền #{idx + 1}",
                    "description": "Cụm đảo tiền tiêu kèm bia chủ quyền và hải đăng dẫn luồng hàng hải an toàn.",
                    "phaseKey": "all",
                }
            )

        anim_channels = []
        for s_idx in range(patrol_ships):
            s_name = f"Tau_Tuan_Tra_Hai_Trinh_{s_idx + 1}"
            z0 = -6.0 + s_idx * 4.5
            meshes.extend(
                create_warship_parts(s_name, (0.82, 0.85, 0.90, 1.0), (0.82, 0.18, 0.18, 1.0), (-2.8, 0.16, z0), 0.95, 0.90)
            )
            for suffix in ("", "_Buom"):
                anim_channels.append(
                    AnimationChannel(
                        f"{s_name}{suffix}",
                        "translation",
                        [0.0, 3.0, 6.0],
                        [-3.4, 0.16, z0, 1.2, 0.16, z0 + 2.4, -3.4, 0.16, z0],
                    )
                )

        anim_name = "Hai_Trinh_Thuc_Thi_Chu_Quyen"
        glb = compile_glb_bytes(meshes, [AnimationClip(anim_name, anim_channels)], "MaritimeSovereignty_PythonGLB")
        meta = {
            "animationNames": [anim_name],
            "cameraSettings": {"position": [11.0, 8.2, 12.5], "target": [0.0, 0.3, 0.0]},
            "phases": [
                {
                    "key": "all",
                    "label": "Toàn cảnh không gian biển đảo",
                    "animationName": anim_name,
                    "cameraPosition": [11.0, 8.2, 12.5],
                    "cameraTarget": [0.0, 0.3, 0.0],
                    "summary": "Mô phỏng Python thể hiện sự gắn kết hữu cơ giữa bờ biển đất liền, thềm lục địa và các cụm đảo chủ quyền.",
                }
            ],
            "hotspots": hotspots,
        }
        return glb, meta

    if preset == "stone_citadel":
        arch_count = max(1, min(5, int(params.get("archCount", 3))))
        wall_span = max(12.0, min(24.0, float(params.get("wallSpan", 18.0))))

        meshes = []
        ground = MeshPart("Nen_Kinh_Do_Co", (0.34, 0.47, 0.28, 1.0), roughness=0.90)
        ground.add_box(24.0, 0.50, 22.0, 0.0, -0.25, 0.0)
        meshes.append(ground)

        gate = MeshPart("Cong_Thanh_Vom_Da_Python", (0.58, 0.59, 0.55, 1.0), roughness=0.80)
        total_gate_w = arch_count * 2.4 + 1.2
        start_x = -total_gate_w * 0.5 + 0.6
        for p_idx in range(arch_count + 1):
            px = start_x + p_idx * 2.4
            gate.add_box(1.15, 2.35, 2.7, px, 1.18, 0.0)
        for a_idx in range(arch_count):
            ax = start_x + 1.2 + a_idx * 2.4
            gate.add_stone_arch(0.72, 0.40, 2.72, 9, ax, 1.92, 0.0)
        gate.add_box(total_gate_w + 0.4, 0.90, 2.75, 0.0, 3.30, 0.0)
        meshes.append(gate)

        walls = MeshPart("Tuong_Thanh_Phong_Thu", (0.50, 0.52, 0.49, 1.0), roughness=0.86)
        wing = max(2.5, (wall_span - total_gate_w) * 0.5)
        walls.add_box(wing, 2.5, 2.2, -(total_gate_w * 0.5 + wing * 0.5), 1.25, 0.0)
        walls.add_box(wing, 2.5, 2.2, (total_gate_w * 0.5 + wing * 0.5), 1.25, 0.0)
        meshes.append(walls)

        flag = MeshPart("Ky_Dai_Trung_Tam", (0.82, 0.58, 0.16, 1.0), roughness=0.45, translation=(0.0, 3.75, 0.0))
        flag.add_frustum(0.05, 0.06, 1.8, 8, 0.0, 0.9, 0.0)
        flag.add_box(1.05, 0.60, 0.05, 0.52, 1.42, 0.0)
        meshes.append(flag)

        q0, q1, q2 = quat_from_euler_y(0.0), quat_from_euler_y(0.22), quat_from_euler_y(-0.22)
        anim_name = "Ky_Dai_Thanh_Co_Tung_Bay"
        glb = compile_glb_bytes(
            meshes,
            [AnimationClip(anim_name, [AnimationChannel("Ky_Dai_Trung_Tam", "rotation", [0.0, 1.5, 3.0, 4.5], [*q0, *q1, *q2, *q0])])],
            "StoneCitadel_PythonGLB",
        )
        meta = {
            "animationNames": [anim_name],
            "cameraSettings": {"position": [10.0, 6.2, 12.0], "target": [0.0, 1.8, 0.0]},
            "phases": [
                {
                    "key": "all",
                    "label": "Kiến trúc cổng thành đá vòm cuốn",
                    "animationName": anim_name,
                    "cameraPosition": [10.0, 6.2, 12.0],
                    "cameraTarget": [0.0, 1.8, 0.0],
                    "summary": f"Mô phỏng kiến trúc thành đá với {arch_count} vòm cuốn đá nêm và sải tường thành {wall_span:.1f}m.",
                }
            ],
            "hotspots": [
                {
                    "x": 0.0,
                    "y": 2.4,
                    "z": 1.4,
                    "title": f"Hệ thống {arch_count} vòm cuốn đá nêm",
                    "description": "Kỹ thuật ghép đá hình múi bưởi tự chèn chặt bằng trọng lực mà không cần chất kết dính.",
                    "phaseKey": "all",
                }
            ],
        }
        return glb, meta

    # Default: campaign_relief
    mountain_peaks = max(2, min(8, int(params.get("mountainPeaks", 5))))
    milestone_count = max(2, min(5, int(params.get("milestoneCount", 3))))

    meshes = []
    terrain = MeshPart("Sa_Ban_Chien_Dich_Python", (0.74, 0.68, 0.54, 1.0), roughness=0.86)
    terrain.add_terrain_grid(18.0, 20.0, 22, 24, lambda x, z: 0.25 * math.sin(x * 0.35) * math.cos(z * 0.28) + max(0.0, -x * 0.14))
    meshes.append(terrain)

    mts = MeshPart("Day_Nui_Hiem_Tro", (0.23, 0.42, 0.24, 1.0), roughness=0.88)
    for i in range(mountain_peaks):
        px = -4.5 + (i % 2) * 1.8
        pz = -6.5 + i * (13.0 / max(1, mountain_peaks - 1))
        mts.add_frustum(0.26, 1.85, 2.2, 8, px, 1.15, pz)
    meshes.append(mts)

    anim_channels = []
    hotspots = []
    for idx in range(milestone_count):
        mz = 5.5 - idx * (11.0 / max(1, milestone_count - 1))
        mx = -1.2 + idx * 1.1
        m_name = f"Moc_Chien_Dich_{idx + 1}"
        beacon = MeshPart(m_name, (0.80, 0.20 + idx * 0.15, 0.18, 1.0), roughness=0.45, translation=(mx, 0.95, mz))
        beacon.add_frustum(0.34, 0.44, 0.32, 10, 0.0, -0.62, 0.0)
        beacon.add_frustum(0.06, 0.07, 1.55, 8, 0.0, 0.20, 0.0)
        beacon.add_box(0.85, 0.50, 0.06, 0.42, 0.72, 0.0)
        meshes.append(beacon)
        anim_channels.append(
            AnimationChannel(
                m_name,
                "scale",
                [0.0, idx * 1.1 + 0.5, idx * 1.1 + 1.1, 5.0],
                [1.0, 1.0, 1.0, 1.25, 1.32, 1.25, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
            )
        )
        hotspots.append(
            {
                "x": round(mx, 2),
                "y": 1.35,
                "z": round(mz, 2),
                "title": f"Mốc diễn biến chiến dịch #{idx + 1}",
                "description": "Điểm tập kết / quyết chiến chiến lược trên sa bàn địa hình.",
                "phaseKey": "all",
            }
        )

    meshes.append(create_tactical_arrow("Mui_Tien_Cong_Chu_Luc", (0.84, 0.22, 0.20, 1.0), (0.2, 0.45, 0.0), math.pi - 0.25, 5.2))
    anim_name = "Tien_Trinh_Chien_Dich_Sa_Ban"
    glb = compile_glb_bytes(meshes, [AnimationClip(anim_name, anim_channels)], "CampaignRelief_PythonGLB")
    meta = {
        "animationNames": [anim_name],
        "cameraSettings": {"position": [10.0, 8.2, 12.5], "target": [0.0, 0.4, 0.0]},
        "phases": [
            {
                "key": "all",
                "label": "Toàn cảnh sa bàn chiến dịch",
                "animationName": anim_name,
                "cameraPosition": [10.0, 8.2, 12.5],
                "cameraTarget": [0.0, 0.4, 0.0],
                "summary": "Sa bàn địa hình sinh tự động từ Python tái hiện các chặng tiến quân chiến lược.",
            }
        ],
        "hotspots": hotspots,
    }
    return glb, meta


CORE_BUILDERS: Dict[str, Callable[[], bytes]] = {
    "bach_dang_938.glb": build_bach_dang_938,
    "khoi_nghia_lam_son.glb": build_lam_son,
    "thanh_nha_ho.glb": build_thanh_nha_ho,
    "dong_nam_a_can_dai.glb": build_dong_nam_a,
    "khong_gian_bien_dong.glb": build_bien_dong,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Trình biên dịch mô phỏng lịch sử 3D từ Python sang .glb")
    parser.add_argument("--build-all", action="store_true", help="Sinh toàn bộ 5 tệp .glb cốt lõi vào --out-dir")
    parser.add_argument("--out-dir", type=str, default="public/models", help="Thư mục xuất tệp .glb khi dùng --build-all")
    parser.add_argument(
        "--preset",
        type=str,
        choices=["naval_ambush", "maritime_sovereignty", "stone_citadel", "campaign_relief"],
        help="Mẫu mô phỏng tham số hóa",
    )
    parser.add_argument("--params-json", type=str, default="{}", help="Chuỗi JSON tham số đầu vào cho --preset")
    parser.add_argument("--out-file", type=str, help="Đường dẫn tệp .glb xuất ra khi dùng --preset")
    parser.add_argument("--meta-out", type=str, help="Đường dẫn tệp .json lưu metadata (hotspots, phases, animations)")

    args = parser.parse_args()

    if args.build_all:
        out_dir = Path(args.out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        summary = []
        for filename, builder in CORE_BUILDERS.items():
            glb_data = builder()
            target = out_dir / filename
            target.write_bytes(glb_data)
            summary.append({"filename": filename, "bytes": len(glb_data), "generator": GENERATOR_SIGNATURE})
        print(json.dumps({"ok": True, "generated": summary}, ensure_ascii=False))
        return

    if args.preset and args.out_file:
        params = json.loads(args.params_json or "{}")
        glb_data, meta = build_parameterized_preset(args.preset, params)
        out_path = Path(args.out_file)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(glb_data)
        if args.meta_out:
            Path(args.meta_out).write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        print(
            json.dumps(
                {
                    "ok": True,
                    "preset": args.preset,
                    "outFile": str(out_path),
                    "bytes": len(glb_data),
                    "generator": GENERATOR_SIGNATURE,
                    "meta": meta,
                },
                ensure_ascii=False,
            )
        )
        return

    parser.print_help()


if __name__ == "__main__":
    main()
