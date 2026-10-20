# src/modules – nơi vẽ các màn hình nghiệp vụ

Bấm 1 chức năng trên menu → app gọi `CP_SysGetMenu` → dựa vào **cờ loại** và cột **`FormInPut`**
để mở đúng file màn hình. Không cần khai báo ở đâu khác: đặt file đúng thư mục, đúng tên là chạy.

| Loại | Cờ trong `CP_SysGetMenu` | Thư mục | Vẽ gì | File mẫu để chép |
|---|---|---|---|---|
| Danh mục | `IsList = 1` | `danhmuc/` | Chỉ vẽ **form Sửa / Thêm** (popup). Màn danh sách là màn chung, không phải vẽ | `_mau/MauDanhMuc.jsx` |
| Báo cáo | `IsReport = 1` | `baocao/` | Điều kiện lọc + bảng kết quả | `_mau/MauBaoCao.jsx` |
| Chứng từ | `IsVoucher = 1` | `chungtu/` | Thông tin chung + dòng chi tiết + Lưu | `_mau/MauChungTu.jsx` |
| Tính toán | `IsCaculator = 1` | `calculator/` | Tham số + nút Thực hiện | `_mau/MauCalculator.jsx` |
| Khác | không cờ nào | `other/` | Tuỳ ý | `_mau/MauKhac.jsx` |

## Thêm 1 màn hình mới

1. Xem `FormInPut` mà thủ tục trả về, ví dụ `BcSoCaiTk` với `IsReport = 1`.
2. Chép file mẫu của loại đó thành `src/modules/baocao/BcSoCaiTk.jsx`, rồi đổi tên component.
3. Sửa ô nhập, cột và tên thủ tục. Bấm lại menu là màn mở ra.

Chưa có file thì màn hình sẽ báo đúng đường dẫn cần tạo và file mẫu để chép.

### Riêng danh mục

- Màn danh sách dùng chung cho mọi danh mục (`src/screens/ListScreen.jsx`). Màn này gọi `CP_SysList` và tự dựng cột, lọc, menu chuột phải và phím tắt.
- Bấm Mới (F4), Sửa (F3) hoặc Xem (F2) sẽ mở file `danhmuc/<FormInPut>.jsx`. Ở đây `FormInPut` lấy từ **bảng cấu hình của `CP_SysList`**, không phải từ `CP_SysGetMenu`.
- Form này kế thừa `CyberFrmListF3`, có sẵn popup, nút Lưu / Quay ra, Ctrl+S và chế độ chỉ xem. Ví dụ: `danhmuc/DMTK0.jsx`.

## Quy tắc

- **Tên file = `FormInPut`**: không phân biệt hoa thường, và được phép bỏ đuôi `Page`. Ví dụ `HangHoa` tìm được cả `HangHoa.jsx` lẫn `HangHoaPage.jsx`.
- **Thứ tự tìm**: app tìm trong thư mục của loại trước, sau đó mới tìm các thư mục khác. Hai loại dùng trùng một tên form vẫn mở đúng file.
- **Props màn hình nhận**: `{ menu, menuInfo }`. `menuInfo` là nguyên dòng `CP_SysGetMenu` (`Ma_Ct`, `Para`, `Cp_NameCaculator`...).
- **Thư mục hoặc file bắt đầu bằng `_`** (vd `_mau/`) **không được nạp** vào app. Đặt file nháp và file mẫu ở đó.
- **Báo lỗi**: mọi lỗi và cảnh báo hiện bằng **toast**, không hiện chữ lỗi trên giao diện.
- **File phụ của màn hình** (css, hàm tiện ích, component con): đặt cạnh màn hình, dùng tên không trùng với một `FormInPut` nào. Gợi ý: bắt đầu bằng `_` (vd `_bcHelpers.js`) để chắc chắn không bị coi là màn hình.
- **`dev/`**: các màn thử và màn mẫu (test control, đọc biển số, chat...). Thư mục này không theo cờ loại.
- **`index.js` trong một thư mục** là tuỳ chọn. Chỉ tạo khi cần gắn cứng Menu_Id, thêm thành phần chạy nền, hoặc thêm mục vào menu avatar. Xem `_mau/index.js`.

## Liên quan

- `src/screens/menuForm.js`: bảng loại (`FORM_KINDS`), cách tìm file, `CP_SysGetMenu`, `CP_SysList`.
- `src/screens/MenuScreen.jsx`: cửa sổ chức năng, chọn màn theo loại.
- `src/components/cyber/`: bộ control dùng chung (`CyberForm`, `CyberFrmListF3`, `CyberTable`, `CyberPopup`...).
