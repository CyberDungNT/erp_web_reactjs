import { callProc } from '@/api/apiClient';
import { CyberCheckBox, CyberFrmListF3, CyberNumeric, CyberTextBox } from '@/components/cyber';

/**
 * FORM SỬA / THÊM MỚI – DANH MỤC TÀI KHOẢN (FormInPut = 'DMTK0' ở bảng cấu hình CP_SysList).
 * Kế thừa CyberFrmListF3: popup, nút Lưu / Quay ra, Ctrl+S, hỏi khi thoát chưa lưu... đã có sẵn – ở đây chỉ vẽ ô nhập + gọi lưu.
 *
 * Tạo form cho danh mục khác: chép file này, đổi tên file = FormInPut của danh mục đó (vd DmKH.jsx), sửa ô nhập + thủ tục lưu.
 */

// THỦ TỤC LƯU – đổi theo thủ tục thật của bạn (tên + thứ tự tham số)
const SAVE_PROC = 'CP_SysListSave';

export default function DMTK0(props) {
  return (
    <CyberFrmListF3
      {...props}
      width={760}
      defaults={{ MA_NT: 'VND', BAC_TK: 1, TK_SC: 0, TK_CN: 0, LOAI_TK: 0 }}
      validate={(d) => {
        if (!String(d.Tk0 || '').trim()) return 'Chưa nhập Tài khoản.';
        if (!String(d.TEN_TK0 || '').trim()) return 'Chưa nhập Tên tài khoản.';
        return null;
      }}
      onSave={(data, { isNew, list, user }) => callProc(SAVE_PROC, [
        list?.code || 'DMTK0',          // mã danh mục
        isNew ? 'N' : 'E',              // N thêm mới / E sửa
        JSON.stringify({ ...data, Tk011: undefined, Bold: undefined, BackColor: undefined, ForeColor: undefined }),
        user?.Ma_TTCP || '',
        user?.User_name || '',
        user?.TokenKey || '',
        '',                             // Id_Device – để trống
      ], { silent: true })}
    >
      {(form, { isNew }) => (
        <div className="grid grid--2">
          <CyberTextBox {...form.bind('Tk0')} label="Tài khoản" required readOnly={!isNew} maxLength={20} autoFocus={isNew} />
          <CyberTextBox {...form.bind('TK_ME')} label="TK mẹ" maxLength={20} />
          <CyberTextBox {...form.bind('TEN_TK0')} label="Tên tài khoản" required maxLength={200} autoFocus={!isNew} />
          <CyberTextBox {...form.bind('TEN_TK02')} label="Tên tài khoản 2" maxLength={200} />
          <CyberTextBox {...form.bind('TEN_NGAN')} label="Tên ngắn" maxLength={100} />
          <CyberTextBox {...form.bind('MA_NT')} label="Ngoại tệ" upperCase maxLength={3} />
          <CyberNumeric {...form.bind('BAC_TK')} label="Bậc TK" decimals={0} min={1} max={9} />
          <div className="f3-checks">
            <CyberCheckBox {...form.bind('TK_SC')} text="TK sổ cái" trueValue={1} falseValue={0} />
            <CyberCheckBox {...form.bind('TK_CN')} text="TK công nợ" trueValue={1} falseValue={0} />
            <CyberCheckBox {...form.bind('LOAI_TK')} text="TK chi tiết" trueValue={1} falseValue={0} />
          </div>
        </div>
      )}
    </CyberFrmListF3>
  );
}
