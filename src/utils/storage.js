/**
 * QUY ĐỊNH LƯU TRÌNH DUYỆT: localStorage CHỈ được chứa các khoá dưới đây, mọi thứ khác giữ trong bộ nhớ (mất khi tải lại trang).
 *
 *   cyber_auth               bản ghi đăng nhập đã MÃ HOÁ (TokenKey + tài khoản + đơn vị + ngôn ngữ) – xem auth/authService.js
 *   cyber_device_id          mã thiết bị gửi kèm khi đăng nhập (@M_Id_Device)
 *   cyber_sidebar_width      độ rộng menu trái
 *   cyber_sidebar_collapsed  menu trái đang thu gọn
 *
 * Khoá giải mã cyber_auth nằm ở IndexedDB "cyber_vault" (không phải localStorage, không đọc ra được) – xem auth/tokenVault.js.
 * Muốn lưu thêm khoá mới: thêm vào LOCAL_KEYS, nếu không cleanLocalStorage() sẽ xoá khi mở app.
 */
export const LOCAL_KEYS = Object.freeze({
  AUTH: 'cyber_auth',
  DEVICE_ID: 'cyber_device_id',
  SIDEBAR_WIDTH: 'cyber_sidebar_width',
  SIDEBAR_COLLAPSED: 'cyber_sidebar_collapsed',
});

const ALLOWED = new Set(Object.values(LOCAL_KEYS));

/** Xoá mọi khoá localStorage không nằm trong danh sách (dữ liệu cũ: cyber_last_login, cyber_mock_chat...). Gọi 1 lần khi khởi động. */
export function cleanLocalStorage() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && !ALLOWED.has(key)) localStorage.removeItem(key);
    }
  } catch { /* trình duyệt chặn storage */ }
}

/** Đọc / ghi localStorage có kiểm tra danh sách – ghi khoá ngoài danh sách sẽ bị từ chối (báo ở console khi dev). */
export const localStore = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    if (!ALLOWED.has(key)) {
      if (import.meta.env.DEV) console.warn(`[storage] Không cho lưu '${key}' vào localStorage – thêm vào LOCAL_KEYS (utils/storage.js) nếu thật sự cần.`);
      return;
    }
    try { localStorage.setItem(key, value); } catch { /* đầy / bị chặn */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};
