-- src/db/schema.sql

-- 1. 使用者資料表 (Users)
-- 負責儲存 Discord 綁定狀態、SEGA 登入憑證與遊戲基本資訊
CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT PRIMARY KEY,
    sega_id TEXT,                 -- 改為非必填，支援純綁定 token
    sega_password TEXT,           -- 改為非必填
    cookie TEXT,                  -- 存放有效的登入 Session Cookie，避免頻繁登入
    lxns_token TEXT,              -- 水魚查分器 Developer Token
    player_name TEXT,             -- 遊戲內玩家暱稱
    rating INTEGER DEFAULT 0,     -- 玩家當前 DX Rating
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 玩家最新成績快取 (Scores)
-- 儲存玩家在各個曲目與難度下的「最佳成績」，用於每次爬蟲抓完資料後進行 Diff 比對
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    song_name TEXT NOT NULL,
    chart_type TEXT NOT NULL,     -- 'Standard' 或 'DX'
    difficulty TEXT NOT NULL,     -- 'Basic', 'Advanced', 'Expert', 'Master', 'Re:MASTER'
    achievements REAL NOT NULL,   -- 達成率 (如 100.5000)
    dx_score INTEGER NOT NULL,    -- DX 分數
    fc_status TEXT,               -- FC/AP 狀態 (如 'fc', 'ap', 'app')
    fs_status TEXT,               -- 同步狀態 (如 'fs', 'fsd')
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- 確保同一玩家的同一首歌、同一譜面、同一難度只有一筆「最新」紀錄
    UNIQUE(discord_id, song_name, chart_type, difficulty),
    FOREIGN KEY(discord_id) REFERENCES users(discord_id) ON DELETE CASCADE
);

-- 3. 成績成長軌跡表 (Score History)
-- 每次爬蟲比對發現「達成率提升」或「DX 分數提升」時，寫入一筆歷史快照，專門用來繪製成長曲線
CREATE TABLE IF NOT EXISTS score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL,
    song_name TEXT NOT NULL,
    chart_type TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    achievements REAL NOT NULL,
    dx_score INTEGER NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- 記錄發生變動的時間
    FOREIGN KEY(discord_id) REFERENCES users(discord_id) ON DELETE CASCADE
);

-- 建立索引 (Indexes) 以加速成長曲線查詢
CREATE INDEX IF NOT EXISTS idx_score_history_lookup 
ON score_history(discord_id, song_name, chart_type, difficulty, recorded_at);
