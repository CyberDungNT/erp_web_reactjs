import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { backoffDelay } from '../backoff';

/**
 * Server throw new HubException("Bạn gửi quá nhanh...") -> thư viện SignalR phía web báo lỗi dạng
 *   "An unexpected error occurred invoking 'SendMessage' on the server. HubException: Bạn gửi quá nhanh..."
 * -> bóc lấy đúng câu thông báo của server, đánh dấu hub = true (lỗi nghiệp vụ, hiển thị nguyên văn cho người dùng).
 */
function toHubError(err) {
  const m = /HubException:\s*([\s\S]*)$/.exec(err?.message || '');
  if (!m) return err;
  const e = new Error(m[1].trim());
  e.hub = true;
  return e;
}

/**
 * Kết nối hub SignalR thật (ASP.NET Core). Server: project API_App_Demo, thư mục Realtime/ (AppHub.cs)
 * Token gửi qua query ?access_token=... (SignalR tự làm với accessTokenFactory) – server đọc trong AppHub.OnConnectedAsync.
 */
export function createSignalRTransport({ url, token, user, name, unit, onEvent, onStatus, onReconnected, events }) {
  // u / n / dv: server bật Realtime:DevBypassToken (KHÔNG kiểm tra token) lấy user từ đây.
  // Gửi khi chạy dev (npm run dev), hoặc bản build có VITE_SOCKET_SEND_USER=true (test trên IIS khi chưa có proc
  // CP_RT_ValidateToken). Chạy thật: tắt cờ này -> không gửi, server lấy user từ TokenKey.
  const sendUser = import.meta.env.DEV || String(import.meta.env.VITE_SOCKET_SEND_USER).toLowerCase() === 'true';
  const devInfo = sendUser ? new URLSearchParams({ u: user || '', n: name || '', dv: unit || '' }).toString() : '';
  const conn = new HubConnectionBuilder()
    .withUrl(devInfo ? `${url}${url.includes('?') ? '&' : '?'}${devInfo}` : url, { accessTokenFactory: () => token })
    // Kết nối lại có ngẫu nhiên (xem backoff.js). Sau 2 phút vẫn không được -> trả null để đóng hẳn,
    // socket.js tiếp tục thử theo chu kỳ dài hơn (cũng có ngẫu nhiên).
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (ctx) => (ctx.elapsedMilliseconds > 120000 ? null : backoffDelay(ctx.previousRetryCount)),
    })
    .configureLogging(LogLevel.None) // lỗi đã được socket.js báo bằng toast, không in thêm ra console
    .build();

  const registered = new Set();
  const listen = (event) => {
    if (registered.has(event)) return;
    registered.add(event);
    conn.on(event, (...args) => onEvent(event, args));
  };
  events().forEach(listen);

  conn.onreconnecting(() => onStatus('reconnecting'));
  conn.onreconnected(() => { onStatus('connected'); onReconnected(); });
  // Server đóng kèm lý do (vd HubException: phiên đăng nhập không hợp lệ) -> chuyển lý do lên socket.js để báo / ngừng thử lại
  conn.onclose((err) => onStatus('disconnected', err ? toHubError(err) : undefined));

  return {
    get connectionId() { return conn.connectionId; },
    listen,
    start: () => conn.start(),
    stop: () => conn.stop(),
    invoke: (method, ...args) => {
      if (conn.state !== HubConnectionState.Connected) return Promise.reject(new Error('Mất kết nối realtime.'));
      return conn.invoke(method, ...args).catch((err) => { throw toHubError(err); });
    },
  };
}
