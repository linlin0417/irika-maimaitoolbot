import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const data = new SlashCommandBuilder()
    .setName('gitputdata')
    .setDescription('從遠端拉取最新程式碼並重啟機器人');

export async function execute(interaction: ChatInputCommandInteraction) {
    // 這裡建議加上您的 Discord ID 判斷，確保只有最高權限管理者能使用
    // const ADMIN_ID = '在這裡填入您的 Discord ID';
    // if (interaction.user.id !== ADMIN_ID) {
    //     return interaction.reply({ content: '您沒有權限執行此指令。', ephemeral: true });
    // }

    await interaction.reply({ content: '開始執行更新程序 (git pull)...' });

    try {
        // 執行 git pull，若有更新依賴也可以加上 && npm install
        const { stdout } = await execAsync('git pull');
        
        await interaction.editReply({ 
            content: `更新成功，系統即將重啟...\n\`\`\`\n${stdout.slice(0, 1500)}\n\`\`\`` 
        });
        
        // 延遲 1.5 秒以確保 Discord API 已經發送訊息，接著結束 Process
        setTimeout(() => {
            process.exit(0);
        }, 1500);

    } catch (error: any) {
        await interaction.editReply({ 
            content: `更新失敗，請檢查主機狀態：\n\`\`\`\n${error.message}\n\`\`\`` 
        });
    }
}
