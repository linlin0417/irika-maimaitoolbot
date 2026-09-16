import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// 資料庫檔案將建立在根目錄下的 data 資料夾 (需確保資料夾存在)
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

import type { Database as BetterDatabase } from 'better-sqlite3';

const dbPath = path.join(dataDir, 'maimai.db');
const db: BetterDatabase = new Database(dbPath, {
    // 開啟預寫式日誌 (WAL) 模式，大幅提升 SQLite 讀寫併發效能
    // 這對我們的背景爬蟲 + 機器人查詢非常重要
});

db.pragma('journal_mode = WAL');

// 讀取並執行 Schema 初始化資料表
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// 執行 schema (若資料表已存在會被 IF NOT EXISTS 略過)
db.exec(schema);

console.log(`[DB] SQLite database initialized at ${dbPath}`);

export default db;
