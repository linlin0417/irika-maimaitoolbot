# 使用 Node.js 24 作為基底映像 (對應目前的開發環境)
FROM node:24-slim

# 設定工作目錄
WORKDIR /app

# 安裝必要的系統依賴 (主要針對 canvas 與 better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 複製 package.json 進行安裝
COPY package*.json ./

# 安裝依賴 (包含執行 setup 腳本)
RUN npm install

# 複製其餘所有專案檔案
COPY . .

# 暴露可能需要的 Port (雖然 Discord bot 不一定需要，但先保留)
# EXPOSE 3000

# 設定啟動指令
CMD ["npm", "start"]
