@echo off
chcp 65001 >nul
echo Остановка Telegram-бота MOSSAD (@anti14388bot)...
taskkill /F /FI "WINDOWTITLE eq MOSSAD_TG_BOT*" /T >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'tg_bridge\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo Бот успешно остановлен.
timeout /t 2 >nul
