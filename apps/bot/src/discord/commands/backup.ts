import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import db from '../../db/index.js';
import fs from 'fs';
import path from 'path';

export const data = new SlashCommandBuilder()
    .setName('backup')
    .setDescription('手動備份個人資料')
    .addUserOption(option => 
        option.setName('user')
            .setDescription('要備份的使用者 (僅管理員可用)')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const ADMIN_ID = '1031852521993543711';
    let targetUser = interaction.user;
    const specifiedUser = interaction.options.getUser('user');

    if (specifiedUser) {
        if (interaction.user.id !== ADMIN_ID) {
            return interaction.editReply('只有管理員可以備份其他人的資料。');
        }
        targetUser = specifiedUser;
    }

    const discordId = targetUser.id;

    // 取得資料
    const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
    if (!user) {
        return interaction.editReply(`找不到 ${targetUser.username} 的帳號記錄。`);
    }

    const scores = db.prepare('SELECT * FROM scores WHERE discord_id = ?').all(discordId);
    const scoreHistory = db.prepare('SELECT * FROM score_history WHERE discord_id = ?').all(discordId);
    const titles = db.prepare('SELECT * FROM user_titles WHERE discord_id = ?').all(discordId);
    const plates = db.prepare('SELECT * FROM user_plates WHERE discord_id = ?').all(discordId);
    const frames = db.prepare('SELECT * FROM user_frames WHERE discord_id = ?').all(discordId);

    const backupData = {
        user,
        scores,
        scoreHistory,
        titles,
        plates,
        frames,
        exportTime: new Date().toISOString()
    };

    const tempFileName = `backup_${discordId}_${Date.now()}.imaidata`;
    const tempFilePath = path.join(process.cwd(), 'data', tempFileName);

    try {
        fs.writeFileSync(tempFilePath, JSON.stringify(backupData, null, 2));
        
        const attachment = new AttachmentBuilder(tempFilePath);
        
        try {
            // 第一優先：嘗試發送私人訊息
            await interaction.user.send({
                content: `這是 ${targetUser.username} 的資料備份。`,
                files: [attachment]
            });
            await interaction.editReply(`已經將備份檔案送至您的私人訊息中。`);
        } catch (dmError) {
            console.error('DM 發送失敗，改用備援方式回覆:', dmError);
            // 備援方案：如果 DM 失敗，直接透過 ephemeral 回覆檔案
            await interaction.editReply({
                content: `(由於無法發送私人訊息，備份檔案改由這裡發送給您)\n這是 ${targetUser.username} 的資料備份。`,
                files: [attachment]
            });
        }
    } catch (e) {
        console.error('備份產生失敗:', e);
        await interaction.editReply('備份過程發生錯誤，無法產生檔案。');
    } finally {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}
