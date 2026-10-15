import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Menu chuột phải hiển thị tại toạ độ (x, y).
 * items: [{ text, icon, shortcut, onClick, disabled, hidden, danger }, '-' (đường kẻ), ...]
 */
export default function CyberContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.min(x, window.innerWidth - r.width - 4),
      top: Math.min(y, window.innerHeight - r.height - 4),
    });
  }, [x, y]);

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const visible = (items || []).filter((it) => it && !it.hidden);

  return createPortal(
    <ul className="cy-menu" ref={ref} style={pos} onContextMenu={(e) => e.preventDefault()}>
      {visible.map((it, i) =>
        it === '-' || it.divider ? (
          <li key={i} className="cy-menu__divider" />
        ) : (
          <li key={i}
            className={`cy-menu__item ${it.disabled ? 'is-disabled' : ''} ${it.danger ? 'is-danger' : ''}`}
            onClick={() => { if (it.disabled) return; onClose(); it.onClick?.(); }}>
            <span className="cy-menu__icon">{it.icon}</span>
            <span className="cy-menu__text">{it.text}</span>
            {it.shortcut && <span className="cy-menu__shortcut">{it.shortcut}</span>}
          </li>
        )
      )}
    </ul>,
    document.body
  );
}
