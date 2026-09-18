import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import db from '../../db/index.js';
import { SongDatabase } from '../../core/song-db.js';
import { DxRatingCoverProvider } from '../../core/dxrating-covers.js';
import { calculateRating } from '../../core/rating.js';

export const data = new SlashCommandBuilder()
    .setName('profile')
    .setDescription('查看您的 Maimai DX 玩家名片與統計資料');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const discordId = interaction.user.id;

    try {
        const user = db.prepare('SELECT sega_id, updated_at, icon_url FROM users WHERE discord_id = ?').get(discordId) as any;
        if (!user) {
            await interaction.editReply('[錯誤] 找不到您的帳號記錄，請先使用 `/login` 綁定 SEGA ID。');
            return;
        }

        const scores = db.prepare(`
            SELECT song_name, chart_type, difficulty, achievements, dx_score, fc_status, fs_status
            FROM scores
            WHERE discord_id = ?
        `).all(discordId) as any[];

        if (scores.length === 0) {
            await interaction.editReply('[錯誤] 資料庫中沒有您的成績紀錄，請先使用 `/update` 進行同步。');
            return;
        }

        const songDb = SongDatabase.getInstance();
        const coverProvider = DxRatingCoverProvider.getInstance();

        const diffMap: Record<string, number> = {
            'Basic': 0, 'Advanced': 1, 'Expert': 2, 'Master': 3, 'Re:MASTER': 4
        };

        const parsedScores: Array<{ isNew: boolean; rating: number; }> = [];

        let apCount = 0;
        let fcCount = 0;
        let sssCount = 0;
        let clearCount = 0;

        for (const score of scores) {
            try {
                const diffIndex = diffMap[score.difficulty] ?? 3;
                const chartType = score.chart_type as 'Standard' | 'DX';
                
                const levelValue = songDb.getConstant(score.song_name, chartType, diffIndex);
                if (!levelValue) continue;

                const rating = calculateRating(levelValue, score.achievements);
                
                if (score.achievements >= 100.0) sssCount++;
                if (score.achievements >= 80.0) clearCount++;
                
                if (score.fc_status === 'ap' || score.fc_status === 'app') apCount++;
                if (score.fc_status === 'fc' || score.fc_status === 'fcp' || score.fc_status === 'ap' || score.fc_status === 'app') fcCount++;

                parsedScores.push({
                    isNew: coverProvider.isNewSong(score.song_name),
                    rating
                });
            } catch (e) {
                continue;
            }
        }

        const newSongs = parsedScores.filter(s => s.isNew).sort((a, b) => b.rating - a.rating);
        const oldSongs = parsedScores.filter(s => !s.isNew).sort((a, b) => b.rating - a.rating);

        const newTotal = newSongs.slice(0, 15).reduce((sum, s) => sum + s.rating, 0);
        const oldTotal = oldSongs.slice(0, 35).reduce((sum, s) => sum + s.rating, 0);
        const b50Total = newTotal + oldTotal;

        const embed = new EmbedBuilder()
            .setColor('#00E1D9')
            .setTitle(`[ ${interaction.user.username} 的 Maimai DX 玩家名片 ]`)
            .setThumbnail(user.icon_url || interaction.user.displayAvatarURL())
            .addFields(
                { name: '綜合 Rating (B50)', value: `**${b50Total}**\n(新曲: ${newTotal} / 舊曲: ${oldTotal})`, inline: false },
                { name: '遊玩總譜面數', value: `${scores.length} 首`, inline: true },
                { name: 'SSS 以上數量', value: `${sssCount} 首`, inline: true },
                { name: '通關數量 (80%+)', value: `${clearCount} 首`, inline: true },
                { name: '全連 (FC) 以上', value: `${fcCount} 譜面`, inline: true },
                { name: '完美 (AP) 以上', value: `${apCount} 譜面`, inline: true },
                { name: '最後更新時間', value: `<t:${Math.floor(new Date(user.updated_at).getTime() / 1000)}:R>`, inline: false }
            )
            .setFooter({ text: 'Powered by Irika-MaimaiToolBot' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (e: any) {
        console.error('[Discord] 產生 Profile 失敗:', e);
        await interaction.editReply('[錯誤] 產生玩家名片時發生錯誤，請稍後再試。');
    }
}
