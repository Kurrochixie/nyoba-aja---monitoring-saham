@echo off
REM =====================================================================
REM  Saham Monitor - launcher
REM  Nyalakan server (kalau belum jalan) lalu buka aplikasinya di browser.
REM =====================================================================
setlocal
set "APPDIR=%~dp0saham-monitor"
set "PY=%APPDIR%\.venv\Scripts\python.exe"
set "URL=http://127.0.0.1:8000/"

REM Cek apakah server sudah hidup di port 8000.
powershell -NoProfile -Command "try{Invoke-WebRequest '%URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0}catch{exit 1}"
if errorlevel 1 (
  REM Belum jalan: nyalakan uvicorn di jendela terpisah (minimized), cwd = APPDIR.
  start "Saham Monitor Server" /min /d "%APPDIR%" "%PY%" -m uvicorn api:app --host 127.0.0.1 --port 8000
  REM Tunggu sampai server siap (maks ~25 detik).
  powershell -NoProfile -Command "for($i=0;$i -lt 25;$i++){try{Invoke-WebRequest '%URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; break}catch{Start-Sleep 1}}"
)

REM Buka aplikasinya di browser default.
start "" "%URL%"
endlocal
