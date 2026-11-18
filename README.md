# LỊCH SỬ 11 3D – KHÁM PHÁ LỊCH SỬ QUA KHÔNG GIAN SỐ

> **Khẩu hiệu:** *"Chạm vào quá khứ – Khám phá lịch sử – Kiến tạo tương lai."*  
> **Đơn vị triển khai:** Trường THPT Hòa Minh, tỉnh Vĩnh Long  
> **Chương trình:** Lịch sử lớp 11 – Chương trình GDPT 2018 (*SGK Lịch sử 11 – Kết nối tri thức với cuộc sống*)

---

## 1. Kiến trúc hệ thống
- **Frontend:** React 19 + TypeScript + Tailwind CSS 4 + React Router 7 + Three.js (`GLTFLoader`, `OrbitControls`, `AnimationMixer`, `Raycaster`).
- **Backend:** Node.js + Express (`server.ts`) cung cấp REST API có phân quyền chặt chẽ (`Guest`, `Student`, `Teacher Admin`), xác thực phiên qua cookie `HttpOnly` và băm mật khẩu một chiều bằng **Argon2id** (`@node-rs/argon2`).
- **Cơ sở dữ liệu bền vững:** SQLite quan hệ ở phía máy chủ (`better-sqlite3`, lưu tại `./data/lichsu11.sqlite`), khởi tạo tự động qua tệp migration SQL `/server/migrations/001_init.sql`.
- **Mô hình 3D thực (`.glb`) sinh từ Python 3:** Toàn bộ không gian mô phỏng lịch sử & biển đảo được lập trình bằng Python 3 (`public/python_glb/sinh_mo_phong_lich_su_glb.py`), đóng gói trực tiếp ra tệp nhị phân chuẩn `glTF 2.0 (.glb)` và hỗ trợ kịch bản xuất `.glb` + tự động upload qua HTTP (`public/python_glb/xuat_va_upload_glb.py`) cũng như biên dịch trực tiếp tại `/admin/mo-hinh-3d`.
- **Trợ lý Sử Gia AI 11:** Kết nối `@google/genai` ở phía máy chủ thông qua biến môi trường `GEMINI_API_KEY` (tuyệt đối không lộ khóa ra trình duyệt).

## 2. Hướng dẫn cài đặt & Chạy ứng dụng

```bash
# 1. Cài đặt gói phụ thuộc
npm install

# 2. Cấu hình biến môi trường (tham khảo .env.example)
cp .env.example .env

# 3. Sinh 5 mô hình .glb gốc trực tiếp từ Python 3 & chạy kiểm thử đơn vị
python3 public/python_glb/sinh_mo_phong_lich_su_glb.py --build-all --out-dir public/models
npm test

# 4. Khởi chạy môi trường phát triển (Cổng 3000)
npm run dev

# 5. Biên dịch bản Production & khởi chạy
npm run build
npm start
```

## 3. Thông tin đăng nhập kiểm thử
- **Học sinh:** Tự đăng ký tại `/dang-ky` với 5 trường (`Họ và tên`, `Lớp` VD `11A1`, `Tên đăng nhập`, `Mật khẩu`, `Nhập lại mật khẩu`) — không cần email hay SĐT. Hệ thống không tạo sẵn học sinh giả hay điểm số ảo.
- **Giáo viên Quản trị:** Truy cập `/giao-vien` (chỉ có duy nhất ô **Mật khẩu quản trị**). Mật khẩu khởi tạo ban đầu phục vụ kiểm thử là `123456` (được băm Argon2id trong cơ sở dữ liệu; giáo viên có thể đổi sang mật khẩu mạnh ngay tại `/admin/cai-dat`).

## 4. Lập trình Python Sinh Mô phỏng `.glb` & Upload lên Hệ thống
- **Trình biên dịch Python 3 sang `.glb`:** `public/python_glb/sinh_mo_phong_lich_su_glb.py`
- **Script tự động xuất `.glb` và upload qua HTTP multipart:** `public/python_glb/xuat_va_upload_glb.py`
- **Hướng dẫn chi tiết Python & Blender:** `public/models/HUONG_DAN_BLENDER_GLB.md`

