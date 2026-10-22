import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon, { MenuIcon } from '@/components/icons/Icon';
import CyberContextMenu from '@/components/cyber/CyberContextMenu';

/**
 * Thanh cửa sổ dưới cùng: "Trang chủ" + các cửa sổ chức năng đang mở | ngày khoá sổ.
 *
 *  - Bấm: chuyển cửa sổ. Chuột giữa / nút ✕: đóng. Chuột phải: menu (Đóng, Đóng các cửa sổ khác...).
 *  - Kéo ngang 1 tab để đổi vị trí; các tab khác tự trượt nhường chỗ (FLIP animation).
 *    Ctrl + Shift + ← / → trên tab đang chọn: đổi vị trí bằng bàn phím.
 *  - Nhiều tab tràn khỏi thanh: lăn chuột để cuộn ngang, nút ‹ › hai đầu, vuốt ngang (cảm ứng),
 *    bấm ô số lượng cửa sổ -> danh sách mọi cửa sổ đang mở để chọn nhanh.
 *
 * Props: windows [{ key, node }], activeKey, homeKey, titleOf(w), onActivate(key), onClose(keys),
 *        onReorder(newWindows), onContextMenu(e, w), lang, lockDate
 */
const DRAG_THRESHOLD = 5;

export default function TaskBar({
  windows, activeKey, homeKey, titleOf, onActivate, onClose, onReorder, onContextMenu, lang, lockDate,
}) {
  const listRef = useRef(null);
  const items = useRef(new Map());   // key -> element
  const lastPos = useRef(new Map()); // key -> offsetLeft lần render trước (cho FLIP)
  const drag = useRef(null);         // { key, startX, grab, x, moved }
  const justDragged = useRef(false);
  const [dragKey, setDragKey] = useState(null);
  const windowsRef = useRef(windows); // handler kéo đọc danh sách mới nhất qua ref (tránh closure cũ)
  windowsRef.current = windows;
  const [over, setOver] = useState({ left: false, right: false }); // còn tab bị che bên trái / phải
  const [listMenu, setListMenu] = useState(null);                  // { x, y } danh sách cửa sổ
  const E = lang === 'E';

  // Còn tab bị khuất ở 2 đầu? (cuộn, đổi cỡ thanh, thêm / đóng tab)
  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setOver((o) => (o.left === left && o.right === right ? o : { left, right }));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // lăn chuột dọc -> cuộn ngang danh sách tab (chỉ khi đang tràn)
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d) return;
      e.preventDefault();
      el.scrollLeft += e.deltaMode === 1 ? d * 30 : d;
    };
    el.addEventListener('scroll', measure, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('scroll', measure); el.removeEventListener('wheel', onWheel); };
  }, [measure]);

  useEffect(measure, [windows, measure]);

  const scrollByPage = (dir) => {
    const el = listRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const openListMenu = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setListMenu({ x: r.left, y: r.top - 6 });
  };
  const listMenuItems = () => [
    { text: E ? 'Home' : 'Trang chủ', icon: <Icon name="home" size={14} />, shortcut: activeKey === homeKey ? '✓' : undefined, onClick: () => onActivate(homeKey) },
    '-',
    ...windows.map((w) => ({
      text: titleOf(w),
      icon: <MenuIcon icon={w.node?.icon} fallbackText={titleOf(w)} size={14} />,
      shortcut: activeKey === w.key ? '✓' : undefined,
      onClick: () => onActivate(w.key),
    })),
    '-',
    { text: E ? 'Close all windows' : 'Đóng tất cả cửa sổ', danger: true, onClick: () => onClose(windows.map((w) => w.key)) },
  ];

  const setItemRef = (key) => (el) => { if (el) items.current.set(key, el); else items.current.delete(key); };

  // Sau mỗi lần đổi danh sách: tab khác trượt từ vị trí cũ sang vị trí mới; tab đang kéo giữ dưới con trỏ
  useLayoutEffect(() => {
    const next = new Map();
    items.current.forEach((el, key) => next.set(key, el.offsetLeft));
    next.forEach((left, key) => {
      const el = items.current.get(key);
      if (drag.current?.moved && drag.current.key === key) {
        el.style.transition = 'none';
        el.style.transform = `translateX(${drag.current.x - left}px)`;
        return;
      }
      const prev = lastPos.current.get(key);
      if (prev == null || prev === left) return;
      el.style.transition = 'none';
      el.style.transform = `translateX(${prev - left}px)`;
      void el.offsetWidth; // áp vị trí cũ trước rồi mới cho trượt về
      el.style.transition = 'transform .28s cubic-bezier(.22, .61, .36, 1)';
      el.style.transform = '';
    });
    lastPos.current = next;
    if (drag.current) drag.current.pending = false;
  }, [windows]);

  // Tab đang chọn luôn nằm trong vùng nhìn thấy – chừa khoảng mép mờ (FADE) để tab không bị mờ một phần
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector('.is-active');
    if (!el) return;
    const FADE = 32;
    const left = el.offsetLeft - list.offsetLeft;
    const right = left + el.offsetWidth;
    if (left - FADE < list.scrollLeft) list.scrollTo({ left: Math.max(0, left - FADE), behavior: 'smooth' });
    else if (right + FADE > list.scrollLeft + list.clientWidth) list.scrollTo({ left: right + FADE - list.clientWidth, behavior: 'smooth' });
  }, [activeKey, windows.length]);

  const onPointerDown = (e, key) => {
    // cảm ứng: vuốt ngang = cuộn danh sách (không kéo đổi chỗ)
    if (e.button !== 0 || e.pointerType === 'touch' || e.target.closest('.mn__task-close')) return;
    const el = items.current.get(key);
    drag.current = { key, startX: e.clientX, grab: e.clientX - el.getBoundingClientRect().left, x: el.offsetLeft, moved: false };

    const move = (ev) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved) {
        if (Math.abs(ev.clientX - d.startX) < DRAG_THRESHOLD) return;
        d.moved = true;
        setDragKey(key);
      }
      const list = listRef.current;
      const cur = items.current.get(key);
      const wins = windowsRef.current; // danh sách mới nhất (đã đổi chỗ trong lúc kéo)
      const keys = wins.map((w) => w.key);
      const first = items.current.get(keys[0]);
      const last = items.current.get(keys[keys.length - 1]);
      // vị trí mong muốn (toạ độ trong list), giới hạn trong vùng các tab cửa sổ
      let x = ev.clientX - list.getBoundingClientRect().left + list.scrollLeft - d.grab;
      const min = first ? (first === cur ? cur.offsetLeft : first.offsetLeft) : 0;
      const max = last ? last.offsetLeft + last.offsetWidth - cur.offsetWidth : x;
      x = Math.max(min, Math.min(max, x));
      d.x = x;
      cur.style.transition = 'none';
      cur.style.transform = `translateX(${x - cur.offsetLeft}px)`;

      // tâm tab đang kéo vượt qua tâm tab bên cạnh -> đổi chỗ (chờ lần đổi trước vẽ xong mới tính tiếp)
      if (d.pending) return;
      const center = x + cur.offsetWidth / 2;
      const others = keys.filter((k) => k !== key);
      let idx = 0;
      others.forEach((k) => {
        const o = items.current.get(k);
        if (o && o.offsetLeft + o.offsetWidth / 2 < center) idx += 1;
      });
      if (keys.indexOf(key) !== idx) {
        const moving = wins.find((w) => w.key === key);
        const rest = wins.filter((w) => w.key !== key);
        windowsRef.current = [...rest.slice(0, idx), moving, ...rest.slice(idx)];
        d.pending = true;
        onReorder(windowsRef.current);
      }
      // gần mép thì cuộn danh sách
      const r = list.getBoundingClientRect();
      if (ev.clientX < r.left + 30) list.scrollLeft -= 8;
      else if (ev.clientX > r.right - 30) list.scrollLeft += 8;
    };

    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      const d = drag.current;
      drag.current = null;
      if (!d?.moved) return;
      justDragged.current = true; // bỏ qua click sinh ra sau khi thả
      setTimeout(() => { justDragged.current = false; }, 0);
      const el = items.current.get(d.key);
      if (el) {
        el.style.transition = 'transform .25s cubic-bezier(.34, 1.56, .64, 1)';
        el.style.transform = '';
      }
      setDragKey(null);
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  };

  const onItemKey = (e, w) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(w.key); return; }
    if (e.key === 'Delete') { e.preventDefault(); onClose([w.key]); return; }
    if (e.ctrlKey && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const i = windows.findIndex((x) => x.key === w.key);
      const j = i + (e.key === 'ArrowLeft' ? -1 : 1);
      if (j < 0 || j >= windows.length) return;
      const next = [...windows];
      [next[i], next[j]] = [next[j], next[i]];
      onReorder(next);
    }
  };

  return (
    <footer className="mn__task">
      <button type="button" className={`mn__task-home ${activeKey === homeKey ? 'is-active' : ''}`} onClick={() => onActivate(homeKey)} onContextMenu={(e) => onContextMenu(e, { key: homeKey })}>
        <Icon name="home" size={15} />
        <span>{E ? 'Home' : 'Trang chủ'}</span>
      </button>
      {windows.length > 0 && (
        <button type="button" className={`mn__task-count ${listMenu ? 'is-open' : ''}`} onClick={openListMenu}
          title={E ? 'Open windows – click to list all' : 'Cửa sổ đang mở – bấm để xem danh sách'}
          aria-label={E ? `${windows.length} open windows` : `${windows.length} cửa sổ đang mở`}>
          {windows.length}
        </button>
      )}
      <span className="mn__task-sep" />

      {(over.left || over.right) && (
        <button type="button" className="mn__task-nav" disabled={!over.left} onClick={() => scrollByPage(-1)}
          title={E ? 'Scroll left' : 'Cuộn sang trái'} aria-label={E ? 'Scroll left' : 'Cuộn sang trái'}>
          <Icon name="chevronLeft" size={15} strokeWidth={2.2} />
        </button>
      )}
      <div className={`mn__task-list ${dragKey ? 'is-dragging' : ''} ${over.left ? 'has-left' : ''} ${over.right ? 'has-right' : ''}`} ref={listRef} role="tablist"
        aria-label={E ? 'Open windows' : 'Cửa sổ đang mở'}>
        {windows.map((w) => {
          const title = titleOf(w);
          return (
            <div key={w.key} ref={setItemRef(w.key)} role="tab" tabIndex={0} aria-selected={activeKey === w.key}
              className={`mn__task-item ${activeKey === w.key ? 'is-active' : ''} ${dragKey === w.key ? 'is-dragging' : ''}`}
              title={`${title} (${w.key})`}
              onPointerDown={(e) => onPointerDown(e, w.key)}
              onClick={() => { if (!justDragged.current) onActivate(w.key); }}
              onContextMenu={(e) => onContextMenu(e, w)}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); onClose([w.key]); } }}
              onKeyDown={(e) => onItemKey(e, w)}>
              <span className="mn__task-icon"><MenuIcon icon={w.node?.icon} fallbackText={title} size={14} /></span>
              <span className="mn__task-text">{title}</span>
              <button type="button" className="mn__task-close" title={E ? 'Close' : 'Đóng'} tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onClose([w.key]); }}>
                <Icon name="close" size={11} strokeWidth={2.4} />
              </button>
            </div>
          );
        })}
      </div>

      {(over.left || over.right) && (
        <button type="button" className="mn__task-nav" disabled={!over.right} onClick={() => scrollByPage(1)}
          title={E ? 'Scroll right' : 'Cuộn sang phải'} aria-label={E ? 'Scroll right' : 'Cuộn sang phải'}>
          <Icon name="chevronRight" size={15} strokeWidth={2.2} />
        </button>
      )}
      {listMenu && (
        <CyberContextMenu x={listMenu.x} y={listMenu.y} placement="top" items={listMenuItems()} onClose={() => setListMenu(null)} />
      )}

      {lockDate && (
        <span className="mn__lockdate" title={E ? 'Lock date' : 'Ngày khoá sổ'}>
          <Icon name="lock" size={13} strokeWidth={2} /> {lockDate}
        </span>
      )}
    </footer>
  );
}
