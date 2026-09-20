import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { runCrawlerForUser } from '../../core/crawler-service';

export const data = new SlashCommandBuilder()
    .setName('update')
    .setDescription('手動觸發成績更新');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ content: '正在為您同步最新成績，請稍候...', ephemeral: true });
    
    const result = await runCrawlerForUser(interaction.user.id);
    
    if (result) {
        await interaction.editReply({
            content: `同步完成！\n本次爬取了 ${result.totalScraped} 筆資料。\n✨ 新增了 ${result.newRecordsCount} 筆新曲成績，突破了 ${result.improvedRecordsCount} 筆舊有紀錄！`
        });
    } else {
        await interaction.editReply({
            content: '同步失敗，您可能尚未綁定帳號，請先使用 `/login` 指令綁定 SEGA ID。'
        });
    }
}
