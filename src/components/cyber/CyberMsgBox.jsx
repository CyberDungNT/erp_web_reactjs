import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hộp thông báo (MessageBox). 4 dạng chính: success | warning | failed | yesno (+ info).
 *
 * Gọi nhanh ở bất kỳ đâu (cần gắn <CyberMsgBoxHost /> 1 lần ở gốc app – đã gắn trong App.jsx):
 *
 *   import { msgbox } from '../components/cyber';
 *   msgbox.success('Lưu thành công');
 *   msgbox.warning('Chưa nhập mã hàng', { title: 'Thiếu dữ liệu' });
 *   msgbox.failed('Không kết nối được máy chủ', { detail: err.message });
 *   if (await msgbox.yesNo('Xoá chứng từ này?', { danger: true })) { ... }
 *
 * Mỗi hàm trả về Promise: yesno -> true (Có) / false (Không, Esc); các dạng khác -> true khi đóng.
 *
 * Tuỳ chọn: title, detail (dòng phụ nhỏ), okText, yesText, noText, danger (nút Có màu đỏ), lang ('V' | 'E').
 *
 * Dùng dạng component (tự quản lý trạng thái):
 *   <CyberMsgBox open={open} type="warning" message="..." onClose={(ok) => setOpen(false)} />
 */

const TEXT = {
  V: {
    ok: 'Đồng ý', yes: 'Có', no: 'Không',
    title: { success: 'Thành công', warning: 'Cảnh báo', failed: 'Thất bại', yesno: 'Xác nhận', info: 'Thông tin' },
  },
  E: {
    ok: 'OK', yes: 'Yes', no: 'No',
    title: { success: 'Success', warning: 'Warning', failed: 'Failed', yesno: 'Confirm', info: 'Information' },
  },
};

const ICONS = {
  success: <path className="cy-mb__draw" d="M7.5 12.5l3 3 6-6.5" />,
  warning: <><path className="cy-mb__draw" d="M12 7v6" /><path d="M12 16.6v.01" /></>,
  failed: <path className="cy-mb__draw" d="M8.5 8.5l7 7M15.5 8.5l-7 7" />,
  yesno: <><path className="cy-mb__draw" d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 3.9" /><path d="M12 17v.01" /></>,
  info: <><path d="M12 7.6v.01" /><path className="cy-mb__draw" d="M12 11v5.5" /></>,
};

// ---------------- Kho thông báo dùng chung (cho msgbox.*) ----------------
let seq = 0;
let queue = [];
const subs = new Set();
const emit = () => subs.forEach((f) => f(queue));

function show(opts) {
  return new Promise((resolve) => {
    queue = [...queue, { ...opts, id: ++seq, resolve }];
    emit();
  });
}

export const msgbox = {
  show,
  success: (message, opts) => show({ ...opts, type: 'success', message }),
  warning: (message, opts) => show({ ...opts, type: 'warning', message }),
  failed: (message, opts) => show({ ...opts, type: 'failed', message }),
  yesNo: (message, opts) => show({ ...opts, type: 'yesno', message }),
  info: (message, opts) => show({ ...opts, type: 'info', message }),
};

/** Gắn 1 lần ở gốc app để msgbox.* hiển thị được */
export function CyberMsgBoxHost() {
  const [items, setItems] = useState(queue);
  useEffect(() => {
    subs.add(setItems);
    return () => subs.delete(setItems);
  }, []);
  const done = (item, result) => {
    queue = queue.filter((x) => x.id !== item.id);
    emit();
    item.resolve(result);
  };
  return items.map((it) => <CyberMsgBox key={it.id} open {...it} onClose={(r) => done(it, r)} />);
}

// ---------------- Component ----------------
export default function CyberMsgBox({
  open, type = 'info', title, message, detail, okText, yesText, noText, danger = false, lang = 'V', onClose,
}) {
  const [closing, setClosing] = useState(false);
  const boxRef = useRef(null);
  const primaryRef = useRef(null);
  const closed = useRef(false);
  const t = TEXT[lang === 'E' ? 'E' : 'V'];
  const isYesNo = type === 'yesno';

  const finish = (result) => {
    if (closed.current) return;
    closed.current = true;
    setClosing(true);
    setTimeout(() => onClose?.(result), 160);
  };

  useEffect(() => {
    if (!open) { closed.current = false; setClosing(false); return; }
    primaryRef.current?.focus();
    const onKey = (e) => {
      // Chỉ hộp trên cùng xử lý phím
      const all = document.querySelectorAll('.cy-mb');
      if (all[all.length - 1] !== boxRef.current) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(isYesNo ? false : true); }
      if (e.key === 'Tab') { // giữ focus trong hộp
        const btns = [...boxRef.current.querySelectorAll('button')];
        const i = btns.indexOf(document.activeElement);
        e.preventDefault();
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length]?.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isYesNo]);

  if (!open) return null;

  return createPortal(
    <div className={`cy-mb-overlay ${closing ? 'is-closing' : ''}`}>
      <div ref={boxRef} className={`cy-mb cy-mb--${type}`} role={isYesNo ? 'alertdialog' : 'dialog'} aria-modal="true"
        aria-labelledby="cy-mb-title">
        <div className="cy-mb__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30">{ICONS[type] || ICONS.info}</svg>
        </div>
        <h3 className="cy-mb__title" id="cy-mb-title">{title || t.title[type] || t.title.info}</h3>
        {message && <div className="cy-mb__msg">{message}</div>}
        {detail && <div className="cy-mb__detail">{detail}</div>}
        <div className="cy-mb__actions">
          {isYesNo ? (
            <>
              <button type="button" className="cy-mb__btn" onClick={() => finish(false)}>{noText || t.no}</button>
              <button ref={primaryRef} type="button" className={`cy-mb__btn cy-mb__btn--primary ${danger ? 'is-danger' : ''}`}
                onClick={() => finish(true)}>{yesText || t.yes}</button>
            </>
          ) : (
            <button ref={primaryRef} type="button" className="cy-mb__btn cy-mb__btn--primary" onClick={() => finish(true)}>
              {okText || t.ok}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
