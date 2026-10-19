# Cập nhật hệ thống từ xa (không cần vào server chép file)

Sau khi cài đặt 1 lần, mỗi lần sửa code chỉ cần:

```bash
npm run deploy               # build giao diện web + đẩy lên server
npm run deploy -- api        # publish API + đẩy lên server + chờ API khởi động lại
npm run deploy -- all        # cả hai
npm run deploy -- --note "sửa lỗi in phiếu"   # kèm ghi chú (hiện trong lịch sử)
```

Hoặc trên web: **bấm avatar → Cập nhật hệ thống** (chỉ quản trị viên) → nhập khoá → kéo thả gói `.zip` → Cập nhật.
Màn này cũng xem phiên bản đang chạy, lịch sử cập nhật và **Quay lại** bản trước.

Người đang mở web sẽ tự được nhắc **"Đã có phiên bản mới – Tải lại"** (kiểm tra 5 phút/lần và khi quay lại tab).

---

## Cài đặt 1 lần trên server

### 1. Chép bản API có chức năng cập nhật lên server (lần cuối chép tay)
`dotnet publish` API như bình thường rồi chép lên thư mục site API trên IIS.

### 2. Tạo file `appsettings.Production.json` trong thư mục API trên server
File này **không bao giờ bị cập nhật ghi đè**, giữ cấu hình riêng của server:

```json
{
  "Deploy": {
    "AdminLogin": true,
    "Key": "đặt-một-chuỗi-bí-mật-dài-ít-nhất-16-ký-tự",
    "WebPath": "C:\\inetpub\\wwwroot\\erp-web"
  }
}
```
- `AdminLogin` – **biến chọn cách cập nhật**:
  - `true`: tài khoản đăng nhập có **Is_Admin = 1** (CP_SysLogin) mở "Cập nhật hệ thống" là dùng được, **không cần nhập khoá**.
    API tự kiểm tra TokenKey của phiên đăng nhập trong database (`SysLogin` + `SysUserinfo`: token còn hạn, Is_Admin = 1),
    lịch sử ghi đúng tên tài khoản đó.
  - `false`: chỉ cập nhật bằng khoá (như cũ).
- `Key`: khoá cập nhật – luôn dùng được song song (lệnh `npm run deploy` dùng khoá này). Ai có khoá là cập nhật được, giữ bí mật.
  Chỉ dùng cách tài khoản quản trị thì có thể bỏ trống `Key` (khi đó `npm run deploy` không dùng được).
- `WebPath`: thư mục site IIS của giao diện web.
- ⚠ Đường dẫn trong JSON phải viết **2 dấu `\`**: `"C:\\webreactjs\\dist"`. Viết `"C:\webreactjs\dist"` là sai cú pháp →
  API không khởi động được (IIS báo **HTTP Error 500.30**). Khi đó API ghi rõ file / dòng lỗi vào
  **`LOI-KHOI-DONG.txt`** trong thư mục API – sửa theo hướng dẫn trong file đó rồi Recycle Application Pool.

### 3. Cấp quyền ghi cho IIS (chạy CMD quyền Administrator)
Thay `TenAppPoolApi` bằng tên Application Pool của site API và đường dẫn cho đúng:

```bat
icacls "C:\inetpub\wwwroot\api" /grant "IIS AppPool\TenAppPoolApi:(OI)(CI)M"
icacls "C:\inetpub\wwwroot\erp-web" /grant "IIS AppPool\TenAppPoolApi:(OI)(CI)M"
```

### 4. Recycle Application Pool của API 1 lần, rồi mở web kiểm tra màn "Cập nhật hệ thống".

### 5. Trên máy dev: tạo file `.env.deploy` (không đưa vào git)
Chép từ `.env.deploy.example`, điền `DEPLOY_URL` (địa chỉ API) và `DEPLOY_KEY` (= `Deploy:Key` ở bước 2).

---

## Cách hoạt động / an toàn

- Chỉ **thêm và ghi đè** file, không xoá file thừa (người đang mở bản cũ vẫn tải được file js cũ).
- File gửi lên giống hệt file đang có thì bỏ qua → chỉ gửi những gì thật sự đổi.
- **Không ghi đè file riêng của server**: `key.txt`, `key.xml`, `appsettings.Production.json`, `web.config`, `App_Data\`, `logs\`
  (API) và `web.config` (web) – đổi danh sách ở `Deploy:ApiKeepFiles` / `Deploy:WebKeepFiles`.
- Kiểm tra gói trước khi ghi: web phải có `index.html`, API phải có `API_App_Demo.dll` hợp lệ; chặn đường dẫn `../`; tối đa 400 MB.
- Mỗi lượt cập nhật **sao lưu file bị ghi đè** vào `App_Data\deploy\backups` (giữ 5 bản mới nhất) → nút **Quay lại**.
- API: DLL đang chạy bị Windows khoá → đổi tên file cũ thành `*.deploy-old`, ghi file mới, rồi API tự dừng;
  IIS chạy lại bằng file mới ở request kế tiếp. Lần khởi động sau tự xoá `*.deploy-old`.

## Khi bản API mới bị lỗi không khởi động được (không vào được màn cập nhật)

Trước tiên xem file **`LOI-KHOI-DONG.txt`** trong thư mục API (có khi lỗi do file cấu hình sai cú pháp – sửa là chạy lại).
Nếu không phải, vào server **1 lần** và khôi phục bằng bản sao lưu:

1. Mở thư mục `<thư mục API>\App_Data\deploy\backups`, lấy file `.zip` **mới nhất**.
2. Giải nén **đè** vào thư mục API (PowerShell):
   ```powershell
   Expand-Archive -Path "<thư mục API>\App_Data\deploy\backups\<file mới nhất>.zip" -DestinationPath "<thư mục API>" -Force
   ```
3. Recycle Application Pool của API.

Nếu API không tự chạy lại sau khi cập nhật: Recycle Application Pool (IIS Manager → Application Pools → Recycle).
