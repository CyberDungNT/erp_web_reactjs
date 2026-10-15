import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon, { MenuIcon, hasMenuIcon } from '../components/icons/Icon';
import { normalize } from '../utils/menuTree';
import './menustrip.css';

/**
 * Menu trên cùng kiểu MenuStrip của WinForms.
 *
 * Chuột:
 *   - Bấm mục trên thanh -> thả xuống; khi đang mở, rê sang mục khác trên thanh sẽ đổi menu.
 *   - Rê vào mục có ▸ -> menu con xổ sang phải (nhiều cấp). Bấm mục lá -> mở chức năng.
 *   - Bấm ra ngoài -> đóng.
 * Bàn phím:
 *   - Alt (nhấn rồi thả) / F10: kích hoạt thanh menu. Giữ Alt: hiện gạch chân phím tắt.
 *   - Alt + chữ gạch chân: mở thẳng mục trên thanh.
 *   - ← → : chuyển mục trên thanh / đóng-mở menu con.  ↑ ↓ : chọn mục trong menu.
 *   - Enter / Space: chọn.  Esc: đóng 1 cấp.  Gõ chữ: nhảy tới mục có phím tắt (hoặc chữ cái đầu) đó.
 *
 * Props: tree (cây từ buildMenuTree), onOpen(node) khi chọn 1 chức năng,
 *        variant: 'strip' (thanh riêng kiểu WinForms) | 'header' (nằm trên thanh tiêu đề, có mũi tên ▾).
 */
const HOVER_DELAY = 250;
const usable = (list = []) => list.filter((n) => !n.separator);
const hasKids = (n) => usable(n?.children).length > 0;
const keyOf = (n) => normalize(n.accel >= 0 ? n.text[n.accel] : n.text.charAt(0));
const accelOf = (n) => (n.accel >= 0 ? normalize(n.text[n.accel]) : null);

function Label({ node }) {
  const { text, accel } = node;
  if (accel == null || accel < 0) return <span className="ms-label">{text}</span>;
  return (
    <span className="ms-label">
      {text.slice(0, accel)}<u>{text[accel]}</u>{text.slice(accel + 1)}
    </span>
  );
}

export default function MenuStrip({ tree, onOpen, variant = 'strip' }) {
  const nodeMap = useMemo(() => {
    const m = new Map();
    const walk = (list) => list.forEach((n) => { m.set(n.id, n); walk(n.children); });
    walk(tree);
    return m;
  }, [tree]);

  // Cấp 0 = thanh menu, cấp k (>=1) = dropdown của node open[k-1]
  const [open, setOpen] = useState([]);   // id các node đang mở dropdown, theo cấp
  const [hot, setHot] = useState([]);     // id mục đang sáng ở mỗi cấp
  const [active, setActive] = useState(false); // thanh đang được kích hoạt bằng bàn phím
  const [kb, setKb] = useState(false);    // hiện gạch chân phím tắt
  const stripRef = useRef(null);
  const refs = useRef(new Map());
  const timer = useRef(null);
  const altAlone = useRef(false);

  const setRef = useCallback((id) => (el) => {
    if (el) refs.current.set(id, el);
    else refs.current.delete(id);
  }, []);

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setOpen([]);
    setHot([]);
    setActive(false);
    setKb(false);
  }, []);

  const invoke = useCallback((node) => {
    close();
    onOpen(node);
  }, [close, onOpen]);

  /** Mở menu con của node (node nằm ở cấp k) */
  const openSub = useCallback((k, node, focusFirst) => {
    clearTimeout(timer.current);
    setOpen((o) => [...o.slice(0, k), node.id]);
    setHot((h) => {
      const nh = [...h.slice(0, k), node.id];
      const first = focusFirst ? usable(node.children)[0] : null;
      if (first) nh[k + 1] = first.id;
      return nh;
    });
  }, []);

  const choose = useCallback((k, node, viaKeyboard) => {
    if (hasKids(node)) openSub(k, node, viaKeyboard);
    else invoke(node);
  }, [openSub, invoke]);

  // ----- Chuột trên thanh -----
  const onBarDown = (e, node) => {
    e.preventDefault();
    if (!hasKids(node)) return invoke(node);
    if (open[0] === node.id) return close();
    setActive(true);
    openSub(0, node, false);
  };
  const onBarEnter = (node) => {
    if (open.length && open[0] !== node.id) {
      if (hasKids(node)) openSub(0, node, false);
      else { setOpen([]); setHot([node.id]); }
    }
  };

  // ----- Chuột trong dropdown (mục ở cấp k) -----
  const onItemEnter = (k, node) => {
    setHot((h) => [...h.slice(0, k), node.id]);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpen((o) => (hasKids(node) ? [...o.slice(0, k), node.id] : o.slice(0, k)));
    }, HOVER_DELAY);
  };

  // ----- Bấm ra ngoài / đổi kích thước cửa sổ -> đóng -----
  useEffect(() => {
    if (!open.length && !active) return;
    const onDown = (e) => {
      if (stripRef.current?.contains(e.target) || e.target.closest?.('.ms-drop')) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [open.length, active, close]);

  // ----- Bàn phím -----
  useEffect(() => {
    const levelItems = (k) => usable(k === 0 ? tree : nodeMap.get(open[k - 1])?.children);

    const moveBar = (dir) => {
      const items = usable(tree);
      if (!items.length) return;
      const i = items.findIndex((n) => n.id === hot[0]);
      const next = items[(i + dir + items.length) % items.length];
      if (open.length && hasKids(next)) openSub(0, next, true);
      else { setOpen([]); setHot([next.id]); }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Alt') {
        altAlone.current = true;
        setKb(true);
        return;
      }
      altAlone.current = false;

      // Alt + chữ: mở mục trên thanh có phím tắt tương ứng
      if (e.altKey && !e.ctrlKey && e.key.length === 1) {
        const k = normalize(e.key);
        const node = usable(tree).find((n) => accelOf(n) === k);
        if (node) {
          e.preventDefault();
          setActive(true);
          setKb(true);
          if (hasKids(node)) openSub(0, node, true);
          else invoke(node);
        }
        return;
      }

      if (e.key === 'F10' && !e.shiftKey) {
        e.preventDefault();
        if (active || open.length) close();
        else { setActive(true); setKb(true); setHot([usable(tree)[0]?.id]); }
        return;
      }

      if (!active && !open.length) return;

      const depth = open.length;           // cấp đang điều khiển bằng phím
      const items = levelItems(depth);
      const cur = items.findIndex((n) => n.id === hot[depth]);
      const curNode = items[cur];
      const handled = () => { e.preventDefault(); e.stopPropagation(); };

      switch (e.key) {
        case 'Escape':
          handled();
          if (depth > 0) {
            setOpen(open.slice(0, depth - 1));
            setHot(hot.slice(0, depth));
          } else close();
          return;
        case 'ArrowDown':
        case 'ArrowUp': {
          handled();
          if (depth === 0) {
            if (curNode && hasKids(curNode)) openSub(0, curNode, true);
            return;
          }
          if (!items.length) return;
          const dir = e.key === 'ArrowDown' ? 1 : -1;
          const next = items[cur < 0 ? (dir > 0 ? 0 : items.length - 1) : (cur + dir + items.length) % items.length];
          setHot((h) => [...h.slice(0, depth), next.id]);
          return;
        }
        case 'ArrowRight':
          handled();
          if (depth > 0 && curNode && hasKids(curNode)) openSub(depth, curNode, true);
          else moveBar(1);
          return;
        case 'ArrowLeft':
          handled();
          if (depth > 1) {
            setOpen(open.slice(0, depth - 1));
            setHot(hot.slice(0, depth));
          } else moveBar(-1);
          return;
        case 'Enter':
        case ' ':
          handled();
          if (curNode) choose(depth, curNode, true);
          return;
        case 'Tab':
          close();
          return;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            const k = normalize(e.key);
            const byAccel = items.filter((n) => accelOf(n) === k);
            const matches = byAccel.length ? byAccel : items.filter((n) => keyOf(n) === k);
            if (!matches.length) return;
            handled();
            if (matches.length === 1 && byAccel.length) {
              choose(depth, matches[0], true);
            } else {
              // nhiều mục cùng chữ -> lần lượt chuyển qua từng mục
              const after = matches.find((n) => items.indexOf(n) > cur) || matches[0];
              setHot((h) => [...h.slice(0, depth), after.id]);
            }
          }
      }
    };

    const onKeyUp = (e) => {
      if (e.key !== 'Alt') return;
      if (altAlone.current) {
        e.preventDefault();
        if (active || open.length) close();
        else { setActive(true); setKb(true); setHot([usable(tree)[0]?.id]); }
      } else if (!active && !open.length) {
        setKb(false);
      }
      altAlone.current = false;
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
    };
  }, [tree, nodeMap, open, hot, active, close, openSub, choose, invoke]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const barHot = hot[0];

  return (
    <>
      <nav ref={stripRef} className={`menustrip menustrip--${variant} ${kb ? 'ms-kb' : ''}`} role="menubar" aria-label="Menu chính">
        {tree.map((n) =>
          n.separator ? (
            <span key={n.id} className="ms-top-sep" />
          ) : (
            <div key={n.id} ref={setRef(n.id)} role="menuitem"
              aria-haspopup={hasKids(n) || undefined} aria-expanded={hasKids(n) ? open[0] === n.id : undefined}
              className={`ms-top ${open[0] === n.id ? 'is-open' : ''} ${!open.length && active && barHot === n.id ? 'is-hot' : ''}`}
              onMouseDown={(e) => onBarDown(e, n)}
              onMouseEnter={() => onBarEnter(n)}>
              {hasMenuIcon(n.icon) && <MenuIcon icon={n.icon} size={variant === 'header' ? 17 : 14} />}
              <Label node={n} />
              {variant === 'header' && hasKids(n) && <Icon name="chevronDown" size={14} className="ms-top-chev" />}
            </div>
          )
        )}
      </nav>
      {open.map((id, i) => {
        const node = nodeMap.get(id);
        if (!node || !hasKids(node)) return null;
        return (
          <Dropdown key={id} level={i + 1} node={node} anchor={refs.current.get(id)} isRoot={i === 0}
            hotId={hot[i + 1]} openId={open[i + 1]} kb={kb} setRef={setRef}
            onEnter={onItemEnter} onChoose={(k, c) => choose(k, c, false)} />
        );
      })}
    </>
  );
}

function Dropdown({ level, node, anchor, isRoot, hotId, openId, kb, setRef, onEnter, onChoose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!anchor || !el) return;
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left;
    let top;
    if (isRoot) {
      left = r.left;
      top = r.bottom;
      if (left + w > vw - 4) left = vw - w - 4;
    } else {
      left = r.right - 3;                       // xổ sang phải
      if (left + w > vw - 4) left = r.left - w + 3; // không đủ chỗ -> xổ sang trái
      top = r.top - 3;
    }
    if (top + h > vh - 4) top = vh - h - 4;
    setPos({ left: Math.max(4, left), top: Math.max(4, top) });
  }, [anchor, node, isRoot]);

  // Mục được chọn bằng bàn phím luôn nằm trong vùng nhìn thấy
  useEffect(() => {
    if (!hotId || !ref.current) return;
    ref.current.querySelector(`[data-id="${CSS.escape(hotId)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [hotId]);

  return createPortal(
    <div ref={ref} className={`ms-drop ${kb ? 'ms-kb' : ''}`} role="menu" style={pos}
      onMouseDown={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      {node.children.map((c) => {
        if (c.separator) return <div key={c.id} className="ms-sep" role="separator" />;
        const sub = hasKids(c);
        return (
          <div key={c.id} ref={setRef(c.id)} data-id={c.id} role="menuitem"
            aria-haspopup={sub || undefined} aria-expanded={sub ? openId === c.id : undefined}
            className={`ms-item ${hotId === c.id ? 'is-hot' : ''} ${openId === c.id ? 'is-open' : ''}`}
            onMouseEnter={() => onEnter(level, c)}
            onClick={() => onChoose(level, c)}>
            <span className="ms-gutter">{hasMenuIcon(c.icon) && <MenuIcon icon={c.icon} size={14} />}</span>
            <Label node={c} />
            <span className="ms-arrow">{sub && <Icon name="chevronRight" size={12} strokeWidth={2.2} />}</span>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
