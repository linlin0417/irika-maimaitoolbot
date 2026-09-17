import dotenv from 'dotenv';
// 確保優先讀取環境變數
dotenv.config();

import './db/index'; // 確保資料庫初始化
import { startScheduler } from './core/scheduler';
import { startDiscordBot } from './discord/index';
import { DxRatingCoverProvider } from './core/dxrating-covers';

async function bootstrap() {
    console.log('====================================');
    console.log('   Irika-MaimaiToolBot 系統啟動中   ');
    console.log('====================================');

    // 0. 初始化外部曲繪庫 (gekichumai/dxdata)
    await DxRatingCoverProvider.getInstance().init();

    // 1. 啟動排程管理器 (定時同步與爬蟲)
    startScheduler();

    // 2. 啟動 Discord 機器人
    startDiscordBot();
}

bootstrap();