import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import fs from 'fs';
import path from 'path';

export const data = new SlashCommandBuilder()
    .setName('debug')
    .setDescription('開發與除錯用指令')
    .addSubcommandGroup(group => 
        group
            .setName('fix')
            .setDescription('錯誤修復類指令')
            .addSubcommand(subcommand => 
                subcommand
                    .setName('icon')
                    .setDescription('修復頭像顯示問題 (刪除快取的頭像)')
                    .addUserOption(option => 
                        option.setName('target')
                            .setDescription('要修復的使用者 (預設為自己)')
                            .setRequired(false)
                    )
            )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (group === 'fix' && subcommand === 'icon') {
        const targetUser = interaction.options.getUser('target') || interaction.user;
        const discordId = targetUser.id;
        const iconsDir = path.resolve(process.cwd(), 'data/icons');
        
        let deletedCount = 0;
        const possiblePaths = [
            path.join(iconsDir, `${discordId}_ManualIcon.jpg`),
            path.join(iconsDir, `${discordId}_ManualIcon.png`),
            path.join(iconsDir, `${discordId}_UserIcon.jpg`),
            path.join(iconsDir, `${discordId}_UserIcon.png`)
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                try {
                    fs.unlinkSync(p);
                    deletedCount++;
                } catch (e) {
                    console.error(`無法刪除快取頭像 ${p}:`, e);
                }
            }
        }

        if (deletedCount > 0) {
            await interaction.reply({ 
                content: `✅ 已清除 ${targetUser.username} 的快取頭像 (共 ${deletedCount} 個檔案)。下次產生海報時會重新獲取。`, 
                ephemeral: false 
            });
        } else {
            await interaction.reply({ 
                content: `⚠️ ${targetUser.username} 目前沒有任何快取頭像。`, 
                ephemeral: true 
            });
        }
    } else {
        await interaction.reply({ content: '未知的子指令', ephemeral: true });
    }
}
