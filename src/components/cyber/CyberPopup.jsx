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
 */
export default function CyberPopup({
  open, onClose, title, width = 560, height, footer, children,
  closeOnBackdrop = false, closeOnEsc = true, draggable = true, maximizable = true, className = '',
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [maximized, setMaximized] = useState(false);
  const drag = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) { setOffset({ x: 0, y: 0 }); setMaximized(false); return; }
    const onKey = (e) => {
      // Chỉ popup trên cùng mới xử lý Esc
      const all = document.querySelectorAll('.cy-popup');
      if (e.key === 'Escape' && closeOnEsc && all[all.length - 1] === boxRef.current) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

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

  const style = maximized
    ? { width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh', borderRadius: 0 }
    : { width, height, transform: `translate(${offset.x}px, ${offset.y}px)` };

  return createPortal(
    <div className="cy-overlay" onMouseDown={(e) => closeOnBackdrop && e.target === e.currentTarget && onClose?.()}>
      <div className={`cy-popup ${className}`} style={style} ref={boxRef} role="dialog" aria-modal="true">
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
      </div>
    </div>,
    document.body
  );
}
