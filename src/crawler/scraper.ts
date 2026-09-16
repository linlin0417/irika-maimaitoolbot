import * as cheerio from 'cheerio';
import { MaimaiAuthClient } from './auth';
import type { ScrapedScore } from '../db/repository';

export class MaimaiScraper {
    constructor(private auth: MaimaiAuthClient) {}

    /**
     * 走訪國際版成績頁面，抓取所有難度 (Basic ~ Re:MASTER) 的成績
     */
    public async fetchAllScores(): Promise<ScrapedScore[]> {
        const allScores: ScrapedScore[] = [];
        const difficulties = ['Basic', 'Advanced', 'Expert', 'Master', 'Re:MASTER'] as const;

        // genre=99 代表「所有曲目」
        for (let diffIdx = 0; diffIdx < 5; diffIdx++) {
            const diffName = difficulties[diffIdx];
            console.log(`[Scraper] 正在抓取 ${diffName} 難度...`);
            
            const url = `https://maimaidx-eng.com/maimai-mobile/record/musicGenre/search/?genre=99&diff=${diffIdx}`;
            const res = await this.auth.client.get(url);
            const $ = cheerio.load(res.data);

            // 選取所有包含成績的容器 (去除非相關的 UI 區塊)
            const rows = $('.main_wrapper.t_c .m_15');

            rows.each((_, el) => {
                const $row = $(el);
                
                // 跳過分類標題行 (screw_block)
                if ($row.hasClass('screw_block')) return;
                
                // 必須是成績行
                if (!($row.hasClass('w_450') && $row.hasClass('p_r'))) return;

                // 1. 解析曲名
                const songNameElem = $row.find('.music_name_block');
                if (!songNameElem.length) return;
                const songName = songNameElem.text().trim();

                // 2. 解析譜面類型 (Standard 或 DX)
                let chartType: 'Standard' | 'DX' = 'DX';
                const chartImg = $row.find('.music_kind_icon');
                if (chartImg.length > 0 && chartImg.attr('src')?.includes('_standard')) {
                    chartType = 'Standard';
                }

                // 3. 解析達成率與 DX 分數
                const scoreBlocks = $row.find('.music_score_block');
                if (scoreBlocks.length < 2) return;

                const achievementsText = $(scoreBlocks[0]).text().trim().replace('%', '');
                const achievements = parseFloat(achievementsText);
                if (isNaN(achievements)) return;

                // DX 分數格式通常為 "1,234 / 2,500"，我們只需要玩家分數
                const dxScoreText = $(scoreBlocks[1]).text().trim();
                const [playerScoreStr] = dxScoreText.split('/');
                const dxScore = parseInt(playerScoreStr.replace(/,/g, ''), 10) || 0;

                // 4. 解析 FC / FS (Sync) 狀態圖示
                let fc_status = '';
                let fs_status = '';
                
                // 狀態圖示通常在右方靠右對齊的 img tag 中
                const imgs = $row.find('img.f_r').toArray();
                for (const img of imgs) {
                    const src = $(img).attr('src') || '';
                    if (src.includes('music_icon_back')) continue; // 略過沒有狀態的空背板
                    
                    const match = src.match(/music_icon_(.+?)\.png/);
                    if (match) {
                        const status = match[1].toLowerCase();
                        if (['fc', 'fcp', 'ap', 'app'].includes(status)) {
                            fc_status = status;
                        } else if (['fs', 'fsp', 'fsd', 'fsdp', 'fdx', 'fdxp'].includes(status)) {
                            fs_status = status;
                        }
                    }
                }

                allScores.push({
                    song_name: songName,
                    chart_type: chartType,
                    difficulty: diffName,
                    achievements,
                    dx_score: dxScore,
                    fc_status,
                    fs_status
                });
            });
        }

        return allScores;
    }
}
