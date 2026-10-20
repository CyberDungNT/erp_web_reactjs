import { CyberForm, CyberNumeric, CyberTable, toast } from '@/components/cyber';

/**
 * MẪU – MÀN TÍNH TOÁN (loại Tính toán, IsCaculator = 1) – vd tính giá vốn, kết chuyển, khoá sổ, tính khấu hao...
 *
 * Cách dùng: chép file này thành src/modules/calculator/<FormInPut>.jsx (vd TinhGiaVon.jsx), đổi tên component,
 *            sửa tham số + thủ tục tính.
 * Bố cục: tham số (kỳ, năm...) -> nút "Thực hiện" (F9) hỏi xác nhận -> gọi thủ tục -> kết quả / nhật ký xử lý.
 * props: { menu, menuInfo } – menuInfo.Cp_NameCaculator = tên thủ tục tính khai báo trong CP_SysGetMenu (nếu có)
 */
const PROC_DEFAULT = 'CP_Calculator_Mau'; // thủ tục tính – đổi theo thủ tục thật (ưu tiên menuInfo.Cp_NameCaculator)

export default function MauCalculator({ menu, menuInfo }) {
  const proc = menuInfo?.Cp_NameCaculator || PROC_DEFAULT;
  const now = new Date();

  const run = async (f) => {
    const { Thang, Nam } = f.data;
    if (!(Thang >= 1 && Thang <= 12)) return toast.warning('Tháng phải từ 1 đến 12.');
    if (!(await f.msg.yesNo(`Thực hiện "${menu?.text}" cho tháng ${Thang}/${Nam}?`, { title: 'Tính toán', yesText: 'Thực hiện', noText: 'Huỷ' }))) return;
    const started = Date.now();
    const { tables } = await f.call(proc, [Thang, Nam, f.user?.Ma_TTCP, f.user?.User_name, f.user?.TokenKey, '']);
    const st = tables.find((t) => t?.[0] && 'Status' in t[0])?.[0];
    if (st && String(st.Status).toUpperCase() === 'N') return toast.error(st.Note || 'Tính toán không thành công.');
    f.setVars({ result: tables[0] || [] });
    toast.success(`Đã thực hiện xong sau ${((Date.now() - started) / 1000).toFixed(1)} giây.`);
  };

  return (
    <CyberForm
      menu={menu}
      initialData={{ Thang: now.getMonth() + 1, Nam: now.getFullYear() }}
      reloadable={false}
      actions={[{ key: 'run', text: 'Thực hiện', icon: 'calculator', primary: true, shortcut: 'F9', onClick: run }]}
    >
      {(f) => (
        <>
          <CyberForm.Section title="Tham số" icon="tools">
            <div className="grid grid--2">
              <CyberNumeric {...f.bind('Thang')} label="Tháng" min={1} max={12} />
              <CyberNumeric {...f.bind('Nam')} label="Năm" min={2000} max={2100} thousandSep="" />
            </div>
          </CyberForm.Section>
          <CyberForm.Section title="Kết quả" icon="list">
            <CyberTable data={f.vars.result || []} height={360} emptyText="Bấm Thực hiện (F9) để tính" />
          </CyberForm.Section>
        </>
      )}
    </CyberForm>
  );
}
