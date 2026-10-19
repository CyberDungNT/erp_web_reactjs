@echo off
rem Chay go2rtc cho chuc nang doc bien so xe (erp-web). Dong cua so nay = tat go2rtc.
cd /d "%~dp0"
if not exist go2rtc.exe (
  echo Chua co go2rtc.exe trong thu muc nay - xem README.md
  pause
  exit /b 1
)
if not exist ffmpeg.exe echo [Canh bao] Chua co ffmpeg.exe - camera H.265/H.264 se khong ra hinh. Xem README.md
rem dua thu muc nay vao PATH de go2rtc tim thay ffmpeg.exe
set "PATH=%~dp0;%PATH%"
echo go2rtc dang chay tai http://localhost:1984  (dong cua so de tat)
rem go2rtc tu ghi camera duoc them tu web (kem mat khau) vao file cau hinh dang chay
rem -> chay bang BAN SAO go2rtc.run.yaml (khong dua vao git), giu go2rtc.yaml sach
copy /y go2rtc.yaml go2rtc.run.yaml >nul
go2rtc.exe -config go2rtc.run.yaml
pause
