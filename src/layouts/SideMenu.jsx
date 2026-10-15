import { useMemo, useRef, useState } from 'react';
import Icon, { MenuIcon } from '../components/icons/Icon';
import { filterTree } from '../utils/menuTree';

/**
 * Menu bên trái (bảng MENU_TABLE.left của CP_SysLogin) dạng cây nhiều cấp.
 * collapsed = true -> chỉ hiện icon nhóm gốc; bấm vào sẽ mở rộng lại.
 */
export default function SideMenu({ tree, activeId, collapsed, onExpand, onOpen }) {
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const searching = keyword.trim().length > 0;
  const shown = useMemo(() => filterTree(tree, keyword), [tree, keyword]);
  const seen = useRef(new Set()); // nhóm đã từng mở -> giữ DOM để chạy hiệu ứng thu gọn

  const toggle = (id) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  if (collapsed) {
    return (
      <div className="sidemenu sidemenu--collapsed">
        {tree.map((n, i) => (
          <button key={n.id} type="button" className="sidemenu__rail-btn" title={n.text} style={{ '--i': Math.min(i, 16) }}
            onClick={() => { setExpanded((s) => new Set(s).add(n.id)); onExpand(); }}>
            <MenuIcon icon={n.icon} fallbackText={n.text} size={18} />
          </button>
        ))}
      </div>
    );
  }

  const renderNode = (n, depth, i = 0) => {
    if (n.separator) return <li key={n.id} className="sidemenu__sep" />;
    const isGroup = n.children.length > 0;
    const isOpen = searching || expanded.has(n.id);
    if (isOpen) seen.current.add(n.id);
    return (
      <li key={n.id} style={{ '--i': Math.min(i, 16) }}>
        <button type="button"
          className={`sidemenu__item ${depth === 0 ? 'is-root' : ''} ${!isGroup && activeId === n.id ? 'is-active' : ''}`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => (isGroup ? toggle(n.id) : onOpen(n))}
          aria-expanded={isGroup ? isOpen : undefined}
          title={n.text}>
          {depth === 0 ? (
            <MenuIcon icon={n.icon} fallbackText={n.text} size={18} />
          ) : isGroup ? (
            <Icon name="folder" size={14} />
          ) : (
            <span className="sidemenu__dot" />
          )}
          <span className="sidemenu__text">{highlight(n.text, keyword)}</span>
          {isGroup && (depth === 0
            ? <Icon name="chevronDown" size={16} className={`sidemenu__chev sidemenu__chev--root ${isOpen ? 'is-open' : ''}`} />
            : <Icon name="chevronRight" size={13} className={`sidemenu__chev ${isOpen ? 'is-open' : ''}`} />)}
        </button>
        {isGroup && (isOpen || seen.current.has(n.id)) && (
          <div className={`sidemenu__sub ${isOpen ? 'is-open' : ''}`} inert={isOpen ? undefined : ''}>
            <ul>{n.children.map((c, ci) => renderNode(c, depth + 1, ci))}</ul>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="sidemenu">
      <div className="sidemenu__search">
        <Icon name="search" size={14} />
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm chức năng..." />
        {keyword && (
          <button type="button" onClick={() => setKeyword('')} title="Xoá"><Icon name="close" size={12} /></button>
        )}
      </div>
      <ul className="sidemenu__tree">
        {shown.map((n, i) => renderNode(n, 0, i))}
        {searching && shown.length === 0 && <li className="sidemenu__empty">Không tìm thấy chức năng</li>}
      </ul>
    </div>
  );
}

/** Tô đậm phần khớp từ khoá (so khớp có dấu, đơn giản) */
function highlight(text, keyword) {
  const k = keyword.trim();
  if (!k) return text;
  const i = text.toLowerCase().indexOf(k.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + k.length)}</mark>{text.slice(i + k.length)}</>;
}
