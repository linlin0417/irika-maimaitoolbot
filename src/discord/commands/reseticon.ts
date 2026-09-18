import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import fs from 'fs';
import path from 'path';

export const data = new SlashCommandBuilder()
    .setName('reseticon')
    .setDescription('清除手動設定的頭像，恢復為遊戲內設定');

export async function execute(interaction: ChatInputCommandInteraction) {
    const discordId = interaction.user.id;
    const iconsDir = path.resolve(process.cwd(), 'data/icons');
    
    let deleted = false;
    const possiblePaths = [
        path.join(iconsDir, `${discordId}_ManualIcon.jpg`),
        path.join(iconsDir, `${discordId}_ManualIcon.png`)
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            fs.unlinkSync(p);
            deleted = true;
        }
    }

    if (deleted) {
        await interaction.reply({ content: '✅ 已清除手動頭像！下次產生海報時將自動使用遊戲內的搭檔角色（或您可以先執行 `/update` 來更新）。', ephemeral: true });
    } else {
        await interaction.reply({ content: '⚠️ 您目前沒有設定手動頭像。', ephemeral: true });
    }
}
