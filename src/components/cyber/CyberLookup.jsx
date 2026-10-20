import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CyberField, { newId } from './CyberField';
import { toast } from './CyberToast';
import { useBinding, useExtraField } from '@/hooks/useBinding';
import { useAuth } from '@/auth/AuthContext';
import { callProc, buildPara as joinPara } from '@/api/apiClient';

/**
 * Ô TRA CỨU DANH MỤC – gọi thủ tục CP_SysListLookup.
 *
 *   <CyberLookup
 *     {...form.bind('Ma_Kh')}         // cột lưu lại khi chọn -> data.Ma_Kh
 *     textField="Ten_Kh"              // (tuỳ chọn) lưu thêm tên để hiển thị -> data.Ten_Kh
 *     listName="DmKH"                 // tên danh mục -> @M_Tb_Name
 *     filter="Ksd = 0"                // điều kiện lọc -> @M_strKeyFilter (mặc định '1=1')
 *     valueField="Ma_KH"              // (tuỳ chọn) cột lấy giá trị khi chọn – mặc định: cột Order thủ tục trả về
 *     displayField="Ten_KH"           // (tuỳ chọn) cột hiển thị trên ô – mặc định: cột tên (Ten_...) trong head
 *     onSelect={(row) => ...}         // nhận cả dòng để gán các field khác (địa chỉ, mã số thuế...)
 *   />
 *
 * Gọi: CP_SysListLookup @M_Load='1', @M_strValue = chữ đã nhập, @M_strKeyFilter = filter, @M_Tb_Name = listName,
 *                       @M_Ma_TTCP, @M_User_Name (lấy từ phiên đăng nhập)
 *
 * Cách hoạt động:
 *   NGỪNG GÕ (delay, mặc định 500ms) -> tra cứu -> THẢ DANH SÁCH kết quả xuống ngay dưới ô (con trỏ vẫn ở ô, gõ tiếp vẫn lọc lại)
 *       ↑ ↓ / PageUp PageDown chọn dòng, Enter / Tab / bấm chuột -> lấy dòng, Esc -> đóng, trả lại giá trị cũ
 *   Enter ngay (không chờ) -> tra cứu: đúng 1 dòng / trùng khớp mã -> tự chọn luôn, nhiều dòng -> thả danh sách
 *   rời ô khi chưa chọn: đúng 1 dòng / trùng mã -> tự chọn, còn lại -> trả lại giá trị cũ
 *   không có dòng nào -> toast "không tìm thấy", trả lại giá trị cũ
 *   F4 / Alt+↓ / nút ▾ -> thả toàn bộ danh mục
 *   xoá trắng ô rồi rời đi -> bỏ giá trị
 * Thủ tục trả (xem parseLookup):
 *   bảng 1 = dữ liệu (ma_kh, ten_kh, dia_chi...)
 *   bảng 2 = head: Field_Name, Field_Head (tiêu đề), Field_Width (độ rộng, 0 = ẩn) -> cột danh sách
 *   bảng 3 = Order: cột mã của danh mục (vd Ma_KH) -> cột giá trị mặc định
 *   Tên cột dữ liệu được khớp với head KHÔNG phân biệt hoa thường; dòng trả cho onSelect có thêm tên viết đúng như head
 *   (row.Dia_Chi và row.dia_chi đều được). Bảng có Status = N -> báo Note (toast).
 *
 * Props khác:
 *   delay        ms chờ sau khi ngừng gõ rồi mới tra cứu + thả danh sách (mặc định 500; 0 = chỉ tra cứu khi Enter)
 *   dropdownWidth độ rộng tối thiểu danh sách (mặc định: vừa tổng độ rộng cột theo head, không tràn màn hình)
 *   columns      tự khai báo cột: [{ field, caption, width }] (bỏ qua bảng head của thủ tục)
 *   procName     dùng thủ tục khác (mặc định CP_SysListLookup); kèm para (ghép sau từ khoá) hoặc buildPara(keyword) => tham số
 *   placeholder, readOnly, disabled
 */
export const LOOKUP_PROC = 'CP_SysListLookup';

const keyOf = (row, name) => row && name && Object.keys(row).find((k) => k.toLowerCase() === String(name).toLowerCase());
const get = (row, name) => { const k = keyOf(row, name); return k ? row[k] : undefined; };
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const HIDDEN_COLS = /^(bold|backcolor|forecolor|searchshorttext|stt_rec|rowid|status|msg|note|m_lan)$/i;

/**
 * Đọc kết quả CP_SysListLookup:
 *   bảng 1                      = dữ liệu (tên cột có thể khác hoa thường so với head: ma_kh / Ma_KH)
 *   bảng có Field_Name + Field_Width = head: cột danh sách (Field_Head tiêu đề, Field_Width độ rộng, 0 = ẩn)
 *   bảng có cột Order           = cột MÃ của danh mục (vd Order = 'Ma_KH') -> cột giá trị mặc định
 * Mỗi dòng được thêm tên cột viết ĐÚNG NHƯ HEAD (row.Ma_KH, row.Dia_Chi...) bên cạnh tên gốc (row.ma_kh...)
 * -> onSelect(row) dùng tên theo head hay tên gốc đều được.
 */
function parseLookup(tables) {
  const head = tables.slice(1).find((t) => t?.[0] && keyOf(t[0], 'Field_Name') && keyOf(t[0], 'Field_Width'));
  const order = str(get(tables.slice(1).find((t) => t?.[0] && keyOf(t[0], 'Order') && Object.keys(t[0]).length <= 2)?.[0], 'Order'));
  let data = (tables[0] || []).filter((r) => !(keyOf(r, 'Status') && keyOf(r, 'Note') && Object.keys(r).length <= 4));
  let cols = [];
  if (head) {
    const names = head.map((r) => str(get(r, 'Field_Name'))).filter(Boolean);
    // thêm bí danh theo tên head (khác hoa thường) cho mỗi dòng
    const alias = names.map((n) => [n, keyOf(data[0], n)]).filter(([n, k]) => k && k !== n);
    if (alias.length) data = data.map((r) => { const o = { ...r }; for (const [n, k] of alias) o[n] = r[k]; return o; });
    cols = head
      .filter((r) => str(get(r, 'Field_Name')) && Number(get(r, 'Field_Width')) > 0)
      .map((r) => ({ field: str(get(r, 'Field_Name')), caption: str(get(r, 'Field_Head')) || str(get(r, 'Field_Name')), width: Number(get(r, 'Field_Width')) }));
  }
  if (!cols.length) cols = Object.keys(data[0] || {}).filter((k) => !HIDDEN_COLS.test(k)).slice(0, 6).map((k) => ({ field: k, caption: k }));
  return { data, cols, order };
}

export default function CyberLookup(props) {
  const {
    listName, filter = '1=1', procName, para, buildPara, columns, onSelect, delay = 500,
    placeholder, readOnly, disabled, dropdownWidth,
  } = props;
  const { user } = useAuth();
  const [value, setValue] = useBinding(props);
  const [boundText, setBoundText, hasTextField] = useExtraField(props, 'textField');
  const [id] = useState(() => props.id || newId('lkp'));

  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);   // đang gõ (chữ trong ô khác giá trị đã chọn)
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [open, setOpen] = useState(false);          // danh sách thả xuống
  const [rows, setRows] = useState([]);
  const [cols, setCols] = useState(columns || []);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const reqId = useRef(0);
  const timer = useRef(null);
  const orderRef = useRef('');
  const colsRef = useRef(columns || []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // cột giá trị: khai báo valueField > cột Order thủ tục trả về (cột mã) > cột 1
  // cột hiển thị: khai báo displayField > cột tên (Ten_...) trong head > cột 2
  const vField = (row) => keyOf(row, props.valueField) || keyOf(row, orderRef.current) || keyOf(row, colsRef.current[0]?.field) || Object.keys(row || {})[0];
  const dField = (row) => {
    const v = vField(row);
    const nameCol = colsRef.current.find((c) => /^ten/i.test(c.field) && keyOf(row, c.field) !== v);
    return keyOf(row, props.displayField) || keyOf(row, nameCol?.field) || keyOf(row, colsRef.current.find((c) => keyOf(row, c.field) !== v)?.field) || v;
  };

  // Chữ hiển thị khi không gõ
  const displayText = (() => {
    if (value === null || value === undefined || value === '') return '';
    if (hasTextField && boundText) return boundText;
    if (selectedRow && String(selectedRow[vField(selectedRow)]) === String(value)) return selectedRow[dField(selectedRow)] ?? String(value);
    return String(value);
  })();
  const shownText = editing ? text : displayText;

  /** Gọi thủ tục tra cứu -> Promise<dòng[]> (null nếu lỗi / đã có lần gọi mới hơn) */
  const lookup = (keyword) => {
    const reqNo = ++reqId.current;
    const proc = procName || LOOKUP_PROC;
    const p = procName
      ? (buildPara ? buildPara(keyword) : para !== undefined && para !== null && para !== '' ? `${keyword}#${joinPara(para)}` : keyword)
      : [
        '1',                    // @M_Load
        keyword,                // @M_strValue   – giá trị đã nhập
        filter || '1=1',        // @M_strKeyFilter – điều kiện lọc
        listName || '',         // @M_Tb_Name    – tên danh mục
        user?.Ma_TTCP || '',    // @M_Ma_TTCP
        user?.User_name || '',  // @M_User_Name
      ];
    if (!procName && !listName) { toast.error(`CyberLookup "${props.label || props.field}": chưa khai báo listName (tên danh mục).`); return Promise.resolve(null); }
    setLoading(true);
    return callProc(proc, p, { silent: true })
      .then(({ tables }) => {
        if (reqNo !== reqId.current) return null;
        const st = tables.find((t) => t?.[0] && keyOf(t[0], 'Status') && keyOf(t[0], 'Note'))?.[0];
        if (st && str(get(st, 'Status')).toUpperCase() === 'N') { toast.error(str(get(st, 'Note')) || 'Không tra cứu được danh mục.'); return null; }
        const res = parseLookup(tables);
        orderRef.current = res.order;
        colsRef.current = columns?.length ? columns : res.cols;
        setCols(colsRef.current);
        setRows(res.data);
        return res.data;
      })
      .catch((err) => { if (reqNo === reqId.current) toast.error(err?.message || String(err), { title: 'Tra cứu danh mục' }); return null; })
      .finally(() => { if (reqNo === reqId.current) setLoading(false); });
  };

  const select = (row) => {
    clearTimeout(timer.current);
    reqId.current++; // bỏ kết quả tra cứu đang chờ (nếu có)
    setSelectedRow(row);
    setValue(row ? row[vField(row)] : null, row);
    if (hasTextField) setBoundText(row ? row[dField(row)] ?? null : null);
    onSelect?.(row);
    setEditing(false);
    setOpen(false);
  };

  /** Thả danh sách xuống dưới ô (con trỏ vẫn ở ô – gõ tiếp vẫn lọc lại) */
  const showList = (data) => { if (!data) return; setActive(data.length ? 0 : -1); setOpen(true); };

  /** Nhập xong (Enter khi chưa mở danh sách / rời ô): tra cứu ngay */
  const commit = async ({ leaving } = {}) => {
    clearTimeout(timer.current);
    if (!editing) return;
    const t = text.trim();
    if (t === '') { select(null); return; }
    const data = await lookup(t);
    if (!data) { setEditing(false); return; }
    const exact = data.find((r) => str(r[vField(r)]).toLowerCase() === t.toLowerCase());
    if (exact || data.length === 1) { select(exact || data[0]); return; }
    if (!data.length) { toast.warning(`Không tìm thấy "${t}" trong ${props.label || 'danh mục'}.`); setEditing(false); setOpen(false); return; }
    // nhiều kết quả: đang rời ô -> trả lại giá trị cũ; còn ở ô (Enter) -> thả danh sách để chọn
    if (leaving) { setEditing(false); setOpen(false); } else showList(data);
  };

  const openAll = async () => { showList(await lookup('')); };

  const handleInput = (e) => {
    const v = e.target.value;
    setText(v);
    setEditing(true);
    clearTimeout(timer.current);
    if (!v.trim()) { setOpen(false); return; }
    // NGỪNG GÕ -> tra cứu, thả danh sách kết quả xuống dưới ô
    if (delay > 0) {
      timer.current = setTimeout(async () => {
        const data = await lookup(v.trim());
        if (data && document.activeElement === inputRef.current) showList(data);
      }, delay);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) { e.preventDefault(); openAll(); return; }
    if (open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); return; }
      if (e.key === 'PageDown') { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 8)); return; }
      if (e.key === 'PageUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 8)); return; }
      if ((e.key === 'Enter' || e.key === 'Tab') && rows[active]) { if (e.key === 'Enter') e.preventDefault(); select(rows[active]); return; }
      if (e.key === 'Escape') { e.preventDefault(); clearTimeout(timer.current); setOpen(false); setEditing(false); return; }
    }
    if (e.key === 'ArrowDown' && rows.length && editing) { e.preventDefault(); showList(rows); return; }
    if (e.key === 'Enter' && editing) { e.preventDefault(); commit(); return; }
    if (e.key === 'Escape' && editing) { clearTimeout(timer.current); setEditing(false); }
  };

  const handleBlur = () => {
    setOpen(false);
    commit({ leaving: true });
  };

  // Vị trí danh sách (portal + fixed -> không bị cắt trong popup / bảng; thiếu chỗ dưới thì mở lên trên)
  useLayoutEffect(() => {
    if (!open || !inputRef.current) return undefined;
    const update = () => {
      const r = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const up = spaceBelow < 280 && r.top > spaceBelow;
      setPos({ left: r.left, top: up ? undefined : r.bottom + 2, bottom: up ? window.innerHeight - r.top + 2 : undefined, minWidth: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const locked = readOnly || disabled;
  // rộng vừa tổng độ rộng cột (bảng head), thẳng mép trái với ô; thiếu chỗ bên phải -> co cột lại (chữ dài hiện "…"),
  // chỉ dịch sang trái khi ô quá sát mép phải màn hình (còn < 420px)
  const wantW = Math.max(pos?.minWidth || 0, dropdownWidth || 0, cols.reduce((t, c) => t + (c.width || 140) + 13, 0));
  const roomRight = pos ? window.innerWidth - pos.left - 8 : wantW;
  const listW = Math.min(wantW, window.innerWidth - 16, Math.max(roomRight, Math.min(420, wantW)));
  const left = pos ? Math.max(8, Math.min(pos.left, window.innerWidth - listW - 8)) : 0;

  return (
    <CyberField {...props} htmlFor={id} error={props.error}>
      <div className={`cy-input-group ${loading ? 'is-loading' : ''}`}>
        <input
          ref={inputRef}
          id={id}
          className="cy-input"
          autoComplete="off"
          value={shownText}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          onChange={handleInput}
          onFocus={() => setText(displayText)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          role="combobox" aria-expanded={open} aria-autocomplete="list"
        />
        {!locked && (
          <button type="button" className="cy-btn-icon" tabIndex={-1} title="Mở danh sách (F4)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { inputRef.current?.focus(); if (open) setOpen(false); else openAll(); }}>
            {loading ? <span className="cy-lookup__spin" aria-label="Đang tra cứu" /> : '▾'}
          </button>
        )}
      </div>
      {open && pos && createPortal(
        <div className="cy-dropdown cy-dropdown--lookup" ref={listRef} role="listbox"
          style={{ position: 'fixed', left, top: pos.top, bottom: pos.bottom, width: listW }}
          onMouseDown={(e) => e.preventDefault() /* giữ con trỏ ở ô khi bấm vào danh sách */}>
          {/* vùng cuộn riêng – dòng chân nằm NGOÀI để không che dòng cuối khi ↓ tới cuối danh sách */}
          <div className="cy-lookup__scroll">
            <table className="cy-dropdown__table">
              <thead>
                <tr>{cols.map((c) => <th key={c.field} style={{ width: c.width }}>{c.caption ?? c.field}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={i === active ? 'is-active' : ''} role="option" aria-selected={i === active}
                    onMouseEnter={() => setActive(i)} onClick={() => select(r)}>
                    {cols.map((c) => <td key={c.field}>{r[c.field]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="cy-dropdown__msg">{loading ? 'Đang tra cứu...' : 'Không có dữ liệu'}</div>}
          </div>
          {rows.length > 0 && <div className="cy-dropdown__foot">{rows.length} dòng · ↑↓ chọn · Enter lấy · Esc đóng</div>}
        </div>,
        document.body
      )}
    </CyberField>
  );
}
