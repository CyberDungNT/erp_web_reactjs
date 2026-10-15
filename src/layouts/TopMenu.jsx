import { useEffect, useRef, useState } from 'react';
import { MenuIcon } from '../components/icons/Icon';
import Icon from '../components/icons/Icon';

/**
 * Menu trên cùng (bảng MENU_TABLE.top của CP_SysLogin).
 * Bấm mục gốc mở bảng thả xuống: mỗi nhóm cấp 2 là 1 cột; chức năng gắn thẳng vào mục gốc gom vào cột đầu.
 * Nhóm sâu hơn (cấp 3, 4...) hiển thị thành tiêu đề nhỏ + danh sách thụt vào trong cột.
 */
export default function TopMenu({ tree, onOpen }) {
  const [openId, setOpenId] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!openId) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpenId(null); };
    const esc = (e) => e.key === 'Escape' && setOpenId(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [openId]);

  const open = tree.find((n) => n.id === openId);

  const choose = (node) => {
    setOpenId(null);
    onOpen(node);
  };

  const columns = (root) => {
    const direct = root.children.filter((c) => !c.children.length);
    const groups = root.children.filter((c) => c.children.length);
    const cols = [];
    if (direct.length) cols.push({ id: root.id + '-direct', text: root.text, children: direct });
    return [...cols, ...groups];
  };

  const renderItems = (items, depth) =>
    items.map((c) => {
      if (c.separator) return <div className="topmenu__sep" key={c.id} />;
      if (c.children.length) {
        return (
          <div className="topmenu__group" key={c.id} style={{ paddingLeft: depth * 10 }}>
            <div className="topmenu__group-title">{c.text}</div>
            {renderItems(c.children, depth + 1)}
          </div>
        );
      }
      return (
        <button type="button" role="menuitem" key={c.id} className="topmenu__link"
          style={depth ? { paddingLeft: 8 + depth * 10 } : undefined}
          onClick={() => choose(c)} title={c.id}>
          {c.text}
        </button>
      );
    });

  return (
    <nav className="topmenu" ref={ref} aria-label="Phân hệ">
      <div className="topmenu__bar">
        {tree.map((n) => (
          <button key={n.id} type="button"
            className={`topmenu__item ${openId === n.id ? 'is-open' : ''}`}
            aria-expanded={openId === n.id}
            onClick={() => (n.children.length ? setOpenId(openId === n.id ? null : n.id) : choose(n))}
            onMouseEnter={() => openId && n.children.length && setOpenId(n.id)}>
            <MenuIcon icon={n.icon} fallbackText={n.text} size={16} />
            <span>{n.text}</span>
            {n.children.length > 0 && <Icon name="chevronDown" size={12} />}
          </button>
        ))}
      </div>

      {open && (
        <div className="topmenu__panel" role="menu">
          <div className="topmenu__panel-head">
            <MenuIcon icon={open.icon} fallbackText={open.text} size={18} />
            {open.text}
          </div>
          <div className="topmenu__cols">
            {columns(open).map((col) => (
              <div className="topmenu__col" key={col.id}>
                <div className="topmenu__col-title">{col.text}</div>
                {renderItems(col.children, 0)}
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
