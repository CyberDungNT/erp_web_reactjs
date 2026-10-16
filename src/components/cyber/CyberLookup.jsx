import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CyberField, { newId } from './CyberField';
import { useBinding, useExtraField } from '@/hooks/useBinding';
import { callProc, buildPara as joinPara } from '@/api/apiClient';

/**
 * Ô tra cứu (autocomplete) gọi API khi gõ.
 *
 *   <CyberLookup
 *     {...form.bind('MaKH')}          // cột lưu lại khi chọn -> data.MaKH
 *     textField="TenKH"               // (tuỳ chọn) lưu thêm cột hiển thị -> data.TenKH
 *     procName="LookupKhachHang"      // proc nhận từ khoá làm tham số đầu tiên
 *     valueField="MaKH"               // tên cột lấy giá trị khi chọn
 *     displayField="TenKH"            // tên cột hiển thị trên control
 *     columns={[{ field: 'MaKH', caption: 'Mã', width: 80 }, { field: 'TenKH', caption: 'Tên' }]}
 *     onSelect={(row) => ...}         // nhận cả dòng để gán các field khác
 *   />
 *
 * Props:
 *   para         tham số thêm, ghép sau từ khoá: Para = "tukhoa#para"
 *   buildPara    (keyword) => mảng/chuỗi tham số, nếu muốn tự quyết định Para
 *   minChars     số ký tự tối thiểu mới gọi API (mặc định 0)
 *   debounce     ms chờ sau khi ngừng gõ (mặc định 300)
 *   dropdownWidth, placeholder, readOnly, disabled
 * Phím: ↑ ↓ chọn dòng, Enter chọn, Esc đóng, F4 / Alt+↓ mở toàn bộ danh sách.
 */
export default function CyberLookup(props) {
  const {
    procName, para, buildPara, valueField, displayField, columns, minChars = 0,
    debounce = 300, onSelect, placeholder, readOnly, disabled, dropdownWidth,
  } = props;
  const [value, setValue] = useBinding(props);
  const [boundText, setBoundText, hasTextField] = useExtraField(props, 'textField');
  const [id] = useState(() => props.id || newId('lkp'));

  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [pos, setPos] = useState(null);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const timer = useRef(null);
  const reqId = useRef(0);

  const cols = columns?.length
    ? columns
    : [{ field: valueField, caption: 'Mã', width: 90 }, { field: displayField, caption: 'Tên' }];

  // Chữ hiển thị khi không gõ
  const displayText = (() => {
    if (value === null || value === undefined || value === '') return '';
    if (hasTextField && boundText) return boundText;
    if (selectedRow && selectedRow[valueField] === value) return selectedRow[displayField] ?? '';
    return String(value);
  })();
  const shownText = editing ? text : displayText;

  const search = (keyword) => {
    if ((keyword || '').length < minChars) { setRows([]); return; }
    const id = ++reqId.current;
    const p = buildPara
      ? buildPara(keyword)
      : para !== undefined && para !== null && para !== ''
        ? `${keyword}#${joinPara(para)}`
        : keyword;
    setLoading(true);
    setError(null);
    callProc(procName, p)
      .then((res) => { if (id === reqId.current) { setRows(res.table); setActive(res.table.length ? 0 : -1); } })
      .catch((err) => { if (id === reqId.current) { setRows([]); setError(err.message); } })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };

  const openList = (keyword) => {
    setOpen(true);
    search(keyword);
  };

  const select = (row) => {
    setSelectedRow(row);
    setValue(row ? row[valueField] : null, row);
    if (hasTextField) setBoundText(row ? row[displayField] : null);
    onSelect?.(row);
    setEditing(false);
    setOpen(false);
  };

  const handleInput = (e) => {
    const v = e.target.value;
    setText(v);
    setEditing(true);
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), debounce);
  };

  const handleFocus = () => {
    setText(displayText);
  };

  const handleBlur = () => {
    clearTimeout(timer.current);
    if (editing) {
      const t = text.trim();
      if (t === '') select(null);
      else {
        // gõ đúng mã/tên thì tự chọn, ngược lại trả về giá trị cũ
        const lower = t.toLowerCase();
        const match = rows.find(
          (r) => String(r[valueField]).toLowerCase() === lower || String(r[displayField]).toLowerCase() === lower
        );
        if (match) select(match);
        else setEditing(false);
      }
    }
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) {
      e.preventDefault();
      openList('');
      return;
    }
    if (!open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); openList(editing ? text : ''); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[active]) select(rows[active]); }
    else if (e.key === 'Escape') { setOpen(false); setEditing(false); }
  };

  // Vị trí dropdown (dùng portal + fixed để không bị cắt trong popup/table)
  useLayoutEffect(() => {
    if (!open || !inputRef.current) return;
    const update = () => {
      const r = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const up = spaceBelow < 260 && r.top > spaceBelow;
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
  }, [active]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const locked = readOnly || disabled;

  return (
    <CyberField {...props} htmlFor={id} error={props.error}>
      <div className="cy-input-group">
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
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        {!locked && (
          <button type="button" className="cy-btn-icon" tabIndex={-1} title="Mở danh sách (F4)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { inputRef.current?.focus(); open ? setOpen(false) : openList(''); }}>
            ▾
          </button>
        )}
      </div>
      {open && pos && createPortal(
        <div className="cy-dropdown" ref={listRef}
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: Math.max(pos.minWidth, dropdownWidth || 0) }}
          onMouseDown={(e) => e.preventDefault()}>
          <table className="cy-dropdown__table">
            <thead>
              <tr>{cols.map((c) => <th key={c.field} style={{ width: c.width }}>{c.caption ?? c.field}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i === active ? 'is-active' : ''}
                  onMouseEnter={() => setActive(i)} onClick={() => select(r)}>
                  {cols.map((c) => <td key={c.field}>{r[c.field]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="cy-dropdown__msg">Đang tìm...</div>}
          {!loading && error && <div className="cy-dropdown__msg cy-text-danger">{error}</div>}
          {!loading && !error && rows.length === 0 && (
            <div className="cy-dropdown__msg">
              {(editing ? text : '').length < minChars ? `Gõ ít nhất ${minChars} ký tự` : 'Không có dữ liệu'}
            </div>
          )}
        </div>,
        document.body
      )}
    </CyberField>
  );
}
