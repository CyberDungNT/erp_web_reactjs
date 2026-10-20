import { useCallback, useEffect, useRef, useState } from 'react';
import CyberField, { newId } from './CyberField';
import { toast } from './CyberToast';
import Icon from '@/components/icons/Icon';
import { useBinding } from '@/hooks/useBinding';
import { fileUrl, uploadFile } from '@/api/fileApi';

/**
 * CYBERTEXTEDITOR – ô soạn thảo nội dung có định dạng (giống Word), giá trị là CHUỖI HTML.
 *
 *   <CyberTextEditor {...f.bind('Noi_Dung')} label="Nội dung" height={320} placeholder="Nhập nội dung..." />
 *
 * 2 chế độ (nút dưới cùng): "Thiết kế" – soạn trực quan  |  "HTML" – sửa thẳng mã HTML (design theo kiểu HTML).
 * Thanh công cụ: kiểu đoạn (Đoạn văn, Tiêu đề 1-3, Trích dẫn, Mã), đậm / nghiêng / gạch chân / gạch ngang, màu chữ, tô nền,
 *   căn trái / giữa / phải / đều, danh sách chấm / số, thụt lề, liên kết, ảnh (dán link hoặc tải lên API file), bảng,
 *   đường kẻ, xoá định dạng, hoàn tác / làm lại, toàn màn hình.
 * An toàn: HTML luôn được lọc (sanitizeHtml) – bỏ script / style / iframe / form..., thuộc tính on*, link javascript:
 *   (khi dán từ web / Word, khi sửa ở chế độ HTML, khi nạp giá trị vào).
 *
 * Props: label, height (cao vùng soạn, mặc định 260), placeholder, readOnly, disabled,
 *        uploadImage (cho tải ảnh lên, mặc định true), layout (mặc định 'vertical' – nhãn ở trên)
 * Phím: Ctrl+B / I / U, Ctrl+Z / Y; dán từ Word / web giữ định dạng cơ bản.
 */

// ===================== Lọc HTML =====================
const BAD_TAGS = 'script,style,iframe,frame,frameset,object,embed,link,meta,base,form,input,button,textarea,select,option,svg,math,template';
const URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction', 'background', 'poster'];

/** Bỏ thẻ / thuộc tính nguy hiểm (chống XSS) + rác của Word (o:p, mso-..., chú thích) */
export function sanitizeHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  const body = doc.body;
  body.querySelectorAll(BAD_TAGS).forEach((n) => n.remove());
  // thẻ có dấu ":" (o:p, w:sdt... của Word) -> giữ nội dung, bỏ thẻ
  [...body.querySelectorAll('*')].filter((el) => el.tagName.includes(':')).forEach((el) => el.replaceWith(...el.childNodes));
  // chú thích HTML (Word chèn rất nhiều)
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments = []; while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.remove());
  body.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase();
      if (n.startsWith('on') || n === 'srcdoc') el.removeAttribute(a.name);
      else if (URL_ATTRS.includes(n) && /^\s*(javascript|vbscript|data:(?!image\/))/i.test(a.value)) el.removeAttribute(a.name);
      else if (n === 'class' && /^Mso/.test(a.value)) el.removeAttribute(a.name);
      else if (n === 'style') {
        // bỏ thuộc tính Word (mso-...) và expression()
        const st = a.value.split(';').filter((d) => d.trim() && !/^\s*mso-/i.test(d) && !/expression\s*\(|url\s*\(\s*['"]?\s*javascript/i.test(d)).join(';');
        if (st) el.setAttribute('style', st); else el.removeAttribute('style');
      }
    }
    if (el.tagName === 'A' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
  });
  return body.innerHTML;
}

/** Ô soạn trống thật sự (chỉ còn <br> / <p><br></p> / khoảng trắng) -> '' */
// (xoá hết, trình duyệt hay để lại thẻ rỗng như <h2><br></h2>, <p><br></p>; có ảnh / bảng / đường kẻ thì vẫn là có nội dung)
const isBlank = (html) => !html || (!/<(img|table|hr|video|audio)\b/i.test(html) && !html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s|​/g, ''));
/** HTML dễ đọc ở chế độ HTML: xuống dòng sau thẻ khối */
const pretty = (html) => (html || '').replace(/(<\/(p|h[1-6]|div|li|ul|ol|table|thead|tbody|tr|blockquote|pre)>|<br\s*\/?>|<hr\s*\/?>)(?!\n)/gi, '$1\n').trim();

const BLOCKS = [
  ['p', 'Đoạn văn'], ['h1', 'Tiêu đề 1'], ['h2', 'Tiêu đề 2'], ['h3', 'Tiêu đề 3'], ['blockquote', 'Trích dẫn'], ['pre', 'Mã / chữ cố định'],
];
const STATE_CMDS = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];

/** Nút thanh công cụ (ngoài component chính: không bị tạo lại mỗi lần render). onMouseDown preventDefault -> giữ vùng chọn */
function TBtn({ icon, label, title, cmd, arg, on, onClick, off, exec, disabledBtn }) {
  return (
    <button type="button" className={`cy-te__btn ${on ? 'is-on' : ''}`} title={title} aria-label={title} aria-pressed={on || undefined}
      disabled={off || disabledBtn} onMouseDown={(e) => e.preventDefault()} onClick={onClick || (() => exec(cmd, arg))}>
      {icon ? <Icon name={icon} size={16} /> : label}
    </button>
  );
}
const Sep = () => <span className="cy-te__sep" />;

export default function CyberTextEditor(props) {
  const { placeholder = 'Nhập nội dung...', readOnly, disabled, height = 260, uploadImage = true, layout = 'vertical' } = props;
  const [value, setValue] = useBinding(props);
  const [id] = useState(() => props.id || newId('te'));
  const [mode, setMode] = useState('design');      // design | html
  const [htmlText, setHtmlText] = useState('');     // nội dung ô HTML (lọc khi rời ô / chuyển về Thiết kế)
  const [full, setFull] = useState(false);
  const [bar, setBar] = useState(null);             // thanh phụ: null | 'link' | 'image' | 'table'
  const [barVal, setBarVal] = useState({ url: '', rows: 3, cols: 3 });
  const [state, setState] = useState({});           // nút đang bật (đậm, nghiêng...) + kiểu đoạn
  const [empty, setEmpty] = useState(true);
  const [uploading, setUploading] = useState(false);

  const edRef = useRef(null);
  const rangeRef = useRef(null);
  const lastHtml = useRef(null);
  const fileRef = useRef(null);
  const locked = readOnly || disabled;

  // ----- giá trị bên ngoài -> vùng soạn (chỉ khi khác nội dung đang có: tránh nhảy con trỏ khi gõ) -----
  useEffect(() => {
    const ed = edRef.current;
    if (!ed || mode !== 'design') return;
    const v = value || '';
    if (v !== lastHtml.current) {
      ed.innerHTML = sanitizeHtml(v);
      lastHtml.current = v;
      setEmpty(isBlank(ed.innerHTML));
    }
  }, [value, mode]);

  /** Vùng soạn -> giá trị (form.data) */
  const emit = useCallback(() => {
    const ed = edRef.current;
    if (!ed) return;
    const html = isBlank(ed.innerHTML) ? '' : ed.innerHTML;
    setEmpty(!html);
    if (html === lastHtml.current) return;
    lastHtml.current = html;
    setValue(html);
  }, [setValue]);

  // ----- vùng chọn: lưu lại khi rời vùng soạn (bấm nút màu / ô nhập link...) để lệnh áp đúng chỗ -----
  const saveRange = () => {
    const sel = window.getSelection();
    if (sel?.rangeCount && edRef.current?.contains(sel.anchorNode)) rangeRef.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreRange = () => {
    const ed = edRef.current;
    ed?.focus({ preventScroll: true });
    const r = rangeRef.current;
    if (r && ed?.contains(r.startContainer)) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  };

  const refreshState = useCallback(() => {
    if (!edRef.current?.contains(window.getSelection()?.anchorNode)) return;
    const s = {};
    for (const c of STATE_CMDS) { try { s[c] = document.queryCommandState(c); } catch { /* bỏ qua */ } }
    try { s.block = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, '') || 'p'; } catch { s.block = 'p'; }
    if (s.block === 'div' || s.block === 'normal') s.block = 'p';
    setState(s);
    saveRange();
  }, []);

  useEffect(() => {
    if (mode !== 'design') return undefined;
    document.addEventListener('selectionchange', refreshState);
    return () => document.removeEventListener('selectionchange', refreshState);
  }, [mode, refreshState]);

  /** Chạy 1 lệnh định dạng lên vùng chọn */
  const exec = (cmd, arg = null) => {
    if (locked) return;
    restoreRange();
    try { document.execCommand('styleWithCSS', false, cmd === 'foreColor' || cmd === 'hiliteColor'); } catch { /* bỏ qua */ }
    document.execCommand(cmd, false, arg);
    emit();
    refreshState();
  };
  const insertHtml = (html) => exec('insertHTML', html);

  // ----- dán: lọc HTML (web / Word), không có HTML thì dán chữ thường -----
  const onPaste = (e) => {
    const html = e.clipboardData?.getData('text/html');
    const text = e.clipboardData?.getData('text/plain');
    // dán ảnh (chụp màn hình) -> tải lên như ảnh
    const img = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    e.preventDefault();
    if (img && !html) { uploadAndInsert(img); return; }
    if (html) insertHtml(sanitizeHtml(html));
    else if (text) exec('insertText', text);
  };

  // ----- thanh phụ: liên kết / ảnh / bảng -----
  const openBar = (kind) => {
    saveRange();
    let url = '';
    if (kind === 'link') {
      const a = window.getSelection()?.anchorNode?.parentElement?.closest?.('a');
      url = a && edRef.current?.contains(a) ? a.getAttribute('href') || '' : '';
    }
    setBarVal((v) => ({ ...v, url }));
    setBar((b) => (b === kind ? null : kind));
  };
  const applyLink = () => {
    const url = barVal.url.trim();
    if (!url) return toast.warning('Nhập địa chỉ liên kết.');
    const href = /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : `https://${url}`;
    restoreRange();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) insertHtml(`<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${url.replace(/</g, '&lt;')}</a>`);
    else {
      exec('createLink', href);
      edRef.current.querySelectorAll(`a[href="${CSS.escape(href)}"]`).forEach((a) => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
      emit();
    }
    setBar(null);
  };
  const applyImage = (src) => {
    const url = (src ?? barVal.url).trim();
    if (!url) return toast.warning('Nhập link ảnh hoặc bấm "Tải ảnh lên".');
    insertHtml(`<img src="${url.replace(/"/g, '&quot;')}" alt="" style="max-width:100%">`);
    setBar(null);
  };
  const uploadAndInsert = async (file) => {
    if (!file?.type?.startsWith('image/')) return toast.warning('Chọn file ảnh (jpg, png, webp...).');
    if (file.size > 10 * 1024 * 1024) return toast.warning('Ảnh phải nhỏ hơn 10 MB.');
    setUploading(true);
    try {
      const [saved] = await uploadFile(file, { silent: true });
      applyImage(fileUrl(saved));
    } catch (err) {
      toast.error(err?.message || String(err), { title: 'Tải ảnh lên' });
    } finally { setUploading(false); }
  };
  const applyTable = () => {
    const rows = Math.min(50, Math.max(1, +barVal.rows || 1));
    const cols = Math.min(12, Math.max(1, +barVal.cols || 1));
    const cell = (tag) => `<${tag}>&nbsp;</${tag}>`;
    const head = `<tr>${Array.from({ length: cols }, () => cell('th')).join('')}</tr>`;
    const body = Array.from({ length: Math.max(1, rows - 1) }, () => `<tr>${Array.from({ length: cols }, () => cell('td')).join('')}</tr>`).join('');
    insertHtml(`<table class="cy-te-table"><thead>${head}</thead><tbody>${body}</tbody></table><p><br></p>`);
    setBar(null);
  };

  // ----- chuyển chế độ Thiết kế <-> HTML -----
  const toHtml = () => { setHtmlText(pretty(value || '')); setBar(null); setMode('html'); };
  const commitHtml = () => {
    const clean = sanitizeHtml(htmlText.replace(/\n(?=<)/g, '').trim());
    const v = isBlank(clean) ? '' : clean;
    if (v !== (value || '')) setValue(v);
    return v;
  };
  const toDesign = () => { commitHtml(); lastHtml.current = null; setMode('design'); };

  // Esc thoát toàn màn hình
  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setFull(false); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [full]);

  const text = (value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const off = locked || mode !== 'design'; // nút định dạng tắt khi chỉ đọc / đang ở chế độ HTML

  return (
    <CyberField {...props} layout={layout} htmlFor={id}>
      <div className={`cy-te ${full ? 'is-full' : ''} ${locked ? 'is-locked' : ''} ${mode === 'html' ? 'is-html' : ''}`}>
        {!locked && (
          <div className="cy-te__toolbar" role="toolbar" aria-label="Định dạng">
            <TBtn off={off} exec={exec} icon="undo" title="Hoàn tác (Ctrl+Z)" cmd="undo" />
            <TBtn off={off} exec={exec} icon="redo" title="Làm lại (Ctrl+Y)" cmd="redo" />
            <Sep />
            <select className="cy-te__block" value={state.block || 'p'} disabled={mode !== 'design'} title="Kiểu đoạn"
              onMouseDown={saveRange} onChange={(e) => exec('formatBlock', `<${e.target.value}>`)}>
              {BLOCKS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
            <Sep />
            <TBtn off={off} exec={exec} label={<b>B</b>} title="Đậm (Ctrl+B)" cmd="bold" on={state.bold} />
            <TBtn off={off} exec={exec} label={<i>I</i>} title="Nghiêng (Ctrl+I)" cmd="italic" on={state.italic} />
            <TBtn off={off} exec={exec} label={<u>U</u>} title="Gạch chân (Ctrl+U)" cmd="underline" on={state.underline} />
            <TBtn off={off} exec={exec} label={<s>S</s>} title="Gạch ngang" cmd="strikeThrough" on={state.strikeThrough} />
            <label className={`cy-te__btn cy-te__color ${mode !== 'design' ? 'is-disabled' : ''}`} title="Màu chữ" onMouseDown={saveRange}>
              <span className="cy-te__a">A</span><i style={{ background: state.fore || '#d6453d' }} />
              <input type="color" defaultValue="#d6453d" disabled={mode !== 'design'} onChange={(e) => { setState((s) => ({ ...s, fore: e.target.value })); exec('foreColor', e.target.value); }} />
            </label>
            <label className={`cy-te__btn cy-te__color ${mode !== 'design' ? 'is-disabled' : ''}`} title="Tô nền chữ" onMouseDown={saveRange}>
              <Icon name="highlight" size={16} /><i style={{ background: state.back || '#ffe066' }} />
              <input type="color" defaultValue="#ffe066" disabled={mode !== 'design'} onChange={(e) => { setState((s) => ({ ...s, back: e.target.value })); exec('hiliteColor', e.target.value); }} />
            </label>
            <Sep />
            <TBtn off={off} exec={exec} icon="alignLeft" title="Căn trái" cmd="justifyLeft" on={state.justifyLeft} />
            <TBtn off={off} exec={exec} icon="alignCenter" title="Căn giữa" cmd="justifyCenter" on={state.justifyCenter} />
            <TBtn off={off} exec={exec} icon="alignRight" title="Căn phải" cmd="justifyRight" on={state.justifyRight} />
            <TBtn off={off} exec={exec} icon="alignJustify" title="Căn đều" cmd="justifyFull" on={state.justifyFull} />
            <Sep />
            <TBtn off={off} exec={exec} icon="listUl" title="Danh sách chấm" cmd="insertUnorderedList" on={state.insertUnorderedList} />
            <TBtn off={off} exec={exec} icon="listOl" title="Danh sách số" cmd="insertOrderedList" on={state.insertOrderedList} />
            <TBtn off={off} exec={exec} icon="outdent" title="Giảm thụt lề" cmd="outdent" />
            <TBtn off={off} exec={exec} icon="indent" title="Tăng thụt lề" cmd="indent" />
            <Sep />
            <TBtn off={off} exec={exec} icon="link" title="Liên kết" on={bar === 'link'} onClick={() => openBar('link')} />
            <TBtn off={off} exec={exec} icon="image" title="Chèn ảnh" on={bar === 'image'} onClick={() => openBar('image')} />
            <TBtn off={off} exec={exec} icon="table" title="Chèn bảng" on={bar === 'table'} onClick={() => openBar('table')} />
            <TBtn off={off} exec={exec} icon="hr" title="Đường kẻ ngang" cmd="insertHorizontalRule" />
            <Sep />
            <TBtn off={off} exec={exec} icon="eraser" title="Xoá định dạng" onClick={() => { exec('removeFormat'); exec('formatBlock', '<p>'); }} />
            <span className="cy-te__grow" />
            <button type="button" className={`cy-te__btn ${full ? 'is-on' : ''}`} title={full ? 'Thu nhỏ (Esc)' : 'Toàn màn hình'}
              onMouseDown={(e) => e.preventDefault()} onClick={() => setFull((f) => !f)}>
              <Icon name={full ? 'shrink' : 'expand'} size={16} />
            </button>
          </div>
        )}

        {bar && mode === 'design' && (
          <div className="cy-te__bar">
            {bar === 'link' && (
              <>
                <Icon name="link" size={15} />
                <input className="cy-input" autoFocus placeholder="https://..." value={barVal.url}
                  onChange={(e) => setBarVal((v) => ({ ...v, url: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setBar(null); }} />
                <button type="button" className="cy-btn cy-btn--primary" onClick={applyLink}>Gắn liên kết</button>
                <button type="button" className="cy-btn" onClick={() => { exec('unlink'); setBar(null); }}>Bỏ liên kết</button>
              </>
            )}
            {bar === 'image' && (
              <>
                <Icon name="image" size={15} />
                <input className="cy-input" autoFocus placeholder="Dán link ảnh https://..." value={barVal.url}
                  onChange={(e) => setBarVal((v) => ({ ...v, url: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyImage(); } if (e.key === 'Escape') setBar(null); }} />
                <button type="button" className="cy-btn cy-btn--primary" onClick={() => applyImage()}>Chèn</button>
                {uploadImage && (
                  <button type="button" className="cy-btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <Icon name={uploading ? 'refresh' : 'upload'} size={14} className={uploading ? 'cf__spin' : ''} /> {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { uploadAndInsert(e.target.files?.[0]); e.target.value = ''; }} />
              </>
            )}
            {bar === 'table' && (
              <>
                <Icon name="table" size={15} />
                <span>Số dòng</span>
                <input className="cy-input cy-te__num" type="number" min={1} max={50} value={barVal.rows} onChange={(e) => setBarVal((v) => ({ ...v, rows: e.target.value }))} />
                <span>Số cột</span>
                <input className="cy-input cy-te__num" type="number" min={1} max={12} value={barVal.cols} onChange={(e) => setBarVal((v) => ({ ...v, cols: e.target.value }))} />
                <button type="button" className="cy-btn cy-btn--primary" onClick={applyTable}>Chèn bảng</button>
              </>
            )}
            <button type="button" className="cy-te__barx" title="Đóng" onClick={() => setBar(null)}>✕</button>
          </div>
        )}

        {mode === 'design' ? (
          <div
            ref={edRef}
            id={id}
            className={`cy-te__area ${empty ? 'is-empty' : ''}`}
            style={full ? undefined : { height }}
            contentEditable={!locked}
            suppressContentEditableWarning
            role="textbox" aria-multiline="true" aria-label={props.label || 'Nội dung'}
            data-placeholder={placeholder}
            onInput={emit}
            onBlur={() => { saveRange(); emit(); }}
            onKeyUp={refreshState}
            onMouseUp={refreshState}
            onPaste={onPaste}
            onDrop={(e) => {
              const img = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
              if (img && uploadImage && !locked) { e.preventDefault(); uploadAndInsert(img); }
            }}
          />
        ) : (
          <textarea
            id={id}
            className="cy-te__code"
            style={full ? undefined : { height }}
            value={htmlText}
            spellCheck={false}
            readOnly={locked}
            onChange={(e) => setHtmlText(e.target.value)}
            onBlur={commitHtml}
          />
        )}

        <div className="cy-te__foot">
          <span>{words} từ · {text.replace(/\s+/g, ' ').trim().length} ký tự</span>
          <span className="cy-te__grow" />
          <div className="cy-te__modes" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'design'} className={mode === 'design' ? 'is-on' : ''} onClick={() => mode !== 'design' && toDesign()}>
              <Icon name="edit" size={13} /> Thiết kế
            </button>
            <button type="button" role="tab" aria-selected={mode === 'html'} className={mode === 'html' ? 'is-on' : ''} onClick={() => mode !== 'html' && toHtml()}>
              <Icon name="code" size={13} /> HTML
            </button>
          </div>
        </div>
      </div>
    </CyberField>
  );
}
