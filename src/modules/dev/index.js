import { lazy } from 'react';
import { chatBridge, useChatUnread } from './chatBridge';

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
  'DEV.PLATE': lazy(() => import('./BienSoXePage')),
  'DEV.BARCODE': lazy(() => import('./BarcodePage')),
};

/**
 * Thành phần chạy NỀN trong màn chính (không phải màn hình) – MainLayout tự gắn khi đăng nhập.
 * ChatWidget  : khung chat (mở từ menu avatar -> "Tin nhắn"), luôn chạy nền để đếm tin chưa đọc.
 * ChatNotifier: popup tin nhắn mới khi khung chat đang đóng.
 */
export const widgets = [lazy(() => import('./ChatWidget')), lazy(() => import('./ChatNotifier'))];

/** Mục trong menu avatar: "Tin nhắn" (số tin chưa đọc hiện trên mục + chấm đỏ trên avatar) */
export const userMenu = [
  { key: 'chat', icon: 'chat', text: { V: 'Tin nhắn', E: 'Messages' }, onClick: () => chatBridge.openWidget(), useBadge: useChatUnread },
];

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
      { id: 'DEV.PLATE', parentId: 'DEV', text: 'Đọc biển số xe (mẫu)', icon: '', separator: false, children: [] },
      { id: 'DEV.BARCODE', parentId: 'DEV', text: 'Quét QR / mã vạch (mẫu)', icon: '', separator: false, children: [] },
    ],
  },
];
