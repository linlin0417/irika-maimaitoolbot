import { Draw } from '@mai-kit/draw';
import { dbManager } from '../db/DatabaseManager.js';
import { SongDatabase } from '../core/song-db.js';
import { DxRatingCoverProvider } from '../core/dxrating-covers.js';
import { calculateRating, getRank } from '../core/rating.js';
import { DiffMap, Branding } from './template/constants.js';
import { resolveAvatar } from './template/avatar.js';
import { satoriFooterProps } from './template/footer.js';
import fs from 'fs';

export class B50Renderer {
    public static async renderB50Poster(discordId: string, playerName: string, avatarUrl: string | null, userCookie: string | null, outputPath: string): Promise<void> {
        const account = dbManager.getAccountByDiscordId(discordId);
        const userDb = dbManager.getUserDb(account.account_id);

        const scores = userDb.prepare(`
            SELECT song_name, chart_type, difficulty, achievements, dx_score, fc_status, fs_status
            FROM scores
        `).all() as any[];

        const songDb = SongDatabase.getInstance();
        const coverProvider = DxRatingCoverProvider.getInstance();

        const parsedScores: Array<{
            rawScore: any;
            isNew: boolean;
            rating: number;
            levelValue: number;
            levelString: string;
            diffIndex: number;
            chartType: string;
            rateType: string;
        }> = [];

        let appCount = 0;
        let fsdpCount = 0;

        for (const score of scores) {
            try {
                const diffIndex = DiffMap[score.difficulty] ?? 3;
                const chartType = score.chart_type as 'Standard' | 'DX';
                
                const levelValue = songDb.getConstant(score.song_name, chartType, diffIndex);
                if (!levelValue) continue;

                const rating = calculateRating(levelValue, score.achievements);
                const rateType = getRank(score.achievements).toLowerCase().replace('+', 'p');
                
                const intLv = Math.floor(levelValue);
                const frac = levelValue - intLv;
                const levelString = (intLv >= 7 && frac >= 0.7) ? `${intLv}+` : `${intLv}`;

                if (score.fc_status === 'app') appCount++;
                if (score.fs_status === 'fsdp') fsdpCount++;

                parsedScores.push({
                    rawScore: score,
                    isNew: songDb.isNewSong(score.song_name, chartType),
                    rating,
                    levelValue,
                    levelString,
                    diffIndex,
                    chartType: chartType === 'DX' ? 'dx' : 'standard',
                    rateType
                });
            } catch (e) {
                continue;
            }
        }

        const newSongs = parsedScores.filter(s => s.isNew).sort((a, b) => b.rating - a.rating);
        const oldSongs = parsedScores.filter(s => !s.isNew).sort((a, b) => b.rating - a.rating);

        const b15 = newSongs.slice(0, 15);
        const b35 = oldSongs.slice(0, 35);
        const allB50 = [...b15, ...b35];

        const coverPromises = allB50.map(async (s) => {
            const originalTitle = coverProvider.getOriginalTitle(s.rawScore.song_name);
            const coverDataUri = await coverProvider.getCoverDataUri(s.rawScore.song_name);
            return { originalTitle, coverDataUri };
        });
        const coverResults = await Promise.all(coverPromises);

        const charts: any[] = allB50.map((s, index) => {
            const cover = coverResults[index]!;

            const chartItem: any = {
                id: 0,
                song_name: cover.originalTitle,
                level: s.levelString,
                level_value: s.levelValue,
                level_index: s.diffIndex,
                type: s.chartType as any,
                achievements: s.rawScore.achievements,
                dx_score: s.rawScore.dx_score,
                rate: s.rateType as any,
                fc: s.rawScore.fc_status || null,
                fs: s.rawScore.fs_status || null,
                dx_rating: s.rating
            };
            if (cover.coverDataUri) {
                chartItem.coverDataUri = cover.coverDataUri;
            }
            return chartItem;
        });

        const newTotal = b15.reduce((sum, s) => sum + s.rating, 0);
        const oldTotal = b35.reduce((sum, s) => sum + s.rating, 0);
        const b50Total = newTotal + oldTotal;

        const averageRating = allB50.length > 0 ? b50Total / allB50.length : 0;
        const averageAch = allB50.length > 0 ? (allB50.reduce((sum, s) => sum + s.rawScore.achievements, 0) / allB50.length).toFixed(4) + '%' : '0.0000%';
        const maxRating = allB50.length > 0 ? Math.max(...allB50.map(s => s.rating)) : 0;
        const maxDxScore = allB50.length > 0 ? Math.max(...allB50.map(s => s.rawScore.dx_score)) : 0;

        const summary: any = {
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

        const { dataUri: iconDataUri } = await resolveAvatar(discordId, avatarUrl, userCookie);

        const posterData: any = {
            player: {
                name: playerName,
                rating: b50Total
            },
            summary,
            charts: charts,
            radar: [] 
        };
        if (iconDataUri) {
            posterData.player.avatarDataUri = iconDataUri;
        }

        const draw = new Draw({ database: {} as any });
        const pngData = await draw.poster(posterData, {
            ...satoriFooterProps,
            scale: 2,
            assetFallback: 'placeholder',
        });

        fs.writeFileSync(outputPath, pngData);
    }
}
