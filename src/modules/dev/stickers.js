/**
 * BIỂU TƯỢNG CẢM XÚC (emoji) + NHÃN DÁN (sticker) cho chat.
 *
 * Nhãn dán gửi đi là 1 tin nhắn văn bản dạng mã:  [sticker:<bộ>/<mã>]   vd [sticker:cong-viec/ok]
 *   -> server KHÔNG cần sửa gì (lưu như tin thường); web nhận ra mã và vẽ nhãn dán.
 * Thêm nhãn dán: thêm phần tử vào STICKER_PACKS (mã chỉ gồm chữ thường, số, dấu gạch ngang).
 */

export const EMOJI_GROUPS = [
  { id: 'mat-cuoi', name: 'Mặt cười', icon: '😀', list: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬' },
  { id: 'cu-chi', name: 'Cử chỉ', icon: '👍', list: '👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 👏 🙌 👐 🤲 💪 ✍️ 🫶 👀 🧠' },
  { id: 'trai-tim', name: 'Trái tim', icon: '❤️', list: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 💬 💭 💤' },
  { id: 'cong-viec', name: 'Công việc', icon: '💼', list: '💼 📁 📂 📄 📃 📑 📊 📈 📉 🗂️ 📅 📆 🗓️ 📌 📍 📎 🖇️ ✏️ 📝 🖊️ 📞 ☎️ 📱 💻 🖥️ 🖨️ ⌨️ 🖱️ 💾 📧 📨 📬 🔔 ⏰ ⏳ ⌛ ✅ ☑️ ❌ ⚠️ ❗ ❓ 💡 🔑 🔒 💰 💵 🧾 🏢 🚗 🚚 📦' },
  { id: 'vui', name: 'Ăn mừng', icon: '🎉', list: '🎉 🎊 🎈 🎁 🏆 🥇 🎂 🍰 🍾 🥂 🍻 ☕ 🍵 🍜 🍕 🍔 🍟 🍦 🍩 🍪 🍫 🍎 🍉 🌸 🌹 🌻 🌈 ☀️ 🌙 ⭐ 🔥 ⚡ ❄️ 🎵 🎶 ⚽ 🏀 🎮 ✈️ 🏖️' },
].map((g) => ({ ...g, list: g.list.split(' ') }));

export const STICKER_PACKS = [
  {
    id: 'cam-xuc', name: 'Cảm xúc', icon: '😍',
    items: [
      { id: 'vui', e: '😄' }, { id: 'cuoi', e: '😂' }, { id: 'yeu', e: '😍' }, { id: 'thuong', e: '🥰' },
      { id: 'ngau', e: '😎' }, { id: 'nghi', e: '🤔' }, { id: 'buon', e: '😢' }, { id: 'khoc', e: '😭' },
      { id: 'gian', e: '😡' }, { id: 'ngu', e: '😴' }, { id: 'soc', e: '🤯' }, { id: 'tiec', e: '🥳' },
    ],
  },
  {
    id: 'cong-viec', name: 'Công việc', icon: '👍',
    items: [
      { id: 'ok', e: '👍', t: 'OK nhé' }, { id: 'cam-on', e: '🙏', t: 'Cảm ơn' }, { id: 'xong', e: '✅', t: 'Đã xong' },
      { id: 'cho', e: '⏰', t: 'Chờ chút' }, { id: 'goi', e: '📞', t: 'Gọi mình' }, { id: 'gap', e: '🔥', t: 'Gấp!' },
      { id: 'co-len', e: '💪', t: 'Cố lên' }, { id: 'tuyet', e: '👏', t: 'Tuyệt vời' }, { id: 'chuc-mung', e: '🎉', t: 'Chúc mừng' },
      { id: 'bao-cao', e: '📊', t: 'Gửi báo cáo' }, { id: 'nghi', e: '☕', t: 'Giải lao' }, { id: 'hop', e: '🤝', t: 'Hợp tác' },
    ],
  },
];

const STICKER_RE = /^\[sticker:([a-z0-9-]+)\/([a-z0-9-]+)\]$/;

/** Mã tin nhắn của 1 nhãn dán */
export const encodeSticker = (pack, id) => `[sticker:${pack}/${id}]`;

/** Tin nhắn là nhãn dán? -> { pack, item } | null */
export function parseSticker(text) {
  const m = STICKER_RE.exec(String(text ?? '').trim());
  if (!m) return null;
  const pack = STICKER_PACKS.find((p) => p.id === m[1]);
  const item = pack?.items.find((i) => i.id === m[2]);
  return item ? { pack: pack.id, item } : { pack: m[1], item: { id: m[2], e: '🖼️', t: 'Nhãn dán' } }; // bộ cũ / chưa có -> vẫn hiện
}

/** Nội dung hiển thị ngắn (danh sách phòng, popup thông báo) */
export function previewText(text) {
  const s = parseSticker(text);
  if (s) return `[Nhãn dán] ${s.item.e}${s.item.t ? ` ${s.item.t}` : ''}`;
  return text;
}

// 1 emoji = ký tự hình (+ màu da / FE0F) (+ các phần ghép bằng ZWJ, vd 👨‍💻)
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️)?(?:‍\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️)?)*\s*){1,3}$/u;
/** Tin chỉ gồm 1–3 emoji -> hiện to (giống Zalo) */
export const isJumboEmoji = (text) => !!text && text.length <= 24 && EMOJI_ONLY.test(text.trim());

// ----- Cảm xúc thả vào tin nhắn (khớp Realtime:Reactions phía server) -----
export const REACTIONS = [
  { e: '👍', name: 'Thích' }, { e: '❤️', name: 'Yêu thích' }, { e: '😆', name: 'Haha' }, { e: '😮', name: 'Wow' },
  { e: '😭', name: 'Buồn' }, { e: '😡', name: 'Phẫn nộ' }, { e: '🙏', name: 'Cảm ơn' }, { e: '🎉', name: 'Chúc mừng' },
];

/**
 * Bật / tắt 1 cảm xúc của user trên danh sách reactions [{ emoji, users: [{ user, name }] }] – dùng để hiện ngay
 * (server gửi lại MessageReactions là bản chuẩn).
 */
export function toggleReaction(reactions, emoji, user, name, same = (a, b) => a === b) {
  // server trả reactions: null khi tin chưa có cảm xúc (giá trị mặc định "= []" không áp dụng cho null)
  const list = (Array.isArray(reactions) ? reactions : []).map((g) => ({ ...g, users: [...(g.users || [])] }));
  const g = list.find((x) => x.emoji === emoji);
  if (!g) return [...list, { emoji, users: [{ user, name }] }];
  const i = g.users.findIndex((u) => same(u.user, user));
  if (i >= 0) g.users.splice(i, 1); else g.users.push({ user, name });
  return list.filter((x) => x.users.length);
}

// Emoji dùng gần đây – chỉ giữ trong bộ nhớ tab (không lưu localStorage: xem utils/storage.js)
let recent = [];
export const getRecentEmoji = () => recent;
export function pushRecentEmoji(e) {
  recent = [e, ...recent.filter((x) => x !== e)].slice(0, 16);
}
