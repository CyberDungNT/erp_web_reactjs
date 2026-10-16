import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Thông báo nhanh dạng TOAST – hiện ở giữa phía trên màn hình, tự ẩn sau vài giây, không chặn thao tác.
 * (Khác msgbox: msgbox là hộp thoại phải bấm đóng; toast chỉ báo thoáng qua.)
 *
 * Cần gắn <CyberToastHost /> 1 lần ở gốc app – đã gắn trong App.jsx. Gọi ở bất kỳ đâu:
 *
 *   import { toast } from '@/components/cyber';
 *   toast.success('Lưu thành công');
 *   toast.info('Chức năng chưa được kích hoạt', { title: 'Google' });
 *   toast.warning('Sắp hết phiên làm việc', { duration: 6000 });
 *   toast.error('Không kết nối được máy chủ');
 *   const id = toast.info('Đang xử lý...', { duration: 0 }); ... toast.dismiss(id);
 *
 * Tuỳ chọn: title, duration (ms, mặc định 3500; 0 = không tự ẩn), action: { text, onClick }.
 * Rê chuột vào toast sẽ tạm dừng đếm giờ. Tối đa MAX toast cùng lúc (cũ nhất bị đẩy ra).
 */

const MAX = 4;
const DEFAULT_MS = 3500;
const LEAVE_MS = 220;

const ICONS = {
  success: <path d="M7.5 12.5l3 3 6-6.5" />,
  info: <><path d="M12 7.6v.01" /><path d="M12 11v5.5" /></>,
  warning: <><path d="M12 7v6" /><path d="M12 16.6v.01" /></>,
  error: <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />,
};

// ---------------- Kho toast dùng chung ----------------
let seq = 0;
let list = [];
const subs = new Set();
const emit = () => subs.forEach((f) => f(list));

function show(opts) {
  const id = ++seq;
  list = [...list, { duration: DEFAULT_MS, type: 'info', ...opts, id }].slice(-MAX);
  emit();
  return id;
}

function dismiss(id) {
  list = id == null ? [] : list.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  show,
  dismiss,
  success: (message, opts) => show({ ...opts, type: 'success', message }),
  info: (message, opts) => show({ ...opts, type: 'info', message }),
  warning: (message, opts) => show({ ...opts, type: 'warning', message }),
  error: (message, opts) => show({ ...opts, type: 'error', message }),
};

/** Gắn 1 lần ở gốc app để toast.* hiển thị được */
export function CyberToastHost() {
  const [items, setItems] = useState(list);
  useEffect(() => {
    subs.add(setItems);
    return () => subs.delete(setItems);
  }, []);
  if (!items.length) return null;
  return createPortal(
    <div className="cy-toasts" role="region" aria-label="Thông báo">
      {items.map((t) => <ToastItem key={t.id} {...t} />)}
    </div>,
    document.body
  );
}

function ToastItem({ id, type, title, message, duration, action }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);
  const left = useRef(duration);
  const started = useRef(0);

  const close = () => {
    clearTimeout(timer.current);
    setLeaving(true);
    setTimeout(() => dismiss(id), LEAVE_MS);
  };
  const start = () => {
    if (!duration) return;
    started.current = Date.now();
    timer.current = setTimeout(close, left.current);
  };
  const pause = () => {
    if (!duration) return;
    clearTimeout(timer.current);
    left.current = Math.max(400, left.current - (Date.now() - started.current));
  };

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`cy-toast cy-toast--${type} ${leaving ? 'is-leave' : ''}`}
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      onMouseEnter={pause} onMouseLeave={start}
      style={duration ? { '--cy-toast-ms': `${duration}ms` } : undefined}
    >
      <span className="cy-toast__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[type] || ICONS.info}
        </svg>
      </span>
      <div className="cy-toast__body">
        {title && <b className="cy-toast__title">{title}</b>}
        <span className="cy-toast__msg">{message}</span>
      </div>
      {action && (
        <button type="button" className="cy-toast__action" onClick={() => { action.onClick?.(); close(); }}>
          {action.text}
        </button>
      )}
      <button type="button" className="cy-toast__close" aria-label="Đóng" onClick={close}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 7l10 10M17 7L7 17" /></svg>
      </button>
      {!!duration && <span className="cy-toast__bar" aria-hidden="true" />}
    </div>
  );
}
