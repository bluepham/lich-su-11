#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KỊCH BẢN PYTHON TỰ ĐỘNG: SINH MÔ PHỎNG 3D -> XUẤT TỆP .GLB -> UPLOAD LÊN MÁY CHỦ LỊCH SỬ 11 3D
(Không cần cài đặt thư viện ngoài — sử dụng urllib.request & http.cookiejar chuẩn của Python 3)

Ví dụ sử dụng:
  python3 public/python_glb/xuat_va_upload_glb.py \
    --server http://localhost:3000 \
    --admin-password 123456 \
    --preset naval_ambush \
    --name "Chiến thắng Rạch Gầm – Xoài Mút năm 1785" \
    --lesson-id lesson-7 \
    --description "Mô phỏng trận quyết chiến thủy binh của nghĩa quân Tây Sơn trên đoạn sông Tiền (tháng 1/1785)."
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from sinh_mo_phong_lich_su_glb import build_parameterized_preset


def encode_multipart_formdata(
    fields: dict[str, str],
    file_field: str,
    filename: str,
    file_bytes: bytes,
    content_type: str = "model/gltf-binary",
) -> tuple[bytes, str]:
    boundary = f"----PythonGlbUploadBoundary{uuid.uuid4().hex}"
    chunks: list[bytes] = []

    for key, val in fields.items():
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"))
        chunks.append(f"{val}\r\n".encode("utf-8"))

    chunks.append(f"--{boundary}\r\n".encode("utf-8"))
    chunks.append(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'.encode("utf-8")
    )
    chunks.append(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
    chunks.append(file_bytes)
    chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))

    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def export_and_upload_glb(
    server_url: str,
    admin_password: str,
    preset: str,
    model_name: str,
    lesson_id: str,
    description: str,
    source_reference: str,
    params: dict[str, object],
    save_local_path: str | None = None,
) -> dict[str, object]:
    # Bước 1: Lập trình sinh mô phỏng 3D bằng Python và xuất ra tệp nhị phân .glb
    glb_bytes, meta = build_parameterized_preset(preset, params)

    if save_local_path:
        out_path = Path(save_local_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(glb_bytes)
    else:
        tmp_dir = Path(tempfile.gettempdir())
        out_path = tmp_dir / f"python_sim_{preset}.glb"
        out_path.write_bytes(glb_bytes)

    # Bước 2: Đăng nhập phiên Quản trị Giáo viên qua Cookie
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    base = server_url.rstrip("/")
    login_payload = json.dumps({"password": admin_password}).encode("utf-8")
    login_req = urllib.request.Request(
        f"{base}/api/auth/admin/login",
        data=login_payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with opener.open(login_req, timeout=15) as resp:
        login_res = json.loads(resp.read().decode("utf-8"))
        if login_res.get("role") != "admin":
            raise RuntimeError(f"Đăng nhập quản trị không thành công: {login_res}")

    # Bước 3: Upload tệp .glb vừa xuất lên endpoint /api/admin/models/upload (multipart/form-data)
    form_fields = {
        "modelName": model_name,
        "lessonId": lesson_id,
        "description": description,
        "sourceReference": source_reference,
        "authorName": "Python 3 GLB Simulation Pipeline",
        "reviewStatus": "published",
        "version": "1.0",
        "cameraSettingsJson": json.dumps(meta.get("cameraSettings", {}), ensure_ascii=False),
        "phasesJson": json.dumps(meta.get("phases", []), ensure_ascii=False),
        "hotspotsJson": json.dumps(meta.get("hotspots", []), ensure_ascii=False),
    }

    body, content_type = encode_multipart_formdata(
        fields=form_fields,
        file_field="glbFile",
        filename=out_path.name,
        file_bytes=out_path.read_bytes(),
    )

    upload_req = urllib.request.Request(
        f"{base}/api/admin/models/upload",
        data=body,
        headers={"Content-Type": content_type},
        method="POST",
    )
    with opener.open(upload_req, timeout=30) as resp:
        upload_res = json.loads(resp.read().decode("utf-8"))

    return {
        "exportedGlbPath": str(out_path),
        "exportedBytes": len(glb_bytes),
        "uploadResponse": upload_res,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Sinh tệp .glb từ Python và upload trực tiếp lên hệ thống Lịch sử 11 3D")
    parser.add_argument("--server", default="http://localhost:3000", help="Địa chỉ máy chủ ứng dụng")
    parser.add_argument("--admin-password", default="123456", help="Mật khẩu Quản trị Giáo viên")
    parser.add_argument(
        "--preset",
        default="naval_ambush",
        choices=["naval_ambush", "maritime_sovereignty", "stone_citadel", "campaign_relief"],
        help="Mẫu mô phỏng lịch sử Python",
    )
    parser.add_argument("--params-json", default="{}", help="Tham số cấu hình JSON cho mô phỏng")
    parser.add_argument("--name", required=True, help="Tên mô hình 3D hiển thị trên Bảo tàng")
    parser.add_argument("--lesson-id", default="lesson-7", help="Mã bài học gắn kết (lesson-1 .. lesson-13)")
    parser.add_argument("--description", default="Mô phỏng không gian lịch sử 3D được lập trình và xuất .glb từ Python 3.", help="Mô tả sư phạm")
    parser.add_argument(
        "--source-reference",
        default="SGK Lịch sử 11 – Kết nối tri thức với cuộc sống (Mô phỏng sinh từ Python 3)",
        help="Nguồn tư liệu đối chiếu",
    )
    parser.add_argument("--out-file", default=None, help="Đường dẫn lưu tệp .glb cục bộ trước khi upload")

    args = parser.parse_args()
    try:
        result = export_and_upload_glb(
            server_url=args.server,
            admin_password=args.admin_password,
            preset=args.preset,
            model_name=args.name,
            lesson_id=args.lesson_id,
            description=args.description,
            source_reference=args.source_reference,
            params=json.loads(args.params_json or "{}"),
            save_local_path=args.out_file,
        )
        print(json.dumps({"ok": True, **result}, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Lỗi HTTP {exc.code}: {err_body}") from exc


if __name__ == "__main__":
    main()
