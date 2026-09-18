import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
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
        const user = db.prepare('SELECT sega_id, updated_at, icon_url, cookie FROM users WHERE discord_id = ?').get(discordId) as any;
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

        // 處理 Maimai 官方頭像 (因為需要帶上 Cookie 才能下載)
        let avatarUrl = user.icon_url || interaction.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
        let attachment: AttachmentBuilder | null = null;
        
        if (user.icon_url && user.icon_url.includes('maimaidx-eng.com')) {
            try {
                const fetchHeaders: Record<string, string> = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                };
                if (user.cookie) fetchHeaders['Cookie'] = `userId=${user.cookie}`;
                
                const res = await fetch(user.icon_url, { headers: fetchHeaders });
                if (res.ok) {
                    const arrayBuffer = await res.arrayBuffer();
                    attachment = new AttachmentBuilder(Buffer.from(arrayBuffer), { name: 'avatar.png' });
                    avatarUrl = 'attachment://avatar.png';
                }
            } catch (e) {
                console.warn('[Profile] 無法獲取官方頭像:', e);
            }
        }

        const embed = new EmbedBuilder()
            .setColor('#00E1D9')
            .setTitle(`[ ${interaction.user.username} 的 Maimai DX 玩家名片 ]`)
            .setThumbnail(avatarUrl)
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

        const replyPayload: any = { embeds: [embed] };
        if (attachment) {
            replyPayload.files = [attachment];
        }

        await interaction.editReply(replyPayload);

    } catch (e: any) {
        console.error('[Discord] 產生 Profile 失敗:', e);
        await interaction.editReply('[錯誤] 產生玩家名片時發生錯誤，請稍後再試。');
    }
}
