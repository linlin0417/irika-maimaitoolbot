import { MaimaiAuthClient } from '../crawler/auth';
import { MaimaiScraper } from '../crawler/scraper';
import { processScrapedScores, updateUserSession, getUser } from '../db/repository';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

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
    let iconUrl = user.icon_url || null;
    try {
        const homeRes = await auth.client.get('https://maimaidx-eng.com/maimai-mobile/home/');
        const $ = cheerio.load(homeRes.data);
        playerName = $('.name_block').text().trim() || playerName;
        
        const ratingStr = $('.rating_block').text().trim();
        if (ratingStr) {
            rating = parseInt(ratingStr, 10);
        }

        let scrapedIcon = $('img.w_112.f_l').attr('src') || $('.basic_block img').first().attr('src');
        console.log(`[DEBUG Crawler] 原始解析到的 Icon URL: ${scrapedIcon}`);
        
        // 如果連 Icon 都沒找到，或是遇到預設空圖示 (img/Icon/)，則執行進階降級尋找
        if (!scrapedIcon || scrapedIcon.endsWith('img/Icon/') || scrapedIcon.endsWith('img/Icon')) {
            console.log(`[DEBUG Crawler] 偵測到無效或預設 Icon，嘗試從 /playerData/ 獲取...`);
            
            try {
                const pdRes = await auth.client.get('https://maimaidx-eng.com/maimai-mobile/playerData/');
                const $pd = cheerio.load(pdRes.data);
                let pdIcon = $pd('img.w_112.f_l').attr('src');
                
                if (pdIcon && !pdIcon.endsWith('img/Icon/') && !pdIcon.endsWith('img/Icon')) {
                    console.log(`[DEBUG Crawler] 在 /playerData/ 找到有效的 Icon: ${pdIcon}`);
                    scrapedIcon = pdIcon;
                } else {
                    console.log(`[DEBUG Crawler] /playerData/ Icon 依然無效，直接降級尋找首頁的搭檔角色 (Chara) 作為頭像...`);
                    scrapedIcon = $('img[src*="Chara"]').attr('src');
                    console.log(`[DEBUG Crawler] 找到的搭檔角色 URL: ${scrapedIcon}`);
                }
            } catch (err: any) {
                console.warn(`[DEBUG Crawler] 進階抓取失敗: ${err.message}，降級尋找搭檔角色 (Chara)`);
                scrapedIcon = $('img[src*="Chara"]').attr('src');
            }
        }

        if (scrapedIcon) {
            if (scrapedIcon.startsWith('http')) {
                iconUrl = scrapedIcon;
            } else {
                iconUrl = new URL(scrapedIcon, 'https://maimaidx-eng.com/maimai-mobile/').href;
            }
            console.log(`[DEBUG Crawler] 最終解析到的 Icon URL: ${iconUrl}`);

            // 緩存頭像到本地資料夾（直接使用已登入的 auth.client，Cookie 保證正確）
            try {
                console.log(`[DEBUG Crawler] 準備緩存玩家頭像到本地...`);
                const iconsDir = path.resolve(process.cwd(), 'data/icons');
                if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
                
                const imgRes = await auth.client.get(iconUrl, {
                    responseType: 'arraybuffer'
                });
                
                const imgBuffer = Buffer.from(imgRes.data);
                console.log(`[DEBUG Crawler] 下載頭像大小: ${imgBuffer.byteLength} bytes, Content-Type: ${imgRes.headers['content-type']}`);
                
                if (imgBuffer.byteLength > 100) {
                    let ext = '.png';
                    const contentType = imgRes.headers['content-type'] || '';
                    if (contentType.includes('jpeg') || contentType.includes('jpg') || iconUrl.includes('.jpg')) ext = '.jpg';
                    
                    const filename = `${discordId}_UserIcon${ext}`;
                    const filepath = path.join(iconsDir, filename);
                    
                    fs.writeFileSync(filepath, imgBuffer);
                    console.log(`[DEBUG Crawler] 成功緩存大頭貼至: ${filepath} (${imgBuffer.byteLength} bytes)`);
                } else {
                    console.warn(`[DEBUG Crawler] 下載的圖片大小異常 (${imgBuffer.byteLength} bytes)，跳過緩存`);
                }
            } catch(e: any) {
                console.warn(`[DEBUG Crawler] 緩存大頭貼失敗: ${e.message}`);
            }

        } else {
            iconUrl = null;
            console.log(`[DEBUG Crawler] 查無有效的 Icon，設定為 null`);
        }
    } catch (e: any) {
        console.warn(`[DEBUG Crawler] 無法更新首頁資訊: ${e.message}`);
    }

    // 將最新的登入狀態與頭像寫回 DB
    updateUserSession(discordId, newCookie, playerName, rating, iconUrl);

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
