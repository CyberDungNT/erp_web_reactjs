import { lazy } from 'react';

/**
 * MẪU 1 PHÂN HỆ – copy cả thư mục này thành src/modules/<ten-phan-he> (vd: ke-toan, kho, ban-hang).
 * Thư mục bắt đầu bằng "_" KHÔNG được nạp, nên mẫu này không ảnh hưởng app.
 *
 * Khai báo Menu_Id (lấy trong bảng menu của CP_SysLogin) -> màn hình:
 */
export const screens = {
  // '02.02.01': lazy(() => import('./TenManPage')),   // Phiếu kế toán
  'MAU.01': lazy(() => import('./TenManPage')),
};

/**
 * (Tuỳ chọn) Menu thêm vào menu trái – chỉ khi màn chưa có trong menu hệ thống.
 * Bình thường để trống: menu lấy từ DB, chỉ cần khai báo screens ở trên.
 */
export const menu = [];
