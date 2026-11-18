@echo off
title MOSSAD_TG_BOT
echo ========================================================
echo Запуск Telegram-бота MOSSAD (bridge)
echo Для остановки просто закройте это окно или запустите STOP_BOT.bat
echo ========================================================
cd /d "%~dp0"
python tg_bridge.py
pause
