import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SocketStatus } from '@/realtime';
import { useAuth } from '@/auth/AuthContext';
import ChatPage from './ChatPage';
import { chatBridge } from './chatBridge';
import './chat-widget.css';

const OPEN_DELAY_MS = 120;  // rê chuột vào bong bóng bao lâu thì mở (tránh mở nhầm khi lướt chuột qua)
const CLOSE_DELAY_MS = 450; // rời chuột bao lâu thì thu lại (nếu không ghim / không đang gõ)
const HIDE_ANIM_MS = 260;   // thời gian hiệu ứng ẩn khung (khớp .cw__panel.is-closing trong chat-widget.css)
const SIZE = 56;            // đường kính bong bóng
const GAP = 12;             // khoảng cách bong bóng – khung chat
const EDGE_SNAP = 48;       // thả cách mép trái/phải < chừng này -> hít vào mép (nấp bớt nửa, không vướng nhập liệu)
const TASKBAR_H = 42;       // thanh TaskBar dưới cùng
const POS_KEY = 'cyber_chat_bubble'; // sessionStorage (localStorage chỉ dành cho 4 khoá – xem utils/storage.js)

/**
 * CHAT NỔI – có ở mọi màn hình (khai báo widgets trong modules/dev/index.js).
 *   - KÉO bong bóng đi bất kỳ đâu (mặc định góc dưới phải). Thả gần mép trái/phải -> hít vào mép, nấp bớt nửa
 *     để không vướng khi nhập liệu; rê chuột vào thì trượt ra. Vị trí được nhớ trong tab (sessionStorage).
 *   - Rê chuột vào -> hiện danh sách cuộc trò chuyện; chọn 1 cuộc -> giãn 2 cột kiểu Zalo (trái danh sách, phải nội dung).
 *     Khung tự mở về phía còn trống cạnh bong bóng.
 *   - Bấm bong bóng -> GHIM mở. Bấm lại / ✕ / Esc / bấm ra ngoài -> đóng. Đang gõ trong khung thì không tự thu.
 *   - Popup tin nhắn mới "Mở chat"/"Trả lời" -> chatBridge.openWidget(room) mở ghim, vào thẳng phòng.
 * Khung chat luôn được giữ (chỉ ẩn) để vẫn đếm tin chưa đọc, giữ cuộc trò chuyện đang mở.
 */
export default function ChatWidget() {
  const { lang } = useAuth();
  const [open, setOpen] = useState(false);
  // Khung còn hiện thêm HIDE_ANIM_MS sau khi đóng để chạy hiệu ứng ẩn (thu về phía bong bóng)
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setShown(true); setClosing(false); return undefined; }
    if (!shown) return undefined;
    setClosing(true);
    const t = setTimeout(() => { setShown(false); setClosing(false); }, HIDE_ANIM_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const [pinned, setPinned] = useState(false);
  const [unread, setUnread] = useState(0);
  const [hasChat, setHasChat] = useState(false); // đang mở 1 cuộc trò chuyện -> khung giãn 2 cột
  const onActiveChange = useCallback((room) => setHasChat(!!room), []);
  const [pos, setPos] = useState(loadPos);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState(viewport);
  const rootRef = useRef(null);
  const timer = useRef(null);
  const drag = useRef(null);
  const skipClick = useRef(false);
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  const show = useCallback((pin = false) => {
    clearTimeout(timer.current);
    setOpen(true);
    if (pin) setPinned(true);
  }, []);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
    setPinned(false);
  }, []);

  // ----- Hover: vào -> mở sau chút; ra -> thu lại nếu không ghim và không đang gõ trong khung -----
  const onEnter = () => {
    if (coarse || drag.current) return;
    clearTimeout(timer.current);
    if (!open) timer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };
  const onLeave = () => {
    if (coarse || drag.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const focusInside = rootRef.current?.contains(document.activeElement) && document.activeElement !== document.body;
      if (!pinned && !focusInside) setOpen(false);
    }, CLOSE_DELAY_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  // Mở từ nơi khác (popup tin nhắn...) -> ghim mở
  useEffect(() => chatBridge.onOpenWidget(() => show(true)), [show]);

  // Esc / bấm ra ngoài -> đóng
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') hide(); };
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (e.target.closest?.('.cn, .cy-toasts, .cy-mb, .cy-popup')) return; // popup tin nhắn / toast / hộp thoại
      hide();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, hide]);

  // Đổi kích thước cửa sổ -> giữ bong bóng trong màn hình
  useEffect(() => {
    const onResize = () => { setView(viewport()); setPos((p) => clampPos(p)); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ----- Kéo thả bong bóng -----
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5) return; // chưa đủ xa -> vẫn coi là bấm
      d.moved = true;
      clearTimeout(timer.current);
      setDragging(true);
      setOpen(false);
      setPinned(false);
    }
    setPos(clampPos({ x: d.ox + dx, y: d.oy + dy, dock: null }));
  };
  const endDrag = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    skipClick.current = true; // vừa kéo xong -> không tính là bấm
    setDragging(false);
    setPos((p) => {
      const vw = window.innerWidth;
      const dock = p.x < EDGE_SNAP ? 'left' : p.x > vw - SIZE - EDGE_SNAP ? 'right' : null;
      const next = clampPos({ ...p, dock });
      savePos(next);
      return next;
    });
  };
  const onBubbleClick = () => {
    if (skipClick.current) { skipClick.current = false; return; }
    if (open && pinned) hide(); else show(true);
  };
  // Bàn phím: Alt + mũi tên để dời bong bóng
  const onBubbleKey = (e) => {
    if (!e.altKey) return;
    const step = 24;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!delta) return;
    e.preventDefault();
    setPos((p) => { const next = clampPos({ x: p.x + delta[0], y: p.y + delta[1], dock: null }); savePos(next); return next; });
  };

  const panelStyle = placePanel(pos, view, hasChat);
  const side = pos.x + SIZE / 2 > view.w / 2 ? 'right' : 'left';

  return createPortal(
    <div ref={rootRef}
      className={`cw ${open ? 'is-open' : ''} ${pinned ? 'is-pinned' : ''} ${hasChat ? 'has-chat' : ''} ${unread ? 'has-unread' : ''} ${dragging ? 'is-dragging' : ''} ${pos.dock ? `dock-${pos.dock}` : ''} side-${side}`}
      onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <section className={`cw__panel ${closing ? 'is-closing' : ''}`} hidden={!shown} aria-hidden={closing || undefined} role="dialog" aria-label="Tin nhắn" style={panelStyle}>
        <header className="cw__head">
          <span className="cw__title">Tin nhắn</span>
          <SocketStatus lang={lang} />
          <span className="cw__spacer" />
          <button type="button" className={`cw__icon ${pinned ? 'is-on' : ''}`} onClick={() => setPinned((p) => !p)}
            title={pinned ? 'Bỏ ghim (rời chuột sẽ thu lại)' : 'Ghim mở'} aria-pressed={pinned}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4h6l-1 6 3 3H7l3-3-1-6z" /><path d="M12 13v7" />
            </svg>
          </button>
          <button type="button" className="cw__icon" onClick={hide} title="Đóng (Esc)" aria-label="Đóng khung chat">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 7l10 10M17 7L7 17" /></svg>
          </button>
        </header>
        <div className="cw__body">
          <ChatPage compact onUnreadChange={setUnread} onActiveChange={onActiveChange} />
        </div>
      </section>

      <button type="button" className="cw__bubble" style={{ left: pos.x, top: pos.y }} aria-expanded={open}
        aria-label={unread ? `Tin nhắn – ${unread} tin chưa đọc` : 'Tin nhắn'}
        title={dragging ? '' : 'Tin nhắn · kéo để di chuyển (Alt + mũi tên)'}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        onClick={onBubbleClick} onKeyDown={onBubbleKey}>
        <span className="cw__face" aria-hidden="true">
          <svg className="cw__ico-chat" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20.5l1.4-5.1A8.5 8.5 0 1 1 21 11.5z" fill="rgba(255,255,255,.18)" />
            <path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" strokeWidth="2.6" />
          </svg>
          <svg className="cw__ico-close" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M7 7l10 10M17 7L7 17" />
          </svg>
        </span>
        {unread > 0 && <span className="cw__badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------- vị trí
function viewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

/** Mặc định: góc dưới phải, ngay trên thanh TaskBar, hít mép phải */
function defaultPos() {
  return clampPos({ x: window.innerWidth - SIZE, y: window.innerHeight - TASKBAR_H - SIZE - 20, dock: 'right' });
}

function clampPos(p) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = Math.min(Math.max(p.x, 0), vw - SIZE);
  const y = Math.min(Math.max(p.y, 8), vh - SIZE - 8);
  if (p.dock === 'right') x = vw - SIZE;
  if (p.dock === 'left') x = 0;
  return { x, y, dock: p.dock || null };
}

function loadPos() {
  try {
    const p = JSON.parse(sessionStorage.getItem(POS_KEY));
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return clampPos(p);
  } catch { /* hỏng -> mặc định */ }
  return defaultPos();
}

function savePos(p) {
  try { sessionStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* bị chặn */ }
}

/**
 * Đặt khung chat cạnh bong bóng, về phía còn trống:
 *   bong bóng ở nửa phải -> khung bên trái bong bóng (neo mép phải để giãn 2 cột mượt sang trái), ngược lại bên phải;
 *   bong bóng ở nửa dưới -> khung mọc lên trên (neo đáy), ngược lại mọc xuống.
 */
function placePanel(pos, view, hasChat) {
  const want = hasChat ? 820 : 340;
  const onRight = pos.x + SIZE / 2 > view.w / 2;
  const onBottom = pos.y + SIZE / 2 > view.h / 2;
  const space = onRight ? pos.x - GAP - 8 : view.w - (pos.x + SIZE) - GAP - 8;
  // không đủ chỗ cạnh bong bóng (màn hẹp) -> cho phép đè lên bong bóng, vẫn nằm trong màn hình
  const width = Math.max(260, Math.min(want, space >= 300 ? space : view.w - 16));
  const style = { width };
  if (space >= 300) {
    if (onRight) style.right = view.w - pos.x + GAP; else style.left = pos.x + SIZE + GAP;
  } else if (onRight) style.right = 8; else style.left = 8;

  const room = onBottom ? pos.y + SIZE - 8 : view.h - pos.y - 8;
  const height = Math.max(320, Math.min(620, room, view.h - 16));
  style.height = height;
  if (onBottom) style.bottom = Math.max(8, view.h - (pos.y + SIZE));
  else style.top = Math.max(8, Math.min(pos.y, view.h - height - 8));
  return style;
}
