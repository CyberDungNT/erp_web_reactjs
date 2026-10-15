# ERP Web (React + Vite)

Web ERP gọi API `POST /api/Data/execute` ({ Name, Para }) của backend ASP.NET Core.

## Chạy

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build ra thư mục dist/
```

Mặc định đang bật **dữ liệu giả** (đăng nhập bằng mật khẩu `123`) (`VITE_USE_MOCK=true` trong `.env`) để chạy được ngay không cần backend.
Khi có backend: sửa `.env`

```
VITE_API_TARGET=https://localhost:7001   # địa chỉ API .NET của bạn
VITE_USE_MOCK=false
```

Khi dev, Vite proxy `/api` sang `VITE_API_TARGET` nên không bị lỗi CORS.
Khi deploy khác domain: điền `VITE_API_BASE_URL` và bật CORS bên .NET.

## Đăng nhập (CP_SysLogin)

- `src/auth/authService.js` gọi `CP_SysLogin` với 11 tham số theo đúng thứ tự:
  `M_Type#M_PlatForm#M_User_Name#M_Password#M_TokenKey#M_Ma_OTP#M_Id_OTP#M_Ma_TTCP#M_MacAddress#M_UserWindow#M_Id_Device`.
  `M_Type`, `M_PlatForm` sửa trong `loginConfig`. `M_Id_Device` là mã 64 ký tự sinh 1 lần và lưu trên trình duyệt
  (web không đọc được MAC / user Windows nên 2 tham số đó để trống).
- Bảng menu lấy theo vị trí, khai báo ở `MENU_TABLE` trong `authService.js`:
  bảng 0 → menu bên trái, bảng 1 → menu trên cùng (muốn đổi chỉ sửa 2 số này, có hiệu lực ngay, không cần đăng nhập lại).
- Phiên lưu nguyên các bảng trả về. Khi đổi cấu trúc phiên, tăng `SESSION_VERSION` để phiên cũ trên trình duyệt tự huỷ.
- Bảng thông tin đăng nhập (có `status` + `TokenKey`) và bảng dashboard (có `PageName`) nhận dạng theo cột,
  vì khi đăng nhập sai thứ tự bảng khác khi đúng. `status = 'Y'` là thành công, `Note` là thông báo.
- Thông tin phiên dùng ở mọi màn hình: `const { user, session, lang, logout } = useAuth();`
  (`user.TokenKey`, `user.Ma_Dvcs`, `user.Ma_TTCP`...).
- "Ghi nhớ đăng nhập" lưu phiên vào localStorage, không chọn thì đóng tab là mất. Mật khẩu không bao giờ được lưu.

## Chọn đơn vị khi đăng nhập (CP_SysGetUnits)

- Rời ô **Tài khoản** → gọi `CP_SysGetUnits` với `Para = "01#<tài khoản>"` (tham số đầu sửa ở `unitsConfig.firstParam`
  trong `auth/authService.js`). Chỉ gọi lại khi tài khoản đổi.
- Bảng có `Ma_TTCP/Ten_TTCP` → danh sách đơn vị (nhóm theo `Ma_Dvcs`, tìm kiếm không dấu).
  Bảng có `M_LAN` → đơn vị mặc định được chọn sẵn + ngôn ngữ mặc định.
- Mã đơn vị đang chọn được truyền vào `@M_Ma_TTCP` của `CP_SysLogin`. Bấm Đăng nhập khi đơn vị còn đang tải
  thì app chờ tải xong rồi mới đăng nhập.
- Đổi đơn vị trong màn chính (thẻ "Đơn vị làm việc" dưới menu trái) → đăng xuất, màn login điền sẵn đơn vị mới.
- Ô chọn dùng control mới `CyberSelect` (dropdown có tìm kiếm + nhóm, dùng lại được ở màn khác).

## Thương hiệu

`src/config/brand.js`: logo (đặt `logoUrl: '/logo.png'` và chép file vào `public/` để dùng logo ảnh thật),
tên sản phẩm, version, khẩu hiệu, chữ chìm website/hotline, link "Quên mật khẩu", các nút đăng nhập khác
(Google/Microsoft/QR/OTP – chưa nối backend, bấm sẽ hiện thông báo; `enabled: false` để ẩn).

## Màn hình chính

- Hàng tab trên vùng làm việc = các dashboard (bảng có `PageName` của CP_SysLogin). `FrmReference` (HOME) là trang
  "Bạn muốn làm gì hôm nay?" (tìm chức năng, lọc theo phân hệ, lưới chức năng chia trang). Dashboard khác mặc định
  gọi `CP_name` + `Para` rồi hiện bảng. Gắn màn riêng cho 1 PageName: `dashboardPages` trong `screens/registry.js`.
- Chức năng mở ra hiện ở thanh dưới cùng ("Trang chủ" + các cửa sổ đang mở, giữ trạng thái khi chuyển).
  Chuột phải: đóng / đóng cửa sổ khác / đóng tất cả; chuột giữa hoặc Ctrl+Alt+W để đóng. Góc phải: ngày khoá sổ.

- Menu trên (`layouts/MenuStrip.jsx`): kiểu MenuStrip WinForms – bấm mục trên thanh để thả xuống,
  rê vào mục có ▸ để xổ menu con sang phải (nhiều cấp). Chữ sau `&` trong `Bar` là phím tắt
  (Alt + chữ để mở; giữ Alt để thấy gạch chân). Alt/F10 kích hoạt thanh, ← → ↑ ↓ Enter Esc như WinForms.
- Menu trái: cây nhiều cấp theo `Menu_Id`/`Menu_Id0`,
  có tìm kiếm không dấu, nút ☰ thu gọn. `---` là đường kẻ, `&` trong tiêu đề được bỏ.
- Ngôn ngữ VI/EN đổi giữa cột `Bar` và `Bar2`/`bar2`. `01.12.00` đổi ngôn ngữ, `01.19.00` (hoặc Icon `EXIT`) đăng xuất.
- **Gắn màn hình vào menu**: thêm vào `src/screens/registry.js`
  ```js
  '02.02.01': lazy(() => import('../pages/PhieuKeToanPage')),
  ```
  Màn hình nhận prop `menu` (Menu_Id, tiêu đề, IsMaxForm, isShowTab, Tag...). Chưa khai báo thì mở trang tạm.

## Giao diện & màu

- Màu dùng chung khai báo trong `src/theme.css` (xanh chủ đạo `--brand: #00d287`, cam nhấn `--accent: #FF990A`).
  Bộ control Cyber* và mọi màn hình đọc màu từ đây – đổi thương hiệu chỉ cần sửa file này.
- Chữ trên nền xanh dùng `--brand-ink` (xanh rất đậm) vì chữ trắng trên `#00d287` khó đọc;
  chữ xanh trên nền trắng dùng `--brand-text`.
- Hiệu ứng: nút nổi lên + vệt sáng khi hover; đăng nhập sai thì khung rung; đăng nhập đúng thì nút chuyển dấu tích →
  vòng tròn xanh lan ra màn hình → "Đăng nhập thành công" → mờ dần vào màn chính (các phần màn chính trượt vào lần lượt).
  Thời gian từng bước sửa ở đầu `pages/LoginPage.jsx` (`T_CHECK`, `T_LEAVE`, `T_ENTER`).
- Máy bật "Giảm chuyển động" (prefers-reduced-motion) sẽ tự tắt hiệu ứng.
- Font Be Vietnam Pro tải từ Google Fonts; máy không có mạng ngoài sẽ dùng Segoe UI.

## Cấu trúc

```
src/
  api/
    apiClient.js        callProc(name, params) – HÀM GỌI API DÙNG CHUNG
    mockData.js         dữ liệu giả cho các proc Demo_*
  hooks/
    useCyberForm.js     quản lý form + two-way binding: form.bind('Field')
    useBinding.js       hook nội bộ của các control
    useProc.js          gọi proc kiểu hook: { table, tables, loading, error, reload }
  components/cyber/     bộ control dùng chung
    CyberTextBox  CyberNumeric  CyberLookup  CyberDate  CyberCheckBox
    CyberRadioButton  CyberCombobox  CyberTable  CyberContextMenu  CyberPopup
    cyber.css           style control (màu lấy từ theme.css)
  auth/
    authService.js      gọi CP_SysLogin, phân tích kết quả, lưu phiên
    AuthContext.jsx     useAuth(), RequireAuth
  layouts/
    MainLayout.jsx      khung chính: thanh trên, menu trái, tab, thanh trạng thái
    MenuStrip.jsx       menu trên kiểu WinForms
    SideMenu.jsx        menu trái dạng cây
  screens/registry.js   Menu_Id -> màn hình
  utils/menuTree.js     dựng cây menu từ Menu_Id / Menu_Id0
  pages/
    LoginPage.jsx         màn đăng nhập
    HomePage.jsx          trang chủ + dashboard
    DemoControlsPage.jsx  màn hình test tất cả control
    HangHoaPage.jsx       mẫu màn hình danh mục (copy để làm màn mới)
    ProcTesterPage.jsx    gọi proc bất kỳ, xem mọi bảng trả về
  App.jsx               khai báo route
```

## Gọi API

```js
import { callProc } from './api/apiClient';

const res = await callProc('GetData', [1, 2]);   // Para = "1#2"
res.table   // bảng đầu tiên
res.tables  // tất cả bảng (DataSet nhiều bảng)
```

Lỗi (Status = false, mạng, HTTP) đều `throw` – bắt bằng try/catch, `err.message` là Message server trả.
`normalizeTables` tự nhận dạng Data dạng `{Table:[],Table1:[]}`, `[[...],[...]]` hoặc `[...]`.

> Lưu ý: tham số chứa ký tự `#` sẽ bị tách sai vì backend tách theo `#`.

## Two-way binding

```jsx
const form = useCyberForm({ MaKH: null, TenKH: '', SoLuong: 0 });

<CyberTextBox {...form.bind('TenKH')} label="Tên KH" />
<CyberNumeric {...form.bind('SoLuong')} label="Số lượng" />

form.data               // đọc dữ liệu
form.setField('SoLuong', 10)   // gán từ code -> control tự cập nhật
form.setData({...})     // gán cả object
```

Mọi control cũng dùng được kiểu thường: `value={x} onChange={setX}`.

## Control

| Control | Props chính |
|---|---|
| CyberTextBox | `multiline rows maxLength upperCase type readOnly onEnter` |
| CyberNumeric | `decimals thousandSep decimalSep allowNegative min max fixedDecimals` |
| CyberLookup | `procName para buildPara valueField displayField textField columns minChars debounce onSelect` |
| CyberDate | `min max showToday` – giá trị chuỗi `yyyy-MM-dd` |
| CyberCheckBox | `text trueValue falseValue` (vd `1/0` cho cột bit) |
| CyberRadioButton | `items` hoặc `dataSource valueField displayField`, `direction` |
| CyberCombobox | `dataSource` hoặc `procName para`, `valueField displayField showValue allowEmpty`, `onChange(value,row)` |
| CyberTable | `head data onRowClick onRowDoubleClick onSelectionChange contextMenu height showSearch sortable rowClassName frozenColumns frozenRightColumns frozenRows isRowFrozen` |
| CyberPopup | `open onClose title width height footer closeOnBackdrop closeOnEsc draggable maximizable` |

Props chung cho control nhập liệu: `label labelWidth layout('horizontal'|'vertical') required error width disabled`.

### Bảng head của CyberTable

Mỗi dòng mô tả 1 cột (key hoa/thường đều được), có thể lấy từ DB:

| Field | Caption | Width | Type | Decimals | Align | Sum | Visible |
|---|---|---|---|---|---|---|---|
| MaHang | Mã hàng | 90 | text | | | | |
| SoLuong | Số lượng | 90 | number | 0 | right | 1 | 1 |

Type: `text | number | date | datetime | bool`. Không truyền head thì tự sinh cột từ data.
Cột `Fixed`: `left` (hoặc 1) / `right` để cố định cột đó khi cuộn ngang.

### Cố định cột & dòng khi cuộn

Dòng tiêu đề và dòng tổng cộng luôn cố định. Thêm:

```jsx
<CyberTable head={head} data={data}
  frozenColumns={2}          // 2 cột đầu cố định bên trái (cột STT tự cố định theo)
  frozenRightColumns={1}     // 1 cột cuối cố định bên phải
  frozenRows={1}             // 1 dòng dữ liệu đầu cố định dưới tiêu đề
  isRowFrozen={(row) => row.LaDongTong === 1}   // ghim dòng bất kỳ lên đầu
/>
```

Có thể khai báo ngay trong bảng head lấy từ DB bằng cột `Fixed` thay cho `frozenColumns`.
Dòng ghim không bị sắp xếp/lọc đẩy đi và hiển thị 📌 ở cột STT.

### Menu chuột phải (khai báo bên ngoài)

```jsx
<CyberTable head={head} data={data}
  contextMenu={(row, index) => [
    { text: 'Sửa', icon: '✎', onClick: () => edit(row) },
    { text: 'Duyệt', disabled: row.DaDuyet, onClick: () => approve(row) },
    '-',
    { text: 'Xoá', danger: true, onClick: () => remove(row) },
  ]} />
```

### Lookup

Proc nhận từ khoá ở tham số đầu: `Para = "tukhoa"` (hoặc `"tukhoa#para"` khi truyền thêm `para`).
Phím: ↑↓ chọn, Enter chọn, Esc đóng, F4 mở toàn bộ.

```sql
CREATE PROC LookupKhachHang @Keyword NVARCHAR(100) = ''
AS
SELECT TOP 50 MaKH, TenKH, DiaChi FROM DMKhachHang
WHERE @Keyword = '' OR MaKH LIKE '%' + @Keyword + '%' OR TenKH LIKE N'%' + @Keyword + '%'
```
