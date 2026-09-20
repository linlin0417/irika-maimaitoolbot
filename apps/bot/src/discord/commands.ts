import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import client from './client';
import db from '../db/index';
// @ts-ignore
import { fetchPlayerData } from '../crawler/intl';
// @ts-ignore
import { generateB50Poster } from '../render/poster';

export const commands = [
    new SlashCommandBuilder()
        .setName('bind')
        .setDescription('Bind your Sega AIME cookie')
        .addStringOption(option =>
            option.setName('cookie')
                .setDescription('Your userId cookie from maimaidx-eng.com')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('b50')
        .setDescription('Generate your maimai B50 poster')
];

export function registerCommands() {
    client.on('interactionCreate', async (interaction: any) => {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        if (commandName === 'bind') {
            const token = interaction.options.getString('cookie', true);
            const discordId = interaction.user.id;

            try {
                const stmt = db.prepare(`
                    INSERT INTO users (discord_id, cookie) 
                    VALUES (?, ?)
                    ON CONFLICT(discord_id) DO UPDATE SET 
                    cookie = excluded.cookie, 
                    updated_at = CURRENT_TIMESTAMP
                `);
                stmt.run(discordId, token);
                await interaction.reply({ content: 'Successfully bound Sega AIME cookie!', ephemeral: true });
            } catch (error) {
                console.error('Error binding token:', error);
                await interaction.reply({ content: 'Failed to bind cookie.', ephemeral: true });
            }
        } else if (commandName === 'b50') {
            const discordId = interaction.user.id;
            
            try {
                const stmt = db.prepare('SELECT cookie FROM users WHERE discord_id = ?');
                const user = stmt.get(discordId) as { cookie: string | null } | undefined;

                if (!user || !user.cookie) {
                    await interaction.reply({ content: 'You have not bound your AIME cookie yet. Please use `/bind` first.', ephemeral: true });
                    return;
                }

                await interaction.deferReply();
                const playerData = await fetchPlayerData(user.cookie);
                const imageBuffer = await generateB50Poster(playerData.profile, playerData.bests);

                const attachment = new AttachmentBuilder(imageBuffer, { name: 'b50.png' });
                await interaction.editReply({ files: [attachment] });
            } catch (error) {
                console.error('Error generating B50:', error);
                if (interaction.deferred) {
                    await interaction.editReply('An error occurred while generating your B50 poster.');
                } else {
                    await interaction.reply({ content: 'An error occurred while generating your B50 poster.', ephemeral: true });
                }
            }
        }
    });
}
