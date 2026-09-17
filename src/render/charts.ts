import { RenderCore } from './core.js';

// 成績歷史資料型別
export interface ScoreHistoryRecord {
    playTime: Date; // 遊玩時間 (X軸)
    achievement: number; // 達成率 (Y軸)
}

// 繪製成長曲線圖
export class GrowthChartRenderer {
    // 繪製單曲成績成長曲線
    public static async renderChart(records: ScoreHistoryRecord[], outputPath: string): Promise<void> {
        const width = 800;
        const height = 400;
        const core = new RenderCore(width, height);
        const ctx = core.getContext();

        // 背景
        core.drawRoundedRect(0, 0, width, height, 0, '#1e1e1e');
        
        // 圖表區域邊界
        const padding = { top: 40, right: 40, bottom: 60, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // 畫網格與Y軸
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        
        const yAxisCount = 5; // 顯示5條橫線
        const maxAchievement = Math.max(...records.map(r => r.achievement), 100);
        const minAchievement = Math.min(...records.map(r => r.achievement), 80); // 假設最低80
        const yRange = maxAchievement - minAchievement;

        for (let i = 0; i <= yAxisCount; i++) {
            const y = padding.top + chartHeight - (i / yAxisCount) * chartHeight;
            const value = (minAchievement + (i / yAxisCount) * yRange).toFixed(2);
            
            // 橫線
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Y軸文字
            core.drawText(`${value}%`, padding.left - 10, y + 4, '14px sans-serif', '#aaaaaa', 'right', 'middle');
        }

        // 畫X軸文字 (簡化版：只顯示首尾與中間點)
        if (records.length > 0) {
            records.forEach((record, index) => {
                const x = padding.left + (index / Math.max(records.length - 1, 1)) * chartWidth;
                if (index === 0 || index === records.length - 1 || index === Math.floor(records.length / 2)) {
                    const dateStr = record.playTime.toLocaleDateString();
                    core.drawText(dateStr, x, height - padding.bottom + 20, '12px sans-serif', '#aaaaaa', 'center', 'top');
                }
            });
        }

        // 繪製折線
        if (records.length > 1) {
            ctx.beginPath();
            records.forEach((record, index) => {
                const x = padding.left + (index / (records.length - 1)) * chartWidth;
                const y = padding.top + chartHeight - ((record.achievement - minAchievement) / yRange) * chartHeight;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // 繪製資料點
            records.forEach((record, index) => {
                const x = padding.left + (index / (records.length - 1)) * chartWidth;
                const y = padding.top + chartHeight - ((record.achievement - minAchievement) / yRange) * chartHeight;
                
                core.drawRoundedRect(x - 4, y - 4, 8, 8, 4, '#ffffff', '#00ffcc', 2);
            });
        }

        // 繪製左右下角的品牌標誌
        core.drawText('Support by Saya Linlin', 20, height - 20, '14px sans-serif', '#666666', 'left', 'middle');
        core.drawText('By Irika', width - 20, height - 20, 'italic 16px sans-serif', '#888888', 'right', 'middle');

        // 儲存為 PNG
        await core.saveToFile(outputPath);
    }
}
