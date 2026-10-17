@echo off
title AI Quiz - Connect Laptop GPU to AWS EC2
color 0B
echo ========================================================
echo   Connecting Laptop to AWS EC2 Reverse Tunnel
echo   All online transcriptions will route to this laptop!
echo ========================================================
echo.
echo Tunneling AWS EC2 (43.204.96.224:8000) -^> Your Laptop (127.0.0.1:8000)...
echo Keep this window OPEN while running your Whisper model!
echo.
ssh -i "%USERPROFILE%\Downloads\quiz-key.pem" -N -R 8000:127.0.0.1:8000 -o ServerAliveInterval=60 -o ServerAliveCountMax=3 ubuntu@43.204.96.224
echo.
echo [Tunnel Closed]
pause
