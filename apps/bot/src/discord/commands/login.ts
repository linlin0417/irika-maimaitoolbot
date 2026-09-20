import { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';
import { upsertUser } from '../../db/repository';
import { runCrawlerForUser } from '../../core/crawler-service';

export const data = new SlashCommandBuilder()
    .setName('login')
    .setDescription('綁定您的 SEGA ID 以啟用成績追蹤功能 (資料將安全傳輸)');

export async function execute(interaction: ChatInputCommandInteraction) {
    // 建立表單 (Modal) 以安全接收帳密，避免在對話頻道留下明文紀錄
    const modal = new ModalBuilder()
        .setCustomId('login_modal')
        .setTitle('綁定 SEGA ID');

    const idInput = new TextInputBuilder()
        .setCustomId('sega_id')
        .setLabel("SEGA ID (非 Aime 卡號)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const passwordInput = new TextInputBuilder()
        .setCustomId('sega_password')
        .setLabel("密碼")
        .setStyle(TextInputStyle.Short) 
        .setRequired(true);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(idInput);
    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(passwordInput);

    modal.addComponents(firstActionRow, secondActionRow);

    // 彈出輸入表單給使用者
    await interaction.showModal(modal);
}

export async function handleModal(interaction: ModalSubmitInteraction) {
    if (interaction.customId !== 'login_modal') return;

    const segaId = interaction.fields.getTextInputValue('sega_id');
    const password = interaction.fields.getTextInputValue('sega_password');
    const discordId = interaction.user.id;

    // 告知使用者正在處理，並設為隱藏回覆 (Ephemeral) 確保隱私
    await interaction.reply({ content: '正在驗證您的帳號並進行初次同步，這可能需要一至兩分鐘，請稍候...', ephemeral: true });

    // 將登入憑證存入資料庫
    upsertUser(discordId, segaId, password);

    // 觸發爬蟲服務
    const result = await runCrawlerForUser(discordId);

    if (result) {
        await interaction.editReply({
            content: `登入成功！歡迎回來，${result.playerName} (Rating: ${result.rating})。\n初次同步完成：共抓取並儲存了 ${result.totalScraped} 筆成績。`
        });
    } else {
        await interaction.editReply({
            content: '登入失敗，請確認您的帳號密碼正確，且該帳號已開通國際版 Maimai DX 服務。'
        });
    }
}
