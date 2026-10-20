import { callProc } from '@/api/apiClient';
import { CyberCheckBox, CyberFrmListF3, CyberTextBox } from '@/components/cyber';

/**
 * MẪU – FORM SỬA / THÊM MỚI DANH MỤC (loại Danh mục, IsList = 1)
 *
 * Màn danh mục (danh sách, lọc, menu chuột phải...) là màn CHUNG – không phải vẽ (screens/ListScreen, gọi CP_SysList).
 * Chỉ cần vẽ form Sửa / Thêm: bấm Mới (F4) / Sửa (F3) / Xem (F2) -> mở file có tên = FormInPut ở BẢNG CẤU HÌNH CP_SysList.
 *
 * Cách dùng: chép file này thành src/modules/danhmuc/<FormInPut>.jsx (vd DmKH.jsx), đổi tên component,
 *            sửa ô nhập + thủ tục lưu. Ví dụ đầy đủ: src/modules/danhmuc/DMTK0.jsx
 *
 * Form kế thừa CyberFrmListF3: popup, nút Lưu / Quay ra, Ctrl+S, hỏi khi thoát chưa lưu, chế độ chỉ xem... có sẵn.
 *   props (ListScreen truyền): { mode: 'new' | 'edit' | 'view', row, list: { code, title, config, fields }, onClose, onSaved }
 */
const SAVE_PROC = 'CP_SysListSave'; // thủ tục lưu – đổi theo thủ tục thật

export default function MauDanhMuc(props) {
  return (
    <CyberFrmListF3
      {...props}
      width={640}
      defaults={{ Ksd: 0 }}                       // giá trị mặc định khi thêm mới
      validate={(d) => (!String(d.Ma || '').trim() ? 'Chưa nhập mã.' : !String(d.Ten || '').trim() ? 'Chưa nhập tên.' : null)}
      onSave={(data, { isNew, list, user }) => callProc(SAVE_PROC, [
        list?.code || '',                         // mã danh mục (@M_Tb_Name)
        isNew ? 'N' : 'E',                        // N thêm mới / E sửa
        JSON.stringify(data),                     // dòng dữ liệu
        user?.Ma_TTCP || '', user?.User_name || '', user?.TokenKey || '',
        '',                                       // Id_Device – để trống
      ], { silent: true })}
    >
      {(form, { isNew }) => (
        <div className="grid grid--2">
          <CyberTextBox {...form.bind('Ma')} label="Mã" required readOnly={!isNew} maxLength={20} autoFocus={isNew} upperCase />
          <CyberTextBox {...form.bind('Ten')} label="Tên" required maxLength={200} />
          <CyberTextBox {...form.bind('Ten2')} label="Tên 2" maxLength={200} />
          <CyberTextBox {...form.bind('Ghi_Chu')} label="Ghi chú" maxLength={500} />
          <CyberCheckBox {...form.bind('Ksd')} text="Không sử dụng" trueValue={1} falseValue={0} />
        </div>
      )}
    </CyberFrmListF3>
  );
}
