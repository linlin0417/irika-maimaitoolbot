import { Draw } from '@mai-kit/draw';
import fs from 'fs';
import { DxRatingCoverProvider } from '../core/dxrating-covers';

export class PosterRenderer {
    public static async renderSingleScoreCard(
        songName: string,
        difficulty: string,
        chartType: string,
        achievement: number,
        constant: number,
        rating: number,
        rank: string,
        dxScore: number,
        outputPath: string,
        fcStatus?: string | null,
        fsStatus?: string | null
    ): Promise<void> {
        
        // 建立 mai-kit 的 Draw 實例 (database 為空，依靠 coverDataUri 提供圖片)
        const draw = new Draw({ database: {} as any });

        // 採用 dxrating 方案：從本地的 DxRatingCoverProvider 中提取對應歌曲的 data URI 以及原版曲名
        const coverProvider = DxRatingCoverProvider.getInstance();
        const fallbackDataUri = await coverProvider.getCoverDataUri(songName);
        const originalTitle = coverProvider.getOriginalTitle(songName);

        const diffMap: Record<string, number> = {
            'Basic': 0,
            'Advanced': 1,
            'Expert': 2,
            'Master': 3,
            'Re:MASTER': 4
        };
        const levelIndex = diffMap[difficulty] ?? 3;
        
        const typeStr = chartType.toLowerCase() as 'dx' | 'standard';
        const rateStr = rank.toLowerCase().replace('+', 'p');

        const scoreData: any = {
            id: 0, 
            song_name: originalTitle, // 使用 dxdata 中的原版曲名
            type: typeStr,
            level_index: levelIndex,
            achievements: achievement,
            dx_score: dxScore,
            dx_rating: rating,
            level: constant.toFixed(1),
            rate: rateStr
        };

        if (fallbackDataUri) {
            scoreData.coverDataUri = fallbackDataUri;
        } else {
            console.warn(`[PosterRenderer] 未能從 dxrating 中獲取封面: ${songName}`);
        }

        if (fcStatus && fcStatus.trim() !== '') scoreData.fc = fcStatus.toLowerCase().replace('+', 'p');
        if (fsStatus && fsStatus.trim() !== '') scoreData.fs = fsStatus.toLowerCase().replace('+', 'p').replace('d', 'd');

        const pngBuffer = await draw.chart(scoreData, {
            scale: 2, 
            assetFallback: 'placeholder',
            footerLeft: 'Support by Saya Linlin',
            footerRight: 'By Irika'
        });

        fs.writeFileSync(outputPath, pngBuffer);
    }
}
