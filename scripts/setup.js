import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function ensureConfig(exampleFile, targetFile) {
    const examplePath = path.join(rootDir, exampleFile);
    const targetPath = path.join(rootDir, targetFile);

    if (!fs.existsSync(targetPath)) {
        if (fs.existsSync(examplePath)) {
            fs.copyFileSync(examplePath, targetPath);
            console.log(`[Setup] 已自動建立: ${targetFile} (由 ${exampleFile} 複製)`);
        } else {
            console.warn(`[Setup] 找不到範本檔案: ${exampleFile}`);
        }
    } else {
        console.log(`[Setup] 設定檔已存在: ${targetFile}`);
    }
}

console.log('=== Irika-MaimaiToolBot 環境初始化 ===');

// 確保必備資料夾存在
const dirs = ['cfg', 'data', 'data/covers'];
dirs.forEach(d => {
    const p = path.join(rootDir, d);
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
        console.log(`[Setup] 建立資料夾: ${d}`);
    }
});

// 初始化設定檔
ensureConfig('.env.example', '.env');
ensureConfig('cfg/dc_whitelist.cfg.example', 'cfg/dc_whitelist.cfg');

// 修補 mai-kit 語系
import { execSync } from 'child_process';
try {
    execSync('node scripts/patch-maikit.cjs', { stdio: 'inherit' });
} catch (e) {
    console.warn('[Setup] 執行 mai-kit 語系修補失敗');
}

console.log('\n[Setup] 初始化完成！');
console.log('請記得填寫 .env 以及 cfg/dc_whitelist.cfg 中的設定值！');
console.log('====================================\n');
