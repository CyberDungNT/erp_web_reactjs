import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

/**
 * GIAO DIỆN SÁNG / TỐI (dark mode)
 *
 *   Lựa chọn: 'light' | 'dark' | 'system' (theo cài đặt máy – mặc định)
 *   Áp dụng:  <html data-theme="light|dark"> -> biến màu trong styles/theme.css + styles/dark.css đổi theo
 *
 *   Lưu lựa chọn (KHÔNG thêm khoá localStorage – theo quy định ở utils/storage.js):
 *     - sessionStorage 'cyber_theme'           : giữ khi F5 trong tab
 *     - bản ghi đăng nhập đã mã hoá (cyber_auth): mở lại trình duyệt vẫn giữ (khi có "Ghi nhớ đăng nhập")
 *       -> AuthContext gọi applySavedTheme(rec.theme) sau khi tự đăng nhập lại.
 *
 *   Dùng trong component:
 *     const { pref, theme, setPref, toggle } = useTheme();
 *     pref  = lựa chọn của người dùng, theme = màu đang hiển thị thật ('light' | 'dark')
 */
export const THEMES = ['light', 'dark', 'system'];
const SESSION_KEY = 'cyber_theme';
const MQ = '(prefers-color-scheme: dark)';

const subs = new Set();
let persist = null; // hàm lưu vào bản ghi đăng nhập (AuthContext gắn) – tránh vòng import với authService

const valid = (p) => (THEMES.includes(p) ? p : null);
const readSession = () => { try { return valid(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } };
const systemDark = () => typeof window !== 'undefined' && !!window.matchMedia?.(MQ).matches;

let pref = readSession() || 'system';
let theme = resolve(pref);

function resolve(p) {
  return p === 'system' ? (systemDark() ? 'dark' : 'light') : p;
}

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Đổi <html data-theme>. .theme-instant tắt transition của từng phần tử trong lúc đổi -> không có màu 'lưng chừng' gây nháy sáng */
function commit(next, animate) {
  const root = document.documentElement;
  root.classList.add('theme-instant');
  // Bấm từ tối sang sáng: gắn tạm .theme-to-light để quả địa cầu màn login rơi xuống (sang tối thì tự bay lên theo data-theme)
  clearTimeout(commit.t);
  root.classList.toggle('theme-to-light', !!animate && root.dataset.theme === 'dark' && next === 'light');
  commit.t = setTimeout(() => root.classList.remove('theme-to-light'), 2400);
  theme = next;
  root.dataset.theme = next;
  // màu thanh trạng thái trình duyệt điện thoại / app cài lên màn hình chính
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#17222d' : '#1f5f8b');
  // cập nhật React ngay (icon mặt trời / mặt trăng...) để ảnh 'giao diện mới' của hiệu ứng mờ dần đã đúng
  flushSync(() => subs.forEach((fn) => fn()));
}
const endInstant = () => requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('theme-instant')));

/**
 * Áp theme. animate (người dùng bấm) + trình duyệt hỗ trợ View Transitions (Chrome / Edge / Safari mới):
 * giao diện cũ mờ dần, giao diện mới hiện dần (~0,5s – thời gian ở styles/theme.css ::view-transition-*).
 * Trình duyệt cũ / máy bật giảm chuyển động / mở app: đổi tức thì.
 */
function apply(animate) {
  const root = document.documentElement;
  const next = resolve(pref);
  if (next === root.dataset.theme) { subs.forEach((fn) => fn()); return; }
  const motion = !!animate && !reducedMotion();
  if (motion && document.startViewTransition) {
    document.startViewTransition(() => commit(next, true)).finished.finally(endInstant);
  } else {
    commit(next, motion);
    endInstant();
  }
}

/** Đổi lựa chọn (người dùng bấm) */
export function setThemePref(p, { save = true, animate = true } = {}) {
  if (!valid(p)) return;
  pref = p;
  try { sessionStorage.setItem(SESSION_KEY, p); } catch { /* bị chặn */ }
  apply(animate);
  if (save) persist?.(p);
}

/** Bấm nút sáng / tối: onClick={toggleTheme} */
export const toggleTheme = () => setThemePref(theme === 'dark' ? 'light' : 'dark');
export const getThemePref = () => pref;
export const getTheme = () => theme;

/** Bản ghi đăng nhập đã lưu có theme -> dùng, trừ khi tab này đã tự chọn (F5 giữ lựa chọn trong tab) */
export function applySavedTheme(p) {
  if (valid(p) && !readSession() && p !== pref) setThemePref(p, { save: false, animate: false }); // mở app: đổi ngay, không chạy hiệu ứng
}

/** AuthContext gắn hàm lưu lựa chọn vào bản ghi đăng nhập mã hoá */
export function setThemePersister(fn) { persist = fn; }

/** Gọi 1 lần khi khởi động (main.jsx) – trước khi render để không nháy màu */
export function initTheme() {
  apply(false);
  // Đang để "Theo hệ thống" -> máy đổi sáng/tối thì đổi theo
  window.matchMedia?.(MQ).addEventListener?.('change', () => { if (pref === 'system') apply(true); });
}

const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const snapshot = () => `${pref}|${theme}`;

export function useTheme() {
  const [p, t] = useSyncExternalStore(subscribe, snapshot).split('|');
  return { pref: p, theme: t, setPref: setThemePref, toggle: toggleTheme };
}
