import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Menu chuột phải hiển thị tại toạ độ (x, y).
 * items: [{ text, icon, shortcut, onClick, disabled, hidden, danger, children }, '-' (đường kẻ), ...]
 *   icon      chữ / emoji hoặc JSX (vd <Icon name="edit" />)
 *   children  mảng items con -> mục có mũi tên ▸, rê chuột (hoặc bấm) mở menu con bên phải (sát mép màn hình thì bên trái)
 * placement  'bottom' (mặc định: menu mở xuống từ y) | 'top' (mở lên, đáy menu tại y – vd nút ở thanh dưới cùng)
 * Menu cao hơn màn hình -> tự giới hạn chiều cao và cuộn.
 */
export default function CyberContextMenu({ x, y, items, onClose, placement = 'bottom' }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxH = window.innerHeight - 8;
    const h = Math.min(r.height, maxH);
    const top = placement === 'top' ? y - h : y;
    setPos({
      left: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)),
      top: Math.max(4, Math.min(top, window.innerHeight - h - 4)),
      ...(r.height > maxH ? { maxHeight: maxH, overflowY: 'auto' } : null),
    });
  }, [x, y, placement]);

  useEffect(() => {
    // bấm ngoài menu (kể cả menu con – nằm trong ref vì là con DOM) -> đóng
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

  return createPortal(
    <MenuList ref={ref} items={items} onClose={onClose} style={pos} />,
    document.body
  );
}

/** 1 cấp menu (dùng cho cả menu gốc và menu con) */
const MenuList = forwardRef(function MenuList({ items, onClose, style, className = '' }, ref) {
  const [openIdx, setOpenIdx] = useState(-1);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const visible = (items || []).filter((it) => it && !it.hidden);
  const hover = (i) => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpenIdx(i), 120); };

  return (
    <ul className={`cy-menu ${className}`} ref={ref} style={style} onContextMenu={(e) => e.preventDefault()} role="menu">
      {visible.map((it, i) => {
        if (it === '-' || it.divider) return <li key={i} className="cy-menu__divider" role="separator" />;
        const sub = it.children?.filter((c) => c && !c.hidden);
        const hasSub = !!sub?.length;
        return (
          <li key={i} role="menuitem" aria-disabled={it.disabled || undefined} aria-haspopup={hasSub || undefined}
            className={`cy-menu__item ${it.disabled ? 'is-disabled' : ''} ${it.danger ? 'is-danger' : ''} ${hasSub ? 'has-sub' : ''} ${openIdx === i ? 'is-open' : ''}`}
            onMouseEnter={() => hover(hasSub && !it.disabled ? i : -1)}
            onClick={() => {
              if (it.disabled) return;
              if (hasSub) { clearTimeout(timer.current); setOpenIdx(i); return; }
              onClose(); it.onClick?.();
            }}>
            <span className="cy-menu__icon">{it.icon}</span>
            <span className="cy-menu__text">{it.text}</span>
            {it.shortcut && <span className="cy-menu__shortcut">{it.shortcut}</span>}
            {hasSub && <span className="cy-menu__arrow" aria-hidden="true">▸</span>}
            {hasSub && openIdx === i && <SubMenu items={sub} onClose={onClose} />}
          </li>
        );
      })}
    </ul>
  );
});

/** Menu con: mở bên phải mục cha; không đủ chỗ thì bên trái; tràn đáy màn hình thì đẩy lên */
function SubMenu({ items, onClose }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ left: '100%', top: -5, visibility: 'hidden' });
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const pr = parent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const right = pr.right + r.width + 4 <= window.innerWidth;
    const top = Math.min(-5, window.innerHeight - 4 - pr.top - r.height);
    setStyle(right ? { left: '100%', top } : { right: '100%', top });
  }, []);
  return <MenuList ref={ref} items={items} onClose={onClose} style={style} className="cy-menu--sub" />;
}
