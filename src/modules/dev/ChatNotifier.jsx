import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/auth/AuthContext';
import { socket, useSocketEvent, useSocketReady } from '@/realtime';
import { chatBridge, colorOf, initials, isMineMsg, rememberSent, timeOf } from './chatBridge';
import './chat-notifier.css';

const SHOW_MS = 8000;  // tự ẩn sau chừng này (rê chuột / đang trả lời thì dừng)
const MAX_CARDS = 4;   // tối đa số thông báo (mỗi phòng 1 thẻ, tin mới cùng phòng gộp vào)

/**
 * THÔNG BÁO TIN NHẮN MỚI ở góc dưới bên phải – chạy suốt trong màn chính (modules/dev/index.js -> widgets).
 * - Đăng ký nhận tin mọi phòng ngay khi kết nối (không cần mở màn chat).
 * - Màn chat đang hiển thị -> không bật thông báo.
 * - Nhiều thông báo xếp thành cột; rê chuột vào chỉ TẠM DỪNG đếm giờ, giao diện giữ nguyên.
 * - Trả lời nhanh ngay trên thẻ, hoặc "Mở chat" để vào đúng phòng.
 */
export default function ChatNotifier() {
  const { user } = useAuth();
  const me = user?.User_name || '';
  const [rooms, setRooms] = useState({}); // id -> phòng (tên, biểu tượng)
  const [cards, setCards] = useState([]); // [{ room, msgs: [..], stamp }] – cũ trước, mới sau
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const paused = hover || focus; // rê chuột / đang gõ trả lời -> dừng tự ẩn

  // Kết nối xong (và sau mỗi lần kết nối lại) -> đăng ký nhận tin các phòng
  useSocketReady(async () => {
    try {
      const list = await socket.invoke('GetRooms', socket.silent);
      setRooms(Object.fromEntries(list.map((r) => [r.id, r])));
      await socket.invoke('SubscribeRooms', list.map((r) => r.id), socket.silent);
    } catch { /* không có chat (server cũ / lỗi) -> bỏ qua, không làm phiền */ }
  });

  useSocketEvent('ReceiveMessage', (msg) => {
    if (!msg || isMineMsg(msg, me) || chatBridge.isVisible()) return;
    setCards((prev) => {
      const old = prev.find((c) => c.room === msg.room);
      const card = { room: msg.room, msgs: [...(old?.msgs || []), msg].slice(-3), count: (old?.count || 0) + 1, stamp: Date.now() };
      return [...prev.filter((c) => c.room !== msg.room), card].slice(-MAX_CARDS);
    });
  });

  // Màn chat vừa hiện lên -> dọn thông báo (người dùng đã thấy tin trong màn chat)
  useEffect(() => chatBridge.onVisible((v) => { if (v) setCards([]); }), []);
  useEffect(() => { if (!cards.length) { setHover(false); setFocus(false); } }, [cards.length]);

  const close = (room) => setCards((prev) => prev.filter((c) => c.room !== room));
  const open = (room) => {
    setCards([]);
    chatBridge.openWidget(room); // mở khung chat nổi ở góc dưới phải, vào thẳng phòng
  };

  if (!cards.length) return null;
  const n = cards.length;
  return createPortal(
    <section
      className="cn"
      aria-label="Tin nhắn mới"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}
    >
      {n > 1 && (
        <div className="cn__head">
          <span className="cn__head-title">
            <span className="cn__head-dot" aria-hidden="true" />
            {n} cuộc trò chuyện có tin mới
          </span>
          <button type="button" className="cn__clear" onClick={() => setCards([])}>Xoá tất cả</button>
        </div>
      )}
      <div className="cn__list">
        {cards.map((c) => (
          <ChatCard key={c.room} card={c} paused={paused}
            room={rooms[c.room]} onOpen={() => open(c.room)} onClose={() => close(c.room)} />
        ))}
      </div>
    </section>,
    document.body
  );
}

function ChatCard({ card, paused, room, onOpen, onClose }) {
  const { msgs, count, stamp } = card;
  const last = msgs.at(-1);
  const [leaving, setLeaving] = useState(false);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const timer = useRef(null);
  const inputRef = useRef(null);
  const remain = useRef(SHOW_MS);   // thời gian còn lại trước khi tự ẩn
  const startedAt = useRef(0);

  const dismiss = (delay = 0) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLeaving(true);
      setTimeout(onClose, 260);
    }, delay);
  };

  // Tin mới cùng phòng -> đếm lại từ đầu
  useEffect(() => { remain.current = SHOW_MS; }, [stamp]);

  // Tự ẩn: rê chuột / đang trả lời thì DỪNG (giữ phần thời gian còn lại), bỏ chuột ra chạy tiếp
  const stopped = paused || replying || sent;
  useEffect(() => {
    if (stopped) return undefined;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => dismiss(), remain.current);
    return () => {
      clearTimeout(timer.current);
      remain.current = Math.max(800, remain.current - (Date.now() - startedAt.current));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, stopped]);

  useEffect(() => { if (replying) inputRef.current?.focus(); }, [replying]);

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const clientId = `q${Date.now().toString(36)}`;
      rememberSent(clientId);
      await socket.invoke('SendMessage', card.room, body, clientId);
      setSent(true);
      setText('');
      dismiss(1400);
    } catch { /* lỗi đã hiện toast */ } finally {
      setSending(false);
    }
  };

  const color = colorOf(last.user);
  return (
    <article
      className={`cn__card ${leaving ? 'is-leave' : ''}`}
      style={{ '--c': color, '--cn-ms': `${SHOW_MS}ms` }}
    >
      <header className="cn__bar-top">
        <span className="cn__app" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        </span>
        <span className="cn__room">{room?.icon && <i>{room.icon}</i>}{room?.name || card.room}</span>
        <time className="cn__time">{timeOf(last.at)}</time>
        <button type="button" className="cn__close" aria-label="Đóng" onClick={() => dismiss()}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M7 7l10 10M17 7L7 17" /></svg>
        </button>
      </header>

      <button type="button" className="cn__main" onClick={onOpen} title="Mở cuộc trò chuyện">
        <span className="cn__avatar">
          {initials(last.name)}
          {count > 1 && <span className="cn__count">{count > 9 ? '9+' : count}</span>}
        </span>
        <span className="cn__body">
          <b className="cn__name">{last.name}</b>
          <span className="cn__msgs">
            {msgs.map((m, k) => (
              <span key={m.id || k} className={`cn__bubble ${k === msgs.length - 1 ? 'is-last' : ''}`}>{m.text}</span>
            ))}
          </span>
        </span>
      </button>

      {sent ? (
        <div className="cn__sent" role="status">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          Đã gửi trả lời
        </div>
      ) : replying ? (
        <form className="cn__reply-form" onSubmit={send}>
          <input ref={inputRef} className="cn__input" value={text} maxLength={2000} disabled={sending}
            placeholder={`Trả lời ${last.name.split(' ').at(-1)}...`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setReplying(false); setText(''); } }} />
          <button type="submit" className="cn__send" disabled={!text.trim() || sending} aria-label="Gửi">
            {sending ? <span className="cn__spin" /> : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" /><path d="M11.5 13.5L20 4" />
              </svg>
            )}
          </button>
        </form>
      ) : (
        <footer className="cn__actions">
          <button type="button" className="cn__btn" onClick={() => setReplying(true)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
            Trả lời nhanh
          </button>
          <button type="button" className="cn__btn cn__btn--primary" onClick={onOpen}>
            Mở chat
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
          </button>
        </footer>
      )}

      {!replying && !sent && <span key={stamp} className={`cn__progress ${paused ? 'is-paused' : ''}`} aria-hidden="true" />}
    </article>
  );
}
