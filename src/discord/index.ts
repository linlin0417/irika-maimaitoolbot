import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import * as loginCmd from './commands/login';
import * as updateCmd from './commands/update';

// 只需要基礎的 Guilds 權限即可，因為我們使用 Slash Commands
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = [loginCmd.data.toJSON(), updateCmd.data.toJSON()];

client.once('ready', async () => {
    console.log(`[Discord] 機器人已上線，登入身分: ${client.user?.tag}`);
    
    // 註冊 Slash Commands 到 Discord 伺服器
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    try {
        console.log('[Discord] 正在全域註冊斜線指令 (Slash Commands)...');
        await rest.put(
            Routes.applicationCommands(client.user!.id),
            { body: commands },
        );
        console.log('[Discord] 指令註冊成功！(全域指令可能需要幾分鐘才會在某些伺服器顯示)');
    } catch (error) {
        console.error('[Discord] 註冊指令失敗:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    // 處理 Slash Commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'login') {
            await loginCmd.execute(interaction);
        } else if (interaction.commandName === 'update') {
            await updateCmd.execute(interaction);
        }
    } 
    // 處理 Modal 表單送出 (例如密碼輸入)
    else if (interaction.isModalSubmit()) {
        await loginCmd.handleModal(interaction);
    }
});

export function startDiscordBot() {
    if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'your_token_here') {
        console.warn('[Discord] ⚠️ 未設定正確的 DISCORD_TOKEN，略過啟動機器人。請於 .env 檔案中補上。');
        return;
    }
    client.login(process.env.DISCORD_TOKEN);
}
