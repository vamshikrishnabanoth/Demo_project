@echo off
title AI Quiz - Connect Laptop to AWS EC2 (Port 8000)
color 0B

:loop
cls
echo ========================================================
echo   Connecting Laptop to AWS EC2 Reverse Tunnel
echo   All online transcriptions will route to this laptop!
echo ========================================================
echo.
echo Tunneling AWS EC2 (43.204.96.224:8000) -^> Your Laptop (127.0.0.1:8000)...
echo [STATUS] Tunnel ACTIVE and forwarding! Keep this window OPEN.
echo.
ssh -i "%USERPROFILE%\Downloads\quiz-key.pem" -N -R 8000:127.0.0.1:8000 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes ubuntu@43.204.96.224

echo.
echo [!] Tunnel disconnected or timed out. Auto-reconnecting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
