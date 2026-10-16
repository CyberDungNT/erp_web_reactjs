import {
  CyberForm, CyberTextBox, CyberDate, CyberLookup, CyberCombobox, CyberNumeric, CyberTable,
} from '../components/cyber';

/**
 * MÀN MẪU DÙNG CYBERFORM – Phiếu nhập kho.
 *  - onLoad: gọi song song 3 proc (số CT mới, danh sách kho, danh sách hàng) rồi gán dữ liệu mặc định
 *  - Thêm / xoá dòng chi tiết, tự tính thành tiền + tổng ở thanh trạng thái
 *  - Lưu (Ctrl+S): kiểm tra dữ liệu -> hỏi xác nhận -> gọi proc lưu -> báo kết quả -> tạo phiếu mới
 *  - Thêm mới (F2), Làm mới (F5) có sẵn từ CyberForm
 * Copy file này để làm màn chứng từ mới: đổi proc, control và cột chi tiết.
 */
const PROC_NEW_NO = 'CP_GLCD4';
const PROC_KHO = 'CP_GLCD4';
const PROC_HANG = 'CP_GLCD4';
const PROC_SAVE = 'CP_GLCD4';

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = {
  SoCT: '', NgayCT: today(), MaKH: null, TenKH: '', DiaChi: '', MaKho: null, GhiChu: '',
  // ô nhập dòng chi tiết
  MaHang: null, SoLuong: 1, DonGia: 0,
};

const LINE_HEAD = [
  { Field: 'STT', Caption: 'STT', Width: 50, Align: 'center' },
  { Field: 'MaHang', Caption: 'Mã hàng', Width: 90 },
  { Field: 'TenHang', Caption: 'Tên hàng', Width: 260 },
  { Field: 'DVT', Caption: 'ĐVT', Width: 60, Align: 'center' },
  { Field: 'SoLuong', Caption: 'Số lượng', Width: 100, Type: 'number', Decimals: 0, Sum: true },
  { Field: 'DonGia', Caption: 'Đơn giá', Width: 130, Type: 'number', Decimals: 0 },
  { Field: 'ThanhTien', Caption: 'Thành tiền', Width: 150, Type: 'number', Decimals: 0, Sum: true },
];

const money = (n) => Number(n || 0).toLocaleString('vi-VN');
const renumber = (lines) => lines.map((l, i) => ({ ...l, STT: i + 1 }));

export default function PhieuNhapPage({ menu }) {
  // ===== LOAD: chạy khi mở màn hình, khi bấm Làm mới (F5) và sau khi lưu / thêm mới =====
  const onLoad = async (f) => {
    const [so, kho, hang] = await Promise.all([f.call(PROC_NEW_NO), f.call(PROC_KHO), f.call(PROC_HANG)]);
    f.setVars({
      kho: kho.table,
      hangHoa: (hang.tables[1] || []).filter((h) => h.ConKD), // chỉ hàng còn kinh doanh
      lines: [],
      errors: {},
    });
    f.form.setData({ ...EMPTY, NgayCT: today(), SoCT: so.table[0]?.SoCT || '', MaKho: kho.table[0]?.MaKho ?? null });
  };

  // ===== Dòng chi tiết =====
  const addLine = (f) => {
    const { MaHang, SoLuong, DonGia } = f.data;
    const hang = f.vars.hangHoa.find((h) => h.MaHang === MaHang);
    if (!hang) return f.msg.warning('Chọn hàng hoá trước khi thêm dòng.');
    if (!(SoLuong > 0)) return f.msg.warning('Số lượng phải lớn hơn 0.');
    f.setVar('lines', (lines = []) => {
      const i = lines.findIndex((l) => l.MaHang === MaHang && l.DonGia === DonGia);
      const next = i >= 0 // trùng mã + đơn giá -> cộng dồn số lượng
        ? lines.map((l, j) => (j === i ? { ...l, SoLuong: l.SoLuong + SoLuong, ThanhTien: (l.SoLuong + SoLuong) * l.DonGia } : l))
        : [...lines, { MaHang, TenHang: hang.TenHang, DVT: hang.DVT, SoLuong, DonGia, ThanhTien: SoLuong * DonGia }];
      return renumber(next);
    });
    f.form.setData((d) => ({ ...d, MaHang: null, SoLuong: 1, DonGia: 0 }));
  };
  const removeLine = (f, row) => f.setVar('lines', (lines) => renumber(lines.filter((l) => l !== row)));

  // ===== Lưu =====
  const save = async (f) => {
    const d = f.data;
    const lines = f.vars.lines || [];
    const errors = {};
    if (!d.SoCT) errors.SoCT = 'Chưa có số chứng từ';
    if (!d.MaKH) errors.MaKH = 'Chưa chọn nhà cung cấp';
    if (!d.MaKho) errors.MaKho = 'Chưa chọn kho nhập';
    f.setVar('errors', errors);
    if (Object.keys(errors).length) return f.msg.warning('Vui lòng nhập đủ thông tin bắt buộc.', { detail: Object.values(errors).join('\n') });
    if (!lines.length) return f.msg.warning('Phiếu nhập chưa có dòng hàng nào.');

    const total = lines.reduce((s, l) => s + l.ThanhTien, 0);
    const ok = await f.msg.yesNo(`Lưu phiếu nhập ${d.SoCT}?`, {
      title: 'Lưu chứng từ', detail: `${lines.length} dòng hàng – tổng tiền ${money(total)} đ`, yesText: 'Lưu', noText: 'Huỷ',
    });
    if (!ok) return;

    const res = await f.call(PROC_SAVE, [d.SoCT, d.NgayCT, d.MaKH, d.MaKho, d.GhiChu, JSON.stringify(lines)]);
    const r = res.table[0] || {};
    if (r.Result !== 'OK') throw new Error(r.Message || 'Lưu không thành công'); // CyberForm tự báo msgbox.failed
    await f.msg.success(`Đã lưu phiếu nhập ${r.SoCT}`, { detail: `${r.SoDong} dòng hàng – tổng tiền ${money(total)} đ` });
    await f.reload(); // tạo phiếu mới
  };

  const newDoc = async (f) => {
    if ((f.vars.lines || []).length && !(await f.msg.yesNo('Phiếu đang nhập chưa lưu. Bỏ qua và tạo phiếu mới?'))) return;
    await f.reload();
  };

  return (
    <CyberForm
      menu={menu}
      title="Phiếu nhập kho"
      initialData={EMPTY}
      onLoad={onLoad}
      actions={(f) => [
        { key: 'new', text: 'Thêm mới', icon: 'file', shortcut: 'F2', onClick: newDoc },
        { key: 'save', text: 'Lưu', icon: 'tick', shortcut: 'Ctrl+S', primary: true, onClick: save,
          disabled: !(f.vars.lines || []).length, errorTitle: 'Lưu phiếu nhập thất bại' },
      ]}
      footer={(f) => {
        const lines = f.vars.lines || [];
        return (
          <>
            <span>Số dòng: <b>{lines.length}</b></span>
            <span>Tổng số lượng: <b>{money(lines.reduce((s, l) => s + l.SoLuong, 0))}</b></span>
            <span style={{ marginLeft: 'auto' }}>Tổng tiền: <b style={{ color: 'var(--brand-text)', fontSize: 14 }}>{money(lines.reduce((s, l) => s + l.ThanhTien, 0))} đ</b></span>
          </>
        );
      }}
    >
      {(f) => {
        const errors = f.vars.errors || {};
        return (
          <>
            <CyberForm.Section title="Thông tin chứng từ" icon="doc">
              <div className="grid grid--2">
                <div>
                  <CyberTextBox {...f.bind('SoCT')} label="Số chứng từ" readOnly error={errors.SoCT} />
                  <CyberDate {...f.bind('NgayCT')} label="Ngày chứng từ" />
                  <CyberCombobox {...f.bind('MaKho')} label="Kho nhập" required error={errors.MaKho}
                    dataSource={f.vars.kho} valueField="MaKho" displayField="TenKho" showValue />
                </div>
                <div>
                  <CyberLookup {...f.bind('MaKH')} textField="TenKH" label="Nhà cung cấp" required error={errors.MaKH}
                    procName="Demo_LookupKhachHang" valueField="MaKH" displayField="TenKH"
                    columns={[
                      { field: 'MaKH', caption: 'Mã', width: 70 },
                      { field: 'TenKH', caption: 'Tên nhà cung cấp', width: 220 },
                      { field: 'DiaChi', caption: 'Địa chỉ', width: 140 },
                    ]}
                    placeholder="Gõ mã hoặc tên, F4 để xem tất cả"
                    onSelect={(row) => f.form.setField('DiaChi', row?.DiaChi ?? '')} />
                  <CyberTextBox {...f.bind('DiaChi')} label="Địa chỉ" readOnly />
                  <CyberTextBox {...f.bind('GhiChu')} label="Diễn giải" />
                </div>
              </div>
            </CyberForm.Section>

            <CyberForm.Section title="Chi tiết hàng hoá" icon="box"
              extra={(f.vars.lines || []).length > 0 && (
                <button type="button" className="cy-btn cy-btn--danger"
                  onClick={async () => { if (await f.msg.yesNo('Xoá tất cả dòng hàng?', { danger: true })) f.setVar('lines', []); }}>
                  Xoá hết dòng
                </button>
              )}>
              <div className="pn-addline">
                <CyberCombobox {...f.bind('MaHang')} layout="vertical" label="Hàng hoá" dataSource={f.vars.hangHoa}
                  valueField="MaHang" displayField="TenHang" showValue
                  onChange={(v, row) => f.form.setField('DonGia', row?.DonGia ?? 0)} />
                <CyberNumeric {...f.bind('SoLuong')} layout="vertical" label="Số lượng" decimals={0} min={0} />
                <CyberNumeric {...f.bind('DonGia')} layout="vertical" label="Đơn giá" decimals={0} min={0} />
                <button type="button" className="cy-btn cy-btn--primary" onClick={() => addLine(f)}>+ Thêm dòng</button>
              </div>
              <CyberTable
                head={LINE_HEAD}
                data={f.vars.lines || []}
                height={300}
                contextMenu={(row) => [
                  { text: 'Xoá dòng', icon: '🗑', danger: true, onClick: () => removeLine(f, row) },
                ]}
              />
              <p className="hint" style={{ marginTop: 8 }}>Chuột phải vào dòng để xoá. Trùng mã hàng + đơn giá sẽ cộng dồn số lượng.</p>
            </CyberForm.Section>
          </>
        );
      }}
    </CyberForm>
  );
}
