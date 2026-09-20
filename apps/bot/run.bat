@echo off
:loop
echo 啟動 irika-maimaitoolbot...
call npm start
echo 程式已結束。
echo 3 秒後自動重新啟動...
timeout /t 3 /nobreak >nul
goto loop
