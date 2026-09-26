import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { dbManager } from '../../db/DatabaseManager.js';
import { requireTier, Tier } from '../middleware.js';

export const data = new SlashCommandBuilder()
    .setName('activity')
    .setDescription('查看您的長期遊玩頻率與活躍度貢獻圖 (草地圖)');

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!await requireTier(interaction, Tier.ADVANCED, '活躍度貢獻圖')) return;

    await interaction.deferReply();
    const discordId = interaction.user.id;

    let account: any;
    try {
        account = dbManager.getAccountByDiscordId(discordId);
    } catch (e) {
        await interaction.editReply('找不到您的帳號記錄，請先使用 `/login` 綁定 SEGA ID。');
        return;
    }

    const userDb = dbManager.getUserDb(account.account_id);
    
    // 取得過去 12 週 (84天) 的遊玩資料
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    
    // 產生過去 84 天的日期表 (YYYY-MM-DD)
    const dateMap = new Map<string, number>();
    for (let i = 83; i >= 0; i--) {
        const d = new Date(today.getTime() - i * msPerDay);
        const dateStr = d.toISOString().split('T')[0];
        dateMap.set(dateStr, 0);
    }

    const startDateStr = new Date(today.getTime() - 83 * msPerDay).toISOString().split('T')[0];
    
    const records = userDb.prepare(`
        SELECT date, play_count FROM daily_stats 
        WHERE date >= ? ORDER BY date ASC
    `).all(startDateStr) as { date: string, play_count: number }[];

    let totalPlays = 0;
    for (const r of records) {
        if (dateMap.has(r.date)) {
            const count = Math.max(0, r.play_count); // 確保不為負
            dateMap.set(r.date, count);
            totalPlays += count;
        }
    }

    // 取得第一天是星期幾 (0 = 星期日, 1 = 星期一...)
    const firstDayDate = new Date(today.getTime() - 83 * msPerDay);
    const startDayOfWeek = firstDayDate.getDay();

    // 準備渲染 Emoji Grid (7 列 x 12 行)
    // Discord 支援的方形 Emoji: ⬛ 🟩 🟨 🟧 🟥
    const grid: string[][] = Array.from({ length: 7 }, () => []);
    
    // 填充空白直到第一天
    for (let i = 0; i < startDayOfWeek; i++) {
        grid[i].push('⬛');
    }

    // 填入實際資料
    let currentDayOfWeek = startDayOfWeek;
    for (const [dateStr, count] of dateMap.entries()) {
        let emoji = '⬛';
        if (count >= 20) emoji = '🟥';
        else if (count >= 10) emoji = '🟧';
        else if (count >= 5) emoji = '🟨';
        else if (count >= 1) emoji = '🟩';

        grid[currentDayOfWeek].push(emoji);
        
        currentDayOfWeek++;
        if (currentDayOfWeek > 6) currentDayOfWeek = 0;
    }

    // 填充結尾空白
    while (currentDayOfWeek !== 0 && currentDayOfWeek <= 6) {
        grid[currentDayOfWeek].push('⬛');
        currentDayOfWeek++;
    }

    const rowLabels = ['日', '一', '二', '三', '四', '五', '六'];
    const gridText = grid.map((row, idx) => `\`${rowLabels[idx]}\` ${row.join('')}`).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('📅 玩家活躍度貢獻圖 (過去 12 週)')
        .setDescription(`近三個月內共遊玩了 **${totalPlays}** 道 (約 ${Math.ceil(totalPlays/3)} 枚硬幣/局)\n\n${gridText}\n\n**圖例**: ⬛ 0道 | 🟩 1-4道 | 🟨 5-9道 | 🟧 10-19道 | 🟥 20道+`)
        .setColor(0x2b2d31)
        .setFooter({ text: '每日的遊玩道數會依照系統自動同步 (Update) 時進行記錄計算。' });

    await interaction.editReply({ embeds: [embed] });
}
