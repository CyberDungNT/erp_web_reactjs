import { mockHub } from './mockHub';

/**
 * GIẢ LẬP SERVER REALTIME ngay trong trình duyệt (VITE_SOCKET_MODE=mock) – không cần backend.
 * Các tab cùng trình duyệt nói chuyện qua BroadcastChannel => mở 2 tab là thấy tin nhắn / sự kiện qua lại.
 * Logic "server" (các hàm invoke được) nằm ở mockHub.js – cùng tên hàm với hub C# mẫu.
 */
const CHANNEL = 'cyber_socket_mock';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export function createMockTransport({ user, name, onEvent, onStatus, onReconnected }) {
  const connectionId = `mock-${Math.random().toString(36).slice(2, 10)}`;
  const groups = new Set();
  let bc = null;
  let online = false;

  /** Gói tin tới: chỉ nhận nếu đang ở trong nhóm đích (giống server gửi Clients.Group) */
  const receive = (p) => {
    if (!online || p?.kind !== 'event') return;
    if (p.group && !groups.has(p.group)) return;
    if (p.except && p.except === connectionId) return;
    if (p.to && p.to !== user) return;
    onEvent(p.event, p.args);
  };

  /** Gửi sự kiện cho mọi tab (kể cả tab này) – { group, except, to } giống Clients.Group / OthersInGroup / User */
  const publish = (event, args, opts = {}) => {
    const packet = { kind: 'event', event, args, ...opts };
    bc?.postMessage(packet);
    receive(packet);
  };

  const ctx = { connectionId, user, name, groups, publish };

  return {
    connectionId,
    listen() { /* mock nhận mọi sự kiện, không cần đăng ký trước */ },

    async start() {
      await delay(450); // giả lập thời gian bắt tay
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (e) => receive(e.data);
      online = true;
    },

    async stop() {
      online = false;
      bc?.close();
      bc = null;
    },

    async invoke(method, ...args) {
      if (!online) throw new Error('Mất kết nối realtime.');
      const fn = mockHub[method];
      if (!fn) throw new Error(`[MOCK] Hub không có hàm '${method}'.`);
      await delay(80 + Math.random() * 120); // giả lập độ trễ mạng
      return fn(ctx, ...args);
    },

    /** Giả lập rớt mạng: ngừng nhận/gửi vài giây rồi tự kết nối lại */
    async simulateDrop(ms) {
      if (!online) return;
      online = false;
      onStatus('reconnecting');
      await delay(ms);
      online = true;
      onStatus('connected');
      onReconnected();
    },
  };
}
