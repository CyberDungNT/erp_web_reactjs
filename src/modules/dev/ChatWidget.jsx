import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SocketStatus, disablePush, enablePush, usePushStatus } from '@/realtime';
import { toast } from '@/components/cyber';
import { useAuth } from '@/auth/AuthContext';
import ChatPage from './ChatPage';
import { chatBridge } from './chatBridge';
import './chat-widget.css';

const HIDE_ANIM_MS = 260;   // thời gian hiệu ứng ẩn khung (khớp .cw__panel.is-closing trong chat-widget.css)
const MARGIN = 12;          // khung chat cách mép phải (thẳng hàng avatar)
const TASKBAR_H = 42;       // thanh TaskBar dưới cùng
const MOBILE_MAX_W = 640;   // màn hẹp hơn -> khung chat phủ toàn màn hình (khớp @media trong chat-widget.css)

/**
 * KHUNG CHAT – mở từ MENU AVATAR -> "Tin nhắn" (userMenu trong modules/dev/index.js), không còn bong bóng nổi.
 *   - Khung thả xuống ngay dưới avatar (góc trên phải); chọn 1 cuộc -> giãn 2 cột kiểu Zalo (trái danh sách, phải nội dung).
 *   - ✕ / Esc / bấm ra ngoài -> đóng. Mobile: phủ toàn màn hình, đóng bằng ✕.
 *   - Popup tin nhắn mới "Mở chat"/"Trả lời" -> chatBridge.openWidget(room) mở khung, vào thẳng phòng.
 * Khung chat luôn được giữ (chỉ ẩn) để vẫn đếm tin chưa đọc (chatBridge.setUnread -> số trên menu avatar), giữ cuộc đang mở.
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
  const [unread, setUnread] = useState(0);
  const [hasChat, setHasChat] = useState(false); // đang mở 1 cuộc trò chuyện -> khung giãn 2 cột
  const onActiveChange = useCallback((room) => setHasChat(!!room), []);
  const [view, setView] = useState(viewport);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const timer = useRef(null);

  const show = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  // Số tin chưa đọc -> menu avatar (mục "Tin nhắn" + chấm đỏ trên avatar)
  useEffect(() => { chatBridge.setUnread(unread); }, [unread]);
  useEffect(() => () => chatBridge.setUnread(0), []);

  // Mở từ menu avatar "Tin nhắn" / popup tin nhắn mới ("Mở chat", "Trả lời")
  useEffect(() => chatBridge.onOpenWidget(() => show()), [show]);

  // Esc / bấm ra ngoài -> đóng
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') hide(); };
    const onDown = (e) => {
      if (window.innerWidth <= MOBILE_MAX_W) return; // mobile: khung toàn màn hình, chỉ đóng bằng nút ✕
      if (rootRef.current?.contains(e.target)) return;
      if (e.target.closest?.('.cn, .cy-toasts, .cy-mb, .cy-popup, .cy-menu, .mn__user')) return; // + menu avatar (nơi mở khung) // popup tin nhắn / toast / hộp thoại / menu chuột phải
      hide();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, hide]);

  // Đổi kích thước cửa sổ / xoay màn hình -> đặt lại khung
  useEffect(() => {
    const onResize = () => setView(viewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Mobile: khung phủ kín màn hình bằng CSS (inset: 0) – KHÔNG tính chiều cao theo visualViewport (bàn phím ẩn đi mà
  // số đo chưa kịp cập nhật -> khung bị lùn, lộ trang phía sau). Chỉ chừa khoảng dưới = phần bàn phím đang che (--cw-kb).
  const mobile = view.w <= MOBILE_MAX_W;
  useEffect(() => {
    if (!mobile || !shown) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const vv = window.visualViewport;
    let raf = 0;
    const timers = [];
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
        panelRef.current?.style.setProperty('--cw-kb', `${kb < 60 ? 0 : kb}px`); // < 60px: thanh địa chỉ co giãn, không phải bàn phím
      });
    };
    // bàn phím trượt lên / xuống mất ~300ms, có máy không bắn sự kiện ở cuối -> đo thêm vài lần
    const measureSoon = () => { measure(); [100, 300, 600].forEach((ms) => timers.push(setTimeout(measure, ms))); };
    const onFocusOut = () => {
      measureSoon();
      // iPhone: bàn phím ẩn mà trang vẫn bị cuộn lệch -> đưa về đầu
      setTimeout(() => { if (!document.activeElement?.matches?.('input, textarea, [contenteditable]')) window.scrollTo(0, 0); }, 120);
    };
    measure();
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', measure);
    document.addEventListener('focusin', measureSoon);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', measure);
      document.removeEventListener('focusin', measureSoon);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [mobile, shown]);

  const panelStyle = placePanel(view, hasChat);

  return createPortal(
    <div ref={rootRef}
      className={`cw ${open ? 'is-open' : ''} ${hasChat ? 'has-chat' : ''} ${unread ? 'has-unread' : ''} side-top ${mobile ? 'is-mobile' : ''}`}>
      <section ref={panelRef} className={`cw__panel ${closing ? 'is-closing' : ''}`} hidden={!shown} aria-hidden={closing || undefined} role="dialog" aria-label="Tin nhắn" style={panelStyle}>
        <header className="cw__head">
          <span className="cw__title">Tin nhắn</span>
          <SocketStatus lang={lang} />
          <span className="cw__spacer" />
          <PushButton />
          <button type="button" className="cw__icon" onClick={hide} title="Đóng (Esc)" aria-label="Đóng khung chat">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 7l10 10M17 7L7 17" /></svg>
          </button>
        </header>
        <PushHint />
        <div className="cw__body">
          <ChatPage compact onUnreadChange={setUnread} onActiveChange={onActiveChange} />
        </div>
      </section>

    </div>,
    document.body
  );
}

// ----------------------------------------------------------------- thông báo đẩy (realtime/push.js)
const IOS_HINT = 'iPhone / iPad: mở trang bằng Safari → bấm nút Chia sẻ → "Thêm vào MH chính", rồi mở app từ icon đó và bấm 🔔 để bật thông báo (cần iOS 16.4 trở lên).';

/** Bấm 🔔: bật / tắt thông báo khi app thu nhỏ trên thiết bị này. PHẢI gọi enablePush ngay trong sự kiện bấm (Safari). */
async function togglePush(status) {
  if (status === 'install') return toast.info(IOS_HINT, { title: 'Bật thông báo trên iPhone', duration: 12000 });
  if (status === 'denied') {
    return toast.warning('Bạn đã chặn thông báo cho trang này. Vào cài đặt trình duyệt / điện thoại → Thông báo để cho phép lại.', { title: 'Thông báo đang bị chặn' });
  }
  try {
    if (status === 'on') {
      await disablePush();
      toast.info('Đã tắt thông báo trên thiết bị này.');
    } else {
      await enablePush();
      toast.success('Đã bật – thu nhỏ app vẫn nhận được thông báo tin nhắn mới.', { title: 'Thông báo' });
    }
  } catch (err) {
    toast.error(err.message || 'Không bật được thông báo.');
  }
}

function PushButton() {
  const status = usePushStatus();
  if (status === 'unsupported') return null;
  const on = status === 'on';
  const title = { on: 'Đang bật thông báo khi thu nhỏ app – bấm để tắt', off: 'Bật thông báo khi thu nhỏ app', busy: 'Đang xử lý...',
    denied: 'Thông báo đang bị chặn', install: 'Bật thông báo (iPhone: cần thêm vào màn hình chính)' }[status];
  return (
    <button type="button" className={`cw__icon ${on ? 'is-on' : ''}`} onClick={() => togglePush(status)}
      disabled={status === 'busy'} title={title} aria-label={title} aria-pressed={on}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        {!on && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}

/** Dải gợi ý trên khung chat (chỉ mobile – CSS) khi chưa bật thông báo. Bấm × ẩn tới lần tải trang sau. */
let hintClosed = false;
function PushHint() {
  const status = usePushStatus();
  const [closed, setClosed] = useState(hintClosed);
  if (closed || (status !== 'off' && status !== 'install')) return null;
  const close = () => { hintClosed = true; setClosed(true); };
  return (
    <div className="cw__hint" role="note">
      <span>🔔 {status === 'install' ? 'Thêm app vào màn hình chính để nhận thông báo tin nhắn khi thu nhỏ.' : 'Bật thông báo để nhận tin nhắn khi thu nhỏ app.'}</span>
      <button type="button" className="cw__hint-btn" onClick={() => togglePush(status)}>{status === 'install' ? 'Cách làm' : 'Bật'}</button>
      <button type="button" className="cw__hint-x" onClick={close} aria-label="Ẩn gợi ý">×</button>
    </div>
  );
}

// ----------------------------------------------------------------- vị trí
function viewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

/**
 * Khung thả xuống ngay dưới thanh trên cùng, sát phải (dưới avatar). Có cuộc trò chuyện đang mở -> rộng ra 2 cột.
 * Mobile: vị trí / kích thước do CSS lo (.cw.is-mobile .cw__panel – phủ kín màn hình).
 */
function placePanel(view, hasChat) {
  if (view.w <= MOBILE_MAX_W) return undefined;
  const top = Math.round(document.querySelector('.mn__top')?.getBoundingClientRect().bottom ?? 64) + 6;
  const width = Math.max(300, Math.min(hasChat ? 820 : 360, view.w - 24));
  const height = Math.max(320, Math.min(640, view.h - top - TASKBAR_H - 12));
  return { top, right: MARGIN, width, height };
}
