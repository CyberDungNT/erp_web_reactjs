/**
 * "SERVER" GIẢ LẬP – các hàm web gọi bằng socket.invoke('Ten', ...). Tên & tham số trùng hub thật (API_App_Demo/Realtime/AppHub.cs)
 * để đổi sang server thật không phải sửa màn hình.
 * ctx: { connectionId, user, name, groups, publish(event, args, { group, except, to }) }
 */

const HISTORY_MAX = 500;
const PAGE = 30; // số tin mỗi trang lịch sử (server thật: Realtime:ChatHistoryLimit)

const ROOMS = [
  { id: 'chung', name: 'Phòng chung', icon: '#', desc: 'Trao đổi chung toàn công ty' },
  { id: 'ke-toan', name: 'Kế toán', icon: '₫', desc: 'Nhóm phòng kế toán' },
  { id: 'tro-ly', name: 'Trợ lý ảo', icon: '✦', desc: 'Hỏi nhanh: doanh thu, tồn kho, mấy giờ...' },
];

// Người giả lập trong từng phòng (online = đang hoạt động)
const PEOPLE = {
  an: { user: 'an.nv', name: 'Nguyễn Văn An', online: true },
  binh: { user: 'binh.tt', name: 'Trần Thị Bình', online: true },
  hoa: { user: 'hoa.lt', name: 'Lê Thị Hoa', online: true },
  dung: { user: 'dung.pm', name: 'Phạm Minh Dũng', online: false },
  bot: { user: 'bot', name: 'Trợ lý ảo', online: true, bot: true },
};
const ROOM_PEOPLE = { chung: ['an', 'binh', 'dung'], 'ke-toan': ['hoa', 'dung'], 'tro-ly': ['bot'] };

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const SEED = {
  chung: [
    { user: 'an.nv', name: 'Nguyễn Văn An', text: 'Chào cả nhà, sáng nay họp giao ban lúc 9h nhé 👋', at: minutesAgo(180) },
    { user: 'binh.tt', name: 'Trần Thị Bình', text: 'Ok anh, em chuẩn bị số liệu bán hàng tuần trước.', at: minutesAgo(176) },
    { user: 'an.nv', name: 'Nguyễn Văn An', text: 'Nhớ gửi kèm báo cáo tồn kho chi nhánh HCM nữa nha.', at: minutesAgo(175) },
  ],
  'ke-toan': [
    { user: 'hoa.lt', name: 'Lê Thị Hoa', text: 'Cuối tháng khoá sổ ngày 31, mọi người hoàn thiện chứng từ trước 17h giúp mình.', at: minutesAgo(60 * 26) },
  ],
  'tro-ly': [
    { user: 'bot', name: 'Trợ lý ảo', text: 'Xin chào! Mình là trợ lý ảo (giả lập). Thử hỏi: "doanh thu", "tồn kho", "mấy giờ rồi".', at: minutesAgo(5) },
  ],
};

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Kho: { seq: số thứ tự tin cuối, rooms: { room: [tin] } } – seq tăng dần dùng để tải trang cũ hơn (giống Id trong SQL) */
let memory = null; // giữ trong bộ nhớ của tab – không lưu localStorage (xem utils/storage.js). Tab khác nhận tin qua BroadcastChannel.
function load() {
  if (memory) return memory;
  memory = { seq: 0, rooms: {} };
  for (const [room, list] of Object.entries(SEED)) {
    memory.rooms[room] = list.map((m) => ({ ...m, id: newId(), seq: ++memory.seq, room }));
  }
  return memory;
}
function save(store) { memory = store; }
function append(msg) {
  const store = load();
  const saved = { ...msg, seq: ++store.seq };
  store.rooms[msg.room] = [...(store.rooms[msg.room] || []), saved].slice(-HISTORY_MAX);
  save(store);
  return saved;
}
/** 1 trang lịch sử: beforeSeq = null -> mới nhất; có giá trị -> các tin cũ hơn */
function page(room, beforeSeq) {
  const all = load().rooms[room] || [];
  const older = beforeSeq ? all.filter((x) => x.seq < beforeSeq) : all;
  return { room, history: withReactions(older.slice(-PAGE)), hasMore: older.length > PAGE };
}

const roomGroup = (room) => `chat:${room}`;

// ----- Tắt thông báo: user -> phòng -> hết tắt lúc (ms) (bộ nhớ tab) -----
const mutes = {};

// ----- Cảm xúc: messageId -> [{ emoji, users: [{ user, name }] }] (bộ nhớ tab) -----
const reactions = {};
const ALLOWED_REACTIONS = ['👍', '❤️', '😆', '😮', '😭', '😡', '🙏', '🎉'];
function toggle(messageId, emoji, user, name) {
  const list = (reactions[messageId] || []).map((g) => ({ ...g, users: [...g.users] }));
  let g = list.find((x) => x.emoji === emoji);
  if (!g) { g = { emoji, users: [] }; list.push(g); }
  const i = g.users.findIndex((u) => u.user === user);
  const added = i < 0;
  if (added) g.users.push({ user, name }); else g.users.splice(i, 1);
  reactions[messageId] = list.filter((x) => x.users.length);
  return { list: reactions[messageId], added };
}
/** Sự kiện MessageReactions giống server thật: kèm người thả, người viết tin, trích nội dung */
function reactionEvent(room, messageId, emoji, actor, result) {
  const msg = (load().rooms[room] || []).find((m) => m.id === messageId);
  return { room, messageId, reactions: result.list, actor, emoji, added: result.added, author: msg?.user, preview: msg?.text?.slice(0, 120) };
}
const withReactions = (list) => list.map((m) => (reactions[m.id] ? { ...m, reactions: reactions[m.id] } : m));

// ----- Đã xem: phòng -> user -> { room, user, name, seq, at } (bộ nhớ tab) -----
const reads = {};
function markRead(room, user, name, seq) {
  const r = (reads[room] ||= {});
  if ((r[user]?.seq || 0) >= seq) return null;
  r[user] = { room, user, name, seq, at: new Date().toISOString() };
  return r[user];
}

/** Đồng nghiệp giả lập đang online "đọc" tin vừa gửi sau 1-3 giây (để demo trạng thái đã xem) */
function simulateRead(ctx, room, seq) {
  const people = (ROOM_PEOPLE[room] || []).map((k) => PEOPLE[k]).filter((p) => p.online);
  people.forEach((p) => {
    setTimeout(() => {
      const state = markRead(room, p.user, p.name, seq);
      if (state) ctx.publish('MessagesRead', [state], { group: roomGroup(room) });
    }, 900 + Math.random() * 2200);
  });
}

/** Đồng nghiệp giả lập thỉnh thoảng thả cảm xúc vào tin vừa gửi (để demo) */
function simulateReaction(ctx, room, messageId) {
  const people = (ROOM_PEOPLE[room] || []).map((k) => PEOPLE[k]).filter((p) => p.online && !p.bot);
  if (!people.length || Math.random() > 0.45) return;
  const p = people[Math.floor(Math.random() * people.length)];
  const emoji = ['👍', '❤️', '😆', '🎉'][Math.floor(Math.random() * 4)];
  setTimeout(() => {
    const evt = reactionEvent(room, messageId, emoji, { user: p.user, name: p.name }, toggle(messageId, emoji, p.user, p.name));
    ctx.publish('MessageReactions', [evt], { group: roomGroup(room) });
  }, 2500 + Math.random() * 2500);
}
const members = (ctx, room) => [
  { user: ctx.user, name: ctx.name, online: true, me: true },
  ...(ROOM_PEOPLE[room] || []).map((k) => ({ ...PEOPLE[k] })),
];

/** Câu trả lời của trợ lý ảo */
function botAnswer(text) {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  if (/chao|hello|hi\b/.test(t)) return 'Chào bạn 😊 Mình có thể giúp gì?';
  if (/doanh thu/.test(t)) return 'Doanh thu tháng này (giả lập): 12,4 tỷ – tăng 8,2% so với tháng trước. Chi nhánh HCM dẫn đầu.';
  if (/ton kho|ton/.test(t)) return 'Tồn kho hiện tại (giả lập): 1.284 mã hàng, 37 mã dưới mức tồn tối thiểu.';
  if (/may gio|gio/.test(t)) return `Bây giờ là ${new Date().toLocaleTimeString('vi-VN')}.`;
  if (/cam on|thanks/.test(t)) return 'Không có gì nhé!';
  return `Mình đã nhận: "${text.slice(0, 80)}". (Đây là trợ lý giả lập – thử hỏi "doanh thu" hoặc "tồn kho".)`;
}
const COLLEAGUE_REPLIES = ['Ok nhé 👍', 'Mình nhận được rồi.', 'Để mình kiểm tra lại rồi báo bạn.', 'Chuẩn luôn!', 'Cảm ơn bạn nhiều 🙏', 'Chiều nay mình gửi nhé.'];

/** Người khác trong phòng gõ rồi trả lời (chỉ để demo có hội thoại) */
function simulateReply(ctx, room, text) {
  let who;
  let reply;
  if (room === 'tro-ly') {
    who = PEOPLE.bot;
    reply = botAnswer(text);
  } else {
    const online = (ROOM_PEOPLE[room] || []).map((k) => PEOPLE[k]).filter((p) => p.online);
    if (!online.length || Math.random() < 0.4) return;
    who = online[Math.floor(Math.random() * online.length)];
    reply = COLLEAGUE_REPLIES[Math.floor(Math.random() * COLLEAGUE_REPLIES.length)];
  }
  const group = roomGroup(room);
  setTimeout(() => ctx.publish('UserTyping', [{ room, user: who.user, name: who.name }], { group }), 500);
  setTimeout(() => {
    const msg = append({ id: newId(), room, user: who.user, name: who.name, text: reply, at: new Date().toISOString() });
    ctx.publish('ReceiveMessage', [msg], { group });
  }, 1600 + Math.random() * 900);
}

export const mockHub = {
  // ===== Dùng chung =====
  JoinGroup(ctx, group) { ctx.groups.add(group); return true; },
  LeaveGroup(ctx, group) { ctx.groups.delete(group); return true; },

  /** Gửi thông báo cho mọi người (server thật thường tự đẩy 'Notify' từ nghiệp vụ, không cho client gọi) */
  NotifyAll(ctx, title, message, type = 'info') {
    ctx.publish('Notify', [{ title, message, type, from: ctx.name }]);
    return true;
  },

  // ===== Chat =====
  /** Phòng kèm mutedUntil (đang tắt thông báo) của riêng user */
  GetRooms(ctx) { return ROOMS.map((r) => (mutes[ctx.user]?.[r.id] > Date.now() ? { ...r, mutedUntil: new Date(mutes[ctx.user][r.id]).toISOString() } : r)); },

  /** Tắt thông báo: minutes > 0 trong chừng ấy phút, -1 đến khi bật lại, 0 bật lại */
  SetMute(ctx, room, minutes) {
    const until = minutes === 0 ? null : minutes < 0 ? Date.UTC(9999, 11, 31) : Date.now() + minutes * 60000;
    mutes[ctx.user] ||= {};
    if (until) mutes[ctx.user][room] = until; else delete mutes[ctx.user][room];
    const evt = { room, mutedUntil: until ? new Date(until).toISOString() : null };
    ctx.publish('RoomMuteChanged', [evt], { to: ctx.user });
    return evt;
  },

  /** Chỉ nhận tin các phòng (đếm chưa đọc) – không tải lịch sử */
  SubscribeRooms(ctx, rooms = []) {
    rooms.forEach((r) => ctx.groups.add(roomGroup(r)));
    return rooms;
  },

  /** Đang xem phòng: 1 trang lịch sử mới nhất + người online */
  JoinRoom(ctx, room) {
    ctx.groups.add(roomGroup(room));
    const list = members(ctx, room);
    return {
      ...page(room, null), online: list.filter((x) => x.online).length, members: list, large: false,
      reads: Object.values(reads[room] || {}),
    };
  },

  /** Tải trang cũ hơn (kéo lên đầu khung chat) */
  GetHistory(ctx, room, beforeSeq) { return page(room, beforeSeq); },

  LeaveRoom(ctx, room, unsubscribe = false) {
    if (unsubscribe) ctx.groups.delete(roomGroup(room));
    return true;
  },

  SendMessage(ctx, room, text, clientId) {
    const body = String(text ?? '').trim();
    if (!body) throw new Error('Tin nhắn trống.');
    if (body.length > 2000) throw new Error('Tin nhắn quá dài (tối đa 2000 ký tự).');
    const msg = append({ id: newId(), clientId, room, user: ctx.user, name: ctx.name, text: body, at: new Date().toISOString() });
    ctx.publish('ReceiveMessage', [msg], { group: roomGroup(room) });
    simulateRead(ctx, room, msg.seq);
    simulateReaction(ctx, room, msg.id);
    simulateReply(ctx, room, body);
    return msg;
  },

  /** Thả / bỏ cảm xúc vào tin */
  React(ctx, room, messageId, emoji) {
    if (!ALLOWED_REACTIONS.includes(emoji)) throw new Error('Cảm xúc không hợp lệ.');
    if (!(load().rooms[room] || []).some((m) => m.id === messageId)) throw new Error('Tin nhắn không còn trong phòng này.');
    const evt = reactionEvent(room, messageId, emoji, { user: ctx.user, name: ctx.name }, toggle(messageId, emoji, ctx.user, ctx.name));
    ctx.publish('MessageReactions', [evt], { group: roomGroup(room) });
    return evt;
  },

  /** Đã xem tới tin seq – báo cho cả phòng khi vị trí đọc tiến lên */
  MarkRead(ctx, room, seq) {
    const state = markRead(room, ctx.user, ctx.name, Number(seq) || 0);
    if (state) ctx.publish('MessagesRead', [state], { group: roomGroup(room) });
    return !!state;
  },

  /** Báo "đang gõ" cho người khác trong phòng (không gửi lại cho chính mình) */
  Typing(ctx, room) {
    ctx.publish('UserTyping', [{ room, user: ctx.user, name: ctx.name }], { group: roomGroup(room), except: ctx.connectionId });
    return true;
  },

  /** Xoá lịch sử giả lập (nút trong màn demo) */
  ClearHistory(ctx, room) {
    const store = load();
    store.rooms[room] = [];
    save(store);
    delete reads[room];
    ctx.publish('HistoryCleared', [{ room }], { group: roomGroup(room) });
    return true;
  },
};
