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
- **Gắn màn hình vào menu**: xem [src/README.md](src/README.md) (mục "Gọi form").
  Màn hình nhận prop `menu` (Menu_Id, tiêu đề, IsMaxForm, isShowTab, Tag...). Chưa khai báo thì mở trang tạm.

## Giao diện & màu

- Màu dùng chung khai báo trong `src/styles/theme.css` (xanh chủ đạo `--brand: #00d287`, cam nhấn `--accent: #FF990A`).
  Bộ control Cyber* và mọi màn hình đọc màu từ đây – đổi thương hiệu chỉ cần sửa file này.
- Chữ trên nền xanh dùng `--brand-ink` (xanh rất đậm) vì chữ trắng trên `#00d287` khó đọc;
  chữ xanh trên nền trắng dùng `--brand-text`.
- Hiệu ứng: nút nổi lên + vệt sáng khi hover; đăng nhập sai thì khung rung; đăng nhập đúng thì nút chuyển dấu tích →
  vòng tròn xanh lan ra màn hình → "Đăng nhập thành công" → mờ dần vào màn chính (các phần màn chính trượt vào lần lượt).
  Thời gian từng bước sửa ở đầu `pages/login/LoginPage.jsx` (`T_CHECK`, `T_LEAVE`, `T_ENTER`).
- Máy bật "Giảm chuyển động" (prefers-reduced-motion) sẽ tự tắt hiệu ứng.
- Font Be Vietnam Pro tải từ Google Fonts; máy không có mạng ngoài sẽ dùng Segoe UI.

## Cấu trúc thư mục

```
src/
  main.jsx, App.jsx       khởi động app + khai báo route (/login, /)
  config/brand.js         tên đơn vị, version, khẩu hiệu, nút đăng nhập ngoài
  styles/                 theme.css (biến màu dùng chung), index.css (style chung toàn app)
  api/
    apiClient.js          callProc(name, params) – HÀM GỌI API DÙNG CHUNG
    mock/                 dữ liệu giả khi VITE_USE_MOCK=true (index.js = danh sách proc giả)
  auth/                   đăng nhập, lưu token mã hoá, useAuth(), RequireAuth
  hooks/                  useCyberForm (binding), useProc, useBinding (nội bộ control)
  utils/                  hàm tiện ích (dựng cây menu...)
  realtime/               SOCKET dùng chung: socket, useSocketEvent, SocketStatus (xem mục Realtime)
  components/
    cyber/                BỘ CONTROL dùng chung: CyberForm, CyberTextBox, CyberTable, msgbox, toast...
    barcode/              quét QR / mã vạch (CyberBarcodeScanner, CyberBarcodeInput)
    plate/                đọc biển số xe (CyberPlateReader)
    charts/               biểu đồ SVG (LineChart, BarList, StackBar, Sparkline)
    icons/                bộ icon
  layouts/                khung màn chính: thanh trên, MenuStrip, menu trái, TaskBar, chọn đơn vị
  pages/                  màn HỆ THỐNG (không thuộc menu nghiệp vụ)
    login/                màn đăng nhập
    home/                 trang chủ (dashboard)
    PlaceholderPage.jsx   trang tạm cho chức năng chưa làm
  modules/                MÀN NGHIỆP VỤ – tên file = FormInPut (xem src/modules/README.md)
    danhmuc/ baocao/ chungtu/ calculator/ other/   theo cờ loại của CP_SysGetMenu
    _mau/                 file mẫu để chép (thư mục / file bắt đầu bằng "_" không được nạp)
    dev/                  công cụ phát triển: test control, màn mẫu, gọi proc
  screens/                mở màn theo menu: menuForm.js (CP_SysGetMenu, CP_SysList), MenuScreen, ListScreen (danh mục chung)
  README.md               HƯỚNG DẪN DÙNG CONTROL & GỌI FORM
```

Import tuyệt đối từ `src` bằng `@/` (không phải đếm `../../`, chuyển file không gãy import):

```js
import { CyberForm, CyberTextBox, msgbox, toast } from '@/components/cyber';
import { callProc } from '@/api/apiClient';
import { useAuth } from '@/auth/AuthContext';
```

## Thêm màn hình, gọi form & dùng control

Xem **[src/README.md](src/README.md)**: mở màn theo `CP_SysGetMenu` / `FormInPut`, file mẫu `src/modules/_mau`,
CyberForm, form danh mục CyberFrmListF3, binding, props từng control (CyberLookup, CyberDate, CyberTable, CyberPopup...),
toast / msgbox, `callProc`, các control quét mã / đọc biển số / tải file / soạn thảo. Quy ước thư mục: `src/modules/README.md`.

## Realtime (socket)

Một kết nối dùng chung cho cả app (`src/realtime`): tự mở sau khi đăng nhập (gửi `TokenKey`), tự đóng khi đăng xuất,
mất mạng tự kết nối lại và vào lại các nhóm. Mẫu: **bong bóng chat ở góc dưới phải** mọi màn hình (`modules/dev/ChatWidget.jsx` + `ChatPage.jsx`).

```jsx
import { socket, useSocketEvent, useSocketGroup, useSocketReady, useSocketStatus, SocketStatus } from '@/realtime';

// Nghe sự kiện server đẩy xuống (tự huỷ khi đóng màn)
useSocketEvent('ChungTuDaDuyet', (ct) => { toast.success(`Đã duyệt ${ct.SoCT}`); f.reload(); });

// Vào nhóm khi mở màn, rời khi đóng (server gửi theo nhóm: đơn vị, chứng từ, phòng chat...)
useSocketGroup(`donvi:${user.Ma_TTCP}`);

// Mỗi lần kết nối xong (cả sau khi mất mạng) -> tải lại dữ liệu có thể bị lỡ
useSocketReady(() => f.reload());

// Gọi hàm trên hub, có kết quả trả về. Lỗi -> toast + throw; thêm socket.silent ở cuối để không toast
const msg = await socket.invoke('SendMessage', 'chung', 'Xin chào', clientId);

<SocketStatus />   // nhãn trạng thái: Trực tuyến / Đang kết nối lại / Mất kết nối
```

- Sự kiện dùng chung toàn app: `Notify { title, message, type }` → bật toast (xử lý sẵn trong `SocketBridge`).
- Chế độ trong `.env`: `VITE_SOCKET_MODE=mock` (giả lập trong trình duyệt, **mở 2 tab** để thấy chat qua lại),
  `signalr` (hub thật tại `VITE_SOCKET_HUB`, mặc định `/hubs/app`, dev đi qua proxy `/hubs` có WebSocket), `off` (tắt).
- Backend: đã gộp vào project API `API_App_Demo` (thư mục `Realtime/`, hub `/hubs/app`, script SQL `Sql/realtime.sql`,
  hướng dẫn `Realtime/README.md`). Web: `VITE_SOCKET_MODE=signalr`, để trống `VITE_SOCKET_TARGET` (đi chung proxy với API).
  Tên hàm & sự kiện trùng bản giả lập `src/realtime/transports/mockHub.js`.
- Thêm chức năng realtime mới: thêm hàm vào `API_App_Demo/Realtime/AppHub.cs` (hoặc đẩy sự kiện bằng `IRealtimeNotifier`) (và `mockHub.js` nếu muốn test không cần backend),
  trong màn hình dùng `useSocketEvent` / `socket.invoke`. Không cần sửa `socket.js`.
