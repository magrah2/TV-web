@echo off
REM Otevre nahled webu bez VS Code - staci na tenhle soubor dvakrat kliknout.
REM
REM Je to zalozni cesta pro pripad, ze nekdo VS Code nema nebo se mu
REM nedari spustit ulohy. Dela presne totez co uloha "1 - Nahled webu".
REM
REM Bez diakritiky schvalne: cmd cte davkove soubory ve starsim kodovani.

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "nastroje\spustit.ps1" nahled

REM Okno zustane otevrene, aby sla precist pripadna chybova hlaska.
echo.
pause
