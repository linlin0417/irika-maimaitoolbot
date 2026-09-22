@echo off
echo 正在停止所有相關的 Node 進程...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo 正在從 GitHub 拉取最新程式碼...
git pull origin main

echo.
echo 正在安裝最新的依賴套件 (Monorepo root)...
call npm install

echo.
echo 正在為機器人子專案安裝依賴...
cd apps/bot
call npm install
cd ../..

echo.
echo 更新完成！您的資料庫與設定檔均已安全保留。
echo 您現在可以執行原本的啟動方式 (例如執行 apps\bot\run.bat)。
pause
