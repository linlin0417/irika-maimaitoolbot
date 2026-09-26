import { SlashCommandBuilder, AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import { B50Renderer } from '../../render/b50.js';
import fs from 'fs';
import path from 'path';
import { dbManager } from '../../db/DatabaseManager.js';

export const data = new SlashCommandBuilder()
    .setName('b50')
    .setDescription('產生您的 Best 50 總結海報 (依據國際板最新版本區分新舊曲)');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const discordId = interaction.user.id;
    const outputPath = path.resolve(process.cwd(), `data/b50_${discordId}_${Date.now()}.png`);

    try {
        let account: any;
        try {
            account = dbManager.getAccountByDiscordId(discordId);
        } catch (e: any) {
            await interaction.editReply('[錯誤] 找不到您的帳號記錄，請先使用 `/login` 綁定 SEGA ID。');
            return;
        }

        const mainDb = dbManager.getMainDb();
        const userRow = mainDb.prepare('SELECT sega_id, icon_url, cookie FROM accounts WHERE account_id = ?').get(account.account_id) as any;

        const userDb = dbManager.getUserDb(account.account_id);
        const scoreCount = userDb.prepare('SELECT COUNT(*) as count FROM scores').get() as { count: number };
        if (scoreCount.count === 0) {
            await interaction.editReply('[錯誤] 資料庫中沒有您的成績紀錄，請先使用 `/update` 進行同步。');
            return;
        }

        // 優先使用 Maimai 官方頭像，若無則降級為 Discord 頭像
        const avatarUrl = userRow.icon_url || interaction.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });

        // 渲染海報
        await B50Renderer.renderB50Poster(discordId, interaction.user.username, avatarUrl, userRow.cookie || null, outputPath);
        
        // 傳送圖片
        const attachment = new AttachmentBuilder(outputPath);
        await interaction.editReply({ files: [attachment] });

        // 清理暫存檔
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
    } catch (e: any) {
        console.error('[Discord] 產生 B50 失敗:', e);
        await interaction.editReply('[錯誤] 生成 B50 海報時發生錯誤，請稍後再試。');
    }
}
