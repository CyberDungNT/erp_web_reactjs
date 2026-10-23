import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from '@/components/cyber';
import Icon from '@/components/icons/Icon';
import { useAuth } from '@/auth/AuthContext';
import { useMain } from '@/layouts/MainLayout';
import AiMarkdown from './AiMarkdown';
import { askAi, menuCatalog } from './aiApi';
import { aiStore, useAiState } from './aiStore';
import './ai.css';

const CLOSE_MS = 240;     // khớp .ai-panel.is-closing trong ai.css
const MOBILE_MAX_W = 640; // hẹp hơn -> phủ toàn màn hình
const STICK_PX = 80;      // đang ở gần đáy (trong khoảng này) -> chữ mới tới thì tự cuộn theo

const T = {
  V: {
    title: 'Trợ lý AI',
    sub: 'Hỏi cách dùng phần mềm, nghiệp vụ, thao tác',
    hello: (n) => `Xin chào${n ? ` ${n}` : ''}, tôi có thể giúp gì?`,
    helloSub: 'Tôi chỉ đúng chức năng cần dùng (bấm vào là mở), giải thích nghiệp vụ kế toán – bán hàng – kho, và hỗ trợ việc văn phòng.',
    screenTip: (t) => `Hướng dẫn dùng màn "${t}"`,
    tips: ['Lập phiếu thu tiền mặt ở chức năng nào?', 'Cách hạch toán chi phí trả trước dài hạn?', 'Công thức Excel tính số ngày quá hạn công nợ'],
    placeholder: 'Nhập câu hỏi... (Enter gửi, Shift+Enter xuống dòng)',
    placeholderShort: 'Nhập câu hỏi...',
    send: 'Gửi', stop: 'Dừng', newChat: 'Cuộc trò chuyện mới', close: 'Đóng (Esc)',
    thinking: 'Đang suy nghĩ', stopped: 'Đã dừng', copy: 'Chép câu trả lời', copied: 'Đã chép câu trả lời.',
    note: 'AI có thể nhầm – kiểm tra lại thông tin quan trọng. Trợ lý không xem được số liệu trong hệ thống.',
    retry: 'Hỏi lại', noFunc: 'Không tìm thấy chức năng này trong menu của bạn.',
  },
  E: {
    title: 'AI Assistant',
    sub: 'Ask about the software, business processes, how-tos',
    hello: (n) => `Hi${n ? ` ${n}` : ''}, how can I help?`,
    helloSub: 'I can point you to the right function (click to open it), explain accounting, sales and inventory processes, and help with office tasks.',
    screenTip: (t) => `How do I use "${t}"?`,
    tips: ['Where do I create a cash receipt?', 'How to account for long-term prepaid expenses?', 'Excel formula for days overdue'],
    placeholder: 'Ask a question... (Enter to send, Shift+Enter for a new line)',
    placeholderShort: 'Ask a question...',
    send: 'Send', stop: 'Stop', newChat: 'New conversation', close: 'Close (Esc)',
    thinking: 'Thinking', stopped: 'Stopped', copy: 'Copy answer', copied: 'Answer copied.',
    note: 'AI can make mistakes – double-check important information. The assistant cannot see your data.',
    retry: 'Ask again', noFunc: 'This function is not in your menu.',
  },
};

/**
 * KHUNG "HỎI AI" – ghim bên phải màn chính (giữa thanh trên và thanh cửa sổ dưới), mở từ menu avatar -> "Hỏi AI" hoặc Ctrl + /.
 * Gửi kèm màn đang mở + danh sách chức năng người dùng được dùng -> trợ lý chỉ đường bằng nút mở chức năng.
 * Câu trả lời hiện dần (luồng); "Dừng" huỷ giữa chừng. Lỗi -> toast (có nút Hỏi lại).
 */
export default function AiPanel() {
  const { user, lang } = useAuth();
  const main = useMain();
  const { open, busy, messages } = useAiState();
  const t = T[lang === 'E' ? 'E' : 'V'];

  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  const [box, setBox] = useState(null); // { top, bottom } – chừa thanh trên / thanh dưới
  const [mobile, setMobile] = useState(() => window.innerWidth <= MOBILE_MAX_W);
  const [input, setInput] = useState('');
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const stickRef = useRef(true);

  // Cuộc trò chuyện gắn với tài khoản: đổi tài khoản -> xoá
  useEffect(() => { aiStore.setOwner(user?.User_name || ''); }, [user?.User_name]);
  // Rời màn chính (đăng xuất) -> huỷ câu đang trả lời
  useEffect(() => () => abortRef.current?.abort(), []);

  // Hiệu ứng đóng: còn hiện thêm CLOSE_MS
  useEffect(() => {
    if (open) { setShown(true); setClosing(false); return undefined; }
    if (!shown) return undefined;
    setClosing(true);
    const id = setTimeout(() => { setShown(false); setClosing(false); }, CLOSE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Vị trí: ngay dưới thanh trên, trên thanh cửa sổ dưới
  const place = useCallback(() => {
    const top = document.querySelector('.mn__top')?.getBoundingClientRect().bottom ?? 64;
    const task = document.querySelector('.mn__task')?.getBoundingClientRect();
    const bottom = task ? Math.max(0, window.innerHeight - task.top) : 0;
    setBox({ top: Math.round(top), bottom: Math.round(bottom) });
    setMobile(window.innerWidth <= MOBILE_MAX_W);
  }, []);
  useLayoutEffect(() => {
    if (!shown) return undefined;
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [shown, place]);

  // Mở -> con trỏ vào ô hỏi
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 60); }, [open]);

  // Ctrl + / : bật / tắt khung
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); aiStore.toggle(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Chữ mới tới -> cuộn theo (khi người dùng đang ở gần đáy)
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, shown]);
  const onScroll = () => {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
  };

  // Ô nhập tự giãn
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input, shown]);

  // Ngữ cảnh gửi kèm
  const menus = useMemo(() => menuCatalog([main?.leftTree || [], main?.topTree || []]), [main?.leftTree, main?.topTree]);
  const screen = main?.activeKey ? { id: main.activeKey, title: String(main.nodeMap?.get(main.activeKey)?.text || '').replace(/&/g, '') } : null;
  const isMenu = useCallback((id) => !!main?.nodeMap?.get(id) && !main.nodeMap.get(id).children?.length, [main?.nodeMap]);
  const openFunc = useCallback((id) => {
    const node = main?.nodeMap?.get(id);
    if (!node) { toast.warning(t.noFunc); return; }
    main.openMenu(node);
    if (window.innerWidth <= MOBILE_MAX_W) aiStore.close();
  }, [main, t.noFunc]);

  const send = useCallback(async (raw) => {
    const question = String(raw ?? '').trim();
    if (!question || aiStore.get().busy) return;
    const history = aiStore.get().messages
      .filter((m) => m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));
    setInput('');
    stickRef.current = true;
    const { qid, aid } = aiStore.start(question);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await askAi({
        token: user?.TokenKey,
        lang,
        messages: [...history, { role: 'user', content: question }],
        context: { screen, menus },
        signal: ctrl.signal,
        onDelta: (text) => aiStore.append(aid, text),
      });
      aiStore.finish(aid, 'done');
    } catch (err) {
      const answered = aiStore.get().messages.find((m) => m.id === aid)?.content.trim();
      if (err?.name === 'AbortError') {
        if (answered) aiStore.finish(aid, 'stopped'); else { aiStore.drop(qid, aid); setInput(question); }
        return;
      }
      if (answered) aiStore.finish(aid, 'stopped');
      else { aiStore.drop(qid, aid); setInput(question); }
      toast.error(err?.message || String(err), {
        title: t.title,
        duration: 8000,
        action: answered ? undefined : { text: t.retry, onClick: () => send(question) },
      });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, [user?.TokenKey, lang, screen, menus, t]);

  const stop = () => abortRef.current?.abort();
  const newChat = () => { abortRef.current?.abort(); aiStore.clear(); setInput(''); inputRef.current?.focus(); };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success(t.copied); } catch (err) { toast.error(err.message); }
  };

  const onInputKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); }
  };
  const onPanelKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); aiStore.close(); } };

  if (!shown || !box) return null;
  const firstName = String(user?.Comment || user?.User_name || '').trim().split(/\s+/).pop();
  const tips = screen?.title ? [t.screenTip(screen.title), ...t.tips.slice(0, 2)] : t.tips;

  return createPortal(
    <section ref={panelRef} className={`ai-panel ${closing ? 'is-closing' : ''} ${mobile ? 'is-mobile' : ''}`}
      style={mobile ? undefined : { top: box.top, bottom: box.bottom }} role="dialog" aria-label={t.title} onKeyDown={onPanelKey}>
      <header className="ai-panel__head">
        <span className="ai-panel__logo"><Icon name="sparkle" size={18} strokeWidth={1.8} /></span>
        <div className="ai-panel__title">
          <b>{t.title}</b>
          <small>{t.sub}</small>
        </div>
        <button type="button" className="ai-icon-btn" title={t.newChat} aria-label={t.newChat} onClick={newChat} disabled={!messages.length}>
          <Icon name="plus" size={17} />
        </button>
        <button type="button" className="ai-icon-btn" title={t.close} aria-label={t.close} onClick={aiStore.close}>
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className="ai-panel__body" ref={listRef} onScroll={onScroll}>
        {!messages.length ? (
          <div className="ai-empty">
            <span className="ai-empty__logo"><Icon name="sparkle" size={28} strokeWidth={1.6} /></span>
            <h3>{t.hello(firstName)}</h3>
            <p>{t.helloSub}</p>
            <div className="ai-empty__tips">
              {tips.map((q) => (
                <button key={q} type="button" className="ai-tip" onClick={() => send(q)}>
                  <Icon name="sparkle" size={13} /> <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (m.role === 'user' ? (
            <div key={m.id} className="ai-msg ai-msg--user"><div className="ai-msg__bubble">{m.content}</div></div>
          ) : (
            <div key={m.id} className={`ai-msg ai-msg--ai ${m.status === 'streaming' ? 'is-streaming' : ''}`}>
              <span className="ai-msg__avatar"><Icon name="sparkle" size={14} strokeWidth={1.8} /></span>
              <div className="ai-msg__main">
                {m.content ? (
                  <AiMarkdown text={m.content} onMenu={openFunc} isMenu={isMenu} />
                ) : (
                  <div className="ai-typing" aria-live="polite">{t.thinking}<i /><i /><i /></div>
                )}
                {m.status !== 'streaming' && m.content && (
                  <div className="ai-msg__tools">
                    {m.status === 'stopped' && <span className="ai-msg__flag">{t.stopped}</span>}
                    <button type="button" className="ai-icon-btn ai-icon-btn--sm" title={t.copy} aria-label={t.copy} onClick={() => copy(m.content)}>
                      <Icon name="copy" size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )))
        )}
      </div>

      <footer className="ai-panel__foot">
        <div className="ai-compose">
          <textarea ref={inputRef} rows={1} value={input} maxLength={4000} placeholder={mobile ? t.placeholderShort : t.placeholder}
            onChange={(e) => setInput(e.target.value)} onKeyDown={onInputKey} aria-label={t.placeholder} />
          {busy ? (
            <button type="button" className="ai-send is-stop" title={t.stop} aria-label={t.stop} onClick={stop}>
              <Icon name="stop" size={14} strokeWidth={2.6} />
            </button>
          ) : (
            <button type="button" className="ai-send" title={t.send} aria-label={t.send} onClick={() => send(input)} disabled={!input.trim()}>
              <Icon name="send" size={16} strokeWidth={2} />
            </button>
          )}
        </div>
        <p className="ai-panel__note">{t.note}</p>
      </footer>
    </section>,
    document.body,
  );
}
