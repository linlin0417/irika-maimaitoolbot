import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { getSettings, saveSettings } from '../../core/settings.js';

export const data = new SlashCommandBuilder()
    .setName('setting')
    .setDescription('設定機器人全域參數')
    .addStringOption(option => 
        option.setName('category')
            .setDescription('分類')
            .setRequired(true)
            .addChoices(
                { name: '備份 (backup)', value: 'backup' }
            )
    )
    .addStringOption(option =>
        option.setName('parameter')
            .setDescription('參數')
            .setRequired(true)
            .addChoices(
                { name: '自動備份頻道ID (channelId)', value: 'channelId' }
            )
    )
    .addStringOption(option =>
        option.setName('content')
            .setDescription('內容 (若留空則顯示當前設定值)')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const ADMIN_ID = '1031852521993543711';
    if (interaction.user.id !== ADMIN_ID) {
        return interaction.reply({ content: '您沒有權限使用此指令。', ephemeral: true });
    }

    const category = interaction.options.getString('category') as string;
    const parameter = interaction.options.getString('parameter') as string;
    const content = interaction.options.getString('content');

    const settings = getSettings();
    if (!settings[category]) {
        settings[category] = {};
    }

    if (content === null || content === undefined) {
        const currentValue = settings[category][parameter] || '未設定';
        return interaction.reply({ content: `[${category}] ${parameter} 當前設定值為: ${currentValue}`, ephemeral: true });
    } else {
        settings[category][parameter] = content;
        saveSettings(settings);
        return interaction.reply({ content: `[${category}] ${parameter} 已成功更新為: ${content}`, ephemeral: true });
    }
}
