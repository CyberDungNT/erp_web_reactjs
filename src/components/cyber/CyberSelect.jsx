import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CyberField, { newId } from './CyberField';
import { useBinding } from '../../hooks/useBinding';

/**
 * Ô chọn dạng dropdown tuỳ biến: có ô tìm kiếm (không dấu), nhóm, điều khiển bằng bàn phím.
 *
 *   <CyberSelect {...form.bind('MaTTCP')} label="Đơn vị"
 *     dataSource={units} valueField="Ma_TTCP" displayField="Ten_TTCP"
 *     groupField="Ma_Dvcs" groupLabel={(g) => `Đơn vị cơ sở ${g}`}
 *     loading={loading} placeholder="Chọn đơn vị" />
 *
 * Props:
 *   dataSource, valueField, displayField
 *   groupField / groupLabel(giá trị nhóm, các dòng)  -> chia nhóm có tiêu đề
 *   showValue      hiện mã ở bên phải mỗi dòng
 *   searchable     ô tìm kiếm (mặc định bật khi > 8 dòng)
 *   placeholder, loading, loadingText, emptyText, disabled
 *   onChange(value, row)
 */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export default function CyberSelect(props) {
  const {
    dataSource = [], valueField = 'value', displayField = 'text', groupField, groupLabel, showValue,
    searchable, placeholder = '-- Chọn --', loading, loadingText = 'Đang tải...', emptyText = 'Không có dữ liệu',
    disabled,
  } = props;
  const [value, setValue] = useBinding(props);
  const [id] = useState(() => props.id || newId('sel'));
  const [open, setOpen] = useState(false);
  const [kw, setKw] = useState('');
  const [hot, setHot] = useState(-1);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const searchRef = useRef(null);

  const selected = dataSource.find((r) => String(r[valueField]) === String(value ?? ''));
  const canSearch = searchable ?? dataSource.length > 8;

  // Danh sách hiển thị (đã lọc) + vị trí tiêu đề nhóm
  const { items, rows } = useMemo(() => {
    const k = norm(kw.trim());
    const list = k
      ? dataSource.filter((r) => norm(r[displayField]).includes(k) || norm(r[valueField]).includes(k))
      : dataSource;
    const out = [];
    let lastGroup;
    list.forEach((row, i) => {
      if (groupField && row[groupField] !== lastGroup) {
        lastGroup = row[groupField];
        const groupRows = list.filter((r) => r[groupField] === lastGroup);
        out.push({ type: 'group', key: `g-${lastGroup}-${i}`, label: groupLabel ? groupLabel(lastGroup, groupRows) : lastGroup });
      }
      out.push({ type: 'item', key: `i-${row[valueField]}-${i}`, row, index: i });
    });
    return { items: out, rows: list };
  }, [dataSource, kw, displayField, valueField, groupField, groupLabel]);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 280 && r.top > below;
    setPos({
      left: r.left, width: r.width,
      top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.min(320, (up ? r.top : below) - 12),
    });
  };

  const openList = () => {
    if (disabled || loading) return;
    setKw('');
    const idx = dataSource.findIndex((r) => String(r[valueField]) === String(value ?? ''));
    setHot(idx);
    place();
    setOpen(true);
  };
  const close = (focusBtn) => {
    setOpen(false);
    if (focusBtn) btnRef.current?.focus();
  };
  const choose = (row) => {
    setValue(row[valueField], row);
    close(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    if (canSearch) searchRef.current?.focus();
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      close(false);
    };
    const onMove = () => place();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { if (open) setHot(rows.length ? 0 : -1); }, [kw]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    popRef.current?.querySelector('.is-hot')?.scrollIntoView({ block: 'nearest' });
  }, [hot, open]);

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'F4'].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHot((h) => Math.min(rows.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHot((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[hot]) choose(rows[hot]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') close(false);
  };

  return (
    <CyberField {...props} htmlFor={id}>
      <button
        type="button" id={id} ref={btnRef} disabled={disabled}
        className={`cy-select ${open ? 'is-open' : ''} ${!selected ? 'is-empty' : ''}`}
        aria-haspopup="listbox" aria-expanded={open}
        onClick={() => (open ? close(false) : openList())} onKeyDown={onKeyDown}>
        <span className="cy-select__text">
          {loading ? loadingText : selected ? selected[displayField] : placeholder}
        </span>
        {loading ? <span className="cy-select__spin" /> : (
          <svg className="cy-select__chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {open && pos && createPortal(
        <div className="cy-select__pop" ref={popRef} role="listbox" style={{ position: 'fixed', ...pos, maxHeight: undefined }}
          onKeyDown={onKeyDown}>
          {canSearch && (
            <div className="cy-select__search">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input ref={searchRef} value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Tìm..." />
              <span className="cy-select__count">{rows.length}</span>
            </div>
          )}
          <div className="cy-select__list" style={{ maxHeight: pos.maxHeight - (canSearch ? 44 : 0) }}>
            {items.map((it) =>
              it.type === 'group' ? (
                <div key={it.key} className="cy-select__group">{it.label}</div>
              ) : (
                <div key={it.key} role="option" aria-selected={String(it.row[valueField]) === String(value ?? '')}
                  className={`cy-select__opt ${it.index === hot ? 'is-hot' : ''} ${String(it.row[valueField]) === String(value ?? '') ? 'is-selected' : ''}`}
                  onMouseEnter={() => setHot(it.index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(it.row)}>
                  <span className="cy-select__opt-text">{it.row[displayField]}</span>
                  {showValue && <span className="cy-select__opt-code">{it.row[valueField]}</span>}
                  <svg className="cy-select__tick" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )
            )}
            {!rows.length && <div className="cy-select__empty">{kw ? 'Không tìm thấy' : emptyText}</div>}
          </div>
        </div>,
        document.body
      )}
    </CyberField>
  );
}
