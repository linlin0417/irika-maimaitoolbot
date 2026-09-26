-- src/db/main_schema.sql

-- 1. 實體帳號表 (Accounts)
-- 儲存實體玩家的遊戲綁定憑證、目前狀態與權限等級
CREATE TABLE IF NOT EXISTS accounts (
    account_id TEXT PRIMARY KEY,
    tier INTEGER NOT NULL DEFAULT 4, -- 1: Admin, 2: Priority, 3: Advanced, 4: Basic
    sega_id TEXT,
    sega_password TEXT,
    cookie TEXT,
    lxns_token TEXT,
    player_name TEXT,
    rating INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    icon_url TEXT,
    current_title TEXT,
    current_plate TEXT,
    current_frame TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Discord 映射表 (Discord Mappings)
-- 將 Discord 使用者 ID 映射到實體帳號 ID，支援多開小帳綁定同一人
CREATE TABLE IF NOT EXISTS discord_mappings (
    discord_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
);

-- 3. 歌曲封面快取表 (Global)
CREATE TABLE IF NOT EXISTS song_covers (
    song_name TEXT PRIMARY KEY, 
    cover_url TEXT NOT NULL, 
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
