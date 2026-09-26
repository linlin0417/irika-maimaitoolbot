import { Draw } from '@mai-kit/draw';
import { DxRatingCoverProvider } from '../core/dxrating-covers.js';
import { satoriFooterProps } from './template/footer.js';
import { DiffMap } from './template/constants.js';
import { calculateRating, getRank } from '../core/rating.js';
import { SongDatabase } from '../core/song-db.js';
import { dbManager } from '../db/DatabaseManager.js';
import fs from 'fs';

interface UpgradeCandidate {
    songName: string;
    chartType: 'Standard' | 'DX';
    difficulty: string;
    currentAchievement: number;
    currentRating: number;
    targetAchievement: number;
    targetRating: number;
    gain: number;
    levelValue: number;
    dxScore: number;
}

const TARGET_THRESHOLDS = [
    { rate: 'sssp', threshold: 100.5 },
    { rate: 'sss',  threshold: 100.0 },
    { rate: 'ssp',  threshold: 99.5 },
    { rate: 'ss',   threshold: 99.0 },
    { rate: 'sp',   threshold: 98.0 },
    { rate: 's',    threshold: 97.0 },
] as const;

export class UpgradeBoardRenderer {
    public static async renderUpgradeBoard(
        discordId: string,
        outputPath: string,
        limit: number = 10
    ): Promise<void> {
        const songDb = SongDatabase.getInstance();
        const coverProvider = DxRatingCoverProvider.getInstance();

        const account = dbManager.getAccountByDiscordId(discordId);
        const userDb = dbManager.getUserDb(account.account_id);

        const scores = userDb.prepare(`
            SELECT song_name, chart_type, difficulty, achievements, dx_score, fc_status, fs_status
            FROM scores
        `).all() as any[];

        const candidates: UpgradeCandidate[] = [];

        for (const score of scores) {
            try {
                const diffIndex = DiffMap[score.difficulty] ?? 3;
                const chartType = score.chart_type as 'Standard' | 'DX';
                const levelValue = songDb.getConstant(score.song_name, chartType, diffIndex);
                if (!levelValue) continue;

                const currentRating = calculateRating(levelValue, score.achievements);

                for (const { threshold } of TARGET_THRESHOLDS) {
                    if (score.achievements >= threshold) continue;
                    
                    const targetRating = calculateRating(levelValue, threshold);
                    const gain = targetRating - currentRating;
                    
                    if (gain > 0) {
                        candidates.push({
                            songName: score.song_name,
                            chartType,
                            difficulty: score.difficulty,
                            currentAchievement: score.achievements,
                            currentRating,
                            targetAchievement: threshold,
                            targetRating,
                            gain,
                            levelValue,
                            dxScore: score.dx_score,
                        });
                        break; 
                    }
                }
            } catch (e) {
                continue;
            }
        }

        candidates.sort((a, b) => b.gain - a.gain);
        const topCandidates = candidates.slice(0, limit);

        if (topCandidates.length === 0) {
            throw new Error('找不到可升級的候補曲目');
        }

        const coverPromises = topCandidates.map(async (c) => {
            const originalTitle = coverProvider.getOriginalTitle(c.songName);
            const coverDataUri = await coverProvider.getCoverDataUri(c.songName);
            return { originalTitle, coverDataUri };
        });
        const coverResults = await Promise.all(coverPromises);

        const upgradeData: any = {
            candidates: topCandidates.map((c, index) => {
                const cover = coverResults[index]!;
                const diffIndex = DiffMap[c.difficulty] ?? 3;
                const rateType = getRank(c.currentAchievement).toLowerCase().replace('+', 'p');

                const intLv = Math.floor(c.levelValue);
                const frac = c.levelValue - intLv;
                const levelString = (intLv >= 7 && frac >= 0.7) ? `${intLv}+` : `${intLv}`;

                const scoreChart: any = {
                    id: 0,
                    song_name: cover.originalTitle,
                    type: (c.chartType === 'DX' ? 'dx' : 'standard') as any,
                    level_index: diffIndex as any,
                    achievements: c.currentAchievement,
                    dx_score: c.dxScore,
                    dx_rating: c.currentRating,
                    level: levelString,
                    level_value: c.levelValue,
                    rate: rateType as any,
                };
                if (cover.coverDataUri) {
                    scoreChart.coverDataUri = cover.coverDataUri;
                }

                return {
                    score: scoreChart,
                    levelValue: c.levelValue,
                    currentRating: c.currentRating,
                    targetRating: c.targetRating,
                    targetAchievement: c.targetAchievement,
                    gain: c.gain,
                };
            }),
        };

        const draw = new Draw({ database: {} as any });
        const pngData = await draw.upgrades(upgradeData, {
            ...satoriFooterProps,
            scale: 2,
            assetFallback: 'placeholder',
        });

        fs.writeFileSync(outputPath, pngData);
    }
}
