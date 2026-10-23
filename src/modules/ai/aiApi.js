import { apiConfig } from '@/api/apiClient';

/**
 * GỌI "HỎI AI" – POST /api/Ai/chat (API_App_Demo/Ai/AiController.cs), trả lời dạng luồng (text/event-stream).
 *
 *   await askAi({ token, lang, messages, context, signal, onDelta: (text) => ... });
 *     messages  [{ role: 'user' | 'assistant', content }] – câu cuối là câu hỏi
 *     context   { screen: { id, title }, menus: [{ id, path }] } – màn đang mở + chức năng người dùng được dùng
 *     signal    AbortController.signal – bấm Dừng
 *     onDelta   nhận từng đoạn chữ trả lời
 * Lỗi -> throw Error (message tiếng Việt, hiện toast). Dừng giữa chừng -> throw AbortError.
 * VITE_USE_MOCK=true -> trả lời giả (src/api/mock/ai.js), không gọi máy chủ.
 */
export const AI_URL = `${apiConfig.BASE_URL}/api/Ai/chat`;

export async function askAi({ token, lang, messages, context, signal, onDelta }) {
  if (apiConfig.USE_MOCK) {
    const { mockAskAi } = await import('@/api/mock/ai');
    return mockAskAi({ messages, context, signal, onDelta });
  }

  let resp;
  try {
    resp = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ token, lang, messages, context }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Không kết nối được máy chủ: ' + err.message);
  }

  if (!resp.ok || !resp.body) {
    let msg = `Lỗi HTTP ${resp.status}`;
    try { msg = (await resp.json())?.message || msg; } catch { /* không phải JSON */ }
    throw new Error(msg);
  }

  // Đọc luồng: các sự kiện "data: {json}" cách nhau bằng dòng trống
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let done = false;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (ev.t === 'delta' && ev.text) onDelta?.(ev.text);
        else if (ev.t === 'error') throw new Error(ev.message || 'Trợ lý AI gặp lỗi.');
        else if (ev.t === 'done') done = true;
      }
    }
  }
  if (!done) throw new Error('Mất kết nối khi đang nhận câu trả lời.');
}

/**
 * Danh sách chức năng (lá của menu trái + menu trên) để trợ lý chỉ đường: [{ id, path: 'Kế toán › Tiền mặt › Phiếu thu' }]
 */
export function menuCatalog(trees) {
  const out = new Map();
  const clean = (t) => String(t || '').replace(/&(?!&)/g, '').trim();
  const walk = (nodes, trail) => {
    for (const n of nodes || []) {
      if (!n || n.separator) continue;
      const text = clean(n.text);
      const path = text ? [...trail, text] : trail;
      if (n.children?.length) walk(n.children, path);
      else if (n.id && text && !out.has(n.id)) out.set(n.id, { id: n.id, path: path.join(' › ') });
    }
  };
  trees.forEach((t) => walk(t, []));
  return [...out.values()];
}
