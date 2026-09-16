import cron from 'node-cron';
import db from '../db/index';
import { runCrawlerForUser } from './crawler-service';
import { SongDatabase } from './song-db';

export function startScheduler() {
    console.log('====================================');
    console.log('    [Scheduler] 啟動排程管理器       ');
    console.log('====================================');

    const songDb = SongDatabase.getInstance();

    // 每天 04:00 AM (伺服器維護期間) 執行曲庫定數同步
    cron.schedule('0 4 * * *', async () => {
        console.log('[Scheduler] 觸發每日曲庫同步任務');
        await songDb.syncFromServer();
    });

    // 核心爬蟲任務：逐一對所有已註冊玩家進行成績同步
    const crawlAllUsers = async () => {
        // 從資料庫抓出所有已經成功綁定過 SEGA ID 的玩家
        const users = db.prepare('SELECT discord_id FROM users WHERE sega_id IS NOT NULL AND sega_password IS NOT NULL').all() as { discord_id: string }[];
        
        console.log(`\n[Scheduler] 準備對 ${users.length} 名玩家執行批次成績爬蟲...`);
        
        for (const user of users) {
            try {
                await runCrawlerForUser(user.discord_id);
                
                // 【安全機制】隨機延遲 5 ~ 15 秒，避免瞬間併發請求被 SEGA 視為 DDoS 而遭到封鎖 (Rate Limit)
                const delay = Math.floor(Math.random() * 10000) + 5000;
                console.log(`[Scheduler] 暫停 ${delay / 1000} 秒後處理下一位玩家...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } catch (e: any) {
                console.error(`[Scheduler] 玩家 ${user.discord_id} 同步失敗:`, e.message);
            }
        }
        
        console.log('[Scheduler] 批次爬蟲任務執行完畢。');
    };

    // 依照專案需求：每 3 小時動態觸發一次
    // 第一次晚 10 分鐘 (06:10)，最後一次早 5 分鐘 (00:55)
    
    // 註冊 06:10, 09:10, 12:10, 15:10, 18:10, 21:10 的排程
    cron.schedule('10 6,9,12,15,18,21 * * *', () => {
        console.log('[Scheduler] 觸發 3 小時定期爬蟲任務');
        crawlAllUsers();
    });

    // 註冊 00:55 的排程
    cron.schedule('55 0 * * *', () => {
        console.log('[Scheduler] 觸發當日最後一次定期爬蟲任務 (00:55)');
        crawlAllUsers();
    });
    
    // 啟動時如果本地沒有快取，強制同步一次
    songDb.syncFromServer();
    
    console.log('[Scheduler] 爬蟲與曲庫排程已成功註冊完畢！');
}
