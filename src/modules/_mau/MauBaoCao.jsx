import { CyberDate, toDateString, CyberForm, CyberTable, CyberTextBox, toast } from '@/components/cyber';

/**
 * MẪU – MÀN BÁO CÁO (loại Báo cáo, IsReport = 1)
 *
 * Cách dùng: chép file này thành src/modules/baocao/<FormInPut>.jsx (vd BcSoCaiTk.jsx), đổi tên component,
 *            sửa ô điều kiện lọc + thủ tục lấy số liệu.
 * Bố cục: điều kiện lọc ở trên -> nút "Xem báo cáo" (F9) -> bảng kết quả (cột lấy từ bảng head thủ tục trả về, nếu có).
 * props: { menu, menuInfo } – menuInfo = dòng CP_SysGetMenu (Ma_Ct, Para...)
 */
const PROC_REPORT = 'CP_Report_Mau'; // thủ tục lấy số liệu – đổi theo thủ tục thật

// ngày dạng yyyy-MM-dd 00:00:00 (giống giá trị CyberDate trả về; theo giờ máy, không dùng toISOString – giờ UTC)
const ymd = (d) => `${toDateString(d)} 00:00:00`;
const firstOfMonth = () => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth(), 1)); };
const today = () => ymd(new Date());

export default function MauBaoCao({ menu }) {
  const view = async (f) => {
    const d = f.data;
    if (!d.TuNgay || !d.DenNgay) return toast.warning('Chọn đủ từ ngày / đến ngày.');
    if (d.TuNgay > d.DenNgay) return toast.warning('Từ ngày phải trước đến ngày.');
    const { tables } = await f.call(PROC_REPORT, [d.TuNgay, d.DenNgay, d.Ma, f.user?.Ma_TTCP, f.user?.User_name, f.user?.TokenKey, '']);
    // bảng 1 = dữ liệu; bảng có cột Field_Name / Field = mô tả cột (không có thì bảng tự sinh cột)
    const head = tables.slice(1).find((t) => t?.[0] && ('Field' in t[0] || 'Field_Name' in t[0]));
    f.setVars({ rows: tables[0] || [], head: head || null });
    if (!tables[0]?.length) toast.info('Không có số liệu trong khoảng đã chọn.');
  };

  return (
    <CyberForm
      menu={menu}
      initialData={{ TuNgay: firstOfMonth(), DenNgay: today(), Ma: '' }}
      actions={[{ key: 'view', text: 'Xem báo cáo', icon: 'report', primary: true, shortcut: 'F9', onClick: view }]}
    >
      {(f) => (
        <>
          <CyberForm.Section title="Điều kiện lọc" icon="filter">
            <div className="grid grid--2">
              <CyberDate {...f.bind('TuNgay')} label="Từ ngày" required />
              <CyberDate {...f.bind('DenNgay')} label="Đến ngày" required />
              <CyberTextBox {...f.bind('Ma')} label="Mã (tuỳ chọn)" />
            </div>
          </CyberForm.Section>
          <CyberForm.Section title="Kết quả" icon="list">
            <CyberTable head={f.vars.head} data={f.vars.rows || []} height={420} showSearch emptyText="Bấm Xem báo cáo (F9) để lấy số liệu" />
          </CyberForm.Section>
        </>
      )}
    </CyberForm>
  );
}
