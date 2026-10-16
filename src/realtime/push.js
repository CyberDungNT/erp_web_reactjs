import { useSyncExternalStore } from 'react';
import { socket, socketConfig } from './socket';

/**
 * THÔNG BÁO ĐẨY (Web Push) – nhận thông báo tin nhắn khi app đã thu nhỏ / đóng / tắt màn hình.
 * Server: API_App_Demo/Realtime/WebPush.cs (hub: GetPushKey, RegisterPush, UnregisterPush, SetVisible).
 * Service worker: public/sw.js (hiện thông báo, chạm vào -> mở app vào thẳng phòng chat).
 *
 *   const status = usePushStatus();   // 'unsupported' | 'install' | 'denied' | 'off' | 'on' | 'busy'
 *   await enablePush();               // GỌI TRONG SỰ KIỆN BẤM (iPhone bắt buộc) – xin quyền + đăng ký
 *   await disablePush();              // tắt trên thiết bị này
 *   syncPush();                       // mỗi lần kết nối hub: gửi lại đăng ký đang có (server chạy lại / đổi khoá)
 *   reportVisibility();               // báo server app đang hiện / đã ẩn (đang hiện thì server không đẩy)
 *   onOpenChat((room) => ...)         // chạm vào thông báo -> mở phòng
 *
 * iPhone / iPad: chỉ nhận được khi đã "Thêm vào MH chính" (iOS 16.4+) và mở app từ icon đó -> status 'install'.
 * Chỉ chạy với VITE_SOCKET_MODE=signalr (giả lập mock không có server đẩy).
 */

const SW_URL = '/sw.js';
const ENABLED = socketConfig.MODE === 'signalr';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const supported = () => typeof window !== 'undefined' && window.isSecureContext
  && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Mở app từ thông báo khi app đang đóng: sw.js mở "/?chat=<phòng>". Đọc ngay lúc nạp trang (main.jsx import file này)
// vì MainLayout sẽ ghi đè thanh địa chỉ.
let pendingRoom = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('chat') : null;
const openSubs = new Set();

let status = 'busy';
let serverOff = false;
const statusSubs = new Set();
const setStatus = (s) => {
  if (s === status) return;
  status = s;
  statusSubs.forEach((fn) => fn());
};

/** Trạng thái thông báo đẩy trên thiết bị này – tự render lại khi đổi */
export function usePushStatus() {
  return useSyncExternalStore((fn) => { statusSubs.add(fn); return () => statusSubs.delete(fn); }, () => status);
}

/** Đăng ký service worker + nghe "mở phòng" từ thông báo. Gọi 1 lần khi vào màn chính (ChatNotifier). */
let started = false;
export function initPush() {
  if (started) return;
  started = true;
  if (!ENABLED) { setStatus('unsupported'); return; }
  if (supported()) {
    navigator.serviceWorker.register(SW_URL).catch((err) => console.warn('Không đăng ký được service worker:', err));
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'open-chat' && e.data.room) emitOpen(e.data.room);
    });
  }
  refreshStatus();
}

/** Chạm vào thông báo -> fn(room). Có phòng đang chờ (app vừa được mở từ thông báo) -> gọi ngay. */
export function onOpenChat(fn) {
  openSubs.add(fn);
  if (pendingRoom) { const r = pendingRoom; pendingRoom = null; fn(r); }
  return () => openSubs.delete(fn);
}
function emitOpen(room) {
  if (openSubs.size === 0) { pendingRoom = room; return; }
  openSubs.forEach((fn) => fn(room));
}

async function getSubscription() {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  return reg ? reg.pushManager.getSubscription() : null;
}

async function refreshStatus() {
  if (!ENABLED || serverOff) return setStatus('unsupported');
  if (isIOS && !isStandalone()) return setStatus('install');
  if (!supported()) return setStatus('unsupported');
  if (Notification.permission === 'denied') return setStatus('denied');
  try {
    const sub = Notification.permission === 'granted' ? await getSubscription() : null;
    setStatus(sub ? 'on' : 'off');
  } catch {
    setStatus('off');
  }
}

/** Khoá VAPID dạng base64url -> Uint8Array cho pushManager.subscribe */
function keyBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const sameKey = (sub, key) => {
  const cur = sub.options?.applicationServerKey;
  if (!cur) return true; // trình duyệt không cho đọc -> coi như cùng khoá
  const a = new Uint8Array(cur);
  const b = keyBytes(key);
  return a.length === b.length && a.every((v, i) => v === b[i]);
};

/** Lấy khoá từ server, đăng ký với trình duyệt (khoá đổi -> đăng ký lại) rồi gửi lên server */
async function subscribeAndRegister() {
  const key = await socket.invoke('GetPushKey', socket.silent);
  if (!key) { serverOff = true; throw new Error('Server chưa bật thông báo đẩy.'); }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, key)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await socket.invoke('RegisterPush', sub.toJSON(), socket.silent);
}

/**
 * Bật thông báo trên thiết bị này. PHẢI gọi trực tiếp trong sự kiện bấm (iPhone chỉ hiện hộp xin quyền khi đó).
 * Trả về true nếu bật được; lỗi -> throw Error có câu thông báo dễ hiểu.
 */
export async function enablePush() {
  if (!ENABLED || !supported()) throw new Error('Trình duyệt này không hỗ trợ thông báo đẩy.');
  // xin quyền TRƯỚC mọi await khác (giữ nguyên "cử chỉ người dùng" cho Safari)
  const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (perm !== 'granted') {
    await refreshStatus();
    throw new Error(perm === 'denied'
      ? 'Bạn đã chặn thông báo. Vào cài đặt trình duyệt / điện thoại để cho phép thông báo cho trang này.'
      : 'Bạn chưa cho phép thông báo.');
  }
  setStatus('busy');
  try {
    await subscribeAndRegister();
    setStatus('on');
    return true;
  } catch (err) {
    await refreshStatus();
    throw err;
  }
}

/** Tắt thông báo trên thiết bị này (các thiết bị khác vẫn nhận) */
export async function disablePush() {
  if (!ENABLED || !supported()) return;
  setStatus('busy');
  try {
    const sub = await getSubscription();
    if (sub) {
      await socket.invoke('UnregisterPush', sub.endpoint, socket.silent).catch(() => {});
      await sub.unsubscribe();
    }
  } finally {
    await refreshStatus();
  }
}

/** Mỗi lần kết nối hub: thiết bị đã bật thông báo -> gửi lại đăng ký (server có thể đã chạy lại / đổi khoá). Không hỏi quyền. */
export async function syncPush() {
  if (!ENABLED || !supported() || Notification.permission !== 'granted') return refreshStatus();
  try {
    if (await getSubscription()) await subscribeAndRegister();
  } catch { /* lỗi mạng / server tắt push -> thử lại lần kết nối sau */ }
  return refreshStatus();
}

/** Đăng xuất: huỷ đăng ký trên thiết bị này để người sau dùng máy không nhận tin của tài khoản cũ */
export async function clearPushOnLogout() {
  if (!ENABLED || !supported()) return;
  try {
    const sub = await getSubscription();
    if (sub) {
      await socket.invoke('UnregisterPush', sub.endpoint, socket.silent).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* bỏ qua */ }
  refreshStatus();
}

/** Báo server app đang hiện (không đẩy) hay đã ẩn – thu nhỏ, chuyển tab, tắt màn hình (đẩy) */
export function reportVisibility() {
  if (!ENABLED || socket.status !== 'connected') return;
  socket.invoke('SetVisible', document.visibilityState === 'visible', socket.silent).catch(() => {});
}
