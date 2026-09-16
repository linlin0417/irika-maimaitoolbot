import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class MaimaiAuthClient {
    private jar: CookieJar;
    public client: any;

    constructor() {
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.jar,
            withCredentials: true,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            maxRedirects: 10 // 允許自動跟隨 Sega Auth 到 maimai net 的多次重定向
        }));
    }

    /**
     * 執行 SEGA ID 登入流程
     * @param segaId 帳號
     * @param password 密碼
     * @returns 是否登入成功
     */
    public async login(segaId: string, password: string): Promise<boolean> {
        try {
            // 取得最終跳轉網址的安全方法 (Node.js axios 環境)
            const getFinalUrl = (res: any) => res.request?.res?.responseUrl || res.config?.url || '';

            // 1. 訪問首頁，若未登入會被重定向至 SEGA 登入頁面
            const initialRes = await this.client.get('https://maimaidx-eng.com/maimai-mobile/');
            
            // 如果已經在 home 頁面，代表目前 Cookie 是有效的
            const initialUrl = getFinalUrl(initialRes);
            if (initialUrl.includes('maimaidx-eng.com/maimai-mobile/home/') || initialRes.data.includes('name_block')) {
                console.log('[Auth] Already logged in via session cookie.');
                return true;
            }

            const loginHtml = initialRes.data;
            const $ = cheerio.load(loginHtml);
            
            // 2. 尋找登入表單的 action URL 與所有必須的隱藏欄位 (如 CSRF Token)
            const formAction = $('form').attr('action');
            if (!formAction) {
                console.error('[Auth] Cannot find login form action URL. Possible site change or blocked.');
                return false;
            }

            // 將表單的相對網址轉換為絕對網址 (Absolute URL)，防止 axios 噴錯 "Invalid URL"
            let absoluteFormAction = formAction;
            try {
                absoluteFormAction = new URL(formAction, initialUrl || 'https://gw.sega.jp').href;
            } catch (err) {
                absoluteFormAction = 'https://gw.sega.jp' + (formAction.startsWith('/') ? formAction : '/' + formAction);
            }

            const formData = new URLSearchParams();
            formData.append('sid', segaId);
            formData.append('password', password);
            
            // 自動擷取登入頁面上所有的隱藏欄位 (Token, AuthKey, retention 等)
            $('form input[type="hidden"]').each((_, el) => {
                const name = $(el).attr('name');
                const value = $(el).attr('value');
                if (name && value) {
                    formData.append(name, value);
                }
            });

            // 3. 送出登入請求
            const authRes = await this.client.post(absoluteFormAction, formData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': initialUrl
                }
            });

            // 4. 驗證最終網址是否為 maimai 網頁首頁
            const finalUrl = getFinalUrl(authRes);
            if (finalUrl.includes('maimaidx-eng.com/maimai-mobile/home/') || authRes.data.includes('name_block')) {
                console.log(`[Auth] Login successful for user: ${segaId}`);
                return true;
            }

            console.error(`[Auth] Login failed. Final URL unexpectedly is: ${finalUrl}`);
            // 如果失敗，印出 Title 以幫助除錯 (可能密碼錯誤或有驗證碼)
            const error$ = cheerio.load(authRes.data);
            console.error(`[Auth] Page Title at failure: ${error$('title').text()}`);
            
            return false;
        } catch (error: any) {
            console.error('[Auth] Login error:', error.message);
            return false;
        }
    }

    /**
     * 取得目前的 Cookie 字串 (存入 DB 用)
     */
    public async exportCookieString(): Promise<string> {
        return await this.jar.getCookieString('https://maimaidx-eng.com');
    }

    /**
     * 從 DB 載入過去保存的 Cookie 字串
     */
    public async importCookieString(cookieStr: string): Promise<void> {
        // 設定 Cookie 到 jar，以便後續請求自動帶上
        if (cookieStr) {
            const cookies = cookieStr.split(';');
            for (const cookie of cookies) {
                if (cookie.trim()) {
                    await this.jar.setCookie(cookie.trim(), 'https://maimaidx-eng.com');
                }
            }
        }
    }
}
