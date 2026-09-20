import Database from 'better-sqlite3';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 解決 ESM 模組下 __dirname 不存在的問題
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 資料庫檔案將建立在根目錄下的 data 資料夾 (需確保資料夾存在)
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'maimai.db');
const db: BetterSqlite3Database = new Database(dbPath, {
    // 開啟預寫式日誌 (WAL) 模式，大幅提升 SQLite 讀寫併發效能
});

db.pragma('journal_mode = WAL');

// 讀取並執行 Schema 初始化資料表
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// 執行 schema (若資料表已存在會被 IF NOT EXISTS 略過)
db.exec(schema);

try {
    db.exec('ALTER TABLE users ADD COLUMN icon_url TEXT');
    console.log(`[DB] Added icon_url column to users table.`);
} catch (e) {
    // 欄位已經存在時會報錯，可直接忽略
}

console.log(`[DB] SQLite database initialized at ${dbPath}`);

export default db;
