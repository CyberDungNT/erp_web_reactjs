import { lazy } from 'react';

/**
 * DANH MỤC MÀN HÌNH: Menu_Id -> component.
 *
 * Màn hình nghiệp vụ nằm trong src/modules/<phân-hệ>/, mỗi phân hệ có 1 file index.js khai báo:
 *   export const screens = { '02.02.01': lazy(() => import('./PhieuKeToanPage')) };
 *   export const menu = [];   // (tuỳ chọn) menu thêm vào menu trái
 *   export const widgets = [lazy(() => import('./XxxNotifier'))]; // (tuỳ chọn) thành phần chạy nền trong màn chính
 * File này TỰ NẠP mọi src/modules/* /index.js (bỏ qua thư mục bắt đầu bằng "_", vd _template)
 * -> thêm màn / thêm phân hệ KHÔNG cần sửa file này.
 *
 * Component nhận props: { menu } (node menu: id, text, isMaxForm, isShowTab, tag, url, raw...)
 * Menu_Id chưa khai báo sẽ mở trang PlaceholderPage.
 */
const modules = import.meta.glob(['../modules/*/index.js', '!../modules/_*/index.js'], { eager: true });

export const screens = {};
const moduleMenus = [];
/** Thành phần chạy nền của các module (popup thông báo...) – MainLayout gắn trong màn chính */
export const moduleWidgets = [];
for (const [file, mod] of Object.entries(modules)) {
  for (const id of Object.keys(mod.screens || {})) {
    if (screens[id]) console.warn(`[registry] Menu_Id '${id}' bị khai báo trùng (${file})`);
  }
  Object.assign(screens, mod.screens);
  if (mod.menu?.length) moduleMenus.push(...mod.menu);
  if (mod.widgets?.length) moduleWidgets.push(...mod.widgets);
}

export const Placeholder = lazy(() => import('@/pages/PlaceholderPage'));

/**
 * TRANG CHỦ: 1 dashboard biểu đồ duy nhất (không còn hàng tab dashboard).
 * Muốn dùng trang chủ khác thì đổi component ở đây.
 */
export const HomePage = lazy(() => import('@/pages/home/HomeDashboard'));

/** Mã đặc biệt trong menu hệ thống */
export const EXIT_MENU_IDS = ['01.19.00'];            // Kết thúc -> đăng xuất (hoặc Icon = EXIT)
export const LANG_MENU_IDS = ['01.12.00'];            // English interface / Giao diện tiếng Việt

/** Hiện nhóm menu khai báo trong các module (vd "Công cụ phát triển") ở cuối menu trái (false để ẩn) */
export const SHOW_DEV_MENU = true;

/** Menu bổ sung từ các module – gộp vào cuối menu trái */
export const devMenu = moduleMenus;
