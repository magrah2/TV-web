@echo off
REM Otevře náhled webu bez VS Code — stačí na tenhle soubor dvakrát kliknout.
REM
REM Je to záložní cesta pro případ, že někdo VS Code nemá nebo se mu
REM nedaří spustit úlohy. Dělá přesně totéž co úloha "1 - Nahled webu".

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "nastroje\spustit.ps1" nahled

REM Okno zůstane otevřené, aby šla přečíst případná chybová hláška.
echo.
pause
