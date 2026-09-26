import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, AttachmentBuilder } from 'discord.js';
import { dbManager } from '../../db/DatabaseManager.js';
import { PosterRenderer } from '../../render/poster.js';
import { SongDatabase } from '../../core/song-db.js';
import { getRank, calculateRating } from '../../core/rating.js';
import { DiffMap } from '../../render/template/constants.js';
import path from 'path';
import fs from 'fs';

export const data = new SlashCommandBuilder()
    .setName('score')
    .setDescription('繪製指定曲目的單曲成績卡')
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

    let account: any;
    try {
        account = dbManager.getAccountByDiscordId(discordId);
    } catch(e) {
        await interaction.editReply('找不到您的帳號記錄，請先使用 `/login` 綁定 SEGA ID。');
        return;
    }

    const userDb = dbManager.getUserDb(account.account_id);

    const record = userDb.prepare(`
        SELECT achievements, dx_score, chart_type, fc_status, fs_status 
        FROM scores 
        WHERE song_name = ? AND difficulty = ?
        ORDER BY achievements DESC LIMIT 1
    `).get(songName, difficulty) as { achievements: number, dx_score: number, chart_type: 'Standard' | 'DX', fc_status: string | null, fs_status: string | null } | undefined;

    if (!record) {
        let debugMsg = `找不到您在該首歌曲該難度的遊玩紀錄，請確認曲名是否正確，或是先使用 \`/update\` 進行同步。`;
        
        if (isDebug) {
            const similarSongs = userDb.prepare(`SELECT DISTINCT song_name FROM scores WHERE song_name LIKE ? LIMIT 5`).all(`%${songName.substring(0, 3)}%`) as { song_name: string }[];
            const playedDiffs = userDb.prepare(`SELECT difficulty FROM scores WHERE song_name = ?`).all(songName) as { difficulty: string }[];
            
            debugMsg += `\n\n**[Debug 診斷資訊]**\n- 查詢曲名: \`${songName}\`\n- 查詢難度: \`${difficulty}\`\n`;
            debugMsg += `- 您在資料庫中該曲有紀錄的難度: ${playedDiffs.length > 0 ? playedDiffs.map(d => d.difficulty).join(', ') : '無'}\n`;
            debugMsg += `- 名稱相近的已遊玩曲目: ${similarSongs.length > 0 ? similarSongs.map(s => s.song_name).join(', ') : '無'}`;
        }
        await interaction.editReply(debugMsg);
        return;
    }

    const songDb = SongDatabase.getInstance();
    const diffIndex = DiffMap[difficulty] as number;
    let constant = songDb.getConstant(songName, record.chart_type, diffIndex);

    if (constant == null) {
        constant = 0;
    }

    const rank = getRank(record.achievements);
    const rating = calculateRating(constant || 0, record.achievements);

    const outputPath = path.resolve(process.cwd(), `data/score_${discordId}_${Date.now()}.png`);

    try {
        await PosterRenderer.renderSingleScoreCard(
            songName,
            difficulty,
            record.chart_type,
            record.achievements,
            constant,
            rating,
            rank,
            record.dx_score,
            outputPath,
            record.fc_status,
            record.fs_status
        );
        
        const attachment = new AttachmentBuilder(outputPath, { name: 'score-card.png' });

        let content = `🎵 **${songName}** [${difficulty}]\n您的單曲成績卡已產出：`;
        if (isDebug) {
            content += `\n\n**[Debug 診斷資訊]**\n- SQLite 資料: \`${JSON.stringify(record)}\`\n- 匹配定數庫: \`Constant=${constant}\``;
        }

        await interaction.editReply({
            content,
            files: [attachment]
        });
    } catch (e: any) {
        console.error('[ScoreCommand] 畫圖失敗:', e);
        await interaction.editReply(`繪圖引擎發生錯誤，無法產出單曲成績卡。\n${isDebug ? `\`\`\`\n${e.stack}\n\`\`\`` : ''}`);
    } finally {
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
    }
}
