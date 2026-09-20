import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { updateUserSession, getUser } from '../../db/repository.js';

export const data = new SlashCommandBuilder()
    .setName('seticon')
    .setDescription('手動設定您的自訂頭像 (上傳圖片)')
    .addAttachmentOption(option => 
        option.setName('image')
            .setDescription('請上傳您想要設定的頭像圖片')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    
    const attachment = interaction.options.getAttachment('image');
    if (!attachment || !attachment.contentType?.startsWith('image/')) {
        return interaction.editReply('請上傳有效的圖片檔案！');
    }

    try {
        const iconsDir = path.resolve(process.cwd(), 'data/icons');
        if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

        // 下載 Discord 上的圖片
        const imgRes = await axios.get(attachment.url, { responseType: 'arraybuffer' });
        const imgBuffer = Buffer.from(imgRes.data);
        
        let ext = '.png';
        if (attachment.contentType === 'image/jpeg' || attachment.name?.endsWith('.jpg')) ext = '.jpg';
        
        const discordId = interaction.user.id;
        const filename = `${discordId}_ManualIcon${ext}`;
        const filepath = path.join(iconsDir, filename);
        
        // 刪除可能存在的另一種副檔名快取
        const otherExt = ext === '.jpg' ? '.png' : '.jpg';
        const otherFilepath = path.join(iconsDir, `${discordId}_ManualIcon${otherExt}`);
        if (fs.existsSync(otherFilepath)) fs.unlinkSync(otherFilepath);

        fs.writeFileSync(filepath, imgBuffer);
        
        // 更新成功後不需要動資料庫，b50.ts 會優先讀取 ManualIcon
        await interaction.editReply(`✅ 成功手動設定您的專屬頭像！請重新執行 \`/b50\` 查看效果。`);
    } catch (e: any) {
        console.error(e);
        await interaction.editReply(`設定頭像失敗: ${e.message}`);
    }
}
