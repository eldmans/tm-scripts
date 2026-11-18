@echo off
chcp 65001 >nul
title MOSSAD_TG_BOT
echo ========================================================
echo Запуск Telegram-бота MOSSAD (@anti14388bot)
echo ========================================================
cd /d "%~dp0"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'tg_bridge\.py' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
python tg_bridge.py
pause
