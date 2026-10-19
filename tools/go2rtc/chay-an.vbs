' Chay go2rtc AN (khong hien cua so) – dat loi tat cua file nay vao thu muc Startup de tu chay khi bat may (xem README.md)
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Environment("Process")("PATH") = dir & ";" & sh.Environment("Process")("PATH")
' chay bang ban sao go2rtc.run.yaml: go2rtc tu ghi camera them tu web (kem mat khau) vao file dang chay -> giu go2rtc.yaml sach
fso.CopyFile dir & "\go2rtc.yaml", dir & "\go2rtc.run.yaml", True
sh.Run """" & dir & "\go2rtc.exe"" -config """ & dir & "\go2rtc.run.yaml""", 0, False
