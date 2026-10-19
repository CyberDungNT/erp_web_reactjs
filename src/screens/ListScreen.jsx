import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { CyberTable, toast } from '@/components/cyber';
import Icon from '@/components/icons/Icon';
import { findForm, listCodeOf, loadList, LIST_PROC } from './menuForm';
import './list.css';

/**
 * MÀN DANH MỤC CHUNG – mở khi CP_SysGetMenu trả IsList = 1.
 * Gọi CP_SysList (menuForm.loadList) rồi nhận diện các bảng trả về theo cột (không phụ thuộc thứ tự):
 *   bảng đầu tiên                    -> DỮ LIỆU (cột riêng: Bold = 1 in đậm, BackColor / ForeColor = 'r, g, b' tô màu dòng)
 *   bảng có Field_Name + Field_Width -> HEAD: mô tả cột
 *        Field_Name  tên cột trong dữ liệu ('' = dòng khai báo NHÓM cột, Field_ban = mã nhóm, Field_Head = tiêu đề nhóm)
 *        Field_Head  tiêu đề      Field_Width  độ rộng (0 = ẩn)      Field_Type  C chữ | N số | D ngày | B ô vuông
 *        TextAlign   L | C | R    Format  vd '### ###.##' (số lẻ)   Field_ban0 / CaptionGroup  nhóm của cột
 *        (danh mục KHÔNG hiện dòng tổng cộng, bỏ qua SumAvgCountMinMax)
 *   bảng có ColFrozen / Title        -> CẤU HÌNH: Title (tiêu đề), ColFrozen (số cột cố định bên trái),
 *        FormInPut = TÊN FORM SỬA / THÊM MỚI: bấm Mới / Sửa (hoặc nháy đúp dòng) -> mở file cùng tên trong src/modules
 *        trong CyberPopup (form đó kế thừa CyberFrmListF3 – có sẵn nút Lưu / Quay ra). Lưu xong tự tải lại danh mục.
 *   bảng có Field_Name, không Field_Width -> danh sách cột cho ô "Tìm theo" (Stt = -10: Tất cả)
 *   bảng có Status + Note            -> Status = N: báo Note (toast)
 */
const keyOf = (row, name) => row && Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
const get = (row, name) => { const k = keyOf(row, name); return k ? row[k] : undefined; };
const has = (table, ...names) => !!table?.[0] && names.every((n) => keyOf(table[0], n));
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

const TYPE = { B: 'bool', N: 'number', D: 'date', T: 'datetime' };
const ALIGN = { L: 'left', C: 'center', R: 'right' };

/** '### ###.##' -> 2 số lẻ */
const decimalsOf = (format) => { const m = /\.([#0]+)/.exec(str(format)); return m ? m[1].length : 0; };

/** Màu từ DB: '255, 224, 192' | '#ffe0c0' | 'Red' -> chuỗi CSS ('' nếu không có) */
function cssColor(v) {
  const s = str(v);
  if (!s || s === '0') return '';
  if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(s)) return `rgb(${s})`;
  return s;
}

/** Bảng head của CP_SysList -> mô tả cột cho CyberTable */
export function headToColumns(head) {
  const rows = [...(head || [])].sort((a, b) => (Number(get(a, 'Stt')) || 0) - (Number(get(b, 'Stt')) || 0));
  const groups = {}; // Field_ban của dòng nhóm -> tiêu đề nhóm
  rows.forEach((r) => { if (!str(get(r, 'Field_Name'))) groups[str(get(r, 'Field_ban'))] = str(get(r, 'Field_Head')); });
  return rows
    .filter((r) => str(get(r, 'Field_Name')) && Number(get(r, 'Field_Width')) > 0)
    .map((r) => {
      const type = TYPE[str(get(r, 'Field_Type')).toUpperCase()] || 'text';
      return {
        field: str(get(r, 'Field_Name')),
        caption: str(get(r, 'Field_Head')) || str(get(r, 'Field_Name')),
        width: Number(get(r, 'Field_Width')),
        type,
        decimals: decimalsOf(get(r, 'Format')),
        align: ALIGN[str(get(r, 'TextAlign')).toUpperCase()] || (type === 'bool' ? 'center' : undefined),
        sum: false, // danh mục không hiện dòng tổng cộng
        group: str(get(r, 'CaptionGroup')) || groups[str(get(r, 'Field_ban0'))] || null,
      };
    });
}

/** Màu / đậm của dòng dữ liệu (cột Bold, BackColor, ForeColor) */
function rowStyle(row) {
  const bg = cssColor(get(row, 'BackColor'));
  const fg = cssColor(get(row, 'ForeColor'));
  const bold = ['1', 'true'].includes(str(get(row, 'Bold')).toLowerCase());
  if (!bg && !fg && !bold) return undefined;
  return { ...(bg && { '--row-bg': bg }), ...(fg && { '--row-fg': fg }), ...(bold && { fontWeight: 700 }) };
}

const NARROW_MQ = '(max-width: 800px)'; // khớp MOBILE_MQ của MainLayout
function useNarrow() {
  const [on, setOn] = useState(() => window.matchMedia?.(NARROW_MQ).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW_MQ);
    if (!mq) return undefined;
    const fn = () => setOn(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return on;
}

const OPS = [
  { key: 'like', text: 'Like', test: (s, k) => s.includes(k) },
  { key: 'eq', text: '=', test: (s, k) => s === k },
  { key: 'start', text: 'Bắt đầu', test: (s, k) => s.startsWith(k) },
  { key: 'end', text: 'Kết thúc', test: (s, k) => s.endsWith(k) },
];

export default function ListScreen({ menu, menuInfo }) {
  const { user } = useAuth();
  const code = listCodeOf(menuInfo);
  const [state, setState] = useState({ loading: true, data: [], columns: [], config: null, searchFields: [] });
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState({ field: '', op: 'like', text: '' });
  const [editor, setEditor] = useState(null); // form sửa / thêm đang mở: { id, Form, mode, row }

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    loadList(code, user)
      .then((tables) => {
        if (!alive) return;
        const status = tables.find((t) => has(t, 'Status', 'Note'));
        if (status && str(get(status[0], 'Status')).toUpperCase() === 'N') {
          toast.error(str(get(status[0], 'Note')) || `${LIST_PROC} từ chối mở danh mục ${code}.`);
          return setState((s) => ({ ...s, loading: false }));
        }
        const rest = tables.slice(1);
        const head = rest.find((t) => has(t, 'Field_Name', 'Field_Width')) || [];
        const data = tables[0] || [];
        // Field_Name có thể khác hoa thường so với cột dữ liệu (vd 'tk011' vs 'Tk011') -> lấy đúng tên cột thật
        const columns = headToColumns(head).map((c) => ({ ...c, field: keyOf(data[0], c.field) || c.field }));
        setState((s) => ({
          loading: false,
          loaded: (s.loaded || 0) + 1, // số lần tải xong (đổi key -> bảng hiện dần lại)
          data,
          columns,
          config: rest.find((t) => has(t, 'ColFrozen') || has(t, 'Title', 'Order'))?.[0] || null,
          searchFields: (rest.find((t) => t !== head && has(t, 'Field_Name', 'Field_Head') && !keyOf(t[0], 'Field_Width')) || [])
            .filter((r) => str(get(r, 'Field_Name'))),
        }));
      })
      .catch((err) => {
        if (!alive) return;
        toast.error(err?.message || String(err));
        setState((s) => ({ ...s, loading: false }));
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, reload]);

  const { data, columns, config, searchFields } = state;

  // Ô tìm kiếm trên thanh công cụ: lọc theo 1 cột (hoặc tất cả cột hiển thị)
  const view = useMemo(() => {
    const k = search.text.trim().toLowerCase();
    if (!k) return data;
    const op = OPS.find((o) => o.key === search.op) || OPS[0];
    const fields = search.field ? [search.field] : columns.map((c) => c.field);
    return data.filter((row) => fields.some((f) => op.test(str(row[f]).toLowerCase(), k)));
  }, [data, columns, search]);

  const title = str(get(config, 'Title')) || menu?.text || code;
  // ColFrozen = số cột cố định trái; điện thoại hẹp -> chỉ giữ 1 cột (nhiều cột cố định sẽ chiếm hết màn, không cuộn ngang được)
  const narrow = useNarrow();
  const frozen = Math.min(narrow ? 1 : Infinity, Math.max(0, Number(get(config, 'ColFrozen')) || 0));
  const busy = state.loading;
  const pending = (what) => () => toast.info(`${what} – ${title}: chức năng đang được phát triển.`);
  const needRow = (what) => () => (selected ? pending(what)() : toast.warning('Chọn 1 dòng trong danh mục trước.'));

  // Mới / Sửa: mở form có tên = FormInPut (bảng cấu hình CP_SysList) trong popup
  const formName = str(get(config, 'FormInPut'));
  const openEditor = (mode, row = selected) => {
    if (busy) return;
    if (mode === 'edit' && !row) return toast.warning('Chọn 1 dòng trong danh mục trước.');
    if (!formName) return toast.warning(`${LIST_PROC} chưa khai báo FormInPut (form sửa) cho danh mục ${code}.`);
    const found = findForm(formName);
    if (!found) return toast.warning(`Chưa có form "${formName}" – tạo file src/modules/<thư mục>/${formName}.jsx (kế thừa CyberFrmListF3).`);
    setEditor({ id: Date.now(), Form: found.Component, mode, row: mode === 'edit' ? row : null });
  };

  const exportCsv = useCallback(() => {
    if (!view.length) return toast.warning('Không có dữ liệu để xuất.');
    const esc = (v) => `"${str(v).replace(/"/g, '""')}"`;
    const lines = [columns.map((c) => esc(c.caption)).join(','), ...view.map((r) => columns.map((c) => esc(r[c.field])).join(','))];
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${code || 'danh-muc'}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [view, columns, code]);

  return (
    <div className={`ls ${state.loading ? 'is-busy' : ''}`}>
      {/* Thanh chạy trên đỉnh khi đang gọi thủ tục (giống CyberForm – màn Phiếu nhập kho) */}
      <span className="cf__progress" aria-hidden="true" />
      <div className="ls__bar">
        <div className="ls__tools">
          <button type="button" className="cy-btn cy-btn--primary ls__btn" onClick={() => openEditor('new')} disabled={busy} title="Thêm mới">
            <Icon name="plus" size={15} /><span>Mới</span>
          </button>
          <button type="button" className="cy-btn ls__btn" onClick={() => openEditor('edit')} disabled={busy} title="Sửa dòng đang chọn"><Icon name="edit" size={15} /><span>Sửa</span></button>
          <button type="button" className="cy-btn ls__btn" onClick={() => setReload((n) => n + 1)} disabled={state.loading} title="Tải lại dữ liệu">
            <Icon name="refresh" size={15} className={state.loading ? 'cf__spin' : ''} /><span>Dữ liệu</span>
          </button>
          <button type="button" className="cy-btn ls__btn" onClick={needRow('Đổi mã')} disabled={busy}><Icon name="exchange" size={15} /><span>Đổi mã</span></button>
          <button type="button" className="cy-btn cy-btn--danger ls__btn" onClick={needRow('Xoá')} disabled={busy}><Icon name="trash" size={15} /><span>Xoá</span></button>
          <span className="ls__sep" />
          <button type="button" className="cy-btn ls__btn" title="Xuất Excel (CSV)" onClick={exportCsv} disabled={busy}><Icon name="download" size={15} /><span>Xuất</span></button>
        </div>
        <div className="ls__search">
          <select className="ls__select" value={search.field} aria-label="Tìm theo cột"
            onChange={(e) => setSearch((s) => ({ ...s, field: e.target.value }))}>
            <option value="">Tất cả</option>
            {(searchFields.length ? searchFields.map((r) => ({ field: str(get(r, 'Field_Name')), caption: str(get(r, 'Field_Head')) })) : columns)
              .filter((c) => columns.some((x) => x.field.toLowerCase() === c.field.toLowerCase()))
              .map((c) => <option key={c.field} value={columns.find((x) => x.field.toLowerCase() === c.field.toLowerCase()).field}>{c.caption}</option>)}
          </select>
          <select className="ls__select ls__select--op" value={search.op} aria-label="Cách so khớp"
            onChange={(e) => setSearch((s) => ({ ...s, op: e.target.value }))}>
            {OPS.map((o) => <option key={o.key} value={o.key}>{o.text}</option>)}
          </select>
          <label className="ls__input">
            <Icon name="search" size={14} />
            <input value={search.text} placeholder="Nhập nội dung tìm kiếm..." onChange={(e) => setSearch((s) => ({ ...s, text: e.target.value }))} />
          </label>
        </div>
      </div>

      {!state.loaded ? (
        // Lần tải đầu: khung xương nhấp nháy
        state.loading && <ListSkeleton />
      ) : (
        // Tải xong: bảng hiện dần; đang tải lại: làm mờ, giữ nguyên bảng cũ (không mất ô lọc đang nhập)
        <div className={`ls__body ${state.loading ? 'is-reloading' : ''}`}>
          <CyberTable
            className="ls__table"
            columns={columns}
            data={view}
            height="100%"
            frozenColumns={frozen}
            filterRow
            showNavigator
            rowStyle={rowStyle}
            emptyText="Không có dữ liệu"
            onSelectionChange={(row) => setSelected(row)}
            onRowDoubleClick={(row) => openEditor('edit', row)}
          />
        </div>
      )}

      {editor && (
        <Suspense fallback={null}>
          <editor.Form key={editor.id} mode={editor.mode} row={editor.row} list={{ code, title, config, fields: Object.keys(data[0] || {}) }}
            onClose={() => setEditor(null)} onSaved={() => setReload((n) => n + 1)} />
        </Suspense>
      )}
    </div>
  );
}

/** Khung xương lần tải đầu: thanh tiêu đề + dòng lọc + các dòng dữ liệu nhấp nháy */
function ListSkeleton() {
  return (
    <div className="ls__skeleton" aria-busy="true" aria-label="Đang tải danh mục">
      <div className="cf__sk ls__sk-head" />
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="ls__sk-row" style={{ '--i': i }}>
          <span className="cf__sk" style={{ width: 36 }} />
          <span className="cf__sk" style={{ width: `${14 + (i * 7) % 9}%` }} />
          <span className="cf__sk" style={{ flex: 1 }} />
          <span className="cf__sk" style={{ width: '12%' }} />
          <span className="cf__sk" style={{ width: '8%' }} />
        </div>
      ))}
    </div>
  );
}
