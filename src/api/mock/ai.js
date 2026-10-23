/**
 * TRẢ LỜI GIẢ cho "Hỏi AI" khi VITE_USE_MOCK=true (không gọi máy chủ / Claude).
 * Tìm chức năng khớp câu hỏi trong danh sách menu gửi lên -> trả lời Markdown có nút mở chức năng, chữ hiện dần như thật.
 * Câu hỏi có chữ "lỗi" -> giả lập lỗi máy chủ (để thử toast + Hỏi lại).
 */
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const STOP = new Set(['o', 'chuc', 'nang', 'nao', 'cach', 'lam', 'the', 'gi', 'de', 'va', 'cua', 'cho', 'toi', 'minh', 'la', 'co', 'khong', 'nhu', 'huong', 'dan', 'dung', 'man']);

function findMenus(question, menus) {
  const words = norm(question).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w));
  if (!words.length) return [];
  return (menus || [])
    .map((m) => {
      const leaf = norm(m.path.split('›').pop());
      const all = norm(m.path);
      const score = words.reduce((s, w) => s + (leaf.includes(w) ? 3 : all.includes(w) ? 1 : 0), 0);
      return { ...m, score };
    })
    .filter((m) => m.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function answer(question, context) {
  const hits = findMenus(question, context?.menus);
  const name = (m) => m.path.split('›').pop().trim();
  if (/huong dan dung man/.test(norm(question)) && context?.screen?.id) {
    const s = context.screen;
    return [
      `Màn **${s.title}** dùng để nhập và theo dõi dữ liệu của nghiệp vụ này. Các bước thường dùng:`,
      '',
      '1. Bấm **Mới** (F4) để thêm, hoặc chọn 1 dòng rồi bấm **Sửa** (F3).',
      '2. Nhập các ô bắt buộc (có dấu \\*), các ô mã có thể gõ vài chữ rồi chọn trong danh sách thả xuống.',
      '3. Bấm **Lưu** (Ctrl+S). Lỗi nhập liệu sẽ được báo ngay trên màn hình.',
      '',
      `> Mở lại màn: [${s.title}](menu:${s.id})`,
      '',
      '_(Đây là câu trả lời mẫu – chế độ dữ liệu giả, chưa nối AI thật.)_',
    ].join('\n');
  }
  if (hits.length) {
    return [
      `Bạn có thể dùng ${hits.length > 1 ? 'các chức năng sau' : 'chức năng'}:`,
      '',
      ...hits.map((m) => `- [${name(m)}](menu:${m.id}) – nằm ở **${m.path}**`),
      '',
      'Các bước chung:',
      '',
      `1. Bấm vào nút **${name(hits[0])}** ở trên để mở chức năng.`,
      '2. Bấm **Mới**, nhập thông tin chứng từ: ngày, đối tượng, diễn giải, số tiền.',
      '3. Kiểm tra lại rồi bấm **Lưu**.',
      '',
      '| Phím | Việc |',
      '|---|---|',
      '| F4 | Thêm mới |',
      '| Ctrl+S | Lưu |',
      '',
      '_(Câu trả lời mẫu – chế độ dữ liệu giả, chưa nối AI thật.)_',
    ].join('\n');
  }
  return [
    `Câu hỏi: **${question.slice(0, 120)}**`,
    '',
    'Đây là chế độ **dữ liệu giả** nên trợ lý chưa trả lời thật. Khi nối máy chủ (`VITE_USE_MOCK=false`) và cấu hình `ANTHROPIC_API_KEY` trên API, câu hỏi sẽ được gửi tới Claude.',
    '',
    'Bạn có thể thử hỏi tên 1 chức năng có trong menu, ví dụ: _"phiếu thu ở đâu?"_ – trợ lý giả sẽ tìm và đưa nút mở chức năng.',
  ].join('\n');
}

const wait = (ms, signal) => new Promise((resolve, reject) => {
  const id = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Đã dừng', 'AbortError')); }, { once: true });
});

export async function mockAskAi({ messages, context, signal, onDelta }) {
  const question = messages[messages.length - 1]?.content || '';
  await wait(700, signal); // "đang suy nghĩ"
  if (/\bloi\b/.test(norm(question))) throw new Error('Dịch vụ AI đang gặp sự cố, thử lại sau. (lỗi giả lập)');
  const text = answer(question, context);
  for (let i = 0; i < text.length;) {
    const n = 2 + Math.floor(Math.random() * 6);
    onDelta(text.slice(i, i + n));
    i += n;
    await wait(18, signal);
  }
}
