import { MaimaiAuthClient } from './crawler/auth';
import * as readline from 'readline';
import * as cheerio from 'cheerio';

// 設定終端機互動輸入
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => new Promise((resolve) => rl.question(query, resolve));

async function runTest() {
    console.log('====================================');
    console.log('   SEGA ID 登入爬蟲測試 (國際版)   ');
    console.log('====================================');
    
    const segaId = await question('請輸入 SEGA ID: ');
    const password = await question('請輸入密碼: ');
    rl.close();

    const authClient = new MaimaiAuthClient();
    console.log('\n正在向 gw.sega.jp 發送登入請求...');
    
    const startTime = Date.now();
    const success = await authClient.login(segaId, password);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (success) {
        console.log(`\n登入成功！(耗時 ${duration} 秒)`);
        
        console.log('[Info] 正在前往首頁擷取玩家名片...');
        try {
            const homeRes = await authClient.client.get('https://maimaidx-eng.com/maimai-mobile/home/');
            const $ = cheerio.load(homeRes.data);
            
            const playerName = $('.name_block').text().trim();
            const rating = $('.rating_block').text().trim();
            
            console.log(`\n歡迎回來, ${playerName || '未知玩家'} !`);
            console.log(`當前 Rating: ${rating || '未知'}`);
            
            const cookie = await authClient.exportCookieString();
            console.log('\n成功攔截並保存在 CookieJar 的 Session (局部):');
            console.log(cookie.substring(0, 70) + '...');
        } catch (err: any) {
            console.log('擷取首頁失敗:', err.message);
        }
    } else {
        console.log('\n登入失敗！請檢查您的 SEGA ID、密碼，或是確認該帳號有綁定國際版 maimai。');
    }
}

runTest();
