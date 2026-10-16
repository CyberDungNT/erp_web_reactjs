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
