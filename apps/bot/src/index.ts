import dotenv from 'dotenv';
// 確保優先讀取環境變數
dotenv.config();

import { dbManager } from './db/DatabaseManager.js'; // 確保資料庫初始化
import { startScheduler } from './core/scheduler.js';
import { startDiscordBot } from './discord/index.js';
import { DxRatingCoverProvider } from './core/dxrating-covers.js';
import { startAutoBackup } from './core/autobackup.js';

async function bootstrap() {
    console.log('====================================');
    console.log('   Irika-MaimaiToolBot 系統啟動中   ');
    console.log('====================================');

    // 0. 喚醒資料庫管理器
    dbManager.getMainDb();

    // 0. 初始化外部曲繪庫 (gekichumai/dxdata)
    await DxRatingCoverProvider.getInstance().init();

    // 1. 啟動 Discord 機器人並取得 client 實例
    const client = await startDiscordBot();

    // 2. 啟動背景排程 (傳入 client 供私訊通知使用)
    startScheduler(client);

    // 3. 啟動自動備份排程
    if (client) {
        startAutoBackup(client);
    }
}

bootstrap();