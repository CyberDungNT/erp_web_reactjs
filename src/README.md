# Hướng dẫn dùng control & gọi form

Tài liệu cho người viết màn hình trong `src/`. Mọi control import từ một chỗ:

```js
import { CyberForm, CyberTextBox, CyberLookup, CyberTable, toast, msgbox } from '@/components/cyber';
import { callProc } from '@/api/apiClient';
```

Mục lục

1. [Gọi form (mở màn hình)](#1-gọi-form-mở-màn-hình)
2. [Khung màn hình: CyberForm](#2-khung-màn-hình-cyberform)
3. [Form sửa / thêm danh mục: CyberFrmListF3](#3-form-sửa--thêm-danh-mục-cyberfrmlistf3)
4. [Binding dữ liệu](#4-binding-dữ-liệu)
5. [Control nhập liệu](#5-control-nhập-liệu)
6. [Bảng, popup, menu chuột phải](#6-bảng-popup-menu-chuột-phải)
7. [Thông báo: toast & msgbox](#7-thông-báo-toast--msgbox)
8. [Gọi thủ tục (API)](#8-gọi-thủ-tục-api)
9. [Control đặc biệt: quét mã, đọc biển số, tải file, soạn thảo](#9-control-đặc-biệt)
10. [Quy tắc chung](#10-quy-tắc-chung)

---

## 1. Gọi form (mở màn hình)

### 1.1 Mở từ menu – không phải khai báo gì trong code

Người dùng bấm 1 chức năng trên menu:

```
bấm menu ─► CP_SysGetMenu (@M_Menu_Id, @M_Name, @M_Ma_TTCP, @M_User_Name, @M_TokenKey, @M_Id_Device)
              │
              ├─ Status = N  ─► không mở, CyberMsgBox báo Note
              │
              └─ Status = Y  ─► xem CỜ LOẠI + cột FormInPut
                   IsList = 1       ─► màn danh mục chung (ListScreen, gọi CP_SysList)
                   IsReport = 1     ─► src/modules/baocao/<FormInPut>.jsx
                   IsVoucher = 1    ─► src/modules/chungtu/<FormInPut>.jsx
                   IsCaculator = 1  ─► src/modules/calculator/<FormInPut>.jsx
                   không cờ nào     ─► src/modules/other/<FormInPut>.jsx
```

Ví dụ: `FormInPut = 'BcSoCaiTk'`, `IsReport = 1` → mở `src/modules/baocao/BcSoCaiTk.jsx`.

- Tên file **= FormInPut**, không phân biệt hoa thường, được bỏ đuôi `Page` (`HangHoa` tìm được cả `HangHoaPage.jsx`).
- Tìm trong thư mục của loại trước, không thấy thì tìm các thư mục khác.
- Chưa có file → màn hình tạm báo đúng đường dẫn cần tạo và file mẫu nên chép.
- Thư mục / file bắt đầu bằng `_` (vd `_mau/`, `_helpers.js`) **không** được nạp.

### 1.2 Tạo màn hình mới

1. Chép file mẫu của loại tương ứng trong `src/modules/_mau/`:

   | Loại | File mẫu | Đặt vào |
   |---|---|---|
   | Danh mục (form Sửa / Thêm) | `MauDanhMuc.jsx` | `danhmuc/` |
   | Báo cáo | `MauBaoCao.jsx` | `baocao/` |
   | Chứng từ | `MauChungTu.jsx` | `chungtu/` |
   | Tính toán | `MauCalculator.jsx` | `calculator/` |
   | Khác | `MauKhac.jsx` | `other/` |

2. Đổi tên file thành `FormInPut`, đổi tên component, sửa ô nhập và tên thủ tục.
3. Bấm lại menu là màn mở ra (không cần đăng ký ở đâu).

Màn hình nhận props:

```jsx
export default function BcSoCaiTk({ menu, menuInfo }) {
  // menu      : { id (Menu_Id), text (tiêu đề), icon, ... }
  // menuInfo  : nguyên dòng CP_SysGetMenu – Ma_Ct, Para, FormInPut, IsMaxForm, HelpName, Cp_NameCaculator...
}
```

### 1.3 Danh mục (IsList = 1)

Màn danh sách là **màn chung** (`src/screens/ListScreen.jsx`) – không phải vẽ. Màn này gọi `CP_SysList`, tự dựng cột,
nhóm cột, cột cố định, màu dòng, dòng lọc, tìm kiếm, menu chuột phải và phím tắt:

| Phím | Việc | Phím | Việc |
|---|---|---|---|
| F2 | Xem | F8 | Xoá |
| F3 / nháy đúp | Sửa | F7 | In danh mục |
| F4 | Thêm mới | F10 | Lọc số liệu |
| F6 | Đổi mã | Ctrl+F5 | Làm tươi |

Chỉ cần vẽ **form Sửa / Thêm**: file `src/modules/danhmuc/<FormInPut>.jsx`, trong đó `FormInPut` lấy ở
**bảng cấu hình của CP_SysList** (bảng có `ColFrozen` / `Title`), không phải của CP_SysGetMenu. Xem [mục 3](#3-form-sửa--thêm-danh-mục-cyberfrmlistf3).

### 1.4 Mở / đóng màn hình từ code

```jsx
import { useMain } from '@/layouts/MainLayout';
import { useScreen } from '@/hooks/screenContext';

const { openMenu, nodeMap } = useMain();
openMenu(nodeMap.get('02.02.01'));   // mở chức năng khác theo Menu_Id (vẫn hỏi quyền CP_SysGetMenu như bấm menu)

const screen = useScreen();           // { id: Menu_Id } của cửa sổ đang chứa component
window.dispatchEvent(new CustomEvent('cyber:close-window', { detail: screen.id }));   // tự đóng cửa sổ của mình
```

Mở 1 form theo tên ngay trong màn mình (vd mở form sửa danh mục từ màn khác):

```jsx
import { findForm } from '@/screens/menuForm';

const form = findForm('DMTK0', 'list');   // loại: 'list' | 'report' | 'voucher' | 'calculator' | 'other'
if (form) {
  const { Component } = form;              // component lazy – bọc trong <Suspense>
  return <Component mode="edit" row={row} list={{ code: 'DMTK0', title: 'Tài khoản', fields: Object.keys(row) }}
                    onClose={() => setOpen(false)} onSaved={reload} />;
}
```

### 1.5 Gắn cứng Menu_Id (ít dùng)

Chỉ khi màn chưa khai báo trong DB (màn thử, màn đặc biệt): tạo `index.js` trong thư mục đó, xem `src/modules/_mau/index.js`.

```js
export const screens = { '02.02.01': lazy(() => import('./PhieuKeToan')) };   // bỏ qua CP_SysGetMenu
export const menu = [];       // thêm mục vào menu trái
export const widgets = [];    // thành phần chạy nền trong màn chính
export const userMenu = [];   // thêm mục vào menu avatar
```

---

## 2. Khung màn hình: CyberForm

Mọi màn (báo cáo, chứng từ, tính toán, khác) bọc trong `CyberForm` để có sẵn thanh tiêu đề + nút lệnh, phím tắt,
trạng thái đang xử lý, màn báo lỗi + Thử lại, nút Làm mới (F5) và **bản nháp tự động** (dữ liệu đang nhập giữ qua F5 / mất mạng).

```jsx
import { CyberForm, CyberTextBox, CyberDate, CyberTable, toast } from '@/components/cyber';

export default function BcSoCaiTk({ menu, menuInfo }) {
  const view = async (f) => {
    const { tables } = await f.call('CP_BcSoCaiTk', [f.data.TuNgay, f.data.DenNgay, f.user.Ma_TTCP]);
    f.setVar('rows', tables[0] || []);
    if (!tables[0]?.length) toast.info('Không có số liệu.');
  };

  return (
    <CyberForm
      menu={menu}
      initialData={{ TuNgay: '', DenNgay: '', Tk: '' }}
      onLoad={async (f) => {                    // chạy khi mở màn + khi Làm mới (F5)
        const kho = await f.call('GetKho');
        f.setVar('kho', kho.table);
      }}
      actions={[
        { key: 'view', text: 'Xem báo cáo', icon: 'report', primary: true, shortcut: 'F9', onClick: view },
      ]}
    >
      {(f) => (
        <>
          <CyberForm.Section title="Điều kiện lọc" icon="filter">
            <div className="grid grid--2">
              <CyberDate {...f.bind('TuNgay')} label="Từ ngày" required />
              <CyberDate {...f.bind('DenNgay')} label="Đến ngày" required />
            </div>
          </CyberForm.Section>
          <CyberForm.Section title="Kết quả">
            <CyberTable data={f.vars.rows || []} height={420} showSearch />
          </CyberForm.Section>
        </>
      )}
    </CyberForm>
  );
}
```

**Props**

| Prop | Ý nghĩa |
|---|---|
| `menu` | truyền nguyên prop `menu` của màn → tiêu đề, icon, mã chức năng |
| `title`, `subtitle` | ghi đè tiêu đề / dòng phụ |
| `initialData` | dữ liệu ban đầu của form |
| `onLoad(f)` | async, chạy khi mở + F5. `throw` → màn báo lỗi + nút Thử lại |
| `actions` | mảng (hoặc `(f) => mảng`) nút: `{ key, text, icon, onClick(f), primary, danger, disabled, hidden, shortcut }` |
| `footer(f)` | thanh trạng thái dưới cùng |
| `reloadable` | nút Làm mới + F5 (mặc định `true`) |
| `headless` | ẩn thanh tiêu đề |
| `draft` / `draftVars` / `draftKey` | bản nháp: tắt / lưu kèm `f.vars` (vd `['lines']`) / tên riêng |

`onClick` của action tự được bọc `f.run()`: hiện đang xử lý, lỗi tự báo. Ctrl+N / Ctrl+T / Ctrl+W bị trình duyệt giữ, không dùng làm phím tắt.

**Đối tượng `f`** (truyền cho `onLoad`, `actions`, `children`)

| | |
|---|---|
| `f.data`, `f.bind(field)`, `f.form` | dữ liệu form và binding (`f.form.setField`, `setData`, `reset`) |
| `f.vars`, `f.setVar(k, v)`, `f.setVars(obj)` | biến của màn: danh sách lookup, dòng chi tiết, kết quả báo cáo... |
| `f.call(proc, params)` | gọi thủ tục, tự bật trạng thái đang xử lý |
| `f.run(asyncFn, { errorTitle })` | chạy 1 thao tác có báo lỗi |
| `f.reload()` | chạy lại `onLoad` |
| `f.loading`, `f.busy`, `f.error` | trạng thái |
| `f.user`, `f.lang`, `f.menu`, `f.msg` | người dùng đăng nhập, ngôn ngữ, menu, `msgbox` |

`CyberForm.Section` – khối nhóm nội dung: `title`, `icon`, `extra` (nút bên phải tiêu đề).
Bố cục lưới có sẵn: `<div className="grid grid--2">` (2 cột, tự xuống 1 cột trên điện thoại).

---

## 3. Form sửa / thêm danh mục: CyberFrmListF3

Mọi form Sửa / Thêm của danh mục "kế thừa" `CyberFrmListF3`. Có sẵn: popup (kéo, giãn, phóng to), nút **Lưu / Quay ra**,
Ctrl+S, hỏi khi thoát mà chưa lưu, khoá nút khi đang lưu, chế độ chỉ xem (F2), toast lỗi, tự tải lại danh sách sau khi lưu.

```jsx
// src/modules/danhmuc/DmKH.jsx   (DmKH = FormInPut trong bảng cấu hình CP_SysList)
import { callProc } from '@/api/apiClient';
import { CyberFrmListF3, CyberTextBox, CyberCheckBox } from '@/components/cyber';

export default function DmKH(props) {
  return (
    <CyberFrmListF3
      {...props}                                          // BẮT BUỘC – mode, row, list, onClose, onSaved do ListScreen truyền
      width={720}
      defaults={{ Ksd: 0 }}                               // giá trị mặc định khi thêm mới
      validate={(d) => (!d.Ma_Kh ? 'Chưa nhập mã khách hàng.' : null)}
      onSave={(data, { isNew, list, user }) => callProc('CP_SysListSave', [
        list.code, isNew ? 'N' : 'E', JSON.stringify(data), user.Ma_TTCP, user.User_name, user.TokenKey, '',
      ], { silent: true })}
    >
      {(form, { isNew }) => (
        <div className="grid grid--2">
          <CyberTextBox {...form.bind('Ma_Kh')} label="Mã KH" required readOnly={!isNew} upperCase autoFocus={isNew} />
          <CyberTextBox {...form.bind('Ten_Kh')} label="Tên KH" required />
          <CyberCheckBox {...form.bind('Ksd')} text="Không sử dụng" trueValue={1} falseValue={0} />
        </div>
      )}
    </CyberFrmListF3>
  );
}
```

| Prop | Ý nghĩa |
|---|---|
| `children` | `(form, ctx) => JSX` – `ctx = { mode, isNew, isView, row, list, user, close }` |
| `onSave(data, ctx)` | async. `throw` = lỗi (toast tự hiện). Trả về kết quả `callProc` có `Status = N` → coi là lỗi, báo `Note` |
| `validate(data, ctx)` | trả chuỗi lỗi (toast, không lưu) hoặc `null` |
| `defaults` | object hoặc `(ctx) => object` |
| `title`, `width` (640), `height`, `keepOpen` | `keepOpen`: lưu xong không đóng (nhập liên tục) |

Props ListScreen truyền vào: `mode` (`'new' | 'edit' | 'view'`), `row` (dòng đang chọn), `list` (`{ code, title, config, fields }`), `onClose`, `onSaved`.
Ở chế độ `view` mọi ô tự chỉ đọc và không có nút Lưu.

---

## 4. Binding dữ liệu

```jsx
import { useCyberForm } from '@/hooks/useCyberForm';

const form = useCyberForm({ Ma_Kh: '', So_Luong: 0 });     // trong CyberForm thì dùng sẵn f.bind / f.form

<CyberTextBox {...form.bind('Ma_Kh')} label="Mã KH" />

form.data                      // đọc dữ liệu
form.setField('So_Luong', 10)  // gán 1 field từ code – control tự cập nhật
form.setData({ ... })          // gán cả object (dữ liệu "sạch", vd vừa tải / vừa lưu → xoá bản nháp)
form.reset()                   // về giá trị ban đầu
```

Mọi control cũng dùng kiểu thường được: `value={x} onChange={(v, extra) => setX(v)}`.
`onChange` vẫn được gọi kể cả khi đang bind (dùng để xử lý thêm khi giá trị đổi).

---

## 5. Control nhập liệu

**Props chung** (mọi control nhập liệu): `label`, `labelWidth` (mặc định 120), `layout` (`'horizontal'` | `'vertical'`),
`width`, `required` (dấu *), `readOnly`, `disabled`, `className`, `style`, `id`.

### CyberTextBox – ô chữ

```jsx
<CyberTextBox {...f.bind('Ten_Kh')} label="Tên KH" maxLength={200} />
<CyberTextBox {...f.bind('Ma_Vt')} label="Mã hàng" upperCase onEnter={(v) => tim(v)} />
<CyberTextBox {...f.bind('Ghi_Chu')} label="Ghi chú" multiline rows={4} />
```

`placeholder`, `maxLength`, `multiline`, `rows`, `upperCase`, `type` (`text|password|email`), `onEnter(value, e)`, `onBlur`, `onKeyUp`,
`autoFocus`, `addon` (nút gắn bên phải ô), `autoComplete`, `name`, `inputStyle`.

### CyberNumeric – ô số

Tự phân cách hàng nghìn khi gõ. Giá trị là `number` (để trống = `null`).

```jsx
<CyberNumeric {...f.bind('Don_Gia')} label="Đơn giá" decimals={2} min={0} />
<CyberNumeric {...f.bind('Tien')} thousandSep="." decimalSep="," />     // kiểu VN
```

`decimals` (0), `thousandSep` (`,`), `decimalSep` (`.`), `allowNegative` (true), `min`, `max` (áp khi rời ô),
`fixedDecimals` (bù đủ số 0 khi rời ô, mặc định true), `placeholder`, `onEnter`.
Hàm định dạng dùng ngoài: `formatNumber(1234.5, { decimals: 2 })` → `"1,234.50"`.

### CyberDate – ô ngày / giờ

Giá trị trả về **chuỗi `yyyy-MM-dd HH:mm:ss`** (gửi thẳng xuống SQL). Nhận vào mọi dạng: `'2026-10-15'`, `'2026-10-15T08:30:00'`, `Date`.

```jsx
<CyberDate {...f.bind('Ngay_Ct')} label="Ngày CT" min="2026-01-01" />          // giờ = 00:00:00
<CyberDate {...f.bind('Gio_Vao')} label="Giờ vào" showTime />                   // chọn cả giờ:phút:giây
```

`min`, `max`, `showToday` (nút Hôm nay / Bây giờ, mặc định true), `showTime`.
Hàm dùng ngoài: `toDateString(v)` → `yyyy-MM-dd`, `toTimeString(v)` → `HH:mm:ss`, `toDateTimeString(v)`.
Không dùng `toISOString()` để lấy ngày (bị lệch múi giờ UTC) – dùng `toDateString(new Date())`.

### CyberLookup – tra cứu danh mục (CP_SysListLookup)

```jsx
<CyberLookup
  {...f.bind('Ma_Kh')}          // lưu mã khi chọn
  textField="Ten_Kh"            // (tuỳ chọn) lưu thêm tên vào f.data.Ten_Kh
  listName="DmKH"               // -> @M_Tb_Name
  filter="Ksd = 0"              // -> @M_strKeyFilter (mặc định '1=1')
  label="Khách hàng"
  onSelect={(row) => f.form.setField('Dia_Chi', row.Dia_Chi)}   // nhận cả dòng
/>
```

Thủ tục được gọi: `CP_SysListLookup @M_Load='1', @M_strValue=<chữ đã gõ>, @M_strKeyFilter, @M_Tb_Name, @M_Ma_TTCP, @M_User_Name`.
Kết quả: **bảng 1** = dữ liệu, **bảng 2** = head (`Field_Name`, `Field_Head`, `Field_Width` – 0 là ẩn), **bảng 3** = `Order` (cột mã).

Cách dùng:

- Ngừng gõ (`delay`, mặc định 500ms) → danh sách thả xuống ngay dưới ô, con trỏ vẫn ở ô.
- ↑ ↓ / PageUp / PageDown chọn dòng; Enter / Tab / bấm chuột → lấy; Esc → đóng, trả lại giá trị cũ.
- Enter ngay: đúng 1 dòng hoặc trùng mã → tự chọn.
- F4 / Alt+↓ / nút ▾ → xem toàn bộ danh mục. Xoá trắng ô rồi rời đi → bỏ giá trị.

Props khác: `valueField` (mặc định cột `Order`), `displayField` (mặc định cột `Ten_...`), `delay`, `dropdownWidth`,
`columns` (`[{ field, caption, width }]` – tự khai báo cột), `procName` + `para` / `buildPara(keyword)` (dùng thủ tục khác), `placeholder`.
Tên cột không phân biệt hoa thường: `row.Dia_Chi` và `row.dia_chi` đều được.

### CyberCombobox – chọn từ danh sách ngắn (`<select>`)

```jsx
<CyberCombobox {...f.bind('Ma_Kho')} label="Kho" dataSource={f.vars.kho} valueField="Ma_Kho" displayField="Ten_Kho" />
<CyberCombobox {...f.bind('Ma_Kho')} procName="GetKho" para="" valueField="Ma_Kho" displayField="Ten_Kho" />
```

`dataSource` hoặc `procName` + `para`, `valueField`, `displayField`, `showValue` (hiện "mã - tên"), `allowEmpty` (true), `emptyText`,
`onChange(value, row)`.

### CyberSelect – dropdown có tìm kiếm, chia nhóm

```jsx
<CyberSelect {...f.bind('Ma_TTCP')} label="Đơn vị" dataSource={units} valueField="Ma_TTCP" displayField="Ten_TTCP"
  groupField="Ma_Dvcs" groupLabel={(g) => `Đơn vị cơ sở ${g}`} placeholder="Chọn đơn vị" />
```

`groupField`, `groupLabel(group, rows)`, `showValue`, `searchable` (mặc định bật khi > 8 dòng, tìm không dấu), `loading`, `loadingText`,
`emptyText`, `placeholder`, `onChange(value, row)`.

### CyberCheckBox

```jsx
<CyberCheckBox {...f.bind('Ksd')} text="Không sử dụng" trueValue={1} falseValue={0} />   // cột bit SQL
```

`text`, `trueValue` (true), `falseValue` (false).

### CyberRadioButton

```jsx
<CyberRadioButton {...f.bind('Gioi_Tinh')} items={[{ value: 'M', text: 'Nam' }, { value: 'F', text: 'Nữ' }]} />
<CyberRadioButton {...f.bind('Ma_Kho')} dataSource={kho} valueField="Ma_Kho" displayField="Ten_Kho" direction="vertical" />
```

---

## 6. Bảng, popup, menu chuột phải

### CyberTable

```jsx
<CyberTable
  head={head}                 // bảng mô tả cột (lấy từ DB hoặc khai báo); bỏ trống = tự sinh cột từ data
  data={rows}
  height={420}
  frozenColumns={2}           // cố định 2 cột trái
  onRowDoubleClick={(row, i) => sua(row)}
  rowStyle={(row) => row.Bold ? { fontWeight: 600, '--row-bg': '#fff3d6' } : undefined}
  contextMenu={(row) => [
    { text: 'Sửa', icon: <Icon name="edit" />, shortcut: 'F3', onClick: () => sua(row) },
    '-',
    { text: 'Xoá', danger: true, onClick: () => xoa(row) },
  ]}
/>
```

**Bảng head** – mỗi dòng 1 cột (key hoa / thường đều được):

| Field | Caption | Width | Type | Decimals | Align | Sum | Visible | Fixed | Group |
|---|---|---|---|---|---|---|---|---|---|
| Ma_Vt | Mã hàng | 90 | text | | | | | left | |
| So_Luong | Số lượng | 90 | number | 0 | right | 1 | 1 | | Nhập |
| Tien | Tiền | 120 | number | 0 | right | 1 | 1 | | Nhập |

- `Type`: `text | number | date | datetime | bool`.
- `Fixed`: `left` (hoặc 1) / `right` – cố định cột khi cuộn ngang.
- `Group`: các cột liền nhau cùng Group → tiêu đề 2 tầng.
- `render(value, row, index) => JSX`: chỉ khi khai báo bằng code.

**Props**

| Prop | Ý nghĩa |
|---|---|
| `frozenColumns`, `frozenRightColumns`, `frozenRows`, `isRowFrozen(row)` | cố định cột / dòng khi cuộn |
| `onRowClick`, `onRowDoubleClick`, `onSelectionChange` | `(row, index)` |
| `contextMenu` | mảng items hoặc `(row, index) => items` (xem CyberContextMenu) |
| `showSearch` | ô lọc nhanh trên bảng |
| `filterRow` | dòng lọc theo từng cột dưới tiêu đề |
| `showNavigator` | thanh ⏮ ◀ Bản ghi x / n ▶ ⏭ |
| `showRowNumber` (true), `sortable` (true) | cột STT, bấm tiêu đề để sắp xếp |
| `rowStyle(row, i)`, `rowClassName(row, i)` | màu dòng: biến `--row-bg`, `--row-fg` |
| `height` (360), `loading`, `emptyText` | |

### CyberPopup

```jsx
const [open, setOpen] = useState(false);

<CyberPopup open={open} onClose={() => setOpen(false)} title="Sửa hàng hoá" width={600}
  footer={<>
    <button className="cy-btn" onClick={() => setOpen(false)}>Đóng</button>
    <button className="cy-btn cy-btn--primary" onClick={save}>Lưu</button>
  </>}>
  <CyberTextBox {...form.bind('Ten_Vt')} label="Tên hàng" />
</CyberPopup>
```

`open`, `onClose`, `title`, `width` (560 – số px hoặc `'80%'`), `height`, `footer`, `closeOnBackdrop` (false), `closeOnEsc` (true),
`draggable` (true), `maximizable` (true), `resizable` (true), `minWidth` (320), `minHeight` (180).

> Hiệu ứng đóng: popup cần **còn được render** khi `open = false`. Đừng viết `{open && <CyberPopup open ... />}` –
> viết `<CyberPopup open={open} ... />`. Muốn nạp lười thì giữ cờ "đã mở 1 lần":
> `{seen && <CyberPopup open={open} ... />}` (xem `CyberBarcodeInput.jsx`).

### CyberContextMenu – menu chuột phải tự dùng

```jsx
const [menu, setMenu] = useState(null);

<div onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}>...</div>
{menu && (
  <CyberContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={[
    { text: 'Làm tươi', shortcut: 'Ctrl+F5', onClick: reload },
    { text: 'Kết xuất', children: [ { text: 'Excel', onClick: xuatExcel }, { text: 'PDF', onClick: xuatPdf } ] },
    '-',
    { text: 'Xoá', danger: true, disabled: !row, onClick: xoa },
  ]} />
)}
```

Mỗi item: `text`, `icon` (chữ / JSX), `shortcut` (chỉ hiển thị), `onClick`, `disabled`, `hidden`, `danger`, `children` (menu con).
`'-'` là đường kẻ.

---

## 7. Thông báo: toast & msgbox

```js
import { toast, msgbox } from '@/components/cyber';

// toast – báo thoáng qua, tự ẩn, không chặn thao tác
toast.success('Lưu thành công');
toast.error('Không kết nối được máy chủ');
toast.warning('Chưa nhập mã hàng', { title: 'Thiếu dữ liệu', duration: 6000 });
const id = toast.info('Đang xử lý...', { duration: 0 });  toast.dismiss(id);

// msgbox – hộp thoại phải bấm đóng / cần xác nhận
await msgbox.success('Đã duyệt chứng từ');
await msgbox.failed('Lưu thất bại', { detail: err.message });
if (await msgbox.yesNo('Xoá chứng từ này?', { danger: true })) { ... }
```

- Toast: `title`, `duration` (ms, mặc định 3500; 0 = không tự ẩn), `action: { text, onClick }`.
- Msgbox: `title`, `detail`, `okText`, `yesText`, `noText`, `danger`, `lang` (`'V'` | `'E'`). `yesNo` trả `true` / `false`.

> **Quy tắc:** mọi lỗi / cảnh báo hiện bằng **toast** (hoặc msgbox khi cần xác nhận) – **không** hiện chữ lỗi trên giao diện.

---

## 8. Gọi thủ tục (API)

```js
import { callProc } from '@/api/apiClient';

const res = await callProc('CP_GetData', ['01', user.Ma_TTCP, '']);   // Para = "01#<Ma_TTCP>#"
res.table    // bảng đầu tiên
res.tables   // mọi bảng (DataSet nhiều bảng)
res.message  // Message server trả
```

- Lỗi (Status = false, mạng, HTTP) → **tự toast** rồi `throw`. Muốn tự xử lý lỗi: `callProc(name, params, { silent: true })`.
- Tham số chứa ký tự `#` sẽ bị tách sai (backend tách theo `#`).
- Tìm bảng theo **tên cột**, không theo thứ tự: `tables.find((t) => t?.[0] && 'Field_Name' in t[0])`.
- Bảng có `Status = 'N'` → lỗi nghiệp vụ, báo `Note`.
- Thông tin phiên: `const { user } = useAuth()` → `user.Ma_TTCP`, `user.User_name`, `user.TokenKey`, `user.Nam`...
- Trong CyberForm dùng `f.call(...)` (tự bật đang xử lý). Gọi kiểu hook: `const { table, loading, reload } = useProc('GetKho', [])`.
- Chưa có backend: thêm thủ tục giả vào `src/api/mock/index.js`.

---

## 9. Control đặc biệt

Các control này nặng nên **không** nằm trong `@/components/cyber`, import theo đường dẫn riêng.

### CyberBarcodeInput – ô nhập có nút quét QR / mã vạch

```jsx
import CyberBarcodeInput from '@/components/barcode/CyberBarcodeInput';

<CyberBarcodeInput {...f.bind('Ma_Vt')} label="Mã hàng" upperCase onScan={(text, r) => timHang(text)} />
<CyberBarcodeInput {...f.bind('So_Serial')} label="Số serial" formats={['qr_code']} scanTitle="Quét QR serial" />
```

Bấm nút → popup quét (camera hoặc ảnh) → đọc được 1 mã thì tự điền vào ô và đóng. Vẫn gõ tay hoặc dùng máy quét cầm tay như ô thường.
Props: như CyberTextBox + `onScan(text, result)`, `formats`, `scanTitle`.

### CyberBarcodeScanner – khung quét (camera + ảnh)

```jsx
import CyberBarcodeScanner from '@/components/barcode/CyberBarcodeScanner';

<CyberBarcodeScanner onDetect={(r) => themDong(r.text)} />
// r = { text, format ('qr_code' | 'ean_13' | 'code_128'...), formatName, source ('camera' | 'image'), image (dataURL), at }
```

| Prop | Mặc định | |
|---|---|---|
| `mode` | `'camera'` | `'camera'` \| `'image'` (người dùng đổi được) |
| `continuous` | `true` | `false` = đọc 1 mã rồi dừng |
| `dedupeMs` | 2500 | cùng 1 mã trong khoảng này chỉ báo 1 lần |
| `formats` | tất cả | `qr_code, code_128, code_39, code_93, ean_13, ean_8, upc_a, upc_e, itf, codabar, data_matrix, pdf417, aztec` |
| `sound` | `true` | tiếng bíp + rung |
| `autoStart` | `true` | tự bật camera |
| `height` | 340 | |

- Ảnh: chọn file, kéo thả hoặc dán Ctrl+V.
- Đọc mã từ code: `decodeImageFile(file)` / `decodeCanvas(canvas)` trong `@/components/barcode/barcodeReader`.
- **Camera chỉ chạy trên https hoặc localhost.**

### CyberPlateReader – đọc biển số xe

```jsx
import CyberPlateReader from '@/components/plate/CyberPlateReader';

<CyberPlateReader source={{ type: 'webcam' }} auto onRead={(r) => console.log(r.plate, r.confidence, r.snapshot)} />
```

`source`: `{ type: 'webcam' }` | `{ type: 'url', url }` (rtsp qua go2rtc, snapshot, MJPEG, video) | `{ type: 'image', src }`.
Props khác: `auto`, `interval` (1200), `confirm` (2), `dedupeMs` (8000), `minConfidence` (20), `roi`, `onError`.
ref: `readNow()`, `capture()`. Chi tiết ở đầu file `CyberPlateReader.jsx`.

### CyberFileUpload – tải file lên

```jsx
<CyberFileUpload {...f.bind('Dinh_Kem')} label="Đính kèm" accept="image/*,.pdf,.xlsx" maxSize={10} maxFiles={5} />
```

Giá trị = mảng file đã tải `[{ id, name, size, contentType, uploadedAt, url }]` → lưu các `id` vào DB.
Props: `accept`, `multiple` (true), `maxSize` (MB, 20), `maxFiles` (10), `hint`, `user`, `deleteOnRemove`, `onUploaded(files)`, `onRemove(file)`.
Gọi trực tiếp: `uploadFile`, `deleteFile`, `fileUrl` trong `@/api/fileApi`.

### CyberTextEditor – soạn thảo có định dạng (HTML)

```jsx
<CyberTextEditor {...f.bind('Noi_Dung')} label="Nội dung" height={320} placeholder="Nhập nội dung..." />
```

Giá trị là **chuỗi HTML**. Có 2 chế độ: **Thiết kế** (soạn như Word) và **HTML** (sửa thẳng mã).
Thanh công cụ có: kiểu đoạn, đậm / nghiêng / gạch, màu chữ, căn lề, danh sách, liên kết, ảnh, bảng, toàn màn hình.
HTML luôn được lọc an toàn (`sanitizeHtml` – bỏ script, on*, javascript:). Khi hiển thị HTML lưu trong DB, lọc lại:
`<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />`.
Props: `height` (260), `placeholder`, `readOnly`, `disabled`, `uploadImage` (true), `layout` (mặc định `'vertical'`).

---

## 10. Quy tắc chung

- **Lỗi → toast**, không hiện chữ lỗi trên giao diện.
- **Ngày giờ** gửi xuống SQL dạng `yyyy-MM-dd HH:mm:ss` (giá trị của CyberDate). Không dùng `toISOString()`.
- **localStorage** chỉ chứa `cyber_auth`, `cyber_device_id`, `cyber_sidebar_width`, `cyber_sidebar_collapsed` – không thêm khoá mới.
- **Import** tuyệt đối bằng `@/` (`@/components/cyber`, `@/api/apiClient`).
- **File phụ của màn** (css, hàm tiện ích, component con) đặt cạnh màn, tên bắt đầu bằng `_` (vd `_bcHelpers.js`) để không bị coi là màn hình.
- **CSS riêng** đặt tiền tố class riêng. Ưu tiên class / biến có sẵn: `cy-btn`, `cy-btn--primary`, `grid grid--2`, `var(--brand)`.
- **Màn mẫu để tham khảo**:
  - `src/modules/_mau/` – 5 file mẫu.
  - `src/modules/danhmuc/DMTK0.jsx` – form danh mục thật.
  - `src/modules/dev/` – màn thử control (menu "Công cụ phát triển"), `PhieuNhapPage.jsx`, `BarcodePage.jsx`.
