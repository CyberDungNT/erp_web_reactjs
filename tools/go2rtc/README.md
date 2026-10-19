# go2rtc – đọc camera RTSP cho chức năng đọc biển số (chạy ở máy client)

Trình duyệt **không mở được link `rtsp://`**. go2rtc là chương trình nhỏ (miễn phí, mã nguồn mở) chạy trên **chính máy mở web**:
nhận luồng rtsp từ camera rồi trả ảnh JPEG cho trang web. **Nhận dạng biển số vẫn chạy trên trình duyệt, không qua backend.**

```
Camera (rtsp) ──► go2rtc trên máy này (localhost:1984) ──► trình duyệt: hiện hình + đọc biển số
```

## Cài đặt (1 lần, trên máy ở cổng)

1. Chép cả thư mục `tools/go2rtc` này vào máy, ví dụ `C:\go2rtc`.
2. Tải **go2rtc**: https://github.com/AlexxIT/go2rtc/releases/latest → file `go2rtc_win64.zip`,
   giải nén lấy `go2rtc.exe` đặt vào thư mục trên.
3. Tải **ffmpeg** (cần cho camera H.265 / H.264):
   https://www.gyan.dev/ffmpeg/builds/ → `ffmpeg-release-essentials.zip`,
   giải nén, lấy `bin\ffmpeg.exe` đặt cạnh `go2rtc.exe`.

   Thư mục cuối cùng:
   ```
   C:\go2rtc\
     go2rtc.exe
     ffmpeg.exe
     go2rtc.yaml
     start.bat
     chay-an.vbs
   ```
4. Chạy `start.bat` (có cửa sổ, dễ xem lỗi) **hoặc** `chay-an.vbs` (chạy ẩn).
5. Tự chạy khi bật máy: bấm `Win + R` → gõ `shell:startup` → Enter → tạo lối tắt (shortcut) của `chay-an.vbs` vào thư mục vừa mở.

## Dùng trên web

Màn **Đọc biển số xe** → tab **Link camera** → dán link rtsp, ví dụ
`rtsp://admin:matkhau@222.252.25.139:555/Streaming/Channels/101` → **Kết nối**.
Web tự đăng ký camera với go2rtc (ô "go2rtc" mặc định `http://localhost:1984`).

Link rtsp camera Hikvision: `rtsp://user:pass@IP:cổng/Streaming/Channels/101` (luồng chính) hoặc `.../102` (luồng phụ, nhẹ hơn).
Dahua: `rtsp://user:pass@IP:554/cam/realmonitor?channel=1&subtype=0`.

## Lỗi thường gặp (web báo bằng toast)

| Báo lỗi | Cách xử lý |
|---|---|
| Chưa chạy go2rtc trên máy này | Chạy `start.bat` / `chay-an.vbs`, rồi bấm Kết nối lại (web cũng tự thử lại mỗi 5 giây) |
| go2rtc thiếu ffmpeg | Đặt `ffmpeg.exe` cạnh `go2rtc.exe`, chạy lại go2rtc |
| Sai tài khoản / mật khẩu camera | Kiểm tra lại link. **Hikvision khoá tài khoản ~30 phút sau vài lần sai liên tiếp** |
| Camera không phản hồi | Kiểm tra IP, cổng RTSP, mạng giữa máy này và camera |
| Camera từ chối mở luồng video – go2rtc ghi `wrong response on SETUP` | Camera đã nhận đăng nhập nhưng không cho mở thêm luồng: thường do **đủ số kết nối xem cùng lúc** (đầu ghi NVR, app Hik-Connect / iVMS, go2rtc chạy 2 lần...). Tắt bớt nơi đang xem, đảm bảo chỉ chạy 1 go2rtc, hoặc **khởi động lại camera** (xoá các phiên bị treo). Dùng luồng phụ `.../Streaming/Channels/102` để nhẹ hơn |
| Chrome hỏi "cho phép truy cập thiết bị trong mạng nội bộ" | Bấm **Cho phép** (trang web https gọi tới localhost) |

## Ghi chú

- go2rtc chỉ nhận kết nối từ **chính máy này** (`127.0.0.1`), máy khác trong mạng không dùng được.
- Mật khẩu camera không gửi lên máy chủ nào: link rtsp chỉ đi từ trình duyệt tới go2rtc trên cùng máy.
- go2rtc tự ghi các camera web đã thêm (kèm mật khẩu) vào file cấu hình đang chạy. `start.bat` / `chay-an.vbs` chạy bằng
  **bản sao `go2rtc.run.yaml`** (không đưa vào git) nên `go2rtc.yaml` luôn sạch – sửa cấu hình thì sửa `go2rtc.yaml`.
- Mỗi máy mở web để đọc camera đều cần chạy go2rtc riêng.
