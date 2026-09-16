import dotenv from 'dotenv';
// 確保最優先載入環境變數
dotenv.config();

import './db/index'; // 觸發資料庫初始化
import { startScheduler } from './core/scheduler';
import { startDiscordBot } from './discord/index';

console.log('====================================');
console.log('   Irika-MaimaiToolBot 系統啟動中   ');
console.log('====================================');

// 1. 啟動背景排程 (曲庫同步與定時爬蟲)
startScheduler();

// 2. 啟動 Discord 機器人介面
startDiscordBot();