import { dbManager } from './DatabaseManager.js';

export interface ScrapedScore {
    song_name: string;
    chart_type: 'Standard' | 'DX';
    difficulty: 'Basic' | 'Advanced' | 'Expert' | 'Master' | 'Re:MASTER';
    achievements: number;
    dx_score: number;
    fc_status: string;
    fs_status: string;
    cover_url?: string;
}

// ==========================================
// 1. 玩家資料操作 (Main DB)
// ==========================================

export function upsertUser(discordId: string, segaId: string, segaPassword: string) {
    const mainDb = dbManager.getMainDb();
    const accountId = `${discordId}DC`;
    
    mainDb.transaction(() => {
        const stmtAccount = mainDb.prepare(`
            INSERT INTO accounts (account_id, sega_id, sega_password)
            VALUES (?, ?, ?)
            ON CONFLICT(account_id) DO UPDATE SET
                sega_id = excluded.sega_id,
                sega_password = excluded.sega_password,
                updated_at = CURRENT_TIMESTAMP
        `);
        stmtAccount.run(accountId, segaId, segaPassword);

        const stmtMapping = mainDb.prepare(`
            INSERT OR IGNORE INTO discord_mappings (discord_id, account_id)
            VALUES (?, ?)
        `);
        stmtMapping.run(discordId, accountId);
    })();
}

export function getUser(discordId: string) {
    const mainDb = dbManager.getMainDb();
    const row = mainDb.prepare(`
        SELECT a.* 
        FROM discord_mappings m
        JOIN accounts a ON m.account_id = a.account_id
        WHERE m.discord_id = ?
    `).get(discordId);
    return row;
}

export function updateUserSession(discordId: string, cookie: string, playerName: string, rating: number, iconUrl: string | null = null) {
    const mainDb = dbManager.getMainDb();
    const row = mainDb.prepare('SELECT account_id FROM discord_mappings WHERE discord_id = ?').get(discordId) as { account_id: string } | undefined;
    if (!row) return;

    const stmt = mainDb.prepare(`
        UPDATE accounts SET 
            cookie = ?, 
            player_name = ?, 
            rating = ?,
            icon_url = COALESCE(?, icon_url),
            updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
    `);
    return stmt.run(cookie, playerName, rating, iconUrl, row.account_id);
}

// ==========================================
// 2. 成績操作與比對核心 (User DB)
// ==========================================

export function processScrapedScores(discordId: string, scores: ScrapedScore[]) {
    const account = dbManager.getAccountByDiscordId(discordId);
    const userDb = dbManager.getUserDb(account.account_id);
    const mainDb = dbManager.getMainDb();

    return userDb.transaction(() => {
        const getScoreStmt = userDb.prepare(`
            SELECT achievements, dx_score 
            FROM scores 
            WHERE song_name = ? AND chart_type = ? AND difficulty = ?
        `);

        const insertScoreStmt = userDb.prepare(`
            INSERT INTO scores (song_name, chart_type, difficulty, achievements, dx_score, fc_status, fs_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const updateScoreStmt = userDb.prepare(`
            UPDATE scores SET
                achievements = ?,
                dx_score = ?,
                fc_status = ?,
                fs_status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE song_name = ? AND chart_type = ? AND difficulty = ?
        `);

        const insertHistoryStmt = userDb.prepare(`
            INSERT INTO score_history (song_name, chart_type, difficulty, achievements, dx_score)
            VALUES (?, ?, ?, ?, ?)
        `);

        const insertCoverStmt = mainDb.prepare(`
            INSERT OR REPLACE INTO song_covers (song_name, cover_url, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);

        let newRecordsCount = 0;
        let improvedRecordsCount = 0;

        for (const score of scores) {
            if (score.cover_url) {
                insertCoverStmt.run(score.song_name, score.cover_url);
            }

            const existing = getScoreStmt.get(score.song_name, score.chart_type, score.difficulty) as any;

            if (!existing) {
                insertScoreStmt.run(
                    score.song_name, score.chart_type, score.difficulty,
                    score.achievements, score.dx_score, score.fc_status, score.fs_status
                );
                insertHistoryStmt.run(
                    score.song_name, score.chart_type, score.difficulty,
                    score.achievements, score.dx_score
                );
                newRecordsCount++;
            } else {
                const isAchieveImproved = score.achievements > existing.achievements;
                const isDxImproved = score.dx_score > existing.dx_score;

                if (isAchieveImproved || isDxImproved) {
                    updateScoreStmt.run(
                        score.achievements, score.dx_score, score.fc_status, score.fs_status,
                        score.song_name, score.chart_type, score.difficulty
                    );
                    insertHistoryStmt.run(
                        score.song_name, score.chart_type, score.difficulty,
                        score.achievements, score.dx_score
                    );
                    improvedRecordsCount++;
                }
            }
        }

        return { newRecordsCount, improvedRecordsCount };
    })();
}

export function updateUserCollections(discordId: string, titles: { name: string, type: string }[], plates: string[], frames: string[]) {
    const account = dbManager.getAccountByDiscordId(discordId);
    const userDb = dbManager.getUserDb(account.account_id);

    const insertTitle = userDb.prepare('INSERT INTO user_titles (title_name, title_type) VALUES (?, ?) ON CONFLICT(title_name) DO UPDATE SET title_type = excluded.title_type');
    const insertPlate = userDb.prepare('INSERT INTO user_plates (plate_name, plate_url) VALUES (?, ?) ON CONFLICT(plate_name) DO UPDATE SET plate_url = excluded.plate_url');
    const insertFrame = userDb.prepare('INSERT INTO user_frames (frame_name, frame_url) VALUES (?, ?) ON CONFLICT(frame_name) DO UPDATE SET frame_url = excluded.frame_url');
    
    userDb.transaction(() => {
        for (const t of titles) insertTitle.run(t.name, t.type);
        for (const p of plates) insertPlate.run(p.split('/').pop() || p, p);
        for (const f of frames) insertFrame.run(f.split('/').pop() || f, f);
    })();
}

export function getUserCollections(discordId: string) {
    const account = dbManager.getAccountByDiscordId(discordId);
    const userDb = dbManager.getUserDb(account.account_id);

    const titles = userDb.prepare('SELECT title_name, title_type FROM user_titles').all() as any[];
    const plates = userDb.prepare('SELECT plate_name, plate_url FROM user_plates').all() as any[];
    const frames = userDb.prepare('SELECT frame_name, frame_url FROM user_frames').all() as any[];
    return { titles, plates, frames };
}

export function updateUserEquipment(discordId: string, type: 'title' | 'plate' | 'frame', value: string) {
    const mainDb = dbManager.getMainDb();
    const account = dbManager.getAccountByDiscordId(discordId);

    const validTypes = {
        title: 'current_title',
        plate: 'current_plate',
        frame: 'current_frame'
    };
    const col = validTypes[type];
    if (!col) return;
    mainDb.prepare(`UPDATE accounts SET ${col} = ? WHERE account_id = ?`).run(value, account.account_id);
}
