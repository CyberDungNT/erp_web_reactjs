import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callProc } from '@/api/apiClient';
import { useAuth } from '@/auth/AuthContext';
import { useCyberForm } from '@/hooks/useCyberForm';
import Icon, { MenuIcon } from '@/components/icons/Icon';
import { msgbox } from './CyberMsgBox';

/**
 * CYBERFORM – KHUNG MÀN HÌNH GỐC. Màn hình nào cũng bọc trong CyberForm để dùng chung:
 * vòng đời load, thanh tiêu đề + nút lệnh, phím tắt, trạng thái đang xử lý, báo lỗi.
 * (React không kế thừa class: màn con "kế thừa" bằng cách bọc nội dung trong <CyberForm>.)
 *
 *   export default function PhieuNhapPage({ menu }) {
 *     return (
 *       <CyberForm menu={menu} initialData={{ SoCT: '', MaKho: null }}
 *         onLoad={async (f) => {                       // chạy khi mở màn hình + khi Làm mới (F5)
 *           const kho = await f.call('GetKho');
 *           f.setVar('kho', kho.table);
 *           f.form.setField('MaKho', kho.table[0]?.MaKho);
 *         }}
 *         actions={(f) => [
 *           { key: 'save', text: 'Lưu', icon: 'tick', primary: true, shortcut: 'Ctrl+S', onClick: save },
 *         ]}>
 *         {(f) => <CyberCombobox {...f.bind('MaKho')} dataSource={f.vars.kho} ... />}
 *       </CyberForm>
 *     );
 *   }
 *
 * Props:
 *   menu         node menu (MainLayout truyền vào màn hình) -> tiêu đề, icon, mã chức năng
 *   title        tiêu đề (mặc định menu.text); subtitle: dòng phụ (mặc định mã menu)
 *   initialData  dữ liệu ban đầu của form -> f.form (useCyberForm)
 *   onLoad(f)    async – gọi API / xử lý logic khi vào trang. Lỗi (throw) -> hiện màn báo lỗi + nút Thử lại
 *   actions(f)   mảng nút trên thanh tiêu đề:
 *                { key, text, icon, onClick(f), primary, danger, disabled, hidden, shortcut: 'Ctrl+S' | 'F2' ... }
 *                onClick async được bọc f.run(): tự hiện đang xử lý, lỗi -> msgbox.failed
 *                (Ctrl+N / Ctrl+T / Ctrl+W bị trình duyệt giữ, không dùng làm phím tắt được)
 *   footer(f)    nội dung thanh trạng thái dưới cùng (tuỳ chọn)
 *   reloadable   có nút Làm mới + phím F5 (mặc định true)
 *   headless     ẩn thanh tiêu đề (vd. trang dashboard tự vẽ tiêu đề); F5 / phím tắt vẫn dùng được
 *   children     (f) => JSX  hoặc JSX thường
 *
 * f (ngữ cảnh form) – truyền cho onLoad / actions / children:
 *   f.form, f.data, f.bind          dữ liệu form (two-way binding cho control Cyber*)
 *   f.vars, f.setVar(k, v), f.setVars(obj)   biến dùng chung của màn (danh sách lookup, dòng chi tiết...)
 *   f.call(proc, params)            gọi proc, tự bật trạng thái đang xử lý
 *   f.run(asyncFn, { errorTitle })  chạy 1 thao tác: bật đang xử lý, lỗi -> msgbox.failed, trả về kết quả / undefined
 *   f.reload()                      chạy lại onLoad
 *   f.loading (lần load đang chạy), f.busy (đang có thao tác), f.error
 *   f.msg (= msgbox), f.user, f.lang, f.menu
 */
export default function CyberForm({
  menu, title, subtitle, initialData = {}, onLoad, actions, footer, reloadable = true, headless = false, className = '', children,
}) {
  const { user, lang } = useAuth();
  const form = useCyberForm(initialData);
  const [vars, setVarsState] = useState({});
  const [phase, setPhase] = useState(onLoad ? 'loading' : 'ready'); // loading | ready | error
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(0);
  const rootRef = useRef(null);
  const ctxRef = useRef(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const E = lang === 'E';

  const setVar = useCallback((k, v) => setVarsState((s) => ({ ...s, [k]: typeof v === 'function' ? v(s[k]) : v })), []);
  const setVars = useCallback((obj) => setVarsState((s) => ({ ...s, ...obj })), []);

  const track = useCallback(async (promise) => {
    setBusy((n) => n + 1);
    try { return await promise; } finally { setBusy((n) => n - 1); }
  }, []);

  const call = useCallback((name, params, options) => track(callProc(name, params, options)), [track]);

  const run = useCallback(async (fn, { errorTitle } = {}) => {
    try {
      return await track(Promise.resolve().then(() => fn(ctxRef.current)));
    } catch (err) {
      // Lỗi API đã bật toast (err.reported) -> không hiện thêm hộp thông báo trùng
      if (!err?.reported) await msgbox.failed(errorTitle || (E ? 'An error occurred' : 'Có lỗi xảy ra'), { detail: err?.message || String(err), lang });
      return undefined;
    }
  }, [track, E, lang]);

  const reload = useCallback(async () => {
    if (!onLoadRef.current) return;
    setPhase((p) => (p === 'ready' ? 'reloading' : 'loading'));
    setError(null);
    try {
      await track(Promise.resolve().then(() => onLoadRef.current(ctxRef.current)));
      setPhase('ready');
    } catch (err) {
      setError(err?.message || String(err));
      setPhase('error');
    }
  }, [track]);

  const f = {
    form, data: form.data, bind: form.bind,
    vars, setVar, setVars,
    call, run, reload,
    loading: phase === 'loading' || phase === 'reloading', busy: busy > 0, error,
    msg: msgbox, user, lang, menu,
  };
  ctxRef.current = f;

  // Vào trang -> load 1 lần (StrictMode chạy effect 2 lần -> chặn gọi API trùng)
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    reload();
  }, [reload]);

  // ----- Nút lệnh + phím tắt -----
  const list = useMemo(() => {
    const items = (typeof actions === 'function' ? actions(f) : actions) || [];
    const all = reloadable && onLoad
      ? [...items, { key: '__reload', text: E ? 'Refresh' : 'Làm mới', icon: 'refresh', shortcut: 'F5', onClick: () => reload(), plain: true }]
      : items;
    return all.filter((a) => a && !a.hidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, f.data, vars, busy, phase, reloadable, E]);

  const fire = (a) => {
    if (a.disabled || busy > 0) return;
    if (a.key === '__reload') { a.onClick(); return; }
    run(() => a.onClick?.(ctxRef.current), { errorTitle: a.errorTitle });
  };

  const listRef = useRef(list);
  listRef.current = list;
  useEffect(() => {
    const onKey = (e) => {
      const root = rootRef.current;
      // chỉ màn đang hiển thị (tab đang chọn) và không có hộp thoại nào đang mở
      if (!root || root.offsetParent === null || document.querySelector('.cy-mb-overlay, .cy-overlay')) return;
      const a = listRef.current.find((x) => x.shortcut && matchShortcut(e, x.shortcut));
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      fire(a);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const heading = title || menu?.text || '';
  const sub = subtitle ?? menu?.id;
  const content = typeof children === 'function' ? children(f) : children;

  return (
    <div ref={rootRef} className={`cf ${busy > 0 ? 'is-busy' : ''} ${headless ? 'cf--headless' : ''} ${className}`}>
      {headless && <span className="cf__progress" aria-hidden="true" />}
      {!headless && <header className="cf__head">
        <span className="cf__progress" aria-hidden="true" />
        <span className="cf__icon"><MenuIcon icon={menu?.icon || 'doc'} fallbackText={heading} size={20} /></span>
        <div className="cf__titles">
          <h2 className="cf__title">{heading}</h2>
          {sub && <span className="cf__sub">{sub}</span>}
        </div>
        <div className="cf__actions">
          {list.map((a) => (
            <button key={a.key || a.text} type="button"
              className={`cy-btn cf__btn ${a.primary ? 'cy-btn--primary' : ''} ${a.danger ? 'cy-btn--danger' : ''}`}
              disabled={a.disabled || busy > 0 || (phase !== 'ready' && a.key !== '__reload')}
              title={a.shortcut ? `${a.text} (${a.shortcut})` : a.text} onClick={() => fire(a)}>
              {a.icon && <Icon name={a.icon} size={15} className={a.key === '__reload' && f.loading ? 'cf__spin' : ''} />}
              <span>{a.text}</span>
              {a.shortcut && <kbd>{a.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </header>}

      <div className="cf__body">
        {phase === 'loading' && <Skeleton />}
        {phase === 'error' && (
          <div className="cf__error" role="alert">
            <span className="cf__error-icon"><Icon name="warning" size={26} /></span>
            <h3>{E ? 'Could not load data' : 'Không tải được dữ liệu'}</h3>
            <p>{error}</p>
            <button type="button" className="cy-btn cy-btn--primary" onClick={reload}>
              <Icon name="refresh" size={15} /> {E ? 'Try again' : 'Thử lại'}
            </button>
          </div>
        )}
        {(phase === 'ready' || phase === 'reloading') && (
          <div className={`cf__content ${phase === 'reloading' ? 'is-reloading' : ''}`}>{content}</div>
        )}
      </div>

      {footer && phase !== 'loading' && <footer className="cf__foot">{footer(f)}</footer>}
    </div>
  );
}

/** Khối nhóm nội dung trong form: <CyberForm.Section title="Thông tin chung">...</CyberForm.Section> */
function Section({ title, icon, extra, children, className = '' }) {
  return (
    <section className={`cf__section ${className}`}>
      {(title || extra) && (
        <div className="cf__section-head">
          {icon && <Icon name={icon} size={16} />}
          <h3>{title}</h3>
          {extra && <div className="cf__section-extra">{extra}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
CyberForm.Section = Section;

function Skeleton() {
  return (
    <div className="cf__skeleton" aria-busy="true" aria-label="Đang tải">
      <div className="cf__sk cf__sk--title" />
      <div className="cf__sk-grid">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="cf__sk cf__sk--field" style={{ '--i': i }} />)}
      </div>
      <div className="cf__sk cf__sk--block" />
    </div>
  );
}

/** 'Ctrl+S', 'Ctrl+Shift+N', 'F2', 'Alt+Enter' ... */
function matchShortcut(e, sc) {
  const parts = sc.toLowerCase().split('+').map((s) => s.trim());
  const key = parts.pop();
  const want = { ctrl: parts.includes('ctrl'), shift: parts.includes('shift'), alt: parts.includes('alt') };
  if (want.ctrl !== (e.ctrlKey || e.metaKey) || want.shift !== e.shiftKey || want.alt !== e.altKey) return false;
  return e.key.toLowerCase() === key || (key === 'del' && e.key === 'Delete') || (key === 'esc' && e.key === 'Escape');
}
