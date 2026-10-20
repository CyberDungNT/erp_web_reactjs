import { CyberDate, toDateString, CyberForm, CyberNumeric, CyberTable, CyberTextBox, toast } from '@/components/cyber';

/**
 * MẪU – MÀN CHỨNG TỪ (loại Chứng từ, IsVoucher = 1)
 *
 * Cách dùng: chép file này thành src/modules/chungtu/<FormInPut>.jsx (vd PhieuThu.jsx), đổi tên component,
 *            sửa thông tin chung, cột chi tiết, thủ tục lấy số CT / lưu.
 * Bố cục: thông tin chung (số, ngày, diễn giải) -> dòng chi tiết (thêm / xoá bằng chuột phải) -> Lưu (Ctrl+S), Mới (F2).
 * Ví dụ đầy đủ hơn (lookup khách hàng, chọn kho, cộng dồn dòng): src/modules/dev/PhieuNhapPage.jsx
 * props: { menu, menuInfo } – menuInfo.Ma_Ct = mã chứng từ
 */
const PROC_NEW_NO = 'CP_Voucher_NewNo'; // lấy số chứng từ mới – đổi theo thủ tục thật
const PROC_SAVE = 'CP_Voucher_Save';    // lưu chứng từ – đổi theo thủ tục thật

// ngày dạng yyyy-MM-dd 00:00:00 (giống giá trị CyberDate trả về; theo giờ máy, không dùng toISOString – giờ UTC)
const ymd = (d) => `${toDateString(d)} 00:00:00`;
const today = () => ymd(new Date());
const EMPTY = { So_Ct: '', Ngay_Ct: today(), Dien_Giai: '', Ma_Vt: '', Ten_Vt: '', So_Luong: 1, Don_Gia: 0 };
const LINE_HEAD = [
  { Field: 'Stt', Caption: 'STT', Width: 50, Align: 'center' },
  { Field: 'Ma_Vt', Caption: 'Mã', Width: 110 },
  { Field: 'Ten_Vt', Caption: 'Tên', Width: 260 },
  { Field: 'So_Luong', Caption: 'Số lượng', Width: 100, Type: 'number', Sum: true },
  { Field: 'Don_Gia', Caption: 'Đơn giá', Width: 130, Type: 'number' },
  { Field: 'Tien', Caption: 'Thành tiền', Width: 150, Type: 'number', Sum: true },
];
const renumber = (lines) => lines.map((l, i) => ({ ...l, Stt: i + 1 }));

export default function MauChungTu({ menu, menuInfo }) {
  // mở màn / Làm mới (F5) / sau khi lưu: lấy số chứng từ mới, xoá dòng
  const onLoad = async (f) => {
    const res = await f.call(PROC_NEW_NO, [menuInfo?.Ma_Ct || '', f.user?.Ma_TTCP, f.user?.User_name, f.user?.TokenKey, '']);
    f.setVars({ lines: [] });
    f.form.setData({ ...EMPTY, Ngay_Ct: today(), So_Ct: res.table[0]?.So_Ct || '' });
  };

  const addLine = (f) => {
    const { Ma_Vt, Ten_Vt, So_Luong, Don_Gia } = f.data;
    if (!Ma_Vt) return toast.warning('Nhập mã trước khi thêm dòng.');
    if (!(So_Luong > 0)) return toast.warning('Số lượng phải lớn hơn 0.');
    f.setVar('lines', (lines = []) => renumber([...lines, { Ma_Vt, Ten_Vt, So_Luong, Don_Gia, Tien: So_Luong * Don_Gia }]));
    f.form.setData((d) => ({ ...d, Ma_Vt: '', Ten_Vt: '', So_Luong: 1, Don_Gia: 0 }));
  };

  const save = async (f) => {
    const d = f.data; const lines = f.vars.lines || [];
    if (!d.So_Ct) return toast.warning('Chưa có số chứng từ.');
    if (!lines.length) return toast.warning('Chứng từ chưa có dòng chi tiết.');
    const res = await f.call(PROC_SAVE, [menuInfo?.Ma_Ct || '', d.So_Ct, d.Ngay_Ct, d.Dien_Giai, JSON.stringify(lines),
      f.user?.Ma_TTCP, f.user?.User_name, f.user?.TokenKey, '']);
    const r = res.table[0] || {};
    if (String(r.Status ?? 'Y').toUpperCase() === 'N') return toast.error(r.Note || 'Lưu không thành công.');
    toast.success(`Đã lưu chứng từ ${d.So_Ct}.`);
    await f.reload(); // chứng từ mới
  };

  const newDoc = async (f) => {
    if ((f.vars.lines || []).length && !(await f.msg.yesNo('Chứng từ đang nhập chưa lưu. Bỏ qua và tạo mới?'))) return;
    await f.reload();
  };

  return (
    <CyberForm
      menu={menu}
      initialData={EMPTY}
      onLoad={onLoad}
      draftVars={['lines']}
      actions={[
        { key: 'new', text: 'Mới', icon: 'plus', shortcut: 'F2', onClick: newDoc },
        { key: 'save', text: 'Lưu', icon: 'tick', primary: true, shortcut: 'Ctrl+S', onClick: save },
      ]}
    >
      {(f) => (
        <>
          <CyberForm.Section title="Thông tin chung" icon="doc">
            <div className="grid grid--2">
              <CyberTextBox {...f.bind('So_Ct')} label="Số chứng từ" readOnly />
              <CyberDate {...f.bind('Ngay_Ct')} label="Ngày chứng từ" required />
              <CyberTextBox {...f.bind('Dien_Giai')} label="Diễn giải" />
            </div>
          </CyberForm.Section>
          <CyberForm.Section title="Chi tiết" icon="list">
            <div className="grid grid--2">
              <CyberTextBox {...f.bind('Ma_Vt')} label="Mã" upperCase />
              <CyberTextBox {...f.bind('Ten_Vt')} label="Tên" />
              <CyberNumeric {...f.bind('So_Luong')} label="Số lượng" min={0} />
              <CyberNumeric {...f.bind('Don_Gia')} label="Đơn giá" min={0} />
            </div>
            <p><button type="button" className="cy-btn cy-btn--primary" onClick={() => addLine(f)}>+ Thêm dòng</button></p>
            <CyberTable head={LINE_HEAD} data={f.vars.lines || []} height={300}
              contextMenu={[{ text: 'Xoá dòng', danger: true, onClick: (row) => f.setVar('lines', (ls) => renumber(ls.filter((l) => l !== row))) }]} />
          </CyberForm.Section>
        </>
      )}
    </CyberForm>
  );
}
