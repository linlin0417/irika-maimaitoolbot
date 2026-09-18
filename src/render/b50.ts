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
    public static async renderB50Poster(discordId: string, playerName: string, outputPath: string): Promise<void> {
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
            scoreChart: ScoreChart;
            isNew: boolean;
            rating: number;
        }> = [];

        let apCount = 0;
        let appCount = 0;
        let fsdpCount = 0;

        for (const score of scores) {
            try {
                // 從 magic.json 找定數
                const song = await songDb.getSong(score.song_name);
                const diffIndex = diffMap[score.difficulty] ?? 3;
                const sheetType = score.chart_type === 'DX' ? 'dx' : 'standard';
                const sheet = song.difficulties[sheetType].find(d => d.difficulty === diffIndex);
                if (!sheet) continue; // 找不到對應譜面 (理論上不會發生)

                const levelValue = sheet.level_value;
                const rating = calculateRating(levelValue, score.achievements);
                const rateType = getRank(score.achievements).toLowerCase().replace('+', 'p');

                // 統計
                if (score.fc_status === 'app') appCount++;
                if (score.fs_status === 'fsdp') fsdpCount++;

                const originalTitle = coverProvider.getOriginalTitle(score.song_name);
                const coverDataUri = await coverProvider.getCoverDataUri(score.song_name);

                parsedScores.push({
                    isNew: coverProvider.isNewSong(score.song_name),
                    rating,
                    scoreChart: {
                        id: song.id,
                        song_name: originalTitle,
                        level: sheet.level,
                        level_index: diffIndex,
                        type: sheetType,
                        achievements: score.achievements,
                        dx_score: score.dx_score,
                        rate: rateType as any,
                        fc: score.fc_status || null,
                        fs: score.fs_status || null,
                        dx_rating: rating,
                        coverDataUri
                    }
                });
            } catch (e) {
                // 有些歌曲可能在 magic.json 找不到 (極少數例外)
                continue;
            }
        }

        // 2. 分離新舊曲並排序 (由高到低)
        const newSongs = parsedScores.filter(s => s.isNew).sort((a, b) => b.rating - a.rating);
        const oldSongs = parsedScores.filter(s => !s.isNew).sort((a, b) => b.rating - a.rating);

        // 取 Top 15 新曲 & Top 35 舊曲
        const b15 = newSongs.slice(0, 15);
        const b35 = oldSongs.slice(0, 35);

        // 3. 計算統計資料
        const newTotal = b15.reduce((sum, s) => sum + s.rating, 0);
        const oldTotal = b35.reduce((sum, s) => sum + s.rating, 0);
        const b50Total = newTotal + oldTotal;

        const allB50 = [...b15, ...b35];
        const averageRating = allB50.length > 0 ? b50Total / allB50.length : 0;
        const averageAch = allB50.length > 0 ? (allB50.reduce((sum, s) => sum + s.scoreChart.achievements, 0) / allB50.length).toFixed(4) + '%' : '0.0000%';
        const maxRating = allB50.length > 0 ? Math.max(...allB50.map(s => s.rating)) : 0;
        const maxDxScore = allB50.length > 0 ? Math.max(...allB50.map(s => s.scoreChart.dx_score)) : 0;

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

        const posterData: PosterData = {
            player: {
                name: playerName,
                rating: b50Total,
                // 可以根據需求加入 course_rank 等
            },
            summary,
            charts: allB50.map(s => s.scoreChart),
            radar: [] // 繞過 database.getChartTags()
        };

        // 4. 呼叫 mai-kit 生成海報
        const draw = new Draw({ database: {} as any });
        const pngData = await draw.poster(posterData);

        fs.writeFileSync(outputPath, pngData);
    }
}
