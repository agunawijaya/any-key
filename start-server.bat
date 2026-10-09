@echo off
setlocal
rem Any Key: starts the app on http://localhost:3210 and opens it in the browser.
rem   start-server.bat            development server; edits show up live
rem   start-server.bat prod       production build, the way players get it
rem   add "nobrowser" to either to skip opening the browser
rem Stop the server with Ctrl+C.

cd /d "%~dp0"

set "PORT=3210"
set "MODE=dev"
set "BROWSER=1"
for %%A in (%*) do (
  if /i "%%~A"=="prod" set "MODE=prod"
  if /i "%%~A"=="nobrowser" set "BROWSER="
)

where npm >nul 2>nul || (
  echo Node.js was not found. Install it from nodejs.org, then run this again.
  pause
  exit /b 1
)

rem Only one server per port: if Any Key is already up, just open it.
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul && (
  echo Something is already running on port %PORT%. Opening http://localhost:%PORT%
  if defined BROWSER start "" "http://localhost:%PORT%"
  exit /b 0
)

if not exist "node_modules\" (
  echo Installing dependencies, this takes a minute the first time...
  call npm install || (
    pause
    exit /b 1
  )
)

rem Opens the browser once the server answers, while the server runs in this window.
if defined BROWSER start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 180; $i++) { try { (New-Object Net.Sockets.TcpClient).Connect('localhost', %PORT%); Start-Process 'http://localhost:%PORT%'; break } catch { Start-Sleep -Seconds 1 } }"

if /i "%MODE%"=="prod" (
  echo Building Any Key...
  call npm run build || (
    pause
    exit /b 1
  )
  echo Starting the production server on http://localhost:%PORT% - press Ctrl+C to stop.
  call npm run start -- -p %PORT%
) else (
  echo Starting the development server on http://localhost:%PORT% - press Ctrl+C to stop.
  call npm run dev -- -p %PORT%
)
