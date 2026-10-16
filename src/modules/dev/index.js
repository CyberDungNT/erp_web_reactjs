import { lazy } from 'react';

/**
 * PHÂN HỆ "Công cụ phát triển" – các màn test / màn mẫu.
 * Mỗi phân hệ (thư mục trong src/modules) có 1 file index.js như này, được screens/registry.js tự nạp.
 */

/** Menu_Id -> màn hình (lazy: chỉ tải code khi mở màn) */
export const screens = {
  'DEV.DEMO': lazy(() => import('./DemoControlsPage')),
  'DEV.HANGHOA': lazy(() => import('./HangHoaPage')),
  'DEV.PHIEUNHAP': lazy(() => import('./PhieuNhapPage')),
  'DEV.PROC': lazy(() => import('./ProcTesterPage')),
  'DEV.CHAT': lazy(() => import('./ChatPage')),
};

/**
 * Thành phần chạy NỀN trong màn chính (không phải màn hình) – MainLayout tự gắn khi đăng nhập.
 * ChatNotifier: popup tin nhắn mới ở góc dưới phải khi không mở màn chat.
 */
export const widgets = [lazy(() => import('./ChatNotifier'))];

/**
 * Menu thêm vào cuối menu trái (chỉ dùng cho màn KHÔNG có trong menu hệ thống trả về từ CP_SysLogin).
 * Màn nghiệp vụ thật đã có Menu_Id trong DB thì không cần khai báo menu ở đây.
 * Ẩn nhóm này: đặt SHOW_DEV_MENU = false trong screens/registry.js.
 */
export const menu = [
  {
    id: 'DEV', parentId: '', text: 'Công cụ phát triển', icon: 'tools', separator: false, dev: true,
    children: [
      { id: 'DEV.DEMO', parentId: 'DEV', text: 'Test bộ control', icon: '', separator: false, children: [] },
      { id: 'DEV.HANGHOA', parentId: 'DEV', text: 'Danh mục hàng hoá (mẫu)', icon: '', separator: false, children: [] },
      { id: 'DEV.PHIEUNHAP', parentId: 'DEV', text: 'Phiếu nhập kho (mẫu CyberForm)', icon: '', separator: false, children: [] },
      { id: 'DEV.PROC', parentId: 'DEV', text: 'Gọi proc tuỳ ý', icon: '', separator: false, children: [] },
      { id: 'DEV.CHAT', parentId: 'DEV', text: 'Chat realtime (mẫu socket)', icon: '', separator: false, children: [] },
    ],
  },
];
