import { ChatInputCommandInteraction } from 'discord.js';
import { dbManager } from '../db/DatabaseManager.js';

export enum Tier {
    ADMIN = 1,
    PRIORITY = 2,
    ADVANCED = 3,
    BASIC = 4
}

export function checkTier(discordId: string, requiredTier: Tier): boolean {
    try {
        const account = dbManager.getAccountByDiscordId(discordId);
        return account.tier <= requiredTier;
    } catch (e: any) {
        if (e.message === 'USER_NOT_BOUND') {
            return false;
        }
        throw e;
    }
}

export async function requireTier(interaction: ChatInputCommandInteraction, requiredTier: Tier, featureName: string): Promise<boolean> {
    try {
        const account = dbManager.getAccountByDiscordId(interaction.user.id);
        if (account.tier > requiredTier) {
            const msg = `[拒絕訪問] \`${featureName}\` 為進階/優先用戶專屬功能。您的權限不足。`;
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(msg);
            } else {
                await interaction.reply({ content: msg, ephemeral: true });
            }
            return false;
        }
        return true;
    } catch (e: any) {
        if (e.message === 'USER_NOT_BOUND') {
            const msg = '找不到您的帳號記錄，請先使用 `/login` 綁定 SEGA ID。';
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(msg);
            } else {
                await interaction.reply({ content: msg, ephemeral: true });
            }
            return false;
        }
        throw e;
    }
}
