import { toast } from '@/components/cyber/CyberToast';

/**
 * BÁO LỖI TẬP TRUNG -> bật toast ở trên cùng.
 *
 * Tự bắt (bật/tắt từng nguồn trong ERROR_TOAST):
 *   api      callProc lỗi (mạng, HTTP, Status = false). Muốn tự xử lý không toast: callProc(name, para, { silent: true })
 *   binding  control bind sai (field không có trong form, thiếu setData...) – chỉ khi chạy dev
 *   global   lỗi JS không ai bắt (window.onerror) + Promise bị reject không có catch
 *   console  mọi console.error (gồm cảnh báo của React); console.warn nếu bật consoleWarn
 *
 * Gọi tay ở bất kỳ đâu:
 *   import { reportError } from '@/utils/errorReporter';
 *   try { ... } catch (err) { reportError(err, { title: 'Không đọc được file' }); }
 *
 * Lỗi đã toast được đánh dấu err.reported = true (CyberForm dựa vào đó để không hiện thêm msgbox trùng).
 */
export const ERROR_TOAST = {
  api: true,
  binding: import.meta.env.DEV,
  global: true,
  console: true,
  consoleWarn: false,
};

const DEDUPE_MS = 4000;   // cùng 1 lỗi lặp lại trong khoảng này chỉ toast 1 lần
const MAX_LEN = 240;      // cắt bớt nội dung quá dài (stack, HTML lỗi...)
const recent = new Map(); // key -> thời điểm toast gần nhất
let reporting = false;    // chặn vòng lặp: toast lỗi -> console.error -> toast...

const IGNORE = [
  /ResizeObserver loop/i,             // cảnh báo vô hại của trình duyệt
  /Download the React DevTools/i,
];

/** Lấy nội dung dễ đọc từ Error / chuỗi / object bất kỳ */
export function errorText(err) {
  if (err == null) return 'Lỗi không xác định';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || err.name;
  if (err.reason) return errorText(err.reason);
  if (err.message) return String(err.message);
  try { return JSON.stringify(err); } catch { return String(err); }
}

const shorten = (s) => {
  const line = String(s).trim().split('\n').find((l) => l.trim()) || '';
  return line.length > MAX_LEN ? `${line.slice(0, MAX_LEN)}…` : line;
};

/**
 * Bật toast cho 1 lỗi.
 * @param err    Error | chuỗi | bất kỳ
 * @param opts   { title, type: 'error' | 'warning', source: 'api' | 'binding' | 'global' | 'console' | 'manual' }
 */
export function reportError(err, { title, type = 'error', source = 'manual' } = {}) {
  if (source !== 'manual' && ERROR_TOAST[source] === false) return;
  if (err?.name === 'AbortError') return; // huỷ request chủ động, không phải lỗi
  const message = shorten(errorText(err));
  if (!message || IGNORE.some((re) => re.test(message))) return;

  const key = `${title}|${message}`;
  const now = Date.now();
  if (now - (recent.get(key) || 0) < DEDUPE_MS) return;
  recent.set(key, now);
  if (recent.size > 50) recent.delete(recent.keys().next().value);

  if (err && typeof err === 'object') {
    try { err.reported = true; } catch { /* object đóng băng */ }
  }
  // Hoãn sang tick sau: lỗi có thể phát sinh giữa lúc React đang render, không được setState ngay
  setTimeout(() => {
    if (reporting) return;
    reporting = true;
    try {
      (type === 'warning' ? toast.warning : toast.error)(message, { title: title || defaultTitle(source), duration: 6000 });
    } finally {
      reporting = false;
    }
  }, 0);
}

function defaultTitle(source) {
  return {
    api: 'Lỗi gọi dữ liệu',
    binding: 'Lỗi binding',
    global: 'Lỗi ứng dụng',
    console: 'Lỗi',
  }[source] || 'Có lỗi xảy ra';
}

/** Ghép tham số console.error('%s ...', a, b) thành 1 chuỗi */
function formatConsoleArgs(args) {
  if (!args.length) return '';
  const [first, ...rest] = args;
  if (typeof first === 'string' && /%[sdifoOc]/.test(first)) {
    let i = 0;
    const text = first.replace(/%[sdifoOc]/g, (m) => (m === '%c' ? (i++, '') : errorText(rest[i++])));
    return [text, ...rest.slice(i).map(errorText)].join(' ');
  }
  return args.map(errorText).join(' ');
}

let installed = false;

/** Gắn 1 lần khi khởi động app (main.jsx) */
export function installErrorReporter() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e) => {
    reportError(e.error || e.message, { source: 'global' });
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason?.reported) return; // đã toast ở nơi phát sinh (vd callProc)
    reportError(e.reason, { source: 'global' });
  });

  const origError = console.error.bind(console);
  console.error = (...args) => {
    origError(...args);
    if (reporting || args.some((a) => a?.reported)) return;
    reportError(formatConsoleArgs(args), { source: 'console' });
  };

  const origWarn = console.warn.bind(console);
  console.warn = (...args) => {
    origWarn(...args);
    if (reporting || !ERROR_TOAST.consoleWarn) return;
    reportError(formatConsoleArgs(args), { source: 'console', type: 'warning', title: 'Cảnh báo' });
  };
}
