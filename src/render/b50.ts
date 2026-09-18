import { Draw } from '@mai-kit/draw';
import type { PosterData, ScoreChart, PosterSummary } from '@mai-kit/draw';
import db from '../db/index.js';
import { SongDatabase } from '../core/song-db.js';
import { DxRatingCoverProvider } from '../core/dxrating-covers.js';
import { calculateRating, getRank } from '../core/rating.js';
import fs from 'fs';

export class B50Renderer {
    /**
     * 渲染 B50 海報
     * @param discordId 使用者 Discord ID
     * @param playerName 玩家暱稱 (展示用)
     * @param outputPath 輸出圖片的路徑
     */
    public static async renderB50Poster(discordId: string, playerName: string, avatarUrl: string | null, outputPath: string): Promise<void> {
        // 1. 從資料庫抓出所有成績
        const scores = db.prepare(`
            SELECT song_name, chart_type, difficulty, achievements, dx_score, fc_status, fs_status
            FROM scores
            WHERE discord_id = ?
        `).all(discordId) as any[];

        const songDb = SongDatabase.getInstance();
        const coverProvider = DxRatingCoverProvider.getInstance();

        const diffMap: Record<string, number> = {
            'Basic': 0,
            'Advanced': 1,
            'Expert': 2,
            'Master': 3,
            'Re:MASTER': 4
        };

        const parsedScores: Array<{
            rawScore: any;
            isNew: boolean;
            rating: number;
            levelString: string;
            diffIndex: number;
            chartType: string;
            rateType: string;
        }> = [];

        let apCount = 0;
        let appCount = 0;
        let fsdpCount = 0;

        for (const score of scores) {
            try {
                const diffIndex = diffMap[score.difficulty] ?? 3;
                const chartType = score.chart_type as 'Standard' | 'DX';
                
                // 從 magic.json 找定數
                const levelValue = songDb.getConstant(score.song_name, chartType, diffIndex);
                if (!levelValue) continue;

                const rating = calculateRating(levelValue, score.achievements);
                const rateType = getRank(score.achievements).toLowerCase().replace('+', 'p');
                
                // 推算等級字串
                const intLv = Math.floor(levelValue);
                const frac = levelValue - intLv;
                const levelString = (intLv >= 7 && frac >= 0.7) ? `${intLv}+` : `${intLv}`;

                // 統計
                if (score.fc_status === 'app') appCount++;
                if (score.fs_status === 'fsdp') fsdpCount++;

                parsedScores.push({
                    rawScore: score,
                    isNew: coverProvider.isNewSong(score.song_name),
                    rating,
                    levelString,
                    diffIndex,
                    chartType: chartType === 'DX' ? 'dx' : 'standard',
                    rateType
                });
            } catch (e) {
                continue;
            }
        }

        // 2. 分離新舊曲並排序 (由高到低)
        const newSongs = parsedScores.filter(s => s.isNew).sort((a, b) => b.rating - a.rating);
        const oldSongs = parsedScores.filter(s => !s.isNew).sort((a, b) => b.rating - a.rating);

        // 取 Top 15 新曲 & Top 35 舊曲
        const b15 = newSongs.slice(0, 15);
        const b35 = oldSongs.slice(0, 35);
        const allB50 = [...b15, ...b35];

        // 只為這 50 首獲取封面
        const charts: ScoreChart[] = [];
        for (const s of allB50) {
            const originalTitle = coverProvider.getOriginalTitle(s.rawScore.song_name);
            const coverDataUri = await coverProvider.getCoverDataUri(s.rawScore.song_name);

            charts.push({
                id: 0,
                song_name: originalTitle,
                level: s.levelString,
                level_index: s.diffIndex,
                type: s.chartType as any,
                achievements: s.rawScore.achievements,
                dx_score: s.rawScore.dx_score,
                rate: s.rateType as any,
                fc: s.rawScore.fc_status || null,
                fs: s.rawScore.fs_status || null,
                dx_rating: s.rating,
                coverDataUri
            });
        }

        // 3. 計算統計資料
        const newTotal = b15.reduce((sum, s) => sum + s.rating, 0);
        const oldTotal = b35.reduce((sum, s) => sum + s.rating, 0);
        const b50Total = newTotal + oldTotal;

        const averageRating = allB50.length > 0 ? b50Total / allB50.length : 0;
        const averageAch = allB50.length > 0 ? (allB50.reduce((sum, s) => sum + s.rawScore.achievements, 0) / allB50.length).toFixed(4) + '%' : '0.0000%';
        const maxRating = allB50.length > 0 ? Math.max(...allB50.map(s => s.rating)) : 0;
        const maxDxScore = allB50.length > 0 ? Math.max(...allB50.map(s => s.rawScore.dx_score)) : 0;

        const summary: PosterSummary = {
            b50: b50Total,
            newSongs: newTotal,
            oldSongs: oldTotal,
            averageAchievement: averageAch,
            averageRating,
            maxRating,
            maxDxScore,
            apPlus: appCount,
            syncDxPlus: fsdpCount,
            totalCharts: allB50.length
        };

        // 獲取頭像 Base64
        let iconDataUri: string | undefined = undefined;
        if (avatarUrl) {
            try {
                // Node 18+ 原生 fetch
                const res = await fetch(avatarUrl);
                const arrayBuffer = await res.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                const mimeType = res.headers.get('content-type') || 'image/png';
                iconDataUri = `data:${mimeType};base64,${base64}`;
            } catch (e) {
                console.warn('[B50] 無法獲取玩家頭像', e);
            }
        }

        const posterData: PosterData = {
            player: {
                name: playerName,
                rating: b50Total,
                icon: iconDataUri
            },
            summary,
            charts: charts,
            radar: [] // 繞過 database.getChartTags()
        };

        // 4. 呼叫 mai-kit 生成海報
        const draw = new Draw({ database: {} as any });
        const pngData = await draw.poster(posterData);

        fs.writeFileSync(outputPath, pngData);
    }
}
