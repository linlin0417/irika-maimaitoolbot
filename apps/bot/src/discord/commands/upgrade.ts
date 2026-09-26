import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { UpgradeBoardRenderer } from '../../render/upgrade-board.js';
import { dbManager } from '../../db/DatabaseManager.js';
import path from 'path';
import fs from 'fs';
import { requireTier, Tier } from '../middleware.js';

export const data = new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('提供推分建議：找出最有機會提升 Rating 的曲目')
    .addIntegerOption(option =>
        option.setName('count')
            .setDescription('建議數量 (預設 10，最大 15)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(15)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!await requireTier(interaction, Tier.ADVANCED, '推分建議')) return;

    await interaction.deferReply();
    const discordId = interaction.user.id;
    const limit = interaction.options.getInteger('count') ?? 10;
    const outputPath = path.resolve(process.cwd(), `data/upgrade_${discordId}_${Date.now()}.png`);

    try {
        let account: any;
        try {
            account = dbManager.getAccountByDiscordId(discordId);
        } catch (e) {
            await interaction.editReply('[錯誤] 找不到您的帳號記錄，請先使用 `/login` 綁定 SEGA ID。');
            return;
        }

        const userDb = dbManager.getUserDb(account.account_id);
        const scoreCount = userDb.prepare('SELECT COUNT(*) as count FROM scores').get() as { count: number };
        if (scoreCount.count === 0) {
            await interaction.editReply('[錯誤] 資料庫中沒有您的成績紀錄，請先使用 `/update` 進行同步。');
            return;
        }

        await UpgradeBoardRenderer.renderUpgradeBoard(discordId, outputPath, limit);

        const attachment = new AttachmentBuilder(outputPath, { name: 'upgrade-board.png' });
        await interaction.editReply({
            content: `🎯 **推分建議** - 以下是最有機會提升 Rating 的 ${limit} 首曲目：`,
            files: [attachment],
        });
    } catch (e: any) {
        console.error('[UpgradeCommand] 推分建議失敗:', e);
        const msg = e.message === '找不到可升級的候補曲目'
            ? '🏆 您已經太強了，目前找不到明顯可推分的區間！'
            : '[錯誤] 產生推分建議時發生錯誤，請稍後再試。';
        await interaction.editReply(msg);
    } finally {
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
    }
}
