-- src/db/user_schema.sql

-- 1. 玩家最新成績快取 (Scores)
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_name TEXT NOT NULL,
    chart_type TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    achievements REAL NOT NULL,
    dx_score INTEGER NOT NULL,
    fc_status TEXT,
    fs_status TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(song_name, chart_type, difficulty)
);

-- 2. 成績成長軌跡表 (Score History)
CREATE TABLE IF NOT EXISTS score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_name TEXT NOT NULL,
    chart_type TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    achievements REAL NOT NULL,
    dx_score INTEGER NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_score_history_lookup 
ON score_history(song_name, chart_type, difficulty, recorded_at);

-- 3. 獨立的單次遊玩詳細紀錄 (Playlog)
CREATE TABLE IF NOT EXISTS maimai_playlog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    play_idx TEXT UNIQUE,
    song_name TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    chart_type TEXT NOT NULL,
    level TEXT,
    achievement REAL NOT NULL,
    dx_score INTEGER NOT NULL,
    dx_score_max INTEGER NOT NULL,
    fast_count INTEGER,
    late_count INTEGER,
    tap_critical INTEGER, tap_perfect INTEGER, tap_great INTEGER, tap_good INTEGER, tap_miss INTEGER,
    hold_critical INTEGER, hold_perfect INTEGER, hold_great INTEGER, hold_good INTEGER, hold_miss INTEGER,
    slide_critical INTEGER, slide_perfect INTEGER, slide_great INTEGER, slide_good INTEGER, slide_miss INTEGER,
    touch_critical INTEGER, touch_perfect INTEGER, touch_great INTEGER, touch_good INTEGER, touch_miss INTEGER,
    break_critical INTEGER, break_perfect INTEGER, break_great INTEGER, break_good INTEGER, break_miss INTEGER,
    max_combo INTEGER, max_combo_target INTEGER, max_sync INTEGER, max_sync_target INTEGER,
    fc_status TEXT, fs_status TEXT, track_rating INTEGER,
    played_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 使用者稱號庫 (Titles)
CREATE TABLE IF NOT EXISTS user_titles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_name TEXT NOT NULL UNIQUE,
    title_type TEXT
);

-- 5. 使用者名牌版庫 (Plates)
CREATE TABLE IF NOT EXISTS user_plates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_name TEXT NOT NULL UNIQUE,
    plate_url TEXT NOT NULL
);

-- 6. 使用者底板庫 (Frames)
CREATE TABLE IF NOT EXISTS user_frames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frame_name TEXT NOT NULL UNIQUE,
    frame_url TEXT NOT NULL
);

-- 7. 每日遊玩道數統計 (Daily Stats - 用於畫草地圖)
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY, -- YYYY-MM-DD
    play_count INTEGER DEFAULT 0,
    first_play_at DATETIME,
    last_play_at DATETIME
);
