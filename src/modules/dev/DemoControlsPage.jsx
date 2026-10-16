import { useRef, useState } from 'react';
import {
  CyberTextBox, CyberNumeric, CyberLookup, CyberDate, CyberCheckBox,
  CyberRadioButton, CyberCombobox, CyberTable, CyberPopup, CyberMsgBox, msgbox, toast, CyberFileUpload,
} from '@/components/cyber';
import { useCyberForm } from '@/hooks/useCyberForm';
import { useProc } from '@/hooks/useProc';
import { callProc } from '@/api/apiClient';

const initialForm = {
  SoCT: '',
  GhiChu: '',
  MaKH: null,
  TenKH: '',
  DiaChi: '',
  NgayCT: new Date().toISOString().slice(0, 10),
  SoLuong: 1,
  DonGia: 0,
  TyLeCK: 0,
  MaKho: null,
  LoaiCT: 'NHAP',
  ThanhToan: 'TM',
  DaDuyet: false,
  IsActive: 1,
};

const loaiCTItems = [
  { value: 'NHAP', text: 'Phiếu nhập' },
  { value: 'XUAT', text: 'Phiếu xuất' },
  { value: 'CHUYEN', text: 'Chuyển kho' },
];

// ===== Dữ liệu lớn để test cố định cột/dòng =====
const bigHead = [
  { Field: 'MaCT', Caption: 'Số CT', Width: 100 },
  { Field: 'NgayCT', Caption: 'Ngày CT', Width: 95, Type: 'date' },
  { Field: 'TenKH', Caption: 'Khách hàng', Width: 200 },
  ...['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12'].map((t) => ({
    Field: t, Caption: `Tháng ${t.slice(1)}`, Width: 110, Type: 'number', Sum: true,
  })),
  { Field: 'TongTien', Caption: 'Tổng tiền', Width: 130, Type: 'number', Sum: true },
  { Field: 'UuTien', Caption: 'Ưu tiên', Width: 70, Type: 'bool' },
  { Field: 'TrangThai', Caption: 'Trạng thái', Width: 110 },
];
const tenKH = ['Minh Phát', 'Hoàng Long', 'Bình An', 'Thành Đạt', 'Phú Quý', 'Hưng Thịnh', 'Ánh Dương'];
const bigData = Array.from({ length: 300 }, (_, i) => {
  const row = {
    MaCT: `HD${String(i + 1).padStart(5, '0')}`,
    NgayCT: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    TenKH: `Công ty ${tenKH[i % tenKH.length]} ${Math.floor(i / 7) + 1}`,
    UuTien: i % 37 === 5,
    TrangThai: ['Chờ duyệt', 'Đã duyệt', 'Đã giao'][i % 3],
  };
  let sum = 0;
  for (let m = 1; m <= 12; m++) {
    const v = ((i * 7919 + m * 104729) % 9000 + 1000) * 1000;
    row[`T${String(m).padStart(2, '0')}`] = v;
    sum += v;
  }
  row.TongTien = sum;
  return row;
});

const msgLangItems = [
  { value: 'V', text: 'Tiếng Việt' },
  { value: 'E', text: 'English' },
];
const msgTypeItems = [
  { value: 'success', text: 'success' },
  { value: 'warning', text: 'warning' },
  { value: 'failed', text: 'failed' },
  { value: 'yesno', text: 'yesno' },
  { value: 'info', text: 'info' },
];

const thanhToanTable = [
  { Ma: 'TM', Ten: 'Tiền mặt' },
  { Ma: 'CK', Ten: 'Chuyển khoản' },
  { Ma: 'CN', Ten: 'Công nợ' },
];

export default function DemoControlsPage() {
  // ===== Form chính: mọi control bind vào form.data =====
  const form = useCyberForm(initialForm);
  const [errors, setErrors] = useState({});
  const [log, setLog] = useState([]);
  const addLog = (msg) =>
    setLog((l) => [`${new Date().toLocaleTimeString('vi-VN')}  ${msg}`, ...l].slice(0, 50));

  const thanhTien = (form.data.SoLuong || 0) * (form.data.DonGia || 0) * (1 - (form.data.TyLeCK || 0) / 100);

  const fillFromCode = () => {
    form.setData({
      ...form.data,
      SoCT: 'PN-2026-0001',
      GhiChu: 'Gán từ code -> control tự cập nhật',
      MaKH: 'KH002',
      TenKH: 'Công ty CP Hoàng Long',
      DiaChi: 'Cầu Giấy, Hà Nội',
      NgayCT: '2026-12-31',
      SoLuong: 1250,
      DonGia: 1234567.89,
      TyLeCK: 5,
      MaKho: 'K02',
      LoaiCT: 'XUAT',
      ThanhToan: 'CK',
      DaDuyet: true,
      IsActive: 0,
    });
    setErrors({});
    addLog('Gán dữ liệu từ code');
  };

  const validate = () => {
    const e = {};
    if (!form.data.SoCT) e.SoCT = 'Chưa nhập số chứng từ';
    if (!form.data.MaKH) e.MaKH = 'Chưa chọn khách hàng';
    if (!form.data.MaKho) e.MaKho = 'Chưa chọn kho';
    if (!(form.data.SoLuong > 0)) e.SoLuong = 'Số lượng phải > 0';
    setErrors(e);
    addLog(Object.keys(e).length ? `Validate lỗi: ${Object.keys(e).join(', ')}` : 'Validate OK');
  };

  // ===== Bảng: proc trả 2 bảng -> tables[0] = head, tables[1] = data =====
  const { tables, loading, error, reload } = useProc('Demo_GetHangHoa', []);
  const head = tables[0] || [];
  const data = tables[1] || [];

  // ===== Popup sửa dòng =====
  const editForm = useCyberForm({});
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const openEdit = (row) => {
    editForm.setData({ ...row });
    setEditOpen(true);
  };
  const saveEdit = async () => {
    setSaving(true);
    try {
      const d = editForm.data;
      await callProc('Demo_SaveHangHoa', [d.MaHang, d.TenHang, d.SoLuong, d.DonGia]);
      addLog(`Đã lưu ${d.MaHang}`);
      setEditOpen(false);
      reload();
    } catch (err) {
      addLog('Lỗi lưu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (row) => {
    const ok = await msgbox.yesNo(`Xoá ${row.MaHang} - ${row.TenHang}?`, {
      title: 'Xoá hàng hoá', detail: 'Dữ liệu đã xoá không thể khôi phục.', yesText: 'Xoá', noText: 'Huỷ', danger: true,
    });
    if (!ok) return;
    try {
      await callProc('Demo_DeleteHangHoa', [row.MaHang]);
      addLog(`Đã xoá ${row.MaHang}`);
      msgbox.success(`Đã xoá ${row.MaHang}`);
      reload();
    } catch (err) {
      msgbox.failed('Không xoá được hàng hoá', { detail: err.message });
    }
  };

  // ===== CyberMsgBox =====
  const mb = useCyberForm({
    Type: 'yesno',
    Title: '',
    Message: 'Bạn có chắc muốn lưu chứng từ này?',
    Detail: 'Sau khi lưu, chứng từ sẽ được chuyển sang trạng thái chờ duyệt.',
    Lang: 'V',
    Danger: false,
  });
  const mbOpts = () => ({
    title: mb.data.Title || undefined,
    detail: mb.data.Detail || undefined,
    lang: mb.data.Lang,
    danger: !!mb.data.Danger,
  });
  /** Gọi msgbox.<type> và ghi kết quả Promise trả về vào nhật ký */
  const showMsg = async (type) => {
    const fn = { success: msgbox.success, warning: msgbox.warning, failed: msgbox.failed, yesno: msgbox.yesNo, info: msgbox.info }[type];
    addLog(`msgbox.${type === 'yesno' ? 'yesNo' : type}(...) mở`);
    const r = await fn(mb.data.Message, mbOpts());
    addLog(`msgbox.${type === 'yesno' ? 'yesNo' : type} -> ${r}`);
  };
  /** Kịch bản thực tế: hỏi -> giả lập lưu -> báo kết quả (await nối tiếp) */
  const runFlow = async (willFail) => {
    const ok = await msgbox.yesNo('Lưu phiếu nhập PN-2026-0001?', { title: 'Lưu chứng từ' });
    addLog(`Kịch bản: hỏi lưu -> ${ok}`);
    if (!ok) return msgbox.warning('Đã huỷ thao tác lưu.');
    await new Promise((r) => setTimeout(r, 600));
    if (willFail) {
      await msgbox.failed('Lưu chứng từ thất bại', { detail: 'Lỗi SQL 547: xung đột ràng buộc khoá ngoại (MaKho = K09).' });
      addLog('Kịch bản: lưu lỗi');
    } else {
      await msgbox.success('Đã lưu phiếu nhập PN-2026-0001', { detail: 'Tổng tiền: 12.345.678 đ' });
      addLog('Kịch bản: lưu thành công');
    }
  };
  /** Mở liên tiếp nhiều hộp: hộp sau chồng lên hộp trước, Esc / Enter chỉ tác động hộp trên cùng */
  const stackMsgs = () => {
    msgbox.info('Hộp 1 (dưới cùng)').then((r) => addLog(`Hộp 1 -> ${r}`));
    msgbox.warning('Hộp 2').then((r) => addLog(`Hộp 2 -> ${r}`));
    msgbox.yesNo('Hộp 3 (trên cùng) – trả lời trước').then((r) => addLog(`Hộp 3 -> ${r}`));
  };
  // Dạng component (tự quản lý state open)
  const [declOpen, setDeclOpen] = useState(false);

  // ===== CyberFileUpload =====
  const up = useCyberForm({ DinhKem: [], AnhDaiDien: [], BaoCao: [] });

  // ===== CyberToast =====
  const ts = useCyberForm({
    Title: '',
    Message: 'Đã lưu phiếu nhập PN-2026-0001',
    Duration: 3500,
    Action: false,
  });
  const lastToast = useRef(null);
  /** Gọi toast.<type> với các tuỳ chọn đang nhập; id trả về dùng cho toast.dismiss(id) */
  const showToast = (type) => {
    const id = toast[type](ts.data.Message, {
      title: ts.data.Title || undefined,
      duration: Number(ts.data.Duration) || 0,
      action: ts.data.Action ? { text: 'Hoàn tác', onClick: () => addLog(`toast #${id}: bấm Hoàn tác`) } : undefined,
    });
    lastToast.current = id;
    addLog(`toast.${type}(...) -> id ${id}`);
  };
  /** Kịch bản: toast "đang xử lý" không tự ẩn -> xong thì đóng và báo kết quả */
  const toastFlow = async () => {
    const id = toast.info('Đang đồng bộ dữ liệu...', { title: 'Đồng bộ', duration: 0 });
    await new Promise((r) => setTimeout(r, 1800));
    toast.dismiss(id);
    toast.success('Đồng bộ xong 128 bản ghi', { title: 'Đồng bộ' });
    addLog('Kịch bản toast: xử lý -> xong');
  };
  const toastBurst = () => {
    ['success', 'info', 'warning', 'error', 'info'].forEach((type, i) =>
      setTimeout(() => toast[type](`Toast thứ ${i + 1} (${type})`), i * 250));
    addLog('Bắn 5 toast liên tiếp (tối đa 4 cái cùng lúc)');
  };

  // ===== Cố định cột / dòng =====
  const freeze = useCyberForm({ Left: 3, Right: 1, Rows: 1, PinUuTien: false });

  // ===== Popup tuỳ ý =====
  const [freeOpen, setFreeOpen] = useState(false);
  const freeForm = useCyberForm({ TuNgay: '2026-10-01', DenNgay: '2026-10-31', MaKH: null, TenKH: '' });

  return (
    <div className="page">
      <div className="page__title">
        <h2>Test bộ control Cyber*</h2>
        <div className="page__actions">
          <button className="cy-btn" onClick={fillFromCode}>Gán giá trị từ code</button>
          <button className="cy-btn" onClick={() => { form.reset(); setErrors({}); addLog('Reset form'); }}>Reset</button>
          <button className="cy-btn cy-btn--primary" onClick={validate}>Kiểm tra dữ liệu</button>
        </div>
      </div>

      <div className="split">
        <div>
          <section className="panel">
            <h3 className="panel__title">Nhập liệu (two-way binding vào form.data)</h3>
            <div className="grid grid--2">
              <div>
                <CyberTextBox {...form.bind('SoCT')} label="Số chứng từ" required upperCase
                  maxLength={20} placeholder="VD: PN-0001" error={errors.SoCT} />
                <CyberDate {...form.bind('NgayCT')} label="Ngày chứng từ" />
                <CyberLookup
                  {...form.bind('MaKH')}
                  textField="TenKH"
                  label="Khách hàng" required error={errors.MaKH}
                  procName="Demo_LookupKhachHang"
                  valueField="MaKH"
                  displayField="TenKH"
                  columns={[
                    { field: 'MaKH', caption: 'Mã KH', width: 70 },
                    { field: 'TenKH', caption: 'Tên khách hàng', width: 200 },
                    { field: 'DiaChi', caption: 'Địa chỉ', width: 140 },
                  ]}
                  placeholder="Gõ mã hoặc tên, F4 để xem tất cả"
                  onSelect={(row) => {
                    form.setField('DiaChi', row?.DiaChi ?? '');
                    addLog(`Lookup chọn: ${row ? row.MaKH + ' - ' + row.TenKH : '(trống)'}`);
                  }}
                />
                <CyberTextBox {...form.bind('DiaChi')} label="Địa chỉ" readOnly />
                <CyberCombobox
                  {...form.bind('MaKho')}
                  label="Kho" required error={errors.MaKho}
                  procName="Demo_GetKho"
                  valueField="MaKho" displayField="TenKho" showValue
                  onChange={(v, row) => addLog(`Combobox chọn: ${v} (${row?.TenKho ?? ''})`)}
                />
                <CyberTextBox {...form.bind('GhiChu')} label="Ghi chú" multiline rows={2} />
              </div>
              <div>
                <CyberNumeric {...form.bind('SoLuong')} label="Số lượng" decimals={0} min={0} error={errors.SoLuong} />
                <CyberNumeric {...form.bind('DonGia')} label="Đơn giá" decimals={2} />
                <CyberNumeric {...form.bind('TyLeCK')} label="% Chiết khấu" decimals={2} min={0} max={100} />
                <CyberNumeric value={thanhTien} label="Thành tiền" decimals={2} readOnly />
                <CyberRadioButton {...form.bind('LoaiCT')} label="Loại CT" items={loaiCTItems} />
                <CyberRadioButton {...form.bind('ThanhToan')} label="Thanh toán"
                  dataSource={thanhToanTable} valueField="Ma" displayField="Ten" />
                <CyberCheckBox {...form.bind('DaDuyet')} label="Trạng thái" text="Đã duyệt" />
                <CyberCheckBox {...form.bind('IsActive')} label="Hoạt động" text="Đang dùng (lưu 1/0)"
                  trueValue={1} falseValue={0} />
              </div>
            </div>
            <p className="hint">
              Số kiểu Việt Nam (dấu chấm nghìn, phẩy thập phân):
            </p>
            <div style={{ maxWidth: 380 }}>
              <CyberNumeric {...form.bind('DonGia')} label="Đơn giá (VN)" decimals={2}
                thousandSep="." decimalSep="," />
            </div>
          </section>

          <section className="panel">
            <h3 className="panel__title">CyberTable – head &amp; data lấy từ proc Demo_GetHangHoa</h3>
            <p className="hint">Click: chọn dòng · Double-click / Enter: sửa · Chuột phải: menu · ↑↓: di chuyển · Bấm tiêu đề: sắp xếp</p>
            {error && <div className="alert alert--error">{error}</div>}
            <CyberTable
              head={head}
              data={data}
              loading={loading}
              height={300}
              showSearch
              onRowClick={(row, i) => addLog(`Click dòng ${i}: ${row.MaHang}`)}
              onRowDoubleClick={(row) => openEdit(row)}
              rowClassName={(row) => (row.SoLuong === 0 ? 'row-out-of-stock' : '')}
              contextMenu={(row) => [
                { text: 'Sửa', icon: '✎', shortcut: 'Enter', onClick: () => openEdit(row) },
                { text: 'Xem chi tiết', icon: '👁', onClick: () => msgbox.info(`${row.MaHang} - ${row.TenHang}`, { title: 'Chi tiết hàng hoá', detail: JSON.stringify(row, null, 2) }) },
                { text: 'Sao chép mã', icon: '⧉', onClick: () => { navigator.clipboard?.writeText(row.MaHang); addLog(`Đã copy ${row.MaHang}`); } },
                { text: 'Ngừng kinh doanh', icon: '⏸', disabled: !row.ConKD, onClick: () => addLog(`Ngừng KD ${row.MaHang}`) },
                '-',
                { text: 'Làm mới', icon: '⟳', onClick: () => reload() },
                { text: 'Xoá', icon: '🗑', danger: true, onClick: () => remove(row) },
              ]}
            />
          </section>

          <section className="panel">
            <h3 className="panel__title">CyberTable – cố định cột &amp; dòng khi cuộn (300 dòng × 18 cột)</h3>
            <div className="grid grid--2">
              <div>
                <CyberNumeric {...freeze.bind('Left')} label="Cố định cột trái" labelWidth={140} min={0} max={10} />
                <CyberNumeric {...freeze.bind('Right')} label="Cố định cột phải" labelWidth={140} min={0} max={5} />
              </div>
              <div>
                <CyberNumeric {...freeze.bind('Rows')} label="Cố định dòng đầu" labelWidth={140} min={0} max={10} />
                <CyberCheckBox {...freeze.bind('PinUuTien')} label="Ghim dòng" labelWidth={140}
                  text="Ghim các dòng Ưu tiên lên đầu" />
              </div>
            </div>
            <p className="hint">Cuộn ngang/dọc để thấy tiêu đề, dòng tổng, cột và dòng cố định luôn hiển thị.</p>
            <CyberTable
              head={bigHead}
              data={bigData}
              height={420}
              showSearch
              frozenColumns={freeze.data.Left || 0}
              frozenRightColumns={freeze.data.Right || 0}
              frozenRows={freeze.data.Rows || 0}
              isRowFrozen={freeze.data.PinUuTien ? (row) => row.UuTien : undefined}
              onRowClick={(row) => addLog(`Bảng lớn – click ${row.MaCT}`)}
              contextMenu={[{ text: 'Xem', icon: '👁', onClick: (row) => addLog(`Xem ${row.MaCT}`) }]}
            />
          </section>

          <section className="panel">
            <h3 className="panel__title">CyberPopup – vẽ giao diện tuỳ ý</h3>
            <button className="cy-btn cy-btn--primary" onClick={() => setFreeOpen(true)}>Mở popup lọc báo cáo</button>
          </section>

          <section className="panel">
            <h3 className="panel__title">CyberMsgBox – hộp thông báo (success, warning, failed, yesno, info)</h3>
            <div className="grid grid--2">
              <div>
                <CyberTextBox {...mb.bind('Message')} label="Nội dung" multiline rows={2} />
                <CyberTextBox {...mb.bind('Detail')} label="Chi tiết (detail)" multiline rows={2} placeholder="Để trống nếu không cần" />
                <CyberTextBox {...mb.bind('Title')} label="Tiêu đề" placeholder="Để trống = tiêu đề mặc định theo dạng" />
              </div>
              <div>
                <CyberRadioButton {...mb.bind('Lang')} label="Ngôn ngữ" items={msgLangItems} />
                <CyberCheckBox {...mb.bind('Danger')} label="Nút Có" text="Màu đỏ (danger) – dạng yesno" />
                <CyberRadioButton {...mb.bind('Type')} label="Dạng (component)" items={msgTypeItems} />
              </div>
            </div>

            <p className="hint">Gọi nhanh <code>msgbox.*</code> (trả về Promise – kết quả ghi vào Nhật ký sự kiện):</p>
            <div className="page__actions">
              <button className="cy-btn" onClick={() => showMsg('success')}>✔ success</button>
              <button className="cy-btn" onClick={() => showMsg('warning')}>⚠ warning</button>
              <button className="cy-btn" onClick={() => showMsg('failed')}>✖ failed</button>
              <button className="cy-btn cy-btn--primary" onClick={() => showMsg('yesno')}>? yesNo</button>
              <button className="cy-btn" onClick={() => showMsg('info')}>ℹ info</button>
            </div>

            <p className="hint" style={{ marginTop: 14 }}>Kịch bản thực tế &amp; trường hợp đặc biệt:</p>
            <div className="page__actions">
              <button className="cy-btn" onClick={() => runFlow(false)}>Hỏi → lưu thành công</button>
              <button className="cy-btn" onClick={() => runFlow(true)}>Hỏi → lưu thất bại</button>
              <button className="cy-btn" onClick={stackMsgs}>Mở 3 hộp chồng nhau</button>
              <button className="cy-btn" onClick={() => msgbox.warning('Chuỗi rất dài: ' + 'Lorem ipsum dolor sit amet, '.repeat(12), { detail: 'Dòng 1\nDòng 2\nDòng 3 – xuống dòng bằng \\n' })}>
                Nội dung dài / nhiều dòng
              </button>
              <button className="cy-btn" onClick={() => setDeclOpen(true)}>Dạng component &lt;CyberMsgBox /&gt;</button>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              Phím: <b>Enter</b> = nút chính, <b>Esc</b> = Không / đóng, <b>Tab</b> chỉ chạy trong hộp.
            </p>

            <CyberMsgBox open={declOpen} type={mb.data.Type} title={mb.data.Title || undefined} message={mb.data.Message}
              detail={mb.data.Detail || undefined} lang={mb.data.Lang} danger={!!mb.data.Danger}
              onClose={(r) => { setDeclOpen(false); addLog(`<CyberMsgBox type="${mb.data.Type}"> onClose(${r})`); }} />
          </section>

          <section className="panel">
            <h3 className="panel__title">CyberFileUpload – kéo thả file, tải lên api/File/upload</h3>
            <CyberFileUpload {...up.bind('DinhKem')} label="Đính kèm chứng từ" layout="vertical" maxSize={20} maxFiles={5}
              onUploaded={(file) => addLog(`Đã tải lên: ${file.name} (id ${file.id})`)}
              onRemove={(file) => addLog(`Bỏ file: ${file.name}`)} />
            <div className="grid grid--2" style={{ marginTop: 12 }}>
              <CyberFileUpload {...up.bind('AnhDaiDien')} label="Ảnh đại diện (1 ảnh, xoá trên server khi bỏ)" layout="vertical"
                accept="image/*" multiple={false} maxSize={5} deleteOnRemove />
              <CyberFileUpload {...up.bind('BaoCao')} label="Chỉ PDF / Excel" layout="vertical" accept=".pdf,.xls,.xlsx" maxFiles={3} />
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              Giá trị bind (lưu các <code>id</code> vào DB cùng chứng từ, mở lại thì gán mảng này vào form để hiện lại):
            </p>
            <pre className="json-view">{JSON.stringify(up.data, null, 2)}</pre>
            <div className="page__actions">
              <button className="cy-btn" onClick={() => { up.reset(); addLog('Xoá danh sách file (không xoá trên server)'); }}>Làm trống</button>
            </div>
          </section>

          <section className="panel">
            <h3 className="panel__title">CyberToast – thông báo nhanh ở trên cùng (success, info, warning, error)</h3>
            <div className="grid grid--2">
              <div>
                <CyberTextBox {...ts.bind('Message')} label="Nội dung" multiline rows={2} />
                <CyberTextBox {...ts.bind('Title')} label="Tiêu đề" placeholder="Để trống nếu không cần" />
              </div>
              <div>
                <CyberNumeric {...ts.bind('Duration')} label="Thời gian (ms)" min={0} allowNegative={false} />
                <CyberCheckBox {...ts.bind('Action')} label="Nút hành động" text={'Thêm nút "Hoàn tác" (action)'} />
              </div>
            </div>

            <p className="hint">Gọi nhanh <code>toast.*</code> (trả về id – thời gian <b>0</b> = không tự ẩn, rê chuột vào toast để tạm dừng):</p>
            <div className="page__actions">
              <button className="cy-btn" onClick={() => showToast('success')}>✔ success</button>
              <button className="cy-btn cy-btn--primary" onClick={() => showToast('info')}>ℹ info</button>
              <button className="cy-btn" onClick={() => showToast('warning')}>⚠ warning</button>
              <button className="cy-btn" onClick={() => showToast('error')}>✖ error</button>
            </div>

            <p className="hint" style={{ marginTop: 14 }}>Kịch bản &amp; trường hợp đặc biệt:</p>
            <div className="page__actions">
              <button className="cy-btn" onClick={toastFlow}>Đang xử lý → xong</button>
              <button className="cy-btn" onClick={toastBurst}>Bắn 5 toast liên tiếp</button>
              <button className="cy-btn" onClick={() => toast.warning('Chuỗi rất dài: ' + 'Lorem ipsum dolor sit amet, '.repeat(8), { title: 'Nội dung dài' })}>
                Nội dung dài
              </button>
              <button className="cy-btn" onClick={() => { toast.dismiss(lastToast.current); addLog(`toast.dismiss(${lastToast.current})`); }}>
                Đóng toast vừa mở
              </button>
              <button className="cy-btn" onClick={() => { toast.dismiss(); addLog('toast.dismiss() – đóng tất cả'); }}>Đóng tất cả</button>
            </div>

            <p className="hint" style={{ marginTop: 14 }}>Lỗi tự bật toast (cấu hình ở <code>utils/errorReporter.js</code>):</p>
            <div className="page__actions">
              <button className="cy-btn" onClick={() => callProc('Proc_Khong_Ton_Tai', []).catch(() => addLog('callProc lỗi -> toast'))}>Gọi API lỗi</button>
              <button className="cy-btn" onClick={() => callProc('Proc_Khong_Ton_Tai', [], { silent: true }).catch((e) => addLog(`silent: ${e.message}`))}>Gọi API lỗi (silent)</button>
              <button className="cy-btn" onClick={() => { ts.bind('SaiTenField'); addLog("form.bind('SaiTenField')"); }}>Bind sai tên field</button>
              <button className="cy-btn" onClick={() => setTimeout(() => { throw new Error('Lỗi JS không được bắt (demo)'); })}>Lỗi JS</button>
              <button className="cy-btn" onClick={() => Promise.reject(new Error('Promise bị reject không có catch (demo)'))}>Promise reject</button>
              <button className="cy-btn" onClick={() => console.error('console.error từ code (demo)', { ma: 42 })}>console.error</button>
            </div>
          </section>
        </div>

        <div>
          <section className="panel">
            <h3 className="panel__title">form.data (cập nhật theo thời gian thực)</h3>
            <pre className="json-view">{JSON.stringify(form.data, null, 2)}</pre>
          </section>
          <section className="panel">
            <h3 className="panel__title">Nhật ký sự kiện</h3>
            <ul className="log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </section>
        </div>
      </div>

      {/* Popup sửa dòng */}
      <CyberPopup
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Sửa hàng hoá: ${editForm.data.MaHang ?? ''}`}
        width={520}
        footer={<>
          <button className="cy-btn" onClick={() => setEditOpen(false)}>Đóng</button>
          <button className="cy-btn cy-btn--primary" onClick={saveEdit} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </>}
      >
        <CyberTextBox {...editForm.bind('MaHang')} label="Mã hàng" readOnly />
        <CyberTextBox {...editForm.bind('TenHang')} label="Tên hàng" autoFocus />
        <CyberNumeric {...editForm.bind('SoLuong')} label="Số lượng" />
        <CyberNumeric {...editForm.bind('DonGia')} label="Đơn giá" decimals={2} />
        <CyberDate {...editForm.bind('NgayNhap')} label="Ngày nhập" />
        <CyberCheckBox {...editForm.bind('ConKD')} label=" " text="Còn kinh doanh" />
      </CyberPopup>

      {/* Popup tuỳ ý: chứa form lọc + bảng */}
      <CyberPopup open={freeOpen} onClose={() => setFreeOpen(false)} title="Điều kiện lọc báo cáo" width={760}
        footer={<button className="cy-btn cy-btn--primary" onClick={() => {
          addLog(`Lọc: ${JSON.stringify(freeForm.data)}`); setFreeOpen(false);
        }}>Đồng ý</button>}>
        <div className="grid grid--2">
          <CyberDate {...freeForm.bind('TuNgay')} label="Từ ngày" labelWidth={80} />
          <CyberDate {...freeForm.bind('DenNgay')} label="Đến ngày" labelWidth={80} min={freeForm.data.TuNgay} />
        </div>
        <CyberLookup {...freeForm.bind('MaKH')} textField="TenKH" label="Khách hàng" labelWidth={80}
          procName="Demo_LookupKhachHang" valueField="MaKH" displayField="TenKH" />
        <p className="hint">Bảng bên trong popup:</p>
        <CyberTable head={head} data={data} height={200} />
      </CyberPopup>
    </div>
  );
}
