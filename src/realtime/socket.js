import { reportError } from '@/utils/errorReporter';
import { backoffDelay } from './backoff';

/**
 * KẾT NỐI REALTIME DÙNG CHUNG (1 kết nối cho cả app – mở khi đăng nhập, đóng khi đăng xuất: xem SocketBridge).
 * ---------------------------------------------------------------------------------
 * Server -> web : "sự kiện"  (socket.on('TenSuKien', handler))
 * Web -> server : "gọi hàm" trên hub (await socket.invoke('TenHam', ...thamSo)) – có kết quả trả về
 *
 *   import { socket } from '@/realtime';
 *   const off = socket.on('ChungTuDaDuyet', (ct) => toast.success(`Đã duyệt ${ct.SoCT}`));
 *   off();                                         // huỷ nghe
 *   await socket.invoke('SendMessage', 'chung', 'Xin chào', clientId);
 *   await socket.join('donvi:02');                 // vào nhóm (tự vào lại sau khi mất kết nối)
 *   socket.status                                  // idle | connecting | connected | reconnecting | disconnected
 *
 * Trong component nên dùng hook (tự huỷ khi đóng màn): useSocketEvent, useSocketStatus, useSocketGroup – xem useSocket.js
 *
 * Chế độ (.env):
 *   VITE_SOCKET_MODE=mock     giả lập trong trình duyệt (mở 2 tab để thấy tin nhắn qua lại) – mặc định
 *   VITE_SOCKET_MODE=signalr  nối hub SignalR thật: VITE_SOCKET_HUB=/hubs/app (đi qua proxy khi dev)
 *   VITE_SOCKET_MODE=off      tắt hẳn
 */

const MODE = (import.meta.env.VITE_SOCKET_MODE || 'mock').toLowerCase();
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const HUB = import.meta.env.VITE_SOCKET_HUB || '/hubs/app';
// Đường dẫn tương đối -> cùng server API (qua proxy khi dev); URL đầy đủ (https://rt.congty.vn/hubs/app) -> server riêng
const HUB_URL = /^https?:\/\//i.test(HUB) ? HUB : `${BASE_URL}${HUB}`;
const INVOKE_WAIT_MS = 10000;                // invoke khi đang kết nối: chờ tối đa chừng này

export const socketConfig = { MODE, HUB_URL };

const listeners = new Map(); // tên sự kiện -> Set(handler)
const statusSubs = new Set();
const groups = new Set();    // nhóm đã vào – vào lại sau khi kết nối lại
let transport = null;
let status = 'idle';
let session = null;          // { token, user, name } của kết nối hiện tại
let retryTimer = null;
let retryCount = 0;
let lastError = null;

function setStatus(s, err) {
  if (err !== undefined) lastError = err;
  if (s === status) return;
  status = s;
  statusSubs.forEach((fn) => fn(s));
}

function dispatch(event, args) {
  const set = listeners.get(event);
  if (!set) return;
  [...set].forEach((fn) => {
    try { fn(...args); } catch (err) { reportError(err, { title: `Lỗi xử lý sự kiện ${event}`, source: 'global' }); }
  });
}

async function createTransport(opts) {
  if (MODE === 'signalr') {
    const { createSignalRTransport } = await import('./transports/signalr');
    return createSignalRTransport({ ...opts, url: HUB_URL });
  }
  const { createMockTransport } = await import('./transports/mock');
  return createMockTransport(opts);
}

async function rejoinGroups() {
  for (const g of groups) {
    try { await transport.invoke('JoinGroup', g); } catch { /* bỏ qua: nhóm sẽ thử lại lần kết nối sau */ }
  }
}

async function start() {
  clearTimeout(retryTimer);
  const mine = transport;
  setStatus(retryCount ? 'reconnecting' : 'connecting');
  try {
    await mine.start();
    if (mine !== transport) return; // đã đăng xuất / đổi phiên trong lúc chờ
    retryCount = 0;
    setStatus('connected', null);
    await rejoinGroups();
  } catch (err) {
    if (mine !== transport) return;
    setStatus('disconnected', err);
    if (retryCount === 0) reportError(err, { title: 'Không kết nối được máy chủ realtime', source: 'api' });
    const wait = backoffDelay(retryCount + 1); // có ngẫu nhiên – tránh mọi client dội server cùng lúc
    retryCount += 1;
    retryTimer = setTimeout(start, wait);
  }
}

/** Chờ tới khi kết nối xong (dùng trong invoke) */
function whenConnected(timeout = INVOKE_WAIT_MS) {
  if (status === 'connected') return Promise.resolve();
  if (!transport) return Promise.reject(new Error('Chưa kết nối realtime (chưa đăng nhập hoặc đã tắt).'));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { off(); reject(new Error('Hết thời gian chờ kết nối realtime.')); }, timeout);
    const off = socket.onStatus((s) => {
      if (s === 'connected') { clearTimeout(t); off(); resolve(); }
    });
  });
}

export const socket = {
  get status() { return status; },
  get error() { return lastError; },
  get mode() { return MODE; },
  get user() { return session?.user || ''; },
  get connectionId() { return transport?.connectionId || null; },

  /** Mở kết nối (SocketBridge tự gọi sau khi đăng nhập). Gọi lại với cùng token thì bỏ qua. */
  async connect({ token = '', user = '', name = '', unit = '' } = {}) {
    if (MODE === 'off') return;
    const key = `${user}|${token}`;
    if (session?.key === key) return; // đã / đang kết nối cho phiên này (StrictMode gọi effect 2 lần)
    await socket.disconnect();
    const mine = { token, user, name: name || user, key };
    session = mine;
    retryCount = 0;
    const holder = {};
    const t = await createTransport({
      token, user, name: mine.name, unit,
      onEvent: dispatch,
      onStatus: (s, err) => {
        if (transport !== holder.t) return; // sự kiện của kết nối cũ
        setStatus(s, err);
        if (s !== 'disconnected') return;
        clearTimeout(retryTimer);
        // Server TỪ CHỐI có lý do (HubException – vd phiên đăng nhập không hợp lệ / hết hạn): báo 1 lần, KHÔNG thử lại
        // (thử lại cũng bị từ chối, chỉ làm phiền). Đăng nhập lại -> SocketBridge gọi connect() với token mới.
        if (err?.hub) {
          reportError(err, { title: 'Không kết nối được chat', type: 'warning', source: 'api' });
          return;
        }
        // Mất kết nối thường (SignalR đã thử kết nối lại hết lượt) -> tiếp tục thử theo chu kỳ của mình
        retryCount = Math.max(retryCount, 1);
        retryTimer = setTimeout(start, backoffDelay(retryCount + 1));
      },
      onReconnected: rejoinGroups,
      events: () => [...listeners.keys()],
    });
    holder.t = t;
    if (session !== mine) { t.stop().catch(() => {}); return; } // đã đăng xuất / đổi phiên trong lúc chờ
    transport = t;
    await start();
  },

  /** Đóng kết nối (đăng xuất) */
  async disconnect() {
    clearTimeout(retryTimer);
    const t = transport;
    transport = null;
    session = null;
    groups.clear();
    if (t) {
      try { await t.stop(); } catch { /* bỏ qua */ }
    }
    setStatus('idle', null);
  },

  /** Nghe 1 sự kiện server đẩy xuống. Trả về hàm huỷ nghe. */
  on(event, handler) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
      transport?.listen?.(event);
    }
    listeners.get(event).add(handler);
    return () => socket.off(event, handler);
  },

  off(event, handler) {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (!set.size) listeners.delete(event);
  },

  /** Gọi 1 hàm trên hub và chờ kết quả. Lỗi -> toast + throw (truyền { silent: true } ở tham số cuối để không toast). */
  async invoke(method, ...args) {
    const last = args[args.length - 1];
    const silent = last && typeof last === 'object' && last.__silent === true;
    if (silent) args.pop();
    try {
      await whenConnected();
      return await transport.invoke(method, ...args);
    } catch (err) {
      if (!silent) {
        if (err?.hub) {
          // Lỗi nghiệp vụ server chủ động báo (HubException): "Bạn gửi quá nhanh...", "Tin nhắn trống."...
          reportError(err, { title: null, type: 'warning', source: 'api' });
        } else {
          reportError(err, { title: `Lỗi realtime: ${method}`, source: 'api' });
        }
      }
      throw err;
    }
  },

  /** Tuỳ chọn cho invoke: socket.invoke('Typing', room, socket.silent) – lỗi không bật toast */
  silent: { __silent: true },

  /** Vào nhóm (đơn vị, phòng chat, chứng từ...) – server gửi theo nhóm. Tự vào lại khi kết nối lại. */
  async join(group) {
    groups.add(group);
    if (status === 'connected') await socket.invoke('JoinGroup', group);
  },

  async leave(group) {
    groups.delete(group);
    if (status === 'connected') await socket.invoke('LeaveGroup', group, socket.silent).catch(() => {});
  },

  /** Nghe thay đổi trạng thái kết nối. Trả về hàm huỷ. */
  onStatus(fn) {
    statusSubs.add(fn);
    return () => statusSubs.delete(fn);
  },

  /** Chỉ chế độ mock: giả lập rớt mạng vài giây để test giao diện mất kết nối / kết nối lại */
  simulateDrop(ms = 3000) {
    transport?.simulateDrop?.(ms);
  },
};
