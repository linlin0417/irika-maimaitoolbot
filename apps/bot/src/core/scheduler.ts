import cron from 'node-cron';
import db from '../db/index.js';
import { runCrawlerForUser } from './crawler-service.js';
import { SongDatabase } from './song-db.js';
import type { Client } from 'discord.js';

export function startScheduler(client?: Client) {
    console.log('====================================');
    console.log('    [Scheduler] 背景排程系統啟動       ');
    console.log('====================================');

    const songDb = SongDatabase.getInstance();

    // 每天 04:00 AM (伺服器維護後) 進行歌曲資料庫同步
    cron.schedule('0 4 * * *', async () => {
        console.log('[Scheduler] 執行每日歌曲庫同步...');
        await songDb.syncFromServer();
    });

    // 定義自動爬蟲任務
    const crawlAllUsers = async () => {
        const users = db.prepare('SELECT discord_id FROM users WHERE sega_id IS NOT NULL AND sega_password IS NOT NULL').all() as { discord_id: string }[];
        
        console.log(`\n[Scheduler] 準備對 ${users.length} 位玩家進行自動更新...`);
        
        for (const user of users) {
            try {
                const result = await runCrawlerForUser(user.discord_id);
                
                // 只有在有新成績，且有傳入 client 的情況下，才發送 Discord 私訊通知
                if (result && client && (result.newRecordsCount > 0 || result.improvedRecordsCount > 0)) {
                    try {
                        const dcUser = await client.users.fetch(user.discord_id);
                        await dcUser.send(`🤖 **背景自動更新完成！**\n嗨 ${result.playerName}，系統剛剛自動幫您同步了成績！\n✨ 新增了 **${result.newRecordsCount}** 筆成績\n📈 達成率突破 **${result.improvedRecordsCount}** 筆\n快使用 \`/b50\` 看看最新海報吧！`);
                        console.log(`[Scheduler] 已發送更新通知給玩家 ${user.discord_id}`);
                    } catch (dmErr: any) {
                        console.warn(`[Scheduler] 無法私訊玩家 ${user.discord_id}: ${dmErr.message}`);
                    }
                }
                
                // 隨機等待 5 ~ 15 秒，避免觸發 SEGA 的 Rate Limit
                const delay = Math.floor(Math.random() * 10000) + 5000;
                console.log(`[Scheduler] 隨機等待 ${delay / 1000} 秒後繼續...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } catch (e: any) {
                console.error(`[Scheduler] 玩家 ${user.discord_id} 自動更新失敗:`, e.message);
            }
        }
        
        console.log('[Scheduler] 本次批次自動更新完成。');
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
