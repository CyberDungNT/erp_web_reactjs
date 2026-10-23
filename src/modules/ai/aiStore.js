import { useSyncExternalStore } from 'react';

/**
 * Trạng thái "Hỏi AI" dùng chung (ngoài component -> đóng khung rồi mở lại vẫn còn cuộc trò chuyện).
 * Chỉ nằm trong BỘ NHỚ của tab: tải lại trang / đổi tài khoản là mất (không lưu localStorage).
 *
 *   aiStore.open() / close() / toggle()      mở / đóng khung trợ lý (menu avatar "Hỏi AI", phím Ctrl + /)
 *   useAiState() -> { open, owner, busy, messages: [{ id, role, content, status: 'streaming' | 'done' | 'stopped' }] }
 */
let state = { open: false, owner: '', busy: false, messages: [] };
const subs = new Set();
let seq = 0;

const set = (patch) => {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach((fn) => fn());
};

export function useAiState() {
  return useSyncExternalStore((fn) => { subs.add(fn); return () => subs.delete(fn); }, () => state);
}

export const aiStore = {
  get: () => state,
  open: () => set({ open: true }),
  close: () => set({ open: false }),
  toggle: () => set((s) => ({ open: !s.open })),

  /** Cuộc trò chuyện thuộc về tài khoản nào – đổi tài khoản thì xoá */
  setOwner(owner) {
    if (state.owner !== owner) set({ owner, messages: [], busy: false });
  },
  clear: () => set({ messages: [], busy: false }),

  /** Thêm câu hỏi + ô trả lời trống (đang chạy) -> trả id ô trả lời */
  start(question) {
    const q = { id: ++seq, role: 'user', content: question, status: 'done' };
    const a = { id: ++seq, role: 'assistant', content: '', status: 'streaming' };
    set((s) => ({ busy: true, messages: [...s.messages, q, a] }));
    return { qid: q.id, aid: a.id };
  },
  append(id, text) {
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)) }));
  },
  finish(id, status = 'done') {
    set((s) => ({ busy: false, messages: s.messages.map((m) => (m.id === id ? { ...m, status } : m)) }));
  },
  /** Bỏ câu hỏi + câu trả lời lỗi (để hỏi lại) */
  drop(...ids) {
    set((s) => ({ busy: false, messages: s.messages.filter((m) => !ids.includes(m.id)) }));
  },
};
