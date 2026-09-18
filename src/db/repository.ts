import db from './index';

// 定義爬蟲抓取回來的單筆成績介面
export interface ScrapedScore {
    song_name: string;
    chart_type: 'Standard' | 'DX';
    difficulty: 'Basic' | 'Advanced' | 'Expert' | 'Master' | 'Re:MASTER';
    achievements: number;
    dx_score: number;
    fc_status: string; // e.g., '', 'fc', 'fcp', 'ap', 'app'
    fs_status: string; // e.g., '', 'fs', 'fsp', 'fsd', 'fsdp'
    cover_url?: string;
}

// ==========================================
// 1. 玩家資料操作 (User Operations)
// ==========================================

export function upsertUser(discordId: string, segaId: string, segaPassword: string) {
    const stmt = db.prepare(`
        INSERT INTO users (discord_id, sega_id, sega_password)
        VALUES (?, ?, ?)
        ON CONFLICT(discord_id) DO UPDATE SET
            sega_id = excluded.sega_id,
            sega_password = excluded.sega_password,
            updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(discordId, segaId, segaPassword);
}

export function getUser(discordId: string) {
    return db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
}

export function updateUserSession(discordId: string, cookie: string, playerName: string, rating: number, iconUrl: string | null = null) {
    const stmt = db.prepare(`
        UPDATE users SET 
            cookie = ?, 
            player_name = ?, 
            rating = ?,
            icon_url = COALESCE(?, icon_url),
            updated_at = CURRENT_TIMESTAMP
        WHERE discord_id = ?
    `);
    return stmt.run(cookie, playerName, rating, iconUrl, discordId);
}

// ==========================================
// 2. 成績操作與比對核心 (Score & Diff Logic)
// ==========================================

// 運用 SQLite Transaction 保證大批次更新的效能與資料原子性
export const processScrapedScores: any = db.transaction((discordId: string, scores: ScrapedScore[]) => {
    const getScoreStmt = db.prepare(`
        SELECT achievements, dx_score 
        FROM scores 
        WHERE discord_id = ? AND song_name = ? AND chart_type = ? AND difficulty = ?
    `);

    const insertScoreStmt = db.prepare(`
        INSERT INTO scores (discord_id, song_name, chart_type, difficulty, achievements, dx_score, fc_status, fs_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateScoreStmt = db.prepare(`
        UPDATE scores SET
            achievements = ?,
            dx_score = ?,
            fc_status = ?,
            fs_status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE discord_id = ? AND song_name = ? AND chart_type = ? AND difficulty = ?
    `);

    const insertHistoryStmt = db.prepare(`
        INSERT INTO score_history (discord_id, song_name, chart_type, difficulty, achievements, dx_score)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertCoverStmt = db.prepare(`
        INSERT OR REPLACE INTO song_covers (song_name, cover_url, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    let newRecordsCount = 0;
    let improvedRecordsCount = 0;

    for (const score of scores) {
        if (score.cover_url) {
            insertCoverStmt.run(score.song_name, score.cover_url);
        }

        const existing = getScoreStmt.get(discordId, score.song_name, score.chart_type, score.difficulty) as any;

        if (!existing) {
            // 情境 A：該玩家第一次遊玩這張譜面 (沒有快取紀錄)
            insertScoreStmt.run(
                discordId, score.song_name, score.chart_type, score.difficulty,
                score.achievements, score.dx_score, score.fc_status, score.fs_status
            );
            
            // 寫入初始成長軌跡
            insertHistoryStmt.run(
                discordId, score.song_name, score.chart_type, score.difficulty,
                score.achievements, score.dx_score
            );
            newRecordsCount++;
        } else {
            // 情境 B：已有紀錄，進行 Diff 比對
            const isAchieveImproved = score.achievements > existing.achievements;
            const isDxImproved = score.dx_score > existing.dx_score;

            // 只要達成率或 DX 分數其中一項有突破，就視為進步
            if (isAchieveImproved || isDxImproved) {
                // 更新最高成績快取
                updateScoreStmt.run(
                    score.achievements, score.dx_score, score.fc_status, score.fs_status,
                    discordId, score.song_name, score.chart_type, score.difficulty
                );
                
                // 新增一筆成長軌跡 (歷史切片)
                insertHistoryStmt.run(
                    discordId, score.song_name, score.chart_type, score.difficulty,
                    score.achievements, score.dx_score
                );
                improvedRecordsCount++;
            }
        }
    }

    return { newRecordsCount, improvedRecordsCount };
});
