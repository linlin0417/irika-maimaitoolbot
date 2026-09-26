import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { dbManager } from '../src/db/DatabaseManager.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
const oldDbPath = path.join(dataDir, 'maimai.db');
const backupDbPath = path.join(dataDir, `maimai.v1_backup_${Date.now()}.db`);

async function migrate() {
    console.log('====================================');
    console.log('   開始執行資料庫破壞性轉移至 V2 架構   ');
    console.log('====================================');

    if (!fs.existsSync(oldDbPath)) {
        console.error(`找不到舊版資料庫: ${oldDbPath}`);
        return;
    }

    // 1. Backup old DB
    fs.copyFileSync(oldDbPath, backupDbPath);
    console.log(`[Backup] 舊資料庫已備份至: ${backupDbPath}`);

    const oldDb = new Database(oldDbPath, { readonly: true });
    const mainDb = dbManager.getMainDb();

    // 2. Migrate Users to Accounts & Mappings
    console.log('[Migrate] 開始轉移使用者資料...');
    const users = oldDb.prepare('SELECT * FROM users').all() as any[];
    
    mainDb.transaction(() => {
        const insertAccount = mainDb.prepare(`
            INSERT OR IGNORE INTO accounts (account_id, tier, sega_id, sega_password, cookie, lxns_token, player_name, rating, icon_url, current_title, current_plate, current_frame, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMapping = mainDb.prepare(`
            INSERT OR IGNORE INTO discord_mappings (discord_id, account_id, created_at)
            VALUES (?, ?, ?)
        `);

        for (const u of users) {
            const accountId = `${u.discord_id}DC`; // Generated ID
            insertAccount.run(
                accountId, 
                4, // Default tier: Basic
                u.sega_id ?? null, u.sega_password ?? null, u.cookie ?? null, u.lxns_token ?? null, 
                u.player_name ?? null, u.rating ?? null, u.icon_url ?? null, 
                u.current_title ?? null, u.current_plate ?? null, u.current_frame ?? null, 
                u.created_at ?? null, u.updated_at ?? null
            );
            insertMapping.run(u.discord_id, accountId, u.created_at);
        }
    })();
    console.log(`[Migrate] 成功轉移 ${users.length} 位使用者。`);

    // 3. Migrate Song Covers
    console.log('[Migrate] 開始轉移歌曲封面快取...');
    const covers = oldDb.prepare('SELECT * FROM song_covers').all() as any[];
    mainDb.transaction(() => {
        const insertCover = mainDb.prepare('INSERT OR IGNORE INTO song_covers (song_name, cover_url, updated_at) VALUES (?, ?, ?)');
        for (const c of covers) insertCover.run(c.song_name ?? null, c.cover_url ?? null, c.updated_at ?? null);
    })();
    console.log(`[Migrate] 成功轉移 ${covers.length} 筆封面資料。`);

    // 4. Distribute Data to User DBs (Sharding)
    console.log('[Migrate] 開始分發玩家專屬資料庫 (Sharding)...');
    
    for (const user of users) {
        const accountId = `${user.discord_id}DC`;
        const userDb = dbManager.getUserDb(accountId);
        
        userDb.transaction(() => {
            // Scores
            const scores = oldDb.prepare('SELECT * FROM scores WHERE discord_id = ?').all(user.discord_id) as any[];
            const insertScore = userDb.prepare(`INSERT OR IGNORE INTO scores (song_name, chart_type, difficulty, achievements, dx_score, fc_status, fs_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const s of scores) insertScore.run(s.song_name ?? null, s.chart_type ?? null, s.difficulty ?? null, s.achievements ?? null, s.dx_score ?? null, s.fc_status ?? null, s.fs_status ?? null, s.updated_at ?? null);

            // Score History
            try {
                const history = oldDb.prepare('SELECT * FROM score_history WHERE discord_id = ?').all(user.discord_id) as any[];
                const insertHist = userDb.prepare(`INSERT INTO score_history (song_name, chart_type, difficulty, achievements, dx_score, recorded_at) VALUES (?, ?, ?, ?, ?, ?)`);
                for (const h of history) insertHist.run(h.song_name ?? null, h.chart_type ?? null, h.difficulty ?? null, h.achievements ?? null, h.dx_score ?? null, h.recorded_at ?? null);
            } catch (e) {}

            // Playlog (可能在舊版資料庫中不存在)
            let playlogs: any[] = [];
            try {
                playlogs = oldDb.prepare('SELECT * FROM maimai_playlog WHERE discord_id = ?').all(user.discord_id) as any[];
            } catch (e) {
                // Table doesn't exist, ignore
            }
            
            const insertLog = userDb.prepare(`
                INSERT OR IGNORE INTO maimai_playlog (
                    play_idx, song_name, difficulty, chart_type, level, achievement, dx_score, dx_score_max, fast_count, late_count,
                    tap_critical, tap_perfect, tap_great, tap_good, tap_miss, hold_critical, hold_perfect, hold_great, hold_good, hold_miss,
                    slide_critical, slide_perfect, slide_great, slide_good, slide_miss, touch_critical, touch_perfect, touch_great, touch_good, touch_miss,
                    break_critical, break_perfect, break_great, break_good, break_miss, max_combo, max_combo_target, max_sync, max_sync_target,
                    fc_status, fs_status, track_rating, played_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const pl of playlogs) {
                insertLog.run(
                    pl.play_idx ?? null, pl.song_name ?? null, pl.difficulty ?? null, pl.chart_type ?? null, pl.level ?? null, pl.achievement ?? null, pl.dx_score ?? null, pl.dx_score_max ?? null, pl.fast_count ?? null, pl.late_count ?? null,
                    pl.tap_critical ?? null, pl.tap_perfect ?? null, pl.tap_great ?? null, pl.tap_good ?? null, pl.tap_miss ?? null, pl.hold_critical ?? null, pl.hold_perfect ?? null, pl.hold_great ?? null, pl.hold_good ?? null, pl.hold_miss ?? null,
                    pl.slide_critical ?? null, pl.slide_perfect ?? null, pl.slide_great ?? null, pl.slide_good ?? null, pl.slide_miss ?? null, pl.touch_critical ?? null, pl.touch_perfect ?? null, pl.touch_great ?? null, pl.touch_good ?? null, pl.touch_miss ?? null,
                    pl.break_critical ?? null, pl.break_perfect ?? null, pl.break_great ?? null, pl.break_good ?? null, pl.break_miss ?? null, pl.max_combo ?? null, pl.max_combo_target ?? null, pl.max_sync ?? null, pl.max_sync_target ?? null,
                    pl.fc_status ?? null, pl.fs_status ?? null, pl.track_rating ?? null, pl.played_at ?? null, pl.created_at ?? null
                );
            }

            // Titles
            try {
                const titles = oldDb.prepare('SELECT * FROM user_titles WHERE discord_id = ?').all(user.discord_id) as any[];
                const insertTitle = userDb.prepare('INSERT OR IGNORE INTO user_titles (title_name, title_type) VALUES (?, ?)');
                for (const t of titles) insertTitle.run(t.title_name ?? null, t.title_type ?? null);
            } catch (e) {}

            // Plates
            try {
                const plates = oldDb.prepare('SELECT * FROM user_plates WHERE discord_id = ?').all(user.discord_id) as any[];
                const insertPlate = userDb.prepare('INSERT OR IGNORE INTO user_plates (plate_name, plate_url) VALUES (?, ?)');
                for (const p of plates) insertPlate.run(p.plate_name ?? null, p.plate_url ?? null);
            } catch (e) {}

            // Frames
            try {
                const frames = oldDb.prepare('SELECT * FROM user_frames WHERE discord_id = ?').all(user.discord_id) as any[];
                const insertFrame = userDb.prepare('INSERT OR IGNORE INTO user_frames (frame_name, frame_url) VALUES (?, ?)');
                for (const f of frames) insertFrame.run(f.frame_name ?? null, f.frame_url ?? null);
            } catch (e) {}
            
        })();
        console.log(`  - 玩家 ${user.player_name || user.discord_id} 資料轉移完成`);
    }

    oldDb.close();
    dbManager.closeAll();
    
    console.log('====================================');
    console.log('       轉移完成！您可以重啟機器人        ');
    console.log('====================================');
}

migrate().catch(console.error);
