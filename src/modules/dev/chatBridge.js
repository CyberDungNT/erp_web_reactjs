import { useSyncExternalStore } from 'react';
/**
 * Cầu nối giữa khung chat nổi (ChatWidget + ChatPage) và popup thông báo tin nhắn (ChatNotifier):
 *   - ChatPage báo khung chat đang HIỂN THỊ hay không -> ChatNotifier quyết định có bật popup.
 *   - Bất kỳ đâu gọi chatBridge.openWidget(room) -> mở khung chat ở góc dưới phải (vào thẳng phòng nếu có).
 */

let visible = false;
let pendingRoom = null;
let openedByClick = false;
const roomSubs = new Set();
const visibleSubs = new Set();
const openSubs = new Set();
let unread = 0;
const unreadSubs = new Set();

/** Số tin nhắn chưa đọc (cập nhật tức thì) */
export function useChatUnread() {
  return useSyncExternalStore(
    (fn) => { unreadSubs.add(fn); return () => unreadSubs.delete(fn); },
    () => unread,
  );
}

export const chatBridge = {
  /** ChatPage gọi khi hiện / ẩn */
  setVisible(v) {
    if (visible === v) return;
    visible = v;
    visibleSubs.forEach((fn) => fn(v));
  },
  isVisible: () => visible,
  onVisible(fn) {
    visibleSubs.add(fn);
    return () => visibleSubs.delete(fn);
  },

  /** Yêu cầu màn chat mở phòng (màn chat chưa mở thì phòng được nhớ lại, mở xong sẽ lấy) – do người dùng BẤM nên tính là đã xem */
  requestRoom(room) {
    pendingRoom = room;
    openedByClick = true;
    roomSubs.forEach((fn) => fn(room));
  },
  /** Màn chat vừa được mở bằng cách bấm (popup "Mở chat"/"Trả lời")? (chỉ đọc) */
  isOpenedByClick: () => openedByClick,
  /** Đọc rồi xoá cờ */
  takeOpenedByClick() {
    const v = openedByClick;
    openedByClick = false;
    return v;
  },
  /** Phòng đang chờ mở (chỉ đọc) */
  peekPendingRoom: () => pendingRoom,
  takePendingRoom() {
    const r = pendingRoom;
    pendingRoom = null;
    return r;
  },
  onRoomRequest(fn) {
    roomSubs.add(fn);
    return () => roomSubs.delete(fn);
  },

  /** Số tin chưa đọc (khung chat báo lên) – menu avatar / chấm đỏ trên avatar đọc qua useChatUnread() */
  setUnread(n) {
    if (unread === n) return;
    unread = n;
    unreadSubs.forEach((fn) => fn());
  },

  /** Mở khung chat nổi (ghim mở), vào thẳng phòng room nếu truyền */
  openWidget(room) {
    if (room) this.requestRoom(room);
    openSubs.forEach((fn) => fn(room));
  },
  onOpenWidget(fn) {
    openSubs.add(fn);
    return () => openSubs.delete(fn);
  },
};

// ----- Tắt thông báo phòng (riêng từng người – lưu trên server, GetRooms trả mutedUntil) -----
// Dùng chung cho khung chat (icon chuông gạch, badge xám) và popup thông báo (không báo phòng đang tắt).
const mutes = new Map(); // room -> thời điểm hết tắt (ms)
const muteSubs = new Set();
let muteVersion = 0;
let muteTimer = null;
const FOREVER_YEAR = 9999;

function emitMutes() {
  muteVersion += 1;
  muteSubs.forEach((fn) => fn());
  // hẹn giờ tới lúc 1 phòng hết tắt -> vẽ lại (bỏ icon, badge về màu thường)
  clearTimeout(muteTimer);
  const now = Date.now();
  const next = Math.min(...[...mutes.values()].filter((t) => t > now));
  if (Number.isFinite(next) && next - now < 2 ** 31 - 1) muteTimer = setTimeout(emitMutes, next - now + 500);
}

export const muteStore = {
  /** Nạp từ GetRooms: [{ id, mutedUntil }] */
  fromRooms(rooms = []) {
    mutes.clear();
    rooms.forEach((r) => { if (r.mutedUntil) mutes.set(r.id, new Date(r.mutedUntil).getTime()); });
    emitMutes();
  },
  /** Cập nhật 1 phòng (sau SetMute / sự kiện RoomMuteChanged); mutedUntil null = bật lại */
  set(room, mutedUntil) {
    if (mutedUntil) mutes.set(room, new Date(mutedUntil).getTime()); else mutes.delete(room);
    emitMutes();
  },
  isMuted: (room) => (mutes.get(room) || 0) > Date.now(),
  /** Tắt đến lúc nào: Date | 'forever' | null */
  until(room) {
    const t = mutes.get(room);
    if (!t || t <= Date.now()) return null;
    const d = new Date(t);
    return d.getUTCFullYear() >= FOREVER_YEAR ? 'forever' : d;
  },
  subscribe(fn) { muteSubs.add(fn); return () => muteSubs.delete(fn); },
  version: () => muteVersion,
};

/** Hook: vẽ lại khi trạng thái tắt thông báo đổi */
export function useMutes() {
  return useSyncExternalStore(muteStore.subscribe, muteStore.version);
}

/** Chữ hiển thị "đến 15:30" / "đến 15:30 18/10" / "cho đến khi bật lại" */
export function muteLabel(room) {
  const u = muteStore.until(room);
  if (!u) return '';
  if (u === 'forever') return 'cho đến khi bật lại';
  const time = u.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return u.toDateString() === new Date().toDateString()
    ? `đến ${time}`
    : `đến ${time} ${u.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
}

// ----- Nhận diện tin của MÌNH -----
// So tên không phân biệt hoa thường / khoảng trắng; kèm mã tạm (clientId) của tin vừa gửi từ tab này
// -> dù server trả tên người gửi khác cách viết (hoặc server chạy bản cũ) tin mình gửi vẫn nằm bên phải.
const myClientIds = new Set();
const norm = (s) => String(s ?? '').trim().toLowerCase();
/** Ghi nhớ mã tạm của tin vừa gửi */
export function rememberSent(clientId) { if (clientId) myClientIds.add(clientId); }
/** Người dùng u có phải mình (me) không */
export const sameUser = (u, me) => !!norm(me) && norm(u) === norm(me);
/** Tin m có phải của mình không */
export const isMineMsg = (m, me) => !!m && (sameUser(m.user, me) || (!!m.clientId && myClientIds.has(m.clientId)));

// ----- Hàm hiển thị dùng chung cho màn chat & popup -----
const AVATAR_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#8b5cf6', '#e0457b', '#0e9fb0', '#b7791f'];
export const colorOf = (s = '') => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
export const initials = (name = '') => name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase() || '?';
export const timeOf = (iso) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
