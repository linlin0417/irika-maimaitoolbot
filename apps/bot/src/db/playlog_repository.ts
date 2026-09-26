import { dbManager } from './DatabaseManager.js';

export interface PlaylogDetail {
    discord_id?: string; // Will be attached later
    play_idx: string;
    song_name: string;
    difficulty: string;
    chart_type: string;
    level: string;
    achievement: number;
    dx_score: number;
    dx_score_max: number;
    
    fast_count: number;
    late_count: number;
    
    tap_critical: number; tap_perfect: number; tap_great: number; tap_good: number; tap_miss: number;
    hold_critical: number; hold_perfect: number; hold_great: number; hold_good: number; hold_miss: number;
    slide_critical: number; slide_perfect: number; slide_great: number; slide_good: number; slide_miss: number;
    touch_critical: number; touch_perfect: number; touch_great: number; touch_good: number; touch_miss: number;
    break_critical: number; break_perfect: number; break_great: number; break_good: number; break_miss: number;
    
    max_combo: number;
    max_combo_target: number;
    max_sync: number;
    max_sync_target: number;
    fc_status: string;
    fs_status: string;
    track_rating: number;
    played_at: string; // ISO or formatted string
    cover_url?: string; // Optional cover url
}

export class PlaylogRepository {
    public static savePlaylog(discordId: string, log: PlaylogDetail): boolean {
        try {
            const account = dbManager.getAccountByDiscordId(discordId);
            const userDb = dbManager.getUserDb(account.account_id);

            const stmt = userDb.prepare(`
                INSERT INTO maimai_playlog (
                    play_idx, song_name, difficulty, chart_type, level,
                    achievement, dx_score, dx_score_max, fast_count, late_count,
                    tap_critical, tap_perfect, tap_great, tap_good, tap_miss,
                    hold_critical, hold_perfect, hold_great, hold_good, hold_miss,
                    slide_critical, slide_perfect, slide_great, slide_good, slide_miss,
                    touch_critical, touch_perfect, touch_great, touch_good, touch_miss,
                    break_critical, break_perfect, break_great, break_good, break_miss,
                    max_combo, max_combo_target, max_sync, max_sync_target,
                    fc_status, fs_status, track_rating, played_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?
                )
                ON CONFLICT(play_idx) DO NOTHING
            `);
            
            const result = stmt.run(
                log.play_idx, log.song_name, log.difficulty, log.chart_type, log.level,
                log.achievement, log.dx_score, log.dx_score_max, log.fast_count, log.late_count,
                log.tap_critical, log.tap_perfect, log.tap_great, log.tap_good, log.tap_miss,
                log.hold_critical, log.hold_perfect, log.hold_great, log.hold_good, log.hold_miss,
                log.slide_critical, log.slide_perfect, log.slide_great, log.slide_good, log.slide_miss,
                log.touch_critical, log.touch_perfect, log.touch_great, log.touch_good, log.touch_miss,
                log.break_critical, log.break_perfect, log.break_great, log.break_good, log.break_miss,
                log.max_combo, log.max_combo_target, log.max_sync, log.max_sync_target,
                log.fc_status, log.fs_status, log.track_rating, log.played_at
            );

            return result.changes > 0;
        } catch (error) {
            console.error('[DB] Failed to save playlog:', error);
            return false;
        }
    }

    public static getRecentPlaylogs(discordId: string, limit: number = 10): PlaylogDetail[] {
        const account = dbManager.getAccountByDiscordId(discordId);
        const userDb = dbManager.getUserDb(account.account_id);

        const stmt = userDb.prepare(`
            SELECT * FROM maimai_playlog 
            ORDER BY played_at DESC 
            LIMIT ?
        `);
        return stmt.all(limit) as PlaylogDetail[];
    }
}
