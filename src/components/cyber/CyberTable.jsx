import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import CyberContextMenu from './CyberContextMenu';
import { formatNumber } from './CyberNumeric';
import Icon from '@/components/icons/Icon';

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
 *   Group     tiêu đề nhóm: các cột liền nhau cùng Group -> gộp 1 ô tiêu đề phía trên (tiêu đề 2 tầng)
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
 *   filterRow        dòng lọc theo từng cột ngay dưới tiêu đề (cột bool: bấm ô vuông xoay Tất cả / Có / Không)
 *   showNavigator    thanh dưới bảng: ⏮ ◀ Bản ghi x / n ▶ ⏭
 *   sortable         bấm tiêu đề để sắp xếp (mặc định true)
 *   rowStyle(row, index) -> style của dòng. Biến riêng: '--row-bg' (màu nền), '--row-fg' (màu chữ)
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
        group: pick(h, 'group', 'Group', 'GROUP') || null,
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
      return isTrue(v) ? '✔' : '';
    default:
      return String(v);
  }
}

const isTrue = (v) => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';

/** Ô vuông hiển thị cột bool (chỉ xem) */
const BoolBox = ({ on }) => <span className={`cy-table__chk${on ? ' is-on' : ''}`} aria-label={on ? '✔' : ''} />;

/** Khớp 1 ô với giá trị dòng lọc: bool so đúng/sai, còn lại chứa chuỗi (không phân biệt hoa thường) */
function matchFilter(v, col, f) {
  if (col.type === 'bool') return isTrue(v) === f;
  return formatCell(v, col).toLowerCase().includes(String(f).trim().toLowerCase());
}

// So sánh số đo (lẻ subpixel) có sai số rất nhỏ -> không setState lặp vì dao động 0.00x px
const sameArr = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.01);

export default function CyberTable({
  head, columns, data = [], onRowClick, onRowDoubleClick, onSelectionChange, contextMenu,
  height = 360, showRowNumber = true, showSearch = false, sortable = true,
  filterRow = false, showNavigator = false,
  frozenColumns = 0, frozenRightColumns = 0, frozenRows = 0, isRowFrozen,
  loading = false, emptyText = 'Không có dữ liệu', rowClassName, rowStyle, className = '',
}) {
  const cols = useMemo(
    () => arrangeColumns(normalizeColumns(columns || head, data), frozenColumns, frozenRightColumns),
    [columns, head, data, frozenColumns, frozenRightColumns]
  );
  const [sort, setSort] = useState({ field: null, dir: 1 });
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState({}); // dòng lọc theo cột: field -> chuỗi | true/false (cột bool)
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
    const active = cols.filter((c) => filters[c.field] !== undefined && filters[c.field] !== '');
    if (active.length) {
      list = list.filter(({ row }) => active.every((c) => matchFilter(row[c.field], c, filters[c.field])));
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
  }, [data, cols, keyword, filters, sort, frozenRows, isRowFrozen]);

  const rows = view.rows;
  const pinnedCount = view.pinnedCount;

  // ===== Đo kích thước để tính vị trí sticky của cột/dòng cố định =====
  const hasFrozenCols = cols.some((c) => c.fixed);
  const stickyStt = showRowNumber && cols.some((c) => c.fixed === 'left');
  const hasGroups = cols.some((c) => c.group);
  // Tiêu đề nhiều tầng (nhóm cột / dòng lọc) -> phải đo chiều cao từng tầng để ghim đúng chỗ
  const multiHead = hasGroups || filterRow;
  const [metrics, setMetrics] = useState({ lefts: [], rights: [], tops: [], headH: 0, headTops: [] });
  const metricsRef = useRef(metrics);

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
    // KHÔNG làm tròn: độ rộng cột thật có thể lẻ (zoom 125%, cột giãn theo nội dung). Làm tròn rồi cộng dồn
    // khiến vị trí cột cố định lệch vài px so với vị trí tự nhiên -> vừa cuộn ngang là cột + chữ bị xê dịch.
    // (Cộng dồn ĐỘ RỘNG, không đọc vị trí: đang cuộn thì ô cố định nằm ở chỗ "dính", không phải chỗ tự nhiên)
    const widths = ths.map((th) => th.getBoundingClientRect().width);
    const lefts = [];
    const rights = [];
    let acc = 0;
    for (let i = 0; i < ths.length; i++) { lefts[i] = acc; acc += widths[i]; }
    acc = 0;
    for (let i = ths.length - 1; i >= 0; i--) { rights[i] = acc; acc += widths[i]; }

    // headRow = tầng cuối của tiêu đề (đủ 1 ô cho mỗi cột) -> đo độ rộng; chiều cao lấy cả thead
    const headRows = Array.from(tableRef.current?.tHead?.rows || [headRow]);
    const headTops = [];
    let headH = 0;
    for (const tr of headRows) { headTops.push(headH); headH += tr.getBoundingClientRect().height; }
    const tops = [];
    const trs = tableRef.current?.tBodies[0]?.rows || [];
    let top = headH;
    for (let i = 0; i < pinnedCount && i < trs.length; i++) {
      tops[i] = top;
      top += trs[i].getBoundingClientRect().height;
    }
    // Không đổi -> KHÔNG gọi setState (gọi cả khi giống nhau vẫn có thể kích thêm lượt render -> lặp vô hạn)
    const m = metricsRef.current;
    if (sameArr(m.lefts, lefts) && sameArr(m.rights, rights) && sameArr(m.tops, tops) && Math.abs(m.headH - headH) < 0.01 && sameArr(m.headTops, headTops)) return;
    metricsRef.current = { lefts, rights, tops, headH, headTops };
    setMetrics(metricsRef.current);
  }, []);

  const needMeasure = hasFrozenCols || pinnedCount > 0 || multiHead;
  useLayoutEffect(() => {
    if (needMeasure) measure();
  });

  useEffect(() => {
    if (!needMeasure || !tableRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(tableRef.current);
    return () => ro.disconnect();
  }, [needMeasure, measure]);

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

  /** Thanh chuyển bản ghi: chọn dòng thứ i (theo thứ tự đang hiển thị) */
  const curPos = rows.findIndex((v) => v.row === selected);
  const goTo = (i) => {
    if (!rows.length) return;
    const n = Math.max(0, Math.min(rows.length - 1, i));
    selectRow(rows[n].row, rows[n].index);
    onRowClick?.(rows[n].row, rows[n].index);
    scrollRowIntoView(n);
  };

  const setFilter = (field, v) => setFilters((f) => ({ ...f, [field]: v }));
  // Cột bool: Tất cả -> Có -> Không -> Tất cả
  const cycleBool = (field) => setFilters((f) => ({ ...f, [field]: f[field] === undefined ? true : f[field] === true ? false : undefined }));

  // Gộp các cột liền nhau cùng Group thành 1 ô tiêu đề nhóm
  const segments = useMemo(() => {
    const segs = [];
    cols.forEach((c, ci) => {
      const last = segs[segs.length - 1];
      if (c.group && last?.group === c.group && last.fixed === c.fixed) last.span += 1;
      else segs.push({ group: c.group, fixed: c.fixed, ci, span: 1 });
    });
    return segs;
  }, [cols]);

  const align = (c) => c.align || (c.type === 'number' ? 'right' : c.type === 'bool' ? 'center' : 'left');

  const renderCell = (ci, content, extraStyle, extraCls = '', Tag = 'td', key, props = {}) => {
    const s = cellSticky(ci);
    return (
      <Tag key={key} className={`${s.cls} ${extraCls}`.trim() || undefined} style={{ ...extraStyle, ...s.style }} {...props}>
        {content}
      </Tag>
    );
  };

  /** Ô tiêu đề của 1 cột (bấm để sắp xếp) */
  const headCell = (c, ci, style, props = {}) => renderCell(
    ci,
    <>
      {c.caption ?? c.field}
      {sort.field === c.field && <span className="cy-sort">{sort.dir === 1 ? '▲' : '▼'}</span>}
    </>,
    { width: c.width, minWidth: c.width, textAlign: align(c), ...style },
    sortable ? 'is-sortable' : '',
    'th',
    c.field,
    { onClick: () => toggleSort(c.field), ...props }
  );

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
            {hasGroups ? (
              <>
                {/* Tầng 1: ô nhóm (gộp ngang) + cột không nhóm (gộp dọc 2 tầng) */}
                <tr>
                  {showRowNumber && renderCell(-1, 'STT', { top: 0 }, 'cy-table__stt', 'th', 'stt', { rowSpan: 2 })}
                  {segments.map((s) => (s.group
                    ? renderCell(s.ci, s.group, { top: 0, textAlign: 'center' },
                      `cy-table__group${s.ci + s.span - 1 === lastLeftIdx ? ' is-fixed-left-last' : ''}`, 'th', `g${s.ci}`, { colSpan: s.span })
                    : headCell(cols[s.ci], s.ci, { top: 0 }, { rowSpan: 2 })))}
                </tr>
                {/* Tầng 2: các cột thuộc nhóm */}
                <tr>
                  {cols.map((c, ci) => c.group && headCell(c, ci, { top: metrics.headTops[1] }))}
                </tr>
              </>
            ) : (
              <tr ref={filterRow ? undefined : headRowRef}>
                {showRowNumber && renderCell(-1, 'STT', { top: 0 }, 'cy-table__stt', 'th', 'stt')}
                {cols.map((c, ci) => headCell(c, ci, { top: 0 }))}
              </tr>
            )}
            {/* Tầng cuối luôn đủ 1 ô / cột (để đo độ rộng): dòng lọc, hoặc dòng đệm cao 0 khi có nhóm */}
            {(filterRow || hasGroups) && (
              <tr ref={headRowRef} className={filterRow ? 'cy-table__filter' : 'cy-table__sizer'}>
                {showRowNumber && renderCell(-1, filterRow ? <Icon name="filter" size={12} /> : null,
                  { top: metrics.headTops[metrics.headTops.length - 1] }, 'cy-table__stt', 'th', 'stt')}
                {cols.map((c, ci) => {
                  const top = metrics.headTops[metrics.headTops.length - 1];
                  const style = { top, width: c.width, minWidth: c.width, textAlign: 'center' };
                  if (!filterRow) return renderCell(ci, null, style, '', 'th', c.field);
                  const f = filters[c.field];
                  return renderCell(ci, c.type === 'bool'
                    ? (
                      <button type="button" className={`cy-table__chk cy-table__chk--btn${f === true ? ' is-on' : f === false ? ' is-off' : ''}`}
                        title={f === true ? 'Đang lọc: Có' : f === false ? 'Đang lọc: Không' : 'Lọc: Tất cả'} onClick={() => cycleBool(c.field)} />
                    )
                    : (
                      <input className="cy-table__filter-input" value={f ?? ''} aria-label={`Lọc ${c.caption ?? c.field}`}
                        onChange={(e) => setFilter(c.field, e.target.value)} />
                    ), style, '', 'th', c.field);
                })}
              </tr>
            )}
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
                <tr key={index} className={cls || undefined} style={rowStyle?.(row, index)}
                  onClick={() => { selectRow(row, index); onRowClick?.(row, index); }}
                  onDoubleClick={() => onRowDoubleClick?.(row, index)}
                  onContextMenu={(e) => handleContextMenu(e, row, index)}>
                  {showRowNumber && renderCell(-1, pinned ? '📌' : i + 1 - pinnedCount, pinStyle, 'cy-table__stt', 'td', 'stt')}
                  {cols.map((c, ci) =>
                    renderCell(
                      ci,
                      c.render ? c.render(row[c.field], row, index)
                        : c.type === 'bool' ? <BoolBox on={isTrue(row[c.field])} /> : formatCell(row[c.field], c),
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
      {showNavigator && (
        <div className="cy-table__nav">
          <button type="button" title="Bản ghi đầu" disabled={!rows.length || curPos === 0} onClick={() => goTo(0)}>⏮</button>
          <button type="button" title="Bản ghi trước" disabled={!rows.length || curPos === 0} onClick={() => goTo(curPos - 1)}>◀</button>
          <span className="cy-table__nav-text">Bản ghi <b>{curPos >= 0 ? curPos + 1 : 0}</b> / {rows.length}{rows.length !== data.length && <span className="cy-muted"> (lọc từ {data.length})</span>}</span>
          <button type="button" title="Bản ghi sau" disabled={!rows.length || curPos === rows.length - 1} onClick={() => goTo(curPos + 1)}>▶</button>
          <button type="button" title="Bản ghi cuối" disabled={!rows.length || curPos === rows.length - 1} onClick={() => goTo(rows.length - 1)}>⏭</button>
        </div>
      )}
      {menu && <CyberContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
