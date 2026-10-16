import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { msgbox, toast } from '@/components/cyber';
import { socket, useSocketEvent, useSocketReady, useSocketStatus, SocketStatus } from '@/realtime';
import './chat.css';

/**
 * MÀN MẪU REALTIME: CHAT nhiều phòng.
 * Dùng socket dùng chung (src/realtime) – không tự mở kết nối, chỉ:
 *   - useSocketReady  : mỗi lần kết nối xong -> GetRooms + SubscribeRooms (nhận tin mọi phòng để đếm chưa đọc)
 *   - JoinRoom        : CHỈ phòng đang xem -> 1 trang lịch sử + người online; kéo lên đầu -> GetHistory trang cũ hơn
 *   - useSocketEvent  : ReceiveMessage / UserTyping / RoomPresence (chỉ phần thay đổi) / HistoryCleared
 *   - socket.invoke   : SendMessage, Typing, NotifyAll...
 * Thiết kế để chịu tải lớn: không tải lịch sử mọi phòng, phòng lớn không gửi "đang gõ" / danh sách người online.
 * Chế độ mock: mở thêm 1 tab trình duyệt để thấy tin nhắn đồng bộ giữa 2 tab.
 */

const TYPING_SHOW_MS = 3500; // "đang soạn tin" tự tắt sau chừng này nếu không có tín hiệu mới
const TYPING_SEND_MS = 2000; // gửi tín hiệu "đang gõ" tối đa 1 lần / khoảng này
const GROUP_GAP_MS = 5 * 60000; // tin cùng người cách nhau < 5 phút thì gộp nhóm

const AVATAR_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#8b5cf6', '#e0457b', '#0e9fb0', '#b7791f'];
const colorOf = (s = '') => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initials = (name = '') => name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase() || '?';
const timeOf = (iso) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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

const newClientId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function ChatPage() {
  const { user, lang } = useAuth();
  const me = user?.User_name || '';
  const status = useSocketStatus();
  const online = status === 'connected';

  const [rooms, setRooms] = useState([]);
  const [active, setActive] = useState('chung');
  const [msgs, setMsgs] = useState({});       // room -> danh sách tin
  const [presence, setPresence] = useState({}); // room -> { online, members, large }
  const [hasMore, setHasMore] = useState({});   // room -> còn tin cũ hơn để tải
  const [unread, setUnread] = useState({});   // room -> số tin chưa đọc
  const [typing, setTyping] = useState({});   // room -> { user: { name, until } }
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
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
    } catch { setLoading(false); /* lỗi đã hiện toast */ }
  });

  // ----- Vào phòng đang xem: 1 trang lịch sử mới nhất + người online. Đổi phòng -> thôi xem phòng cũ -----
  useEffect(() => {
    if (!ready || socket.status !== 'connected') return undefined;
    let alive = true;
    const room = active;
    setLoading(true);
    socket.invoke('JoinRoom', room).then((j) => {
      if (!alive) return;
      setMsgs((prev) => ({ ...prev, [room]: mergeHistory(prev[room], j.history) }));
      setHasMore((h) => ({ ...h, [room]: j.hasMore }));
      setPresence((p) => ({ ...p, [room]: { online: j.online, members: j.members || [], large: j.large } }));
    }).catch(() => {}).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      if (socket.status === 'connected') socket.invoke('LeaveRoom', room, false, socket.silent).catch(() => {});
    };
  }, [active, ready]);

  // Đóng màn -> huỷ đăng ký mọi phòng (không nhận tin chat nữa)
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  useEffect(() => () => {
    if (socket.status === 'connected') roomsRef.current.forEach((r) => socket.invoke('LeaveRoom', r.id, true, socket.silent).catch(() => {}));
  }, []);

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
    if (msg.room !== activeRef.current && msg.user !== me) {
      setUnread((u) => ({ ...u, [msg.room]: (u[msg.room] || 0) + 1 }));
    }
  });

  useSocketEvent('UserTyping', ({ room, user: u, name }) => {
    if (u === me) return;
    setTyping((prev) => ({ ...prev, [room]: { ...(prev[room] || {}), [u]: { name, until: Date.now() + TYPING_SHOW_MS } } }));
  });

  useSocketEvent('HistoryCleared', ({ room }) => setMsgs((prev) => ({ ...prev, [room]: [] })));

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
  const roomMembers = pres.members;

  return (
    <div className="chat">
      {/* ===== Danh sách phòng ===== */}
      <aside className="chat__side">
        <div className="chat__side-head">
          <h2>Tin nhắn</h2>
          <SocketStatus lang={lang} />
        </div>
        <ul className="chat__rooms" role="listbox" aria-label="Phòng chat">
          {rooms.map((r) => {
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
                      {last ? `${last.user === me ? 'Bạn' : last.name.split(' ').at(-1)}: ${last.text}` : r.desc}
                    </span>
                  </span>
                  {n > 0 && <span className="chat__badge" aria-label={`${n} tin chưa đọc`}>{n > 99 ? '99+' : n}</span>}
                </button>
              </li>
            );
          })}
          {loading && [0, 1, 2].map((i) => <li key={i} className="chat__room-skel" />)}
        </ul>
        <div className="chat__tools">
          <p className="chat__tools-title">Công cụ demo ({socket.mode})</p>
          <button type="button" className="cy-btn" onClick={notifyAll} disabled={!online}>📣 Gửi thông báo (toast) tới mọi tab</button>
          {socket.mode === 'mock' && (
            <>
              <button type="button" className="cy-btn" onClick={() => socket.simulateDrop(4000)} disabled={!online}>📡 Giả lập mất mạng 4 giây</button>
              <button type="button" className="cy-btn" onClick={() => window.open(window.location.href, '_blank')}>🗗 Mở thêm 1 tab để chat qua lại</button>
            </>
          )}
        </div>
      </aside>

      {/* ===== Khung chat ===== */}
      <section className="chat__main">
        <header className="chat__head">
          <span className="chat__room-icon chat__room-icon--lg" style={{ '--c': colorOf(active) }}>{room?.icon || '#'}</span>
          <div className="chat__head-text">
            <h3>{room?.name || '...'}</h3>
            <p>{pres.online.toLocaleString('vi-VN')} người đang xem{pres.large ? ' · phòng lớn' : ''}</p>
          </div>
          <div className="chat__members" aria-label="Thành viên">
            {roomMembers.slice(0, 5).map((m) => (
              <span key={m.user} className={`chat__avatar chat__avatar--sm ${m.online ? 'is-online' : ''}`}
                style={{ '--c': colorOf(m.user) }} title={`${m.name}${m.me || m.user === me ? ' (bạn)' : ''} – ${m.online ? 'đang hoạt động' : 'ngoại tuyến'}`}>
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
          onRetry={(m) => sendMsg(m.room, m.text, m.clientId)} />

        <div className="chat__typing" aria-live="polite">
          {typingNames.length > 0 && (
            <><span className="chat__dots"><i /><i /><i /></span>{typingNames.join(', ')} đang soạn tin...</>
          )}
        </div>

        <form className="chat__composer" onSubmit={submit}>
          <AutoTextarea value={text} onChange={onType} onEnter={submit} disabled={!online}
            placeholder={online ? `Nhắn tới ${room?.name || ''}... (Enter gửi, Shift+Enter xuống dòng)` : 'Đang chờ kết nối...'} />
          <button type="submit" className="chat__send" disabled={!online || !text.trim()} aria-label="Gửi">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" /><path d="M11.5 13.5L20 4" />
            </svg>
          </button>
        </form>
      </section>
    </div>
  );
}

/** Danh sách tin: gộp theo người + ngày, tự cuộn xuống khi có tin mới (nếu đang ở cuối) */
function MessageList({ list, me, loading, hasMore, onLoadMore, onRetry }) {
  const ref = useRef(null);
  const atBottom = useRef(true);
  const lastKey = useRef(null);
  const keepFrom = useRef(null); // { height, top } trước khi chèn trang cũ lên đầu -> giữ nguyên vị trí đang đọc
  const [newBelow, setNewBelow] = useState(false);

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
    if (atBottom.current || last?.user === me) {
      el.scrollTop = el.scrollHeight;
      setNewBelow(false);
    } else {
      setNewBelow(true);
    }
  }, [list, me]);

  const onScroll = () => {
    const el = ref.current;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
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
          <Message key={r.key} m={r.m} mine={r.m.user === me} first={r.first} onRetry={onRetry} />
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

function Message({ m, mine, first, onRetry }) {
  return (
    <div className={`chat__msg ${mine ? 'is-mine' : ''} ${first ? 'is-first' : ''}`}>
      {!mine && (first
        ? <span className="chat__avatar" style={{ '--c': colorOf(m.user) }} title={m.name}>{initials(m.name)}</span>
        : <span className="chat__avatar-gap" />)}
      <div className="chat__bubble-wrap">
        {!mine && first && <span className="chat__name">{m.name}</span>}
        <div className={`chat__bubble ${m.pending ? 'is-pending' : ''} ${m.failed ? 'is-failed' : ''}`}>
          <span className="chat__text">{m.text}</span>
          <span className="chat__meta">
            {timeOf(m.at)}
            {mine && (m.pending ? ' · đang gửi' : m.failed ? '' : ' · ✓')}
          </span>
        </div>
        {m.failed && (
          <button type="button" className="chat__retry" onClick={() => onRetry(m)}>Gửi lỗi – bấm để gửi lại</button>
        )}
      </div>
    </div>
  );
}

/** Ô nhập tự giãn chiều cao, Enter = gửi, Shift+Enter = xuống dòng */
function AutoTextarea({ value, onChange, onEnter, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);
  return (
    <textarea ref={ref} rows={1} className="chat__input" value={value} {...rest}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onEnter(); }
      }} />
  );
}
