import { CyberForm, CyberTextBox, CyberTable, toast } from '@/components/cyber';

/**
 * MẪU – MÀN KHÁC (không thuộc danh mục / báo cáo / chứng từ / tính toán – CP_SysGetMenu không bật cờ loại nào)
 *
 * Cách dùng: chép file này thành src/modules/other/<FormInPut>.jsx, đổi tên component, sửa thủ tục + nội dung.
 * props: { menu, menuInfo } – menu (Menu_Id, tiêu đề...), menuInfo = dòng CP_SysGetMenu
 * Màn mẫu đầy đủ (CyberForm): src/modules/dev/PhieuNhapPage.jsx
 */
const PROC_LOAD = 'Demo_GetHangHoa';   // proc lấy dữ liệu khi mở màn

export default function MauKhac({ menu }) {
  /** Chạy khi mở màn và khi bấm Làm mới (F5): gọi API, gán dữ liệu */
  const onLoad = async (f) => {
    const { tables } = await f.call(PROC_LOAD, []);
    const [head = [], rows = []] = tables;
    f.setVars({ head, rows });
  };

  const save = async (f) => {
    // await f.call('Proc_Luu', [f.data.Ma, f.data.Ten]);
    toast.success('Đã lưu');
  };

  return (
    <CyberForm
      menu={menu}
      onLoad={onLoad}
      initialData={{ Ma: '', Ten: '' }}
      actions={[{ key: 'save', text: 'Lưu', icon: 'tick', primary: true, shortcut: 'Ctrl+S', onClick: save }]}
    >
      {(f) => (
        <>
          <CyberForm.Section title="Thông tin">
            <CyberTextBox {...f.bind('Ma')} label="Mã" required />
            <CyberTextBox {...f.bind('Ten')} label="Tên" />
          </CyberForm.Section>
          <CyberTable head={f.vars.head} data={f.vars.rows || []} height={360} />
        </>
      )}
    </CyberForm>
  );
}
