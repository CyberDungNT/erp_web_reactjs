/**
 * Cầu nối giữa màn Chat (ChatPage) và popup thông báo tin nhắn (ChatNotifier – luôn chạy trong màn chính):
 *   - ChatPage báo đang HIỂN THỊ hay không (mở nhưng đang ở tab khác = không hiển thị) -> ChatNotifier quyết định có bật popup.
 *   - ChatNotifier yêu cầu mở 1 phòng (bấm "Trả lời" trên popup) -> ChatPage chuyển sang phòng đó.
 */

/** Menu_Id của màn chat (khai báo trong modules/dev/index.js) */
export const CHAT_MENU_ID = 'DEV.CHAT';

let visible = false;
let pendingRoom = null;
let openedByClick = false;
const roomSubs = new Set();
const visibleSubs = new Set();

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
};

// ----- Hàm hiển thị dùng chung cho màn chat & popup -----
const AVATAR_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#8b5cf6', '#e0457b', '#0e9fb0', '#b7791f'];
export const colorOf = (s = '') => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
export const initials = (name = '') => name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase() || '?';
export const timeOf = (iso) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
