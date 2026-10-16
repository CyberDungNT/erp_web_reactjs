import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { msgbox, toast } from '@/components/cyber';
import { socket, useSocketEvent, useSocketReady, useSocketStatus, SocketStatus } from '@/realtime';
import { chatBridge, colorOf, initials, isMineMsg, rememberSent, sameUser, timeOf } from './chatBridge';
import './chat.css';

/**
 * MÀN MẪU REALTIME: CHAT nhiều phòng.
 * Dùng socket dùng chung (src/realtime) – không tự mở kết nối, chỉ:
 *   - useSocketReady  : mỗi lần kết nối xong -> GetRooms + SubscribeRooms (nhận tin mọi phòng để đếm chưa đọc)
 *   - JoinRoom        : CHỈ phòng đang xem -> 1 trang lịch sử + người online; kéo lên đầu -> GetHistory trang cũ hơn
 *   - useSocketEvent  : ReceiveMessage / UserTyping / RoomPresence (chỉ phần thay đổi) / MessagesRead / HistoryCleared
 *   - MarkRead        : đang hiển thị + đã cuộn tới cuối -> báo "đã xem" tới tin mới nhất (giãn cách, chỉ khi tiến lên)
 *   - socket.invoke   : SendMessage, Typing, NotifyAll...
 * Thiết kế để chịu tải lớn: không tải lịch sử mọi phòng, phòng lớn không gửi "đang gõ" / danh sách người online.
 * Chế độ mock: mở thêm 1 tab trình duyệt để thấy tin nhắn đồng bộ giữa 2 tab.
 */

const TYPING_SHOW_MS = 3500; // "đang soạn tin" tự tắt sau chừng này nếu không có tín hiệu mới
const TYPING_SEND_MS = 2000; // gửi tín hiệu "đang gõ" tối đa 1 lần / khoảng này
const GROUP_GAP_MS = 5 * 60000; // tin cùng người cách nhau < 5 phút thì gộp nhóm

const dayOf = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hôm nay';
  if (d.toDateString() === y.toDateString()) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
};
/**
 * Gộp trang lịch sử mới tải với tin đang có: giữ tin đang gửi / lỗi và tin đến sau trang đó (seq lớn hơn).
 */
function mergeHistory(cur = [], history = []) {
  const maxSeq = history.reduce((a, x) => Math.max(a, x.seq || 0), 0);
  const ids = new Set(history.map((x) => x.id));
  const cids = new Set(history.map((x) => x.clientId).filter(Boolean));
  const extra = cur.filter((x) => !ids.has(x.id) && !(x.clientId && cids.has(x.clientId)) && (x.pending || x.failed || (x.seq || 0) > maxSeq));
  return [...history, ...extra];
}

const maxSeq = (list = []) => list.reduce((a, x) => Math.max(a, x.seq || 0), 0);

/** Bỏ dấu + chữ thường để tìm kiếm tiếng Việt */
const plain = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

const newClientId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * compact = true: chạy trong khung chat nổi (ChatWidget) – kiểu Zalo: chưa chọn thì chỉ có danh sách cuộc trò chuyện (có ô tìm),
 *   chọn 1 cuộc -> 2 cột: trái danh sách, phải nội dung (nút ‹ đóng cuộc trò chuyện).
 * onUnreadChange(total): báo tổng số tin chưa đọc (bong bóng chat hiện số).
 * onActiveChange(roomId | null): báo đang mở cuộc trò chuyện nào (khung nổi giãn rộng thành 2 cột).
 */
export default function ChatPage({ compact = false, onUnreadChange, onActiveChange }) {
  const { user, lang } = useAuth();
  const me = user?.User_name || '';
  const status = useSocketStatus();
  const online = status === 'connected';

  const [rooms, setRooms] = useState([]);
  // Mở từ popup tin nhắn -> vào thẳng phòng đó
  // Vào màn chat: CHƯA mở cuộc trò chuyện nào (null) – trừ khi mở từ popup tin nhắn thì vào thẳng phòng đó
  const [active, setActive] = useState(() => chatBridge.peekPendingRoom() || null);
  useEffect(() => { chatBridge.takePendingRoom(); }, []); // đọc ở trên (StrictMode gọi khởi tạo 2 lần), xoá ở đây
  const [msgs, setMsgs] = useState({});       // room -> danh sách tin
  const [presence, setPresence] = useState({}); // room -> { online, members, large }
  const [hasMore, setHasMore] = useState({});   // room -> còn tin cũ hơn để tải
  const [unread, setUnread] = useState({});   // room -> số tin chưa đọc
  const [typing, setTyping] = useState({});   // room -> { user: { name, until } }
  const [reads, setReads] = useState({});     // room -> { user: { user, name, seq, at } } – đã xem tới đâu
  const [readLog, setReadLog] = useState({}); // room -> { user: [{ seq, at }] } – lần lượt xem tới đâu lúc nào (thời gian xem từng tin)
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [search, setSearch] = useState(''); // ô tìm cuộc trò chuyện (khung nổi)
  const inputRef = useRef(null); // ô nhập tin

  // Mở 1 cuộc trò chuyện (bấm phòng / mở từ popup) -> đặt con trỏ vào ô nhập luôn.
  // Điện thoại / máy tính bảng (màn cảm ứng) thì không, để bàn phím ảo không tự bật che màn hình.
  useEffect(() => {
    if (!active || window.matchMedia?.('(pointer: coarse)').matches) return undefined;
    const id = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [active]);

  // Ô nhập đang bị khoá vì mất kết nối -> có mạng lại thì đặt con trỏ vào lại
  useEffect(() => {
    if (status !== 'connected' || !active || window.matchMedia?.('(pointer: coarse)').matches) return;
    if (document.activeElement === document.body) inputRef.current?.focus({ preventScroll: true });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeRef = useRef(active);
  activeRef.current = active;

  // ----- Kết nối xong (lần đầu + sau mỗi lần mất mạng) -> danh sách phòng + đăng ký nhận tin (không tải lịch sử) -----
  const [ready, setReady] = useState(0); // tăng mỗi lần kết nối lại -> vào lại phòng đang xem (bù tin bị lỡ)
  useSocketReady(async () => {
    try {
      const list = await socket.invoke('GetRooms');
      setRooms(list);
      await socket.invoke('SubscribeRooms', list.map((r) => r.id));
      setReady((n) => n + 1);
      if (!activeRef.current) setLoading(false); // chưa mở phòng nào -> không có lịch sử để tải
    } catch { setLoading(false); /* lỗi đã hiện toast */ }
  });

  // ----- Vào phòng đang xem: 1 trang lịch sử mới nhất + người online. Đổi phòng -> thôi xem phòng cũ -----
  useEffect(() => {
    if (!ready || !active || socket.status !== 'connected') return undefined;
    let alive = true;
    const room = active;
    setLoading(true);
    socket.invoke('JoinRoom', room).then((j) => {
      if (!alive) return;
      setMsgs((prev) => ({ ...prev, [room]: mergeHistory(prev[room], j.history) }));
      setHasMore((h) => ({ ...h, [room]: j.hasMore }));
      setPresence((p) => ({ ...p, [room]: { online: j.online, members: j.members || [], large: j.large } }));
      setReads((r) => ({ ...r, [room]: Object.fromEntries((j.reads || []).map((x) => [x.user, x])) }));
      setReadLog((l) => {
        const cur = l[room] || {};
        const next = { ...cur };
        for (const x of j.reads || []) {
          const log = cur[x.user] || [];
          if (!log.length || log.at(-1).seq < x.seq) next[x.user] = [...log, { seq: x.seq, at: x.at }];
        }
        return { ...l, [room]: next };
      });
      const mine = (j.reads || []).find((x) => sameUser(x.user, me));
      if (mine) lastMarked.current[room] = Math.max(lastMarked.current[room] || 0, mine.seq);
      markSeen(); // chỉ có tác dụng nếu người dùng vừa bấm mở phòng này
    }).catch(() => {}).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      if (socket.status === 'connected') socket.invoke('LeaveRoom', room, false, socket.silent).catch(() => {});
    };
  }, [active, ready]);

  // Báo cho popup tin nhắn (ChatNotifier) biết màn chat có đang HIỂN THỊ không:
  // mở nhưng đang ở tab khác (pane bị ẩn) = không hiển thị -> tin mới vẫn bật popup.
  // Không huỷ đăng ký phòng khi đóng màn: ChatNotifier vẫn cần nhận tin để bật popup.
  const rootRef = useRef(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => chatBridge.setVisible(e.isIntersecting));
    io.observe(el);
    return () => { io.disconnect(); chatBridge.setVisible(false); };
  }, []);

  // Popup "Trả lời" khi màn chat đang mở sẵn -> chuyển phòng (bấm mở = đã xem)
  useEffect(() => chatBridge.onRoomRequest((room) => {
    chatBridge.takePendingRoom();
    chatBridge.takeOpenedByClick();
    engage();
    setActive(room);
    setUnread((u) => ({ ...u, [room]: 0 }));
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- ĐÃ XEM: CHỈ khi người dùng BẤM VÀO đoạn chat (giống Messenger) -----
  // "Đang tương tác" (engaged) bật khi: bấm / focus vào khung trò chuyện, bấm chọn phòng, bấm "Mở chat"/"Trả lời" ở popup.
  // Đang tương tác + cửa sổ đang focus -> tin đến tiếp theo cũng tính là đã xem.
  // Tắt khi: bấm ra ngoài khung trò chuyện, chuyển cửa sổ / tab, màn chat bị ẩn -> phải bấm lại mới tính tiếp.
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  const atBottomRef = useRef(true);
  const engagedRef = useRef(chatBridge.isOpenedByClick()); // mở màn chat từ popup = đã bấm vào đoạn chat
  useEffect(() => { chatBridge.takeOpenedByClick(); }, []); // dùng xong thì xoá cờ
  const mainRef = useRef(null);
  const lastMarked = useRef({}); // room -> seq đã báo (không báo lùi / báo lại)
  const markTimer = useRef(null);
  const markSeen = useCallback(() => {
    clearTimeout(markTimer.current);
    markTimer.current = setTimeout(() => {
      const room = activeRef.current;
      if (!engagedRef.current || socket.status !== 'connected' || !chatBridge.isVisible() || document.hidden || !document.hasFocus()) return;
      const seq = maxSeq(msgsRef.current[room]);
      if (!seq || seq <= (lastMarked.current[room] || 0)) return;
      lastMarked.current[room] = seq;
      socket.invoke('MarkRead', room, seq, socket.silent).catch(() => { lastMarked.current[room] = 0; });
    }, 250);
  }, []);
  const engage = useCallback(() => { engagedRef.current = true; markSeen(); }, [markSeen]);
  useEffect(() => () => clearTimeout(markTimer.current), []);

  // Tin mới đến trong phòng đang xem: chỉ tính đã xem nếu đang tương tác
  useEffect(() => { markSeen(); }, [msgs[active], active, markSeen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bấm ra ngoài khung trò chuyện / rời cửa sổ / ẩn màn chat -> thôi tương tác
  useEffect(() => {
    const onDown = (ev) => { if (mainRef.current && !mainRef.current.contains(ev.target)) engagedRef.current = false; };
    const off = () => { engagedRef.current = false; };
    const onVis = () => { if (document.hidden) off(); };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('blur', off);
    document.addEventListener('visibilitychange', onVis);
    const offBridge = chatBridge.onVisible((v) => { if (!v) off(); });
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('blur', off);
      document.removeEventListener('visibilitychange', onVis);
      offBridge();
    };
  }, []);
  const onBottomChange = useCallback((bottom) => { atBottomRef.current = bottom; }, []);

  /** Kéo lên đầu khung chat -> tải trang cũ hơn */
  const loadingMore = useRef(false);
  const loadMore = async () => {
    const room = active;
    const oldest = (msgs[room] || []).find((x) => x.seq);
    if (loadingMore.current || !hasMore[room] || !oldest || !online) return;
    loadingMore.current = true;
    try {
      const p = await socket.invoke('GetHistory', room, oldest.seq);
      setMsgs((prev) => {
        const cur = prev[room] || [];
        const ids = new Set(cur.map((x) => x.id));
        return { ...prev, [room]: [...p.history.filter((x) => !ids.has(x.id)), ...cur] };
      });
      setHasMore((h) => ({ ...h, [room]: p.hasMore }));
    } catch { /* toast */ } finally {
      loadingMore.current = false;
    }
  };

  // ----- Sự kiện realtime -----
  useSocketEvent('ReceiveMessage', (msg) => {
    setMsgs((prev) => {
      const list = prev[msg.room] || [];
      if (list.some((m) => m.id === msg.id)) return prev;
      const i = msg.clientId ? list.findIndex((m) => m.clientId === msg.clientId) : -1;
      const nextList = i >= 0 ? list.map((m, k) => (k === i ? msg : m)) : [...list, msg];
      return { ...prev, [msg.room]: nextList };
    });
    setTyping((prev) => {
      if (!prev[msg.room]?.[msg.user]) return prev;
      const { [msg.user]: _, ...rest } = prev[msg.room];
      return { ...prev, [msg.room]: rest };
    });
    if (!isMineMsg(msg, me) && (msg.room !== activeRef.current || !chatBridge.isVisible())) {
      setUnread((u) => ({ ...u, [msg.room]: (u[msg.room] || 0) + 1 }));
    }
  });

  useSocketEvent('UserTyping', ({ room, user: u, name }) => {
    if (sameUser(u, me)) return;
    setTyping((prev) => ({ ...prev, [room]: { ...(prev[room] || {}), [u]: { name, until: Date.now() + TYPING_SHOW_MS } } }));
  });

  useSocketEvent('HistoryCleared', ({ room }) => {
    setMsgs((prev) => ({ ...prev, [room]: [] }));
    setReads((prev) => ({ ...prev, [room]: {} }));
    lastMarked.current[room] = 0;
  });

  // Có người vừa đọc tới tin seq (server không gửi ở phòng lớn)
  useSocketEvent('MessagesRead', (r) => {
    if (!r?.room) return;
    setReads((prev) => {
      const cur = prev[r.room]?.[r.user];
      if (cur && cur.seq >= r.seq) return prev;
      return { ...prev, [r.room]: { ...(prev[r.room] || {}), [r.user]: r } };
    });
    setReadLog((prev) => {
      const log = prev[r.room]?.[r.user] || [];
      if (log.length && log.at(-1).seq >= r.seq) return prev;
      return { ...prev, [r.room]: { ...(prev[r.room] || {}), [r.user]: [...log, { seq: r.seq, at: r.at }] } };
    });
  });

  // Có người vào / ra phòng – server chỉ gửi PHẦN THAY ĐỔI (phòng lớn không gửi)
  useSocketEvent('RoomPresence', ({ room, online: count, large, joined, left }) => {
    setPresence((prev) => {
      const cur = prev[room] || { online: 0, members: [], large: false };
      let list = cur.members;
      if (joined && !list.some((x) => x.user === joined.user)) list = [...list, { ...joined, online: true }].slice(0, 50);
      if (left) list = list.filter((x) => x.user !== left);
      return { ...prev, [room]: { online: count ?? cur.online, members: list, large: large ?? cur.large } };
    });
  });

  // Dọn "đang soạn tin" hết hạn
  useEffect(() => {
    const id = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        let changed = false;
        const next = {};
        for (const [room, users] of Object.entries(prev)) {
          next[room] = Object.fromEntries(Object.entries(users).filter(([, v]) => {
            const keep = v.until > now;
            if (!keep) changed = true;
            return keep;
          }));
        }
        return changed ? next : prev;
      });
    }, 700);
    return () => clearInterval(id);
  }, []);

  // ----- Gửi -----
  const lastTyping = useRef(0);
  const onType = (v) => {
    setText(v);
    if (!online || !v.trim() || presence[active]?.large) return; // phòng lớn: không gửi "đang gõ"
    const now = Date.now();
    if (now - lastTyping.current > TYPING_SEND_MS) {
      lastTyping.current = now;
      socket.invoke('Typing', active, socket.silent).catch(() => {});
    }
  };

  const sendMsg = async (room, body, clientId = newClientId()) => {
    rememberSent(clientId);
    const local = { id: clientId, clientId, room, user: me, name: user?.Comment || me, text: body, at: new Date().toISOString(), pending: true };
    setMsgs((prev) => ({ ...prev, [room]: [...(prev[room] || []).filter((m) => m.clientId !== clientId), local] }));
    try {
      const saved = await socket.invoke('SendMessage', room, body, clientId);
      setMsgs((prev) => ({ ...prev, [room]: (prev[room] || []).map((m) => (m.clientId === clientId ? saved : m)) }));
    } catch {
      setMsgs((prev) => ({ ...prev, [room]: (prev[room] || []).map((m) => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)) }));
    }
  };

  const submit = (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || !online) return;
    setText('');
    lastTyping.current = 0;
    sendMsg(active, body);
  };

  const openRoom = (id) => {
    engage();
    setActive(id);
    setUnread((u) => ({ ...u, [id]: 0 }));
  };

  // ----- Công cụ demo -----
  const notifyAll = async () => {
    await socket.invoke('NotifyAll', 'Thông báo hệ thống', `${user?.Comment || me} vừa gửi thông báo tới mọi người.`, 'info').catch(() => {});
  };
  const clearHistory = async () => {
    if (!(await msgbox.yesNo(`Xoá toàn bộ tin nhắn của phòng "${room?.name}"?`, { danger: true, lang }))) return;
    await socket.invoke('ClearHistory', active).catch(() => {});
    toast.success('Đã xoá lịch sử phòng');
  };

  const room = rooms.find((r) => r.id === active);
  const list = msgs[active] || [];
  const typingNames = Object.values(typing[active] || {}).map((t) => t.name);
  const pres = presence[active] || { online: 0, members: [], large: false };
  const readers = Object.values(reads[active] || {}).filter((r) => !sameUser(r.user, me));
  const roomMembers = pres.members;

  // Đang mở cuộc trò chuyện nào -> khung nổi giãn 2 cột / thu về danh sách
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);

  // Tổng chưa đọc -> bong bóng chat
  const totalUnread = Object.values(unread).reduce((a, n) => a + n, 0);
  useEffect(() => { onUnreadChange?.(totalUnread); }, [totalUnread, onUnreadChange]);

  // Khung chat vừa hiện lên đang ở 1 phòng -> phòng đó coi như đã đọc (đếm chưa đọc), đặt con trỏ vào ô nhập
  useEffect(() => chatBridge.onVisible((v) => {
    if (!v || !activeRef.current) return;
    setUnread((u) => ({ ...u, [activeRef.current]: 0 }));
    if (!window.matchMedia?.('(pointer: coarse)').matches) requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }), []);

  return (
    <div className={`chat ${compact ? 'chat--compact' : ''} ${active ? 'has-active' : ''}`} ref={rootRef}>
      {/* ===== Danh sách phòng ===== */}
      <aside className="chat__side">
        {!compact && (
          <div className="chat__side-head">
            <h2>Tin nhắn</h2>
            <SocketStatus lang={lang} />
          </div>
        )}
        {compact && (
          <div className="chat__search">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm cuộc trò chuyện" aria-label="Tìm kiếm cuộc trò chuyện" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Xoá tìm kiếm">✕</button>}
          </div>
        )}
        <ul className="chat__rooms" role="listbox" aria-label="Phòng chat">
          {rooms.filter((r) => !search || plain(`${r.name} ${r.desc}`).includes(plain(search))).map((r) => {
            const last = (msgs[r.id] || []).at(-1);
            const n = unread[r.id] || 0;
            return (
              <li key={r.id}>
                <button type="button" role="option" aria-selected={r.id === active}
                  className={`chat__room ${r.id === active ? 'is-active' : ''}`} onClick={() => openRoom(r.id)}>
                  <span className="chat__room-icon" style={{ '--c': colorOf(r.id) }}>{r.icon}</span>
                  <span className="chat__room-body">
                    <span className="chat__room-top">
                      <b>{r.name}</b>
                      {last && <time>{timeOf(last.at)}</time>}
                    </span>
                    <span className="chat__room-last">
                      {last ? `${isMineMsg(last, me) ? 'Bạn' : last.name.split(' ').at(-1)}: ${last.text}` : r.desc}
                    </span>
                  </span>
                  {n > 0 && <span className="chat__badge" aria-label={`${n} tin chưa đọc`}>{n > 99 ? '99+' : n}</span>}
                </button>
              </li>
            );
          })}
          {!rooms.length && loading && [0, 1, 2].map((i) => <li key={i} className="chat__room-skel" />)}
        </ul>
        {!compact && <div className="chat__tools">
          <p className="chat__tools-title">Công cụ demo ({socket.mode})</p>
          <button type="button" className="cy-btn" onClick={notifyAll} disabled={!online}>📣 Gửi thông báo (toast) tới mọi tab</button>
          {socket.mode === 'mock' && (
            <>
              <button type="button" className="cy-btn" onClick={() => socket.simulateDrop(4000)} disabled={!online}>📡 Giả lập mất mạng 4 giây</button>
              <button type="button" className="cy-btn" onClick={() => window.open(window.location.href, '_blank')}>🗗 Mở thêm 1 tab để chat qua lại</button>
            </>
          )}
        </div>}
      </aside>

      {/* ===== Khung chat ===== */}
      <section className="chat__main" ref={mainRef} onPointerDown={engage} onFocus={engage}>
        {!active ? (
          <ChatEmpty unread={Object.values(unread).reduce((a, n) => a + n, 0)} online={online} status={status} />
        ) : (<>
        <header className="chat__head">
          <button type="button" className="chat__back" onClick={() => setActive(null)} title="Đóng cuộc trò chuyện" aria-label="Đóng cuộc trò chuyện">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span className="chat__room-icon chat__room-icon--lg" style={{ '--c': colorOf(active) }}>{room?.icon || '#'}</span>
          <div className="chat__head-text">
            <h3>{room?.name || '...'}</h3>
            <p>{pres.online.toLocaleString('vi-VN')} người đang xem{pres.large ? ' · phòng lớn' : ''}</p>
          </div>
          <div className="chat__members" aria-label="Thành viên">
            {roomMembers.slice(0, 5).map((m) => (
              <span key={m.user} className={`chat__avatar chat__avatar--sm ${m.online ? 'is-online' : ''}`}
                style={{ '--c': colorOf(m.user) }} title={`${m.name}${m.me || sameUser(m.user, me) ? ' (bạn)' : ''} – ${m.online ? 'đang hoạt động' : 'ngoại tuyến'}`}>
                {initials(m.name)}
              </span>
            ))}
          </div>
          {(socket.mode === 'mock' || user?.is_Admin) && (
            <button type="button" className="cy-btn chat__clear" onClick={clearHistory} title="Xoá lịch sử phòng (giả lập)">Xoá lịch sử</button>
          )}
        </header>

        {!online && status !== 'idle' && (
          <div className={`chat__banner chat__banner--${status}`} role="status">
            {status === 'disconnected' ? 'Mất kết nối máy chủ realtime – đang thử lại...' : 'Đang kết nối lại... tin nhắn sẽ được đồng bộ khi có mạng.'}
          </div>
        )}

        <MessageList key={active} list={list} me={me} loading={loading} hasMore={!!hasMore[active]} onLoadMore={loadMore}
          readers={readers} readLog={readLog[active]} onBottomChange={onBottomChange}
          onRetry={(m) => sendMsg(m.room, m.text, m.clientId)} />

        <div className="chat__typing" aria-live="polite">
          {typingNames.length > 0 && (
            <><span className="chat__dots"><i /><i /><i /></span>{typingNames.join(', ')} đang soạn tin...</>
          )}
        </div>

        <form className="chat__composer" onSubmit={submit}>
          <AutoTextarea inputRef={inputRef} value={text} onChange={onType} onEnter={submit} disabled={!online}
            placeholder={online ? `Nhắn tới ${room?.name || ''}... (Enter gửi, Shift+Enter xuống dòng)` : 'Đang chờ kết nối...'} />
          <button type="submit" className="chat__send" disabled={!online || !text.trim()} aria-label="Gửi">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" /><path d="M11.5 13.5L20 4" />
            </svg>
          </button>
        </form>
        </>)}
      </section>
    </div>
  );
}

/** Khung bên phải khi chưa mở cuộc trò chuyện nào */
function ChatEmpty({ unread, online, status }) {
  return (
    <div className="chat__none">
      <div className="chat__none-art" aria-hidden="true">
        <span className="chat__none-bubble chat__none-bubble--a" />
        <span className="chat__none-bubble chat__none-bubble--b" />
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" />
        </svg>
      </div>
      <h3>Chọn một cuộc trò chuyện</h3>
      <p>Chọn phòng ở danh sách bên trái để xem tin nhắn và bắt đầu trò chuyện.</p>
      {unread > 0 && <span className="chat__none-unread">{unread > 99 ? '99+' : unread} tin nhắn chưa đọc</span>}
      {!online && status !== 'idle' && <span className="chat__none-off">Đang kết nối máy chủ realtime...</span>}
    </div>
  );
}

/** Danh sách tin: gộp theo người + ngày, tự cuộn xuống khi có tin mới (nếu đang ở cuối) */
function MessageList({ list, me, loading, hasMore, onLoadMore, onRetry, readers = [], readLog = {}, onBottomChange }) {
  const ref = useRef(null);
  const atBottom = useRef(true);
  const lastKey = useRef(null);
  const keepFrom = useRef(null); // { height, top } trước khi chèn trang cũ lên đầu -> giữ nguyên vị trí đang đọc
  const [newBelow, setNewBelow] = useState(false);
  const [openKey, setOpenKey] = useState(null); // tin đang mở xem chi tiết thời gian

  const rows = useMemo(() => {
    const out = [];
    let prev = null;
    for (const m of list) {
      const day = dayOf(m.at);
      if (!prev || dayOf(prev.at) !== day) out.push({ kind: 'day', key: `d-${m.id}`, day });
      const first = !prev || prev.user !== m.user || dayOf(prev.at) !== day || new Date(m.at) - new Date(prev.at) > GROUP_GAP_MS;
      out.push({ kind: 'msg', key: m.clientId || m.id, m, first });
      prev = m;
    }
    return out;
  }, [list]);

  // "Đã xem" kiểu Messenger: avatar người đọc nằm dưới TIN CUỐI CÙNG họ đã đọc (tin của bất kỳ ai)
  const { seenAt, maxRead } = useMemo(() => {
    const at = new Map();
    let top = 0;
    for (const r of readers) {
      top = Math.max(top, r.seq);
      let target = null;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const s = list[i].seq;
        if (s && s <= r.seq) { target = list[i]; break; }
      }
      if (!target) continue;
      const key = target.clientId || target.id;
      at.set(key, [...(at.get(key) || []), r]);
    }
    return { seenAt: at, maxRead: top };
  }, [list, readers]);

  // Tin cuối cùng của mình: chưa ai xem -> hiện biểu tượng trạng thái (đang gửi / đã gửi) ở mép phải
  const lastMine = useMemo(() => [...list].reverse().find((x) => isMineMsg(x, me) && !x.failed), [list, me]);
  const lastMineKey = lastMine ? lastMine.clientId || lastMine.id : null;
  const lastMineSeen = !!lastMine?.seq && lastMine.seq <= maxRead;

  // Avatar "đã xem" TRƯỢT từ vị trí cũ xuống tin mới (FLIP) thay vì biến mất rồi hiện lại
  const readerPos = useRef(new Map()); // user -> vị trí lần render trước
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = new Map();
    root.querySelectorAll('[data-reader]').forEach((el) => {
      const id = el.dataset.reader;
      const r = el.getBoundingClientRect();
      const pos = { x: r.left, y: r.top + root.scrollTop, at: el.dataset.at };
      const old = readerPos.current.get(id);
      // chỉ trượt khi người đó chuyển sang TIN KHÁC (tải thêm tin cũ làm lệch vị trí thì không tính)
      if (old && old.at !== pos.at && el.animate) {
        el.animate(
          [{ transform: `translate(${old.x - pos.x}px, ${old.y - pos.y}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 420, easing: 'cubic-bezier(.22, .9, .3, 1)' },
        );
      }
      next.set(id, pos);
    });
    readerPos.current = next;
  }, [seenAt]);

  const setBottom = (v) => {
    if (atBottom.current === v) return;
    atBottom.current = v;
    onBottomChange?.(v);
  };
  useEffect(() => { onBottomChange?.(atBottom.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const last = list.at(-1);
    const key = last ? last.clientId || last.id : null;
    const appended = key !== lastKey.current;
    lastKey.current = key;

    if (keepFrom.current) {
      // vừa chèn tin cũ lên đầu: giữ nguyên chỗ đang đọc
      el.scrollTop = el.scrollHeight - keepFrom.current.height + keepFrom.current.top;
      keepFrom.current = null;
      return;
    }
    if (!appended) return;
    if (atBottom.current || isMineMsg(last, me)) {
      el.scrollTop = el.scrollHeight;
      setNewBelow(false);
      setBottom(true);
    } else {
      setNewBelow(true);
    }
  }, [list, me]);

  const onScroll = () => {
    const el = ref.current;
    setBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
    if (atBottom.current) setNewBelow(false);
    if (el.scrollTop < 80 && hasMore && !keepFrom.current) {
      keepFrom.current = { height: el.scrollHeight, top: el.scrollTop };
      Promise.resolve(onLoadMore()).finally(() => {
        // không có gì được chèn (lỗi / hết) -> bỏ mốc giữ vị trí
        requestAnimationFrame(() => { if (keepFrom.current && ref.current?.scrollHeight === keepFrom.current.height) keepFrom.current = null; });
      });
    }
  };

  return (
    <div className="chat__scroll-wrap">
      <div className="chat__list" ref={ref} onScroll={onScroll} role="log" aria-label="Tin nhắn">
        {hasMore && <div className="chat__more">Kéo lên để xem tin cũ hơn...</div>}
        {loading && !list.length && <div className="chat__empty">Đang tải tin nhắn...</div>}
        {!loading && !list.length && <div className="chat__empty">Chưa có tin nhắn. Hãy gửi lời chào 👋</div>}
        {rows.map((r) => (r.kind === 'day' ? (
          <div key={r.key} className="chat__day"><span>{r.day}</span></div>
        ) : (
          <Fragment key={r.key}>
            <Message m={r.m} mine={isMineMsg(r.m, me)} first={r.first} onRetry={onRetry}
              open={openKey === r.key} onToggle={() => setOpenKey((k) => (k === r.key ? null : r.key))} />
            {openKey === r.key && <MessageInfo m={r.m} mine={isMineMsg(r.m, me)} readers={readers} readLog={readLog} />}
            {seenAt.has(r.key) ? (
              <SeenBy readers={seenAt.get(r.key)} msgKey={r.key} known={readerPos.current} />
            ) : r.key === lastMineKey && !lastMineSeen ? (
              <SendState pending={!!r.m.pending} />
            ) : null}
          </Fragment>
        )))}
      </div>
      {newBelow && (
        <button type="button" className="chat__new" onClick={() => { const el = ref.current; el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }}>
          ↓ Tin nhắn mới
        </button>
      )}
    </div>
  );
}

function Message({ m, mine, first, open, onToggle, onRetry }) {
  return (
    <div className={`chat__msg ${mine ? 'is-mine' : ''} ${first ? 'is-first' : ''}`}>
      {!mine && (first
        ? <span className="chat__avatar" style={{ '--c': colorOf(m.user) }} title={m.name}>{initials(m.name)}</span>
        : <span className="chat__avatar-gap" />)}
      <div className="chat__bubble-wrap">
        {!mine && first && <span className="chat__name">{m.name}</span>}
        <div className={`chat__bubble ${m.pending ? 'is-pending' : ''} ${m.failed ? 'is-failed' : ''} ${open ? 'is-open' : ''}`}
          role="button" tabIndex={0} aria-expanded={open} title="Bấm để xem thời gian"
          onClick={() => { if (!window.getSelection()?.toString()) onToggle(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
          <span className="chat__text">{m.text}</span>
        </div>
        {m.failed && (
          <button type="button" className="chat__retry" onClick={() => onRetry(m)}>Gửi lỗi – bấm để gửi lại</button>
        )}
      </div>
    </div>
  );
}

const fullTime = (iso) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const today = new Date().toDateString() === d.toDateString();
  return today ? time : `${time}, ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
};

/** Thời điểm 1 người xem tin seq: lần đầu vị trí đọc của họ vượt qua seq (nhật ký), không có thì lấy lần đọc gần nhất */
const seenTime = (log = [], seq, fallback) => (log.find((x) => x.seq >= seq) || {}).at || fallback;

/**
 * Chi tiết khi bấm vào tin: thời gian gửi; tin của mình đã có người xem -> thêm thời gian xem
 * (1 người: "Đã xem lúc ..."; nhiều người: từng người kèm giờ).
 */
function MessageInfo({ m, mine, readers, readLog }) {
  const seenBy = mine && m.seq
    ? readers.filter((r) => r.seq >= m.seq)
      .map((r) => ({ ...r, seenAt: seenTime(readLog[r.user], m.seq, r.at) }))
      .sort((a, b) => new Date(a.seenAt) - new Date(b.seenAt))
    : [];
  return (
    <div className={`chat__info ${mine ? 'is-mine' : ''}`} role="status">
      <span>{m.pending ? 'Đang gửi...' : `Đã gửi lúc ${fullTime(m.at)}`}</span>
      {seenBy.length === 1 && <span className="chat__info-seen">Đã xem lúc {fullTime(seenBy[0].seenAt)}</span>}
      {seenBy.length > 1 && (
        <span className="chat__info-seen">
          Đã xem: {seenBy.map((r) => `${r.name} (${fullTime(r.seenAt)})`).join(', ')}
        </span>
      )}
    </div>
  );
}

/** Trạng thái tin cuối của mình khi CHƯA ai xem: ○ đang gửi, ✓ trong vòng tròn = đã gửi (giống Messenger) */
function SendState({ pending }) {
  const label = pending ? 'Đang gửi' : 'Đã gửi';
  return (
    <div className="chat__receipt" title={label} aria-label={label}>
      <svg className={`chat__state ${pending ? 'is-pending' : 'is-sent'}`} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
        {!pending && <path d="M5 8.3l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </div>
  );
}

/**
 * Avatar tròn nhỏ của người đã xem, sát mép phải dưới tin cuối cùng họ đọc (giống Messenger).
 * Nhiều người: xếp chồng nhẹ, tối đa 5 + "+N". Rê chuột: tên & giờ xem.
 * known: những người đã có avatar ở lần render trước -> chỉ người MỚI xem mới có hiệu ứng hiện ra
 * (người cũ đọc thêm thì avatar trượt xuống – xem FLIP trong MessageList).
 */
function SeenBy({ readers, msgKey, known }) {
  const sorted = [...readers].sort((a, b) => new Date(a.at) - new Date(b.at));
  const shown = sorted.slice(-5);
  const more = sorted.length - shown.length;
  const label = `Đã xem bởi ${sorted.map((r) => r.name).join(', ')}`;
  return (
    <div className="chat__receipt" aria-label={label}>
      {more > 0 && <span className="chat__seen-more" title={label}>+{more}</span>}
      {shown.map((r) => (
        <span key={r.user} data-reader={r.user} data-at={msgKey}
          className={`chat__seen-avatar ${known?.has(r.user) ? '' : 'is-new'}`}
          style={{ '--c': colorOf(r.user) }}
          title={`${r.name} đã xem lúc ${timeOf(r.at)}`}>
          {initials(r.name)}
        </span>
      ))}
    </div>
  );
}

/** Ô nhập tự giãn chiều cao, Enter = gửi, Shift+Enter = xuống dòng */
function AutoTextarea({ value, onChange, onEnter, inputRef, ...rest }) {
  const own = useRef(null);
  const ref = inputRef || own;
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el || !el.offsetWidth) return; // đang ẩn (display: none) -> đo sai, đợi hiện ra
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [ref]);
  useLayoutEffect(fit, [value, rest.placeholder, fit]);
  // Bề rộng đổi (khung chat nổi đang giãn ra 2 cột, đổi kích thước cửa sổ...) -> đo lại chiều cao.
  // Không đo lại thì lúc khung còn hẹp câu gợi ý xuống nhiều dòng -> ô nhập cao bất thường, để lại khoảng trắng.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let w = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth === w) return;
      w = el.offsetWidth;
      fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fit]);
  return (
    <textarea ref={ref} rows={1} className="chat__input" value={value} {...rest}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onEnter(); }
      }} />
  );
}
