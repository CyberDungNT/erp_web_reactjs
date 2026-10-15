import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import CyberContextMenu from './CyberContextMenu';
import { formatNumber } from './CyberNumeric';

/**
 * Bảng hiển thị dữ liệu.
 *
 *   <CyberTable
 *     head={headTable}        // bảng mô tả cột (có thể lấy từ DB)
 *     data={dataTable}        // bảng dữ liệu
 *     frozenColumns={2}       // cố định 2 cột đầu khi cuộn ngang
 *     frozenRightColumns={1}  // cố định 1 cột cuối bên phải
 *     frozenRows={1}          // cố định 1 dòng dữ liệu đầu khi cuộn dọc
 *     onRowClick={(row, index) => ...}
 *     onRowDoubleClick={(row, index) => ...}
 *     contextMenu={(row, index) => [
 *       { text: 'Sửa', icon: '✎', onClick: () => edit(row) },
 *       '-',
 *       { text: 'Xoá', danger: true, onClick: () => remove(row) },
 *     ]}
 *   />
 *
 * Bảng head: mỗi dòng 1 cột, chấp nhận key viết hoa hoặc thường:
 *   Field     tên cột trong data (bắt buộc)
 *   Caption   tiêu đề
 *   Width     độ rộng px
 *   Type      'text' | 'number' | 'date' | 'datetime' | 'bool'
 *   Decimals  số lẻ khi Type = number
 *   Align     'left' | 'center' | 'right'
 *   Sum       true -> hiện tổng ở dòng cuối
 *   Visible   false -> ẩn cột
 *   Fixed     'left' (hoặc true/1) | 'right' -> cố định cột này khi cuộn ngang
 *   render    (value, row, index) => JSX   (chỉ khi khai báo bằng code)
 * Không truyền head -> tự sinh cột từ dòng đầu tiên của data.
 *
 * Cố định khi cuộn:
 *   Dòng tiêu đề và dòng tổng cộng luôn cố định.
 *   frozenColumns       số cột đầu cố định bên trái (cột STT tự cố định theo)
 *   frozenRightColumns  số cột cuối cố định bên phải
 *   frozenRows          số dòng dữ liệu đầu cố định ngay dưới tiêu đề
 *   isRowFrozen         (row, index) => true : ghim dòng bất kỳ lên đầu (vd dòng tổng hợp)
 *
 * Props khác:
 *   contextMenu      mảng items (onClick nhận (row, index)) hoặc hàm (row, index) => items
 *   onSelectionChange(row, index)
 *   height           chiều cao vùng cuộn (mặc định 360)
 *   showRowNumber    cột STT (mặc định true)
 *   showSearch       ô lọc nhanh trên bảng
 *   sortable         bấm tiêu đề để sắp xếp (mặc định true)
 *   loading, emptyText, rowClassName(row, index)
 */
const pick = (o, ...keys) => {
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
};

function parseFixed(v) {
  if (v === undefined || v === null || v === '' || v === false || v === 0 || v === '0') return null;
  const s = String(v).toLowerCase();
  if (s === 'right' || s === 'r') return 'right';
  return 'left'; // true, 1, 'left', 'l'
}

export function normalizeColumns(head, data) {
  if (head && head.length) {
    return head
      .map((h) => ({
        field: pick(h, 'field', 'Field', 'FIELD', 'ColumnName'),
        caption: pick(h, 'caption', 'Caption', 'CAPTION', 'Header', 'header'),
        width: Number(pick(h, 'width', 'Width', 'WIDTH')) || undefined,
        type: String(pick(h, 'type', 'Type', 'TYPE') || 'text').toLowerCase(),
        decimals: Number(pick(h, 'decimals', 'Decimals', 'DECIMALS') ?? 0),
        align: pick(h, 'align', 'Align', 'ALIGN'),
        sum: !!pick(h, 'sum', 'Sum', 'SUM'),
        visible: pick(h, 'visible', 'Visible', 'VISIBLE') !== false && pick(h, 'visible', 'Visible', 'VISIBLE') !== 0,
        fixed: parseFixed(pick(h, 'fixed', 'Fixed', 'FIXED', 'frozen', 'Frozen')),
        render: h.render,
      }))
      .filter((c) => c.field && c.visible);
  }
  const first = data?.[0];
  if (!first) return [];
  return Object.keys(first).map((k) => ({
    field: k,
    caption: k,
    type: typeof first[k] === 'number' ? 'number' : typeof first[k] === 'boolean' ? 'bool' : 'text',
    decimals: Number.isInteger(first[k]) ? 0 : 2,
    fixed: null,
  }));
}

/** Sắp lại cột: cố định trái -> bình thường -> cố định phải */
function arrangeColumns(cols, frozenColumns, frozenRightColumns) {
  const list = cols.map((c) => ({ ...c }));
  list.forEach((c, i) => {
    if (!c.fixed && i < frozenColumns) c.fixed = 'left';
    if (!c.fixed && i >= list.length - frozenRightColumns) c.fixed = 'right';
  });
  return [
    ...list.filter((c) => c.fixed === 'left'),
    ...list.filter((c) => !c.fixed),
    ...list.filter((c) => c.fixed === 'right'),
  ];
}

function formatCell(v, col) {
  if (v === null || v === undefined) return '';
  switch (col.type) {
    case 'number':
      return formatNumber(v, { decimals: col.decimals });
    case 'date': {
      const s = String(v).slice(0, 10).split('-');
      return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(v);
    }
    case 'datetime': {
      const d = new Date(v);
      return isNaN(d) ? String(v) : d.toLocaleString('vi-VN');
    }
    case 'bool':
      return v === true || v === 1 || v === '1' || v === 'True' ? '✔' : '';
    default:
      return String(v);
  }
}

const sameArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export default function CyberTable({
  head, columns, data = [], onRowClick, onRowDoubleClick, onSelectionChange, contextMenu,
  height = 360, showRowNumber = true, showSearch = false, sortable = true,
  frozenColumns = 0, frozenRightColumns = 0, frozenRows = 0, isRowFrozen,
  loading = false, emptyText = 'Không có dữ liệu', rowClassName, className = '',
}) {
  const cols = useMemo(
    () => arrangeColumns(normalizeColumns(columns || head, data), frozenColumns, frozenRightColumns),
    [columns, head, data, frozenColumns, frozenRightColumns]
  );
  const [sort, setSort] = useState({ field: null, dir: 1 });
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState(null); // giữ chính object dòng
  const [menu, setMenu] = useState(null);
  const bodyRef = useRef(null);
  const tableRef = useRef(null);
  const headRowRef = useRef(null);

  // Mỗi dòng giữ index gốc trong data để trả ra ngoài
  const view = useMemo(() => {
    let list = data.map((row, index) => ({ row, index }));
    const k = keyword.trim().toLowerCase();
    if (k) {
      list = list.filter(({ row }) => cols.some((c) => formatCell(row[c.field], c).toLowerCase().includes(k)));
    }
    if (sort.field) {
      const col = cols.find((c) => c.field === sort.field);
      list = [...list].sort((a, b) => {
        const x = a.row[sort.field];
        const y = b.row[sort.field];
        if (x === y) return 0;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        if (col?.type === 'number') return (x - y) * sort.dir;
        return String(x).localeCompare(String(y), 'vi') * sort.dir;
      });
    }
    // Dòng ghim (isRowFrozen) đưa lên đầu, sau đó N dòng đầu theo frozenRows
    let pinned = [];
    if (isRowFrozen) {
      pinned = list.filter(({ row, index }) => isRowFrozen(row, index));
      list = list.filter(({ row, index }) => !isRowFrozen(row, index));
    }
    const all = [...pinned, ...list];
    const pinnedCount = Math.min(all.length, pinned.length + Math.max(0, frozenRows));
    return { rows: all, pinnedCount };
  }, [data, cols, keyword, sort, frozenRows, isRowFrozen]);

  const rows = view.rows;
  const pinnedCount = view.pinnedCount;

  // ===== Đo kích thước để tính vị trí sticky của cột/dòng cố định =====
  const hasFrozenCols = cols.some((c) => c.fixed);
  const stickyStt = showRowNumber && cols.some((c) => c.fixed === 'left');
  const [metrics, setMetrics] = useState({ lefts: [], rights: [], tops: [], headH: 0 });

  // Luôn đọc số dòng ghim mới nhất (tránh closure cũ trong ResizeObserver)
  const pinnedRef = useRef(pinnedCount);
  pinnedRef.current = pinnedCount;

  const measure = useCallback(() => {
    const pinnedCount = pinnedRef.current;
    const headRow = headRowRef.current;
    if (!headRow) return;
    // Bảng đang bị ẩn (tab không active, popup đóng...) -> kích thước = 0, không đo để tránh ghi đè số liệu đúng
    if (!headRow.getClientRects().length) return;
    const ths = Array.from(headRow.children);
    const r2 = (n) => Math.round(n * 2) / 2; // làm tròn 0.5px, tránh dao động do lệch subpixel
    const widths = ths.map((th) => r2(th.getBoundingClientRect().width));
    const lefts = [];
    const rights = [];
    let acc = 0;
    for (let i = 0; i < ths.length; i++) { lefts[i] = acc; acc += widths[i]; }
    acc = 0;
    for (let i = ths.length - 1; i >= 0; i--) { rights[i] = acc; acc += widths[i]; }

    const headH = r2(headRow.getBoundingClientRect().height);
    const tops = [];
    const trs = tableRef.current?.tBodies[0]?.rows || [];
    let top = headH;
    for (let i = 0; i < pinnedCount && i < trs.length; i++) {
      tops[i] = top;
      top += r2(trs[i].getBoundingClientRect().height);
    }
    setMetrics((m) =>
      sameArr(m.lefts, lefts) && sameArr(m.rights, rights) && sameArr(m.tops, tops) && m.headH === headH
        ? m
        : { lefts, rights, tops, headH }
    );
  }, []);

  useLayoutEffect(() => {
    if (hasFrozenCols || pinnedCount > 0) measure();
  });

  useEffect(() => {
    if (!(hasFrozenCols || pinnedCount > 0) || !tableRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(tableRef.current);
    return () => ro.disconnect();
  }, [hasFrozenCols, pinnedCount > 0, measure]);

  // Vị trí cột trong hàng (tính cả cột STT)
  const offset = showRowNumber ? 1 : 0;
  const lastLeftIdx = (() => {
    let idx = -1;
    cols.forEach((c, i) => { if (c.fixed === 'left') idx = i; });
    return idx;
  })();
  const firstRightIdx = cols.findIndex((c) => c.fixed === 'right');

  /** style + class cho 1 ô theo cột (ci = -1 là cột STT) */
  const cellSticky = (ci) => {
    const col = ci >= 0 ? cols[ci] : null;
    const pos = ci + offset;
    if ((ci === -1 && stickyStt) || col?.fixed === 'left') {
      const last = ci === lastLeftIdx || (ci === -1 && lastLeftIdx === -1);
      return { style: { position: 'sticky', left: metrics.lefts[pos] ?? 0 }, cls: `is-fixed-left${last ? ' is-fixed-left-last' : ''}` };
    }
    if (col?.fixed === 'right') {
      return { style: { position: 'sticky', right: metrics.rights[pos] ?? 0 }, cls: `is-fixed-right${ci === firstRightIdx ? ' is-fixed-right-first' : ''}` };
    }
    return { style: null, cls: '' };
  };

  // Bỏ chọn nếu dòng không còn trong data
  useEffect(() => {
    if (selected && !data.includes(selected)) setSelected(null);
  }, [data, selected]);

  const sums = useMemo(() => {
    const s = {};
    cols.forEach((c) => {
      if (c.sum) s[c.field] = rows.reduce((t, { row }) => t + (Number(row[c.field]) || 0), 0);
    });
    return s;
  }, [cols, rows]);
  const hasSum = Object.keys(sums).length > 0;

  const selectRow = useCallback((row, index) => {
    setSelected(row);
    onSelectionChange?.(row, index);
  }, [onSelectionChange]);

  const handleContextMenu = (e, row, index) => {
    if (!contextMenu) return;
    e.preventDefault();
    selectRow(row, index);
    const raw = typeof contextMenu === 'function' ? contextMenu(row, index) : contextMenu;
    const items = (raw || []).map((it) =>
      it === '-' || !it?.onClick ? it : { ...it, onClick: () => it.onClick(row, index) }
    );
    if (items.length) setMenu({ x: e.clientX, y: e.clientY, items });
  };

  /** Cuộn sao cho dòng không bị che bởi tiêu đề / dòng cố định / dòng tổng */
  const scrollRowIntoView = (i) => {
    const box = bodyRef.current;
    const tr = tableRef.current?.tBodies[0]?.rows[i];
    if (!box || !tr || i < pinnedCount) return;
    const topCover = pinnedCount > 0
      ? (metrics.tops[pinnedCount - 1] ?? 0) + (tableRef.current.tBodies[0].rows[pinnedCount - 1]?.offsetHeight ?? 0)
      : (headRowRef.current?.offsetHeight ?? 0);
    const footH = tableRef.current.tFoot?.offsetHeight ?? 0;
    const rowTop = tr.offsetTop;
    const rowBottom = rowTop + tr.offsetHeight;
    if (rowTop < box.scrollTop + topCover) box.scrollTop = rowTop - topCover;
    else if (rowBottom > box.scrollTop + box.clientHeight - footH) box.scrollTop = rowBottom - box.clientHeight + footH;
  };

  const handleKeyDown = (e) => {
    if (!rows.length) return;
    const cur = rows.findIndex((v) => v.row === selected);
    let next = cur;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, cur + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, cur - 1);
    else if (e.key === 'Enter' && cur >= 0) { onRowDoubleClick?.(rows[cur].row, rows[cur].index); return; }
    else return;
    e.preventDefault();
    const v = rows[next];
    selectRow(v.row, v.index);
    onRowClick?.(v.row, v.index);
    scrollRowIntoView(next);
  };

  const toggleSort = (field) => {
    if (!sortable) return;
    setSort((s) => (s.field !== field ? { field, dir: 1 } : s.dir === 1 ? { field, dir: -1 } : { field: null, dir: 1 }));
  };

  const align = (c) => c.align || (c.type === 'number' ? 'right' : c.type === 'bool' ? 'center' : 'left');

  const renderCell = (ci, content, extraStyle, extraCls = '', Tag = 'td', key, props = {}) => {
    const s = cellSticky(ci);
    return (
      <Tag key={key} className={`${s.cls} ${extraCls}`.trim() || undefined} style={{ ...extraStyle, ...s.style }} {...props}>
        {content}
      </Tag>
    );
  };

  return (
    <div className={`cy-table ${className}`}>
      {showSearch && (
        <div className="cy-table__toolbar">
          <input className="cy-input cy-table__search" placeholder="Lọc nhanh..." value={keyword}
            onChange={(e) => setKeyword(e.target.value)} />
          <span className="cy-muted">{rows.length}/{data.length} dòng</span>
        </div>
      )}
      <div className="cy-table__scroll" style={{ height }} ref={bodyRef} tabIndex={0} onKeyDown={handleKeyDown}>
        <table ref={tableRef}>
          <thead>
            <tr ref={headRowRef}>
              {showRowNumber && renderCell(-1, 'STT', null, 'cy-table__stt', 'th', 'stt')}
              {cols.map((c, ci) =>
                renderCell(
                  ci,
                  <>
                    {c.caption ?? c.field}
                    {sort.field === c.field && <span className="cy-sort">{sort.dir === 1 ? '▲' : '▼'}</span>}
                  </>,
                  { width: c.width, minWidth: c.width, textAlign: align(c) },
                  sortable ? 'is-sortable' : '',
                  'th',
                  c.field,
                  { onClick: () => toggleSort(c.field) }
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, index }, i) => {
              const pinned = i < pinnedCount;
              const pinStyle = pinned ? { position: 'sticky', top: metrics.tops[i] ?? metrics.headH } : null;
              const cls = [
                row === selected ? 'is-selected' : '',
                pinned ? 'is-pinned' : '',
                pinned && i === pinnedCount - 1 ? 'is-pinned-last' : '',
                rowClassName?.(row, index) || '',
              ].join(' ').trim();
              return (
                <tr key={index} className={cls || undefined}
                  onClick={() => { selectRow(row, index); onRowClick?.(row, index); }}
                  onDoubleClick={() => onRowDoubleClick?.(row, index)}
                  onContextMenu={(e) => handleContextMenu(e, row, index)}>
                  {showRowNumber && renderCell(-1, pinned ? '📌' : i + 1 - pinnedCount, pinStyle, 'cy-table__stt', 'td', 'stt')}
                  {cols.map((c, ci) =>
                    renderCell(
                      ci,
                      c.render ? c.render(row[c.field], row, index) : formatCell(row[c.field], c),
                      { textAlign: align(c), ...pinStyle },
                      '',
                      'td',
                      c.field
                    )
                  )}
                </tr>
              );
            })}
          </tbody>
          {hasSum && rows.length > 0 && (
            <tfoot>
              <tr>
                {showRowNumber && renderCell(-1, null, null, 'cy-table__stt', 'td', 'stt')}
                {cols.map((c, i) =>
                  renderCell(
                    i,
                    c.sum ? formatNumber(sums[c.field], { decimals: c.decimals }) : i === 0 ? 'Tổng cộng' : '',
                    { textAlign: align(c) },
                    '',
                    'td',
                    c.field
                  )
                )}
              </tr>
            </tfoot>
          )}
        </table>
        {!loading && rows.length === 0 && <div className="cy-table__empty">{emptyText}</div>}
        {loading && <div className="cy-table__loading">Đang tải dữ liệu...</div>}
      </div>
      {menu && <CyberContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
