import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, AttachmentBuilder } from 'discord.js';
import db from '../../db/index';
import { GrowthChartRenderer } from '../../render/charts';
import { SongDatabase } from '../../core/song-db';
import path from 'path';
import fs from 'fs';

export const data = new SlashCommandBuilder()
    .setName('chart')
    .setDescription('繪製指定曲目的成績成長曲線圖')
    .addStringOption(option => 
        option.setName('song_name')
            .setDescription('請輸入歌曲名稱 (支援模糊搜尋)')
            .setRequired(true)
            .setAutocomplete(true)
    )
    .addStringOption(option => 
        option.setName('difficulty')
            .setDescription('請選擇難度')
            .setRequired(true)
            .addChoices(
                { name: 'Basic', value: 'Basic' },
                { name: 'Advanced', value: 'Advanced' },
                { name: 'Expert', value: 'Expert' },
                { name: 'Master', value: 'Master' },
                { name: 'Re:MASTER', value: 'Re:MASTER' }
            )
    )
    .addBooleanOption(option => 
        option.setName('debug')
            .setDescription('開啟除錯模式 (顯示資料庫內關聯的原始數據)')
            .setRequired(false)
    );

export async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const songDb = SongDatabase.getInstance();
    const allSongs = songDb.getAllSongNames();

    // 過濾出符合的曲名，Discord 最多只能回傳 25 筆選項
    const filtered = allSongs
        .filter(song => song.toLowerCase().includes(focusedValue))
        .slice(0, 25);

    await interaction.respond(
        filtered.map(choice => ({ name: choice, value: choice }))
    );
}

export async function execute(interaction: ChatInputCommandInteraction) {
    const songName = interaction.options.getString('song_name', true);
    const difficulty = interaction.options.getString('difficulty', true);
    const isDebug = interaction.options.getBoolean('debug') ?? false;
    const discordId = interaction.user.id;

    await interaction.deferReply(); 

    // 從資料庫撈出該曲目所有歷史成績
    const records = db.prepare(`
        SELECT achievements, recorded_at 
        FROM score_history 
        WHERE discord_id = ? AND song_name = ? AND difficulty = ?
        ORDER BY recorded_at ASC
    `).all(discordId, songName, difficulty) as { achievements: number, recorded_at: string }[];

    if (records.length === 0) {
        let debugMsg = `找不到您在該首歌曲該難度的歷史成績，請確認曲名是否正確，或是先使用 \`/update\` 進行同步。`;
        
        if (isDebug) {
            const similarSongs = db.prepare(`SELECT DISTINCT song_name FROM scores WHERE discord_id = ? AND song_name LIKE ? LIMIT 5`).all(discordId, `%${songName.substring(0, 3)}%`) as { song_name: string }[];
            const playedDiffs = db.prepare(`SELECT DISTINCT difficulty FROM scores WHERE discord_id = ? AND song_name = ?`).all(discordId, songName) as { difficulty: string }[];
            
            debugMsg += `\n\n**[Debug 診斷資訊]**\n- 查詢曲名: \`${songName}\`\n- 查詢難度: \`${difficulty}\`\n`;
            debugMsg += `- 您在資料庫中該曲有紀錄的難度: ${playedDiffs.length > 0 ? playedDiffs.map(d => d.difficulty).join(', ') : '無'}\n`;
            debugMsg += `- 名稱相近的已遊玩曲目: ${similarSongs.length > 0 ? similarSongs.map(s => s.song_name).join(', ') : '無'}`;
        }
        await interaction.editReply(debugMsg);
        return;
    }

    if (records.length < 2) {
        let msg = `此曲目前只有一筆或沒有歷史成績，無法產生折線圖。`;
        if (records.length === 1 && records[0]) {
            msg = `此曲目前只有一筆歷史成績 (${records[0].achievements}%)，無法產生折線圖。等下次進步後再來吧！`;
            if (isDebug) {
                msg += `\n\n**[Debug 資訊]**\n- 現有成績: \`${JSON.stringify(records[0])}\``;
            }
        }
        await interaction.editReply(msg);
        return;
    }

    const chartData = records.map(r => ({
        playTime: new Date(r.recorded_at),
        achievement: r.achievements
    }));

    const outputPath = path.resolve(process.cwd(), `data/chart_${discordId}_${Date.now()}.png`);

    try {
        await GrowthChartRenderer.renderChart(chartData, outputPath);
        
        const attachment = new AttachmentBuilder(outputPath, { name: 'growth-chart.png' });

        let content = `📈 **${songName}** [${difficulty}]\n您的成績成長曲線已產出：`;
        if (isDebug) {
            content += `\n\n**[Debug 診斷資訊]**\n- 總計撈取了 ${records.length} 筆歷史紀錄節點。`;
        }

        await interaction.editReply({
            content,
            files: [attachment]
        });
    } catch (e: any) {
        console.error('[ChartCommand] 畫圖失敗:', e);
        await interaction.editReply(`繪圖引擎發生錯誤，無法產出成長曲線圖。\n${isDebug ? `\`\`\`\n${e.stack}\n\`\`\`` : ''}`);
    } finally {
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
    }

}

