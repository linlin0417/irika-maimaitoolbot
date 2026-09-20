import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';

async function diagnose2() {
    const jar = new CookieJar();
    const client = wrapper(axios.create({
        jar,
        withCredentials: true,
        maxRedirects: 10,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    }));

    try {
        const res = await client.get('https://lng-tgk-aime-gw.am-all.net/common_auth/login?site_id=maimaidxex&redirect_url=https://maimaidx-eng.com/maimai-mobile/&back_url=https://maimai.sega.com/');
        const $ = cheerio.load(res.data);
        
        console.log('Forms found on page:');
        $('form').each((i, el) => {
            console.log(`Form ${i} action: ${$(el).attr('action')}`);
            $(el).find('input').each((j, input) => {
                console.log(`  Input ${j} - name: ${$(input).attr('name')}, type: ${$(input).attr('type')}, value: ${$(input).attr('value')}`);
            });
        });
        
        console.log('\nLinks to sega.jp:');
        $('a[href*="sega.jp"]').each((i, el) => {
            console.log($(el).attr('href'));
        });
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}
diagnose2();
