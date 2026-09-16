import { MaimaiAuthClient } from './crawler/auth';
import { MaimaiScraper } from './crawler/scraper';
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query: string): Promise<string> => new Promise((resolve) => rl.question(query, resolve));

async function run() {
    console.log('====================================');
    console.log('    DOM 爬蟲解析完整測試 (國際版)    ');
    console.log('====================================');
    
    const segaId = await question('請輸入 SEGA ID: ');
    const password = await question('請輸入密碼: ');
    rl.close();

    const auth = new MaimaiAuthClient();
    const success = await auth.login(segaId, password);
    if (!success) {
        console.log('登入失敗，請檢查帳號密碼。');
        return;
    }

    console.log('\n登入成功！準備走訪 5 個難度的成績頁面...');
    const scraper = new MaimaiScraper(auth);
    
    const startTime = Date.now();
    const scores = await scraper.fetchAllScores();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n抓取完畢！耗時: ${duration} 秒`);
    console.log(`總共成功解析到 ${scores.length} 筆成績。`);
    
    if (scores.length > 0) {
        console.log('\n隨機抽查 3 筆成績結果：');
        for (let i = 0; i < 3; i++) {
            const randIdx = Math.floor(Math.random() * scores.length);
            console.log(scores[randIdx]);
        }
    }
}
run();
