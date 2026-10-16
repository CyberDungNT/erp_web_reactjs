import { useState } from 'react';
import { CyberTable, CyberPopup, CyberTextBox, CyberNumeric, CyberDate, CyberCheckBox } from '@/components/cyber';
import { useProc } from '@/hooks/useProc';
import { useCyberForm } from '@/hooks/useCyberForm';
import { callProc } from '@/api/apiClient';

/**
 * MẪU MÀN HÌNH DANH MỤC – copy file này để làm màn hình mới.
 *  1. Đổi tên proc lấy danh sách / lưu / xoá
 *  2. Đổi các control trong popup
 */
const PROC_LIST = 'Demo_GetHangHoa';
const PROC_SAVE = 'Demo_SaveHangHoa';
const PROC_DELETE = 'Demo_DeleteHangHoa';

export default function HangHoaPage() {
  const { tables, loading, error, reload } = useProc(PROC_LIST, []);
  const [head, data] = [tables[0] || [], tables[1] || []];
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(null);
  const form = useCyberForm({});

  const edit = (row) => { form.setData({ ...row }); setOpen(true); };

  const save = async () => {
    const d = form.data;
    try {
      await callProc(PROC_SAVE, [d.MaHang, d.TenHang, d.SoLuong, d.DonGia]);
      setMsg({ ok: true, text: `Đã lưu ${d.MaHang}` });
      setOpen(false);
      reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const remove = async (row) => {
    if (!row || !window.confirm(`Xoá ${row.MaHang}?`)) return;
    try {
      await callProc(PROC_DELETE, [row.MaHang]);
      setMsg({ ok: true, text: `Đã xoá ${row.MaHang}` });
      reload();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
  };

  return (
    <div className="page">
      <div className="page__title">
        <h2>Danh mục hàng hoá</h2>
        <div className="page__actions">
          <button className="cy-btn" onClick={() => reload()}>⟳ Làm mới</button>
          <button className="cy-btn" disabled={!selected} onClick={() => edit(selected)}>✎ Sửa</button>
          <button className="cy-btn cy-btn--danger" disabled={!selected} onClick={() => remove(selected)}>🗑 Xoá</button>
        </div>
      </div>
      {error && <div className="alert alert--error">{error}</div>}
      {msg && <div className={`alert ${msg.ok ? 'alert--ok' : 'alert--error'}`}>{msg.text}</div>}
      <div className="panel">
        <CyberTable
          head={head}
          data={data}
          loading={loading}
          height="calc(100vh - 230px)"
          showSearch
          onSelectionChange={setSelected}
          onRowDoubleClick={edit}
          contextMenu={[
            { text: 'Sửa', icon: '✎', onClick: (row) => edit(row) },
            '-',
            { text: 'Xoá', icon: '🗑', danger: true, onClick: (row) => remove(row) },
          ]}
        />
      </div>

      <CyberPopup open={open} onClose={() => setOpen(false)} title="Cập nhật hàng hoá" width={500}
        footer={<>
          <button className="cy-btn" onClick={() => setOpen(false)}>Đóng</button>
          <button className="cy-btn cy-btn--primary" onClick={save}>Lưu</button>
        </>}>
        <CyberTextBox {...form.bind('MaHang')} label="Mã hàng" readOnly />
        <CyberTextBox {...form.bind('TenHang')} label="Tên hàng" required />
        <CyberNumeric {...form.bind('SoLuong')} label="Số lượng" />
        <CyberNumeric {...form.bind('DonGia')} label="Đơn giá" decimals={2} />
        <CyberDate {...form.bind('NgayNhap')} label="Ngày nhập" />
        <CyberCheckBox {...form.bind('ConKD')} label=" " text="Còn kinh doanh" />
      </CyberPopup>
    </div>
  );
}
