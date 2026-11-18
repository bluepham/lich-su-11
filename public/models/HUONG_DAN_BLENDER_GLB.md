# Hướng dẫn Lập trình Python Sinh Mô phỏng 3D -> Xuất tệp `.glb` -> Upload lên Hệ thống

Toàn bộ không gian mô phỏng lịch sử và biển đảo trong **LỊCH SỬ 11 3D** được lập trình bằng **Python 3**, đóng gói trực tiếp sang định dạng nhị phân chuẩn **`glTF 2.0 (.glb)`**, và tải lên hiển thị bằng `GLTFLoader` của Three.js.

---

## Cách 1: Sinh tệp `.glb` từ Python 3 thuần và tự động Upload qua HTTP (`Khuyên dùng`)

Không cần cài đặt phần mềm đồ họa nặng hay thư viện ngoài (`struct`, `json`, `math`, `urllib` có sẵn trong Python 3.10+):

### 1. Biên dịch lại toàn bộ 5 mô hình lịch sử & biển đảo cốt lõi bằng Python
```bash
python3 public/python_glb/sinh_mo_phong_lich_su_glb.py --build-all --out-dir public/models
```

### 2. Lập trình / Tùy biến mô phỏng mới từ Python, xuất `.glb` rồi tự động Upload lên Web
```bash
python3 public/python_glb/xuat_va_upload_glb.py \
  --server http://localhost:3000 \
  --admin-password 123456 \
  --preset naval_ambush \
  --params-json '{"stakeRows": 3, "warshipPairs": 2, "tidalAmplitude": 0.34}' \
  --name "Chiến thắng Rạch Gầm – Xoài Mút năm 1785 (Mô phỏng Python)" \
  --lesson-id lesson-7 \
  --out-file ./rach_gam_xoai_mut_1785.glb
```
Kịch bản sẽ:
1. Dùng Python tính toán lưới địa hình 3D, chiến thuyền, bãi cọc/quần đảo, pháp tuyến đơn vị và hoạt ảnh khung khóa (`AnimationClip`).
2. Xuất tệp nhị phân `.glb` chuẩn glTF 2.0 ra ổ đĩa (`rach_gam_xoai_mut_1785.glb`).
3. Xác thực phiên Giáo viên Quản trị và gửi `multipart/form-data` lên `/api/admin/models/upload`, tự động bóc tách danh sách hoạt ảnh từ header nhị phân `.glb` và công bố ngay trên Bảo tàng 3D!

### 3. Chạy trực tiếp trên giao diện Quản trị Giáo viên
- Truy cập `/giao-vien` -> **5. Quản lý Mô hình 3D** (`/admin/mo-hinh-3d`).
- Sử dụng bảng **"Trình biên dịch Mô phỏng Python -> Xuất .glb & Đăng tải"** để chạy `python3` ngay trên máy chủ, hoặc chọn tệp `.glb` đã xuất từ máy tính cá nhân để upload lên hệ thống.

---

## Cách 2: Dựng nâng cao trong Blender Python API (`bpy`) rồi xuất `.glb`

1. Mở **Blender 3.6 / 4.x**, chuyển sang tab **Scripting** và chạy kịch bản Python mẫu `/public/blender_scripts/tao_bai_coc_bach_dang.py`.
2. Đặt tên rõ ràng cho từng đối tượng (Object Name) để học sinh nhấn vào xem chú thích qua Raycaster.
3. Xuất tệp: **File -> Export -> glTF 2.0 (.glb)**, bật chọn *Apply Modifiers*, *Normals*, *Materials*, và *Animations*.
4. Tải tệp `.glb` lên tại `/admin/mo-hinh-3d`.
