import { MaimaiAuthClient } from '../crawler/auth';
import { MaimaiScraper } from '../crawler/scraper';
import { processScrapedScores, updateUserSession, getUser } from '../db/repository';
import * as cheerio from 'cheerio';

export async function runCrawlerForUser(discordId: string) {
    console.log(`[CrawlerService] 開始處理玩家資料，Discord ID: ${discordId}`);
    
    // 1. 從資料庫取得玩家資訊
    const user = getUser(discordId) as any;
    if (!user) {
        console.error(`[CrawlerService] 找不到該玩家資料: ${discordId}`);
        return null;
    }

    const auth = new MaimaiAuthClient();
    
    // 如果有舊的 Cookie，優先載入以加速登入並減輕伺服器負擔
    if (user.cookie) {
        await auth.importCookieString(user.cookie);
    }

    // 2. 執行登入 (若 Cookie 有效則會直接通過)
    const success = await auth.login(user.sega_id, user.sega_password);
    if (!success) {
        console.error(`[CrawlerService] 玩家 ${discordId} 登入失敗，請確認密碼或網路連線。`);
        return null;
    }

    // 登入成功後，備份最新的 Session Cookie
    const newCookie = await auth.exportCookieString();
    
    // 3. 抓取首頁更新玩家名稱與 Rating
    let playerName = user.player_name || '未知';
    let rating = user.rating || 0;
    try {
        const homeRes = await auth.client.get('https://maimaidx-eng.com/maimai-mobile/home/');
        const $ = cheerio.load(homeRes.data);
        playerName = $('.name_block').text().trim() || playerName;
        
        const ratingStr = $('.rating_block').text().trim();
        if (ratingStr) {
            rating = parseInt(ratingStr, 10);
        }
    } catch (e: any) {
        console.warn(`[CrawlerService] 無法更新首頁資訊: ${e.message}`);
    }

    // 將最新的登入狀態寫回 DB
    updateUserSession(discordId, newCookie, playerName, rating);

    // 4. 開始抓取所有難度的成績
    console.log(`[CrawlerService] 登入完畢，開始走訪成績頁面...`);
    const scraper = new MaimaiScraper(auth);
    const scores = await scraper.fetchAllScores();
    
    console.log(`[CrawlerService] 成功抓取 ${scores.length} 筆成績。進入 SQLite 進行 Diff 差異比對...`);
    
    // 5. 進入 SQLite 進行 Diff 比對，並自動寫入「成績快取」與「成長歷史軌跡」
    const result = processScrapedScores(discordId, scores);
    console.log(`[CrawlerService] 比對與寫入完成！首次遊玩新增: ${result.newRecordsCount} 筆，達成率突破: ${result.improvedRecordsCount} 筆。`);
    
    return {
        playerName,
        rating,
        totalScraped: scores.length,
        newRecordsCount: result.newRecordsCount,
        improvedRecordsCount: result.improvedRecordsCount
    };
}
