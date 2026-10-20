import { lazy } from 'react';

/**
 * MẪU index.js CỦA 1 THƯ MỤC TRONG src/modules – TUỲ CHỌN, đa số trường hợp KHÔNG cần.
 *
 * Bình thường chỉ cần đặt file <FormInPut>.jsx vào đúng thư mục loại (danhmuc / baocao / chungtu / calculator / other)
 * là bấm menu tự mở (CP_SysGetMenu -> FormInPut). Chỉ tạo index.js khi cần 1 trong các việc dưới đây.
 * Thư mục bắt đầu bằng "_" KHÔNG được nạp, nên file mẫu này không ảnh hưởng app.
 */

/** Gắn CỨNG Menu_Id -> màn hình (bỏ qua CP_SysGetMenu) – vd màn đặc biệt chưa khai báo trong DB */
export const screens = {
  // '02.02.01': lazy(() => import('./PhieuKeToan')),
  'MAU.01': lazy(() => import('./MauKhac')),
};

/** Menu thêm vào cuối menu trái – chỉ khi màn chưa có trong menu hệ thống (CP_SysLogin) */
export const menu = [];

/** Thành phần chạy NỀN trong màn chính (vd popup thông báo nghiệp vụ nghe qua socket) */
export const widgets = [];

/** Mục thêm vào menu avatar: [{ key, icon, text: { V, E }, onClick, useBadge }] (vd "Tin nhắn" – xem modules/dev/index.js) */
export const userMenu = [];
