import { Client, GatewayIntentBits, REST, Routes, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 建立一個存放指令的集合
const commandsCollection = new Collection<string, any>();
const commandsData: any[] = [];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- 白名單機制 (Hot-Reload) ---
const whitelistPath = path.resolve(process.cwd(), 'cfg/dc_whitelist.cfg');
let whitelist: Set<string> = new Set();

function loadWhitelist() {
    try {
        if (fs.existsSync(whitelistPath)) {
            const content = fs.readFileSync(whitelistPath, 'utf8');
            whitelist = new Set(
                content.split('\n')
                       .map(line => line.trim())
                       .filter(line => line.length > 0 && !line.startsWith('#'))
            );
            console.log(`[Discord] 白名單已載入，共 ${whitelist.size} 名使用者。`);
        } else {
            console.warn(`[Discord] 白名單檔案未找到，這可能導致沒有任何人可以使用機器人！`);
            whitelist.clear();
        }
    } catch (e) {
        console.error(`[Discord] 讀取白名單失敗:`, e);
    }
}

// 初始載入並監聽檔案變化
loadWhitelist();
fs.watchFile(whitelistPath, (curr, prev) => {
    loadWhitelist();
});

client.once('clientReady', async () => {
    console.log(`[Discord] 機器人已上線，登入身分: ${client.user?.tag}`);
    
    // 將收集到的指令動態註冊到 Discord 全域
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    try {
        console.log(`[Discord] 正在全域註冊 ${commandsData.length} 個斜線指令 (Slash Commands)...`);
        
        // 為了確保開發階段能立即看到指令，也可以考慮註冊到特定伺服器 (Guild)
        // 但此處依照標準註冊為全域指令
        await rest.put(
            Routes.applicationCommands(client.user!.id),
            { body: commandsData },
        );
        console.log('[Discord] 動態指令註冊成功！(全域指令可能需要幾分鐘才會在客戶端顯示)');
    } catch (error) {
        console.error('[Discord] 註冊指令失敗:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    // 檢查白名單 (阻擋非授權用戶使用所有指令與自動完成)
    if (!whitelist.has(interaction.user.id)) {
        if (interaction.isChatInputCommand()) {
            await interaction.reply({ content: '⛔ 您不在機器的白名單中，無法使用此功能。如有需要請聯絡管理員。', ephemeral: true });
        }
        return;
    }

    // 處理斜線指令
    if (interaction.isChatInputCommand()) {
        const command = commandsCollection.get(interaction.commandName);
        if (!command) {
            console.warn(`[Discord] 找不到指令: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`[Discord] 執行指令 ${interaction.commandName} 發生錯誤:`, error);
            const errMsg = { content: '執行指令時發生錯誤，請聯絡管理員。', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errMsg);
            } else {
                await interaction.reply(errMsg);
            }
        }
    } 
    // 處理 Modal 表單送出
    else if (interaction.isModalSubmit()) {
        for (const command of commandsCollection.values()) {
            if (typeof command.handleModal === 'function') {
                try {
                    await command.handleModal(interaction);
                } catch (error) {
                    console.error(`[Discord] 執行 Modal 處理時發生錯誤:`, error);
                }
            }
        }
    }
    // 處理自動完成 (Autocomplete)
    else if (interaction.isAutocomplete()) {
        const command = commandsCollection.get(interaction.commandName);
        if (!command) return;

        if (typeof command.autocomplete === 'function') {
            try {
                await command.autocomplete(interaction);
            } catch (error: any) {
                // 如果是 10062 Unknown interaction，代表使用者打字過快，舊的互動已經過期，可安全忽略
                if (error.code !== 10062) {
                    console.error(`[Discord] 執行自動完成時發生錯誤:`, error);
                }
            }
        }
    }
});

export async function startDiscordBot() {
    if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'your_token_here') {
        console.warn('[Discord] 警告：未設定正確的 DISCORD_TOKEN，略過啟動機器人。');
        return;
    }

    console.log('[Discord] 正在動態載入指令模組...');
    const commandsPath = path.join(__dirname, 'commands');
    
    if (fs.existsSync(commandsPath)) {
        // 讀取 commands 目錄下的所有 ts 或 js 檔案
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            // 在 Windows 環境下，import() 必須使用 file:// 協議的 URL
            const fileUrl = new URL(`file:///${filePath.replace(/\\/g, '/')}`).href;
            
            const command = await import(fileUrl);
            
            // 確認該檔案匯出了必要的 data 屬性
            if (command.data) {
                commandsCollection.set(command.data.name, command);
                commandsData.push(command.data.toJSON());
                console.log(`[Discord] 載入指令成功: /${command.data.name}`);
            } else {
                console.warn(`[Discord] 檔案 ${file} 缺少 'data' 屬性，已略過。`);
            }
        }
    }

    client.login(process.env.DISCORD_TOKEN);
}
