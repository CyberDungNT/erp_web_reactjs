import { lazy } from 'react';

/**
 * DANH MỤC MÀN HÌNH: Menu_Id -> component.
 * Khi làm màn hình mới cho 1 chức năng trong menu, thêm 1 dòng vào đây, ví dụ:
 *   '02.02.01': lazy(() => import('../pages/PhieuKeToanPage')),   // Phiếu kế toán
 * Component nhận props: { menu } (node menu: id, text, isMaxForm, isShowTab, tag, url, raw...)
 * Menu_Id chưa khai báo sẽ mở trang PlaceholderPage.
 */
export const screens = {
  HOME: lazy(() => import('../pages/HomePage')),
  'DEV.DEMO': lazy(() => import('../pages/DemoControlsPage')),
  'DEV.HANGHOA': lazy(() => import('../pages/HangHoaPage')),
  'DEV.PROC': lazy(() => import('../pages/ProcTesterPage')),
};

export const Placeholder = lazy(() => import('../pages/PlaceholderPage'));

/** Mã đặc biệt trong menu hệ thống */
export const EXIT_MENU_IDS = ['01.19.00'];            // Kết thúc -> đăng xuất (hoặc Icon = EXIT)
export const LANG_MENU_IDS = ['01.12.00'];            // English interface / Giao diện tiếng Việt

/** Nhóm "Công cụ phát triển" thêm vào cuối menu trái (đặt false để ẩn) */
export const SHOW_DEV_MENU = true;

export const devMenu = [
  {
    id: 'DEV', parentId: '', text: 'Công cụ phát triển', icon: 'tools', separator: false,
    children: [
      { id: 'DEV.DEMO', parentId: 'DEV', text: 'Test bộ control', icon: '', separator: false, children: [] },
      { id: 'DEV.HANGHOA', parentId: 'DEV', text: 'Danh mục hàng hoá (mẫu)', icon: '', separator: false, children: [] },
      { id: 'DEV.PROC', parentId: 'DEV', text: 'Gọi proc tuỳ ý', icon: '', separator: false, children: [] },
    ],
  },
];
