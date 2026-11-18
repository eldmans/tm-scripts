@echo off
echo Остановка Telegram-бота MOSSAD...
taskkill /F /FI "WINDOWTITLE eq MOSSAD_TG_BOT*" /T >nul 2>&1
wmic process where "CommandLine like '%%tg_bridge.py%%' and not CommandLine like '%%wmic%%'" call terminate >nul 2>&1
echo Бот успешно остановлен.
timeout /t 3
