import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { dbManager } from '../../db/DatabaseManager.js';
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

    let account: any;
    let userRow: any;
    try {
        account = dbManager.getAccountByDiscordId(discordId);
        userRow = dbManager.getMainDb().prepare('SELECT * FROM accounts WHERE account_id = ?').get(account.account_id);
    } catch (e) {
        return interaction.editReply(`找不到 ${targetUser.username} 的帳號記錄。`);
    }

    const userDb = dbManager.getUserDb(account.account_id);

    const scores = userDb.prepare('SELECT * FROM scores').all();
    const scoreHistory = userDb.prepare('SELECT * FROM score_history').all();
    const titles = userDb.prepare('SELECT * FROM user_titles').all();
    const plates = userDb.prepare('SELECT * FROM user_plates').all();
    const frames = userDb.prepare('SELECT * FROM user_frames').all();

    const backupData = {
        user: userRow,
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
            await interaction.user.send({
                content: `這是 ${targetUser.username} 的資料備份。`,
                files: [attachment]
            });
            await interaction.editReply(`已經將備份檔案送至您的私人訊息中。`);
        } catch (dmError) {
            console.error('DM 發送失敗，改用備援方式回覆:', dmError);
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
