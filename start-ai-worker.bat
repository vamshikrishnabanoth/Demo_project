@echo off
title AI Quiz - Local Whisper Engine (Port 8000)
color 0A
echo ========================================================
echo   Starting Local Whisper Transcription Engine
echo   Model: large-v3-turbo (Port 8000)
echo ========================================================
echo.
echo To forward live transcriptions from your AWS website to this laptop,
echo keep this window running, and run connect-laptop-to-aws.bat in another window!
echo.
py -3.11 server/local_whisper_server.py
pause
