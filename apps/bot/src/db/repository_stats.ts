import { dbManager } from './DatabaseManager.js';

export function updateDailyStats(discordId: string, currentTotalPlayCount: number) {
    const account = dbManager.getAccountByDiscordId(discordId);
    const userDb = dbManager.getUserDb(account.account_id);
    const mainDb = dbManager.getMainDb();

    // 取得昨天的總計，以計算今天的 delta
    const today = new Date().toISOString().split('T')[0];
    
    userDb.transaction(() => {
        // 抓出「最近一天」的紀錄（排除今天）來當作 baseline
        const lastRecord = userDb.prepare(`
            SELECT date, total_play_count FROM daily_stats 
            WHERE date < ? ORDER BY date DESC LIMIT 1
        `).get(today) as { date: string, total_play_count: number } | undefined;

        let todayDelta = 0;
        if (lastRecord) {
            todayDelta = currentTotalPlayCount - lastRecord.total_play_count;
            if (todayDelta < 0) todayDelta = 0;
        } else {
            // 如果是系統第一次抓取該玩家資料，無法得知今日增量，因此設為 0
            todayDelta = 0;
        }

        const stmt = userDb.prepare(`
            INSERT INTO daily_stats (date, play_count, total_play_count, first_play_at, last_play_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(date) DO UPDATE SET
                play_count = ?,
                total_play_count = ?,
                last_play_at = CURRENT_TIMESTAMP
        `);
        stmt.run(today, todayDelta, currentTotalPlayCount, todayDelta, currentTotalPlayCount);
    })();
}
