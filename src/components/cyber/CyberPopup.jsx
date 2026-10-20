import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Popup (modal) – vẽ giao diện tuỳ ý bên trong qua children.
 *
 *   <CyberPopup open={open} onClose={() => setOpen(false)} title="Sửa hàng hoá" width={600}
 *     footer={<>
 *       <button className="cy-btn" onClick={() => setOpen(false)}>Đóng</button>
 *       <button className="cy-btn cy-btn--primary" onClick={save}>Lưu</button>
 *     </>}>
 *     <CyberTextBox {...form.bind('TenHang')} label="Tên hàng" />
 *   </CyberPopup>
 *
 * Props:
 *   open, onClose, title, width (mặc định 560), height, footer
 *   closeOnBackdrop  bấm ra ngoài để đóng (mặc định false - tránh mất dữ liệu đang nhập)
 *   closeOnEsc       phím Esc để đóng (mặc định true)
 *   draggable        kéo tiêu đề để di chuyển (mặc định true)
 *   maximizable      nút phóng to (mặc định true)
 *   resizable        kéo cạnh / góc để đổi kích thước (mặc định true) – minWidth (320), minHeight (180)
 */
// thời gian hiệu ứng đóng (khớp .cy-popup.is-closing trong cyber.css)
const CLOSE_MS = 170;

export default function CyberPopup({
  open, onClose, title, width = 560, height, footer, children,
  closeOnBackdrop = false, closeOnEsc = true, draggable = true, maximizable = true, resizable = true,
  minWidth = 320, minHeight = 180, className = '',
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [maximized, setMaximized] = useState(false);
  const [size, setSize] = useState(null); // { w, h } sau khi người dùng kéo giãn
  const drag = useRef(null);
  const boxRef = useRef(null);

  // Đóng có hiệu ứng: open = false -> giữ thêm CLOSE_MS để chạy hiệu ứng thu lại rồi mới gỡ khỏi màn hình
  // (vị trí / kích thước kéo giãn reset SAU hiệu ứng – reset ngay thì popup nhảy về giữa trong lúc đang thu lại)
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setShown(true); setClosing(false); return undefined; }
    if (!shown) return undefined;
    setClosing(true);
    const t = setTimeout(() => {
      setShown(false); setClosing(false);
      setOffset({ x: 0, y: 0 }); setMaximized(false); setSize(null);
    }, CLOSE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      // Chỉ popup trên cùng mới xử lý Esc
      const all = document.querySelectorAll('.cy-popup');
      if (e.key === 'Escape' && closeOnEsc && all[all.length - 1] === boxRef.current) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeOnEsc, onClose]);

  if (!open && !shown) return null;

  const startDrag = (e) => {
    if (!draggable || maximized || e.button !== 0 || e.target.closest('button')) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    const move = (ev) => {
      const d = drag.current;
      if (d) setOffset({ x: d.ox + ev.clientX - d.sx, y: d.oy + ev.clientY - d.sy });
    };
    const up = () => {
      drag.current = null;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  /**
   * Kéo giãn theo hướng dir (n s e w ne nw se sw). Popup nằm giữa màn hình (flex center) nên đổi rộng d px
   * thì 2 bên cùng nở d/2 -> dịch offset thêm d/2 để cạnh đang kéo bám đúng con trỏ, cạnh đối diện đứng yên.
   */
  const startResize = (e, dir) => {
    if (e.button !== 0 || maximized) return;
    e.preventDefault();
    e.stopPropagation();
    const r = boxRef.current.getBoundingClientRect();
    const s0 = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, ox: offset.x, oy: offset.y };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const maxW = window.innerWidth - 16;
    const maxH = window.innerHeight - 16;
    const sx = dir.includes('w') ? -1 : dir.includes('e') ? 1 : 0;
    const sy = dir.includes('n') ? -1 : dir.includes('s') ? 1 : 0;
    const move = (ev) => {
      const w = sx ? clamp(s0.w + sx * (ev.clientX - s0.x), minWidth, maxW) : s0.w;
      const h = sy ? clamp(s0.h + sy * (ev.clientY - s0.y), minHeight, maxH) : s0.h;
      setSize({ w, h });
      setOffset({ x: s0.ox + (sx * (w - s0.w)) / 2, y: s0.oy + (sy * (h - s0.h)) / 2 });
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.classList.remove('cy-resizing');
      document.body.style.cursor = '';
    };
    document.body.style.cursor = getComputedStyle(e.currentTarget).cursor; // giữ con trỏ kể cả khi chuột ra khỏi mép
    document.body.classList.add('cy-resizing');
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const style = maximized
    ? { width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh', borderRadius: 0 }
    : { width: size?.w ?? width, height: size?.h ?? height, transform: `translate(${offset.x}px, ${offset.y}px)` };

  return createPortal(
    <div className={`cy-overlay ${closing ? 'is-closing' : ''}`} onMouseDown={(e) => !closing && closeOnBackdrop && e.target === e.currentTarget && onClose?.()}>
      <div className={`cy-popup ${closing ? 'is-closing' : ''} ${className}`} style={style} ref={boxRef} role="dialog" aria-modal="true">
        <div className={`cy-popup__header ${draggable && !maximized ? 'is-draggable' : ''}`}
          onMouseDown={startDrag} onDoubleClick={() => maximizable && setMaximized((m) => !m)}>
          <span className="cy-popup__title">{title}</span>
          {maximizable && (
            <button type="button" className="cy-popup__btn" title="Phóng to / Thu nhỏ"
              onClick={() => setMaximized((m) => !m)}>{maximized ? '❐' : '□'}</button>
          )}
          <button type="button" className="cy-popup__btn" title="Đóng (Esc)" onClick={onClose}>✕</button>
        </div>
        <div className="cy-popup__body">{children}</div>
        {footer && <div className="cy-popup__footer">{footer}</div>}
        {resizable && !maximized && ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((d) => (
          <span key={d} className={`cy-popup__rz cy-popup__rz--${d}`} onMouseDown={(e) => startResize(e, d)} aria-hidden="true" />
        ))}
      </div>
    </div>,
    document.body
  );
}
