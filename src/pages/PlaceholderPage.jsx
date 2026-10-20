import Icon from '@/components/icons/Icon';
import { kindOf } from '@/screens/menuForm';

/**
 * Trang tạm cho chức năng chưa có màn hình – hiện thông tin để dev biết cần làm gì.
 * menuInfo = dòng CP_SysGetMenu trả về (có khi mở từ DB – screens/MenuScreen.jsx)
 */
export default function PlaceholderPage({ menu, menuInfo }) {
  const form = String(menuInfo?.FormInPut || '').trim();
  const kind = kindOf(menuInfo); // loại chức năng -> thư mục chứa form + file mẫu
  return (
    <div className="page">
      <div className="placeholder">
        <div className="placeholder__icon"><Icon name="file" size={28} /></div>
        <h2>{menu?.text}</h2>
        <p>{form ? <>Chưa có file màn hình <code>{form}.jsx</code> trong project.</> : 'Chức năng này chưa có màn hình trên web.'}</p>
        <table className="placeholder__info">
          <tbody>
            <tr><th>Menu_Id</th><td><code>{menu?.id}</code></td></tr>
            {menuInfo ? (
              <>
                <tr><th>FormInPut</th><td><code>{form || '(trống)'}</code></td></tr>
                {menuInfo.Name && <tr><th>Name</th><td><code>{menuInfo.Name}</code></td></tr>}
                {menuInfo.Ma_Ct && <tr><th>Ma_Ct</th><td><code>{menuInfo.Ma_Ct}</code></td></tr>}
                <tr><th>Loại</th><td>{kind.text}{kind.flag ? <> (<code>{kind.flag} = 1</code>)</> : ''}</td></tr>
                {menuInfo.Para && <tr><th>Para</th><td><code>{menuInfo.Para}</code></td></tr>}
              </>
            ) : (
              <>
                <tr><th>Menu cha</th><td><code>{menu?.parentId || '—'}</code></td></tr>
                <tr><th>IsMaxForm</th><td>{menu?.isMaxForm ? '1' : '0'}</td></tr>
              </>
            )}
          </tbody>
        </table>
        <p className="hint">
          {form ? (
            <>Tạo file <code>src/modules/{kind.folder}/{form}.jsx</code> (chép mẫu <code>src/modules/_mau/{kind.sample}.jsx</code>, đổi tên) – bấm lại menu là tự mở.</>
          ) : (
            <>Khai báo cột <code>FormInPut</code> trong <code>CP_SysGetMenu</code> = tên file màn hình trong <code>src/modules/{kind.folder}</code>.</>
          )}
        </p>
      </div>
    </div>
  );
}
