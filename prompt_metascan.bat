@echo off
chcp 65001 >nul
python "%~dp0prompt_metascan.py" "%CD%"
