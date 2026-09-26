import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, ButtonBuilder, ButtonStyle, ButtonInteraction, ComponentType, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { MaimaiAuthClient } from '../../crawler/auth.js';
import { MaimaiScraper } from '../../crawler/scraper.js';
import { dbManager } from '../../db/DatabaseManager.js';
import { PlaylogRepository } from '../../db/playlog_repository.js';
import fs from 'fs';
import path from 'path';
import { requireTier, Tier } from '../middleware.js';

export const data = new SlashCommandBuilder()
    .setName('recent')
    .setDescription('查看最近遊玩紀錄與詳細資訊')
    .addBooleanOption(option => 
        option.setName('debug')
            .setDescription('開啟除錯模式 (顯示抓取到的原始 JSON 資料)')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!await requireTier(interaction, Tier.ADVANCED, '最近遊玩追蹤')) return;

    const isDebug = interaction.options.getBoolean('debug') ?? false;
    const discordId = interaction.user.id;

    await interaction.deferReply();

    let account: any;
    let userRow: any;
    try {
        account = dbManager.getAccountByDiscordId(discordId);
        userRow = dbManager.getMainDb().prepare('SELECT cookie FROM accounts WHERE account_id = ?').get(account.account_id) as any;
    } catch (e) {
        await interaction.editReply('您尚未綁定或登入 Maimai NET，請先使用 `/login` 或 `/update` 更新您的狀態。');
        return;
    }

    if (!userRow || !userRow.cookie) {
        await interaction.editReply('您尚未綁定或登入 Maimai NET，請先使用 `/login` 或 `/update` 更新您的狀態。');
        return;
    }

    const authClient = new MaimaiAuthClient();
    await authClient.importCookieString(userRow.cookie);
    const scraper = new MaimaiScraper(authClient);

    let recentPlays: any[];
    try {
        recentPlays = await scraper.fetchRecentPlays();
        if (recentPlays.length === 0) {
            if (isDebug) {
                const res = await authClient.client.get('https://maimaidx-eng.com/maimai-mobile/record/');
                const debugPath = path.resolve(process.cwd(), `data/debug_recent_${Date.now()}.html`);
                fs.writeFileSync(debugPath, res.data);
                
                const attachment = new AttachmentBuilder(debugPath, { name: 'debug_recent.html' });
                
                await interaction.editReply({
                    content: '找不到最近的遊玩紀錄。已產出除錯用的 HTML 檔案，請檢查。',
                    files: [attachment]
                });
                return;
            }
            await interaction.editReply('找不到最近的遊玩紀錄。可能是尚未遊玩，或是 Cookie 已過期。');
            return;
        }
    } catch (error: any) {
        console.error('[RecentCommand] fetchRecentPlays failed:', error);
        await interaction.editReply(`抓取紀錄失敗，可能需要重新登入。\n錯誤: ${error.message}`);
        return;
    }

    const options = recentPlays.slice(0, 20).map((play, index) => ({
        label: `${play.played_at} - ${play.song_name}`.substring(0, 100),
        description: `[${play.difficulty}] 達成率: ${play.achievement}%`,
        value: play.idx
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_recent_play')
        .setPlaceholder('選擇一筆紀錄以查看詳細資訊')
        .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const response = await interaction.editReply({
        content: `找到 ${recentPlays.length} 筆最近遊玩紀錄，請從下方選單選擇您要查看詳細資料的單曲：`,
        components: [row]
    });

    const collector = response.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 120_000 
    });

    collector.on('collect', async (i) => {
        if (i.isStringSelectMenu() && i.customId === 'select_recent_play') {
            await i.deferUpdate();
            const selectedIdx = i.values[0];
            
            try {
                const summary = recentPlays.find(p => p.idx === selectedIdx);

                const detail = await scraper.fetchPlayDetail(selectedIdx);
                if (!detail.song_name && summary) detail.song_name = summary.song_name;
                
                let content = `**${detail.song_name}** [${detail.difficulty}]\n`;
                if (isDebug) {
                    content += `**[Debug 原始資料]**\n\`\`\`json\n${JSON.stringify(detail, null, 2).substring(0, 1800)}\n\`\`\`\n`;
                }

                const embed = new EmbedBuilder()
                    .setTitle(`${detail.song_name} - ${detail.difficulty}`)
                    .setColor(0x0099ff)
                    .addFields(
                        { name: '達成率', value: `${detail.achievement}%`, inline: true },
                        { name: 'DX 分數', value: `${detail.dx_score} / ${detail.dx_score_max}`, inline: true },
                        { name: 'Track Rating', value: `${detail.track_rating}`, inline: true },
                        { name: 'Combo / Sync', value: `Combo: ${detail.max_combo}/${detail.max_combo_target} \nSync: ${detail.max_sync}/${detail.max_sync_target}`, inline: true },
                        { name: 'Fast / Late', value: `Fast: ${detail.fast_count} | Late: ${detail.late_count}`, inline: true },
                        { name: '特殊狀態', value: `${detail.fc_status ? detail.fc_status.toUpperCase() : '無'} / ${detail.fs_status ? detail.fs_status.toUpperCase() : '無'}`, inline: true },
                        { name: '判定細節', value: 
                            `**TAP**: CP:${detail.tap_critical} | P:${detail.tap_perfect} | G:${detail.tap_great} | Gd:${detail.tap_good} | M:${detail.tap_miss}\n` +
                            `**HOLD**: CP:${detail.hold_critical} | P:${detail.hold_perfect} | G:${detail.hold_great} | Gd:${detail.hold_good} | M:${detail.hold_miss}\n` +
                            `**SLIDE**: CP:${detail.slide_critical} | P:${detail.slide_perfect} | G:${detail.slide_great} | Gd:${detail.slide_good} | M:${detail.slide_miss}\n` +
                            `**TOUCH**: CP:${detail.touch_critical} | P:${detail.touch_perfect} | G:${detail.touch_great} | Gd:${detail.touch_good} | M:${detail.touch_miss}\n` +
                            `**BREAK**: CP:${detail.break_critical} | P:${detail.break_perfect} | G:${detail.break_great} | Gd:${detail.break_good} | M:${detail.break_miss}`
                        }
                    )
                    .setFooter({ text: `遊玩時間: ${detail.played_at} | idx: ${detail.play_idx}` });

                const { DxRatingCoverProvider } = await import('../../core/dxrating-covers.js');
                const coverProvider = DxRatingCoverProvider.getInstance();
                const localCoverPath = await coverProvider.getLocalCoverPath(detail.song_name);

                let files: any[] = [];
                if (localCoverPath) {
                    const coverAttachment = new AttachmentBuilder(localCoverPath, { name: 'cover.jpg' });
                    embed.setThumbnail('attachment://cover.jpg');
                    files.push(coverAttachment);
                } else if (detail.cover_url) {
                    embed.setThumbnail(detail.cover_url);
                }

                const saveButton = new ButtonBuilder()
                    .setCustomId(`save_playlog_${selectedIdx}`)
                    .setLabel('儲存這次資訊')
                    .setStyle(ButtonStyle.Primary);
                
                const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(saveButton);

                await interaction.editReply({
                    content,
                    embeds: [embed],
                    components: [row, btnRow],
                    files: files
                });

                (i.client as any)._lastFetchedDetail = detail; 

            } catch (error: any) {
                console.error('[RecentCommand] fetchPlayDetail failed:', error);
                await interaction.editReply(`無法獲取詳細資料，可能該紀錄已失效。\n錯誤: ${error.message}`);
            }
        } else if (i.isButton() && i.customId.startsWith('save_playlog_')) {
            const idx = i.customId.split('_')[2];
            const detail = (i.client as any)._lastFetchedDetail;

            if (!detail || detail.play_idx !== idx) {
                await i.reply({ content: '無法找到此筆紀錄的暫存資料，請重新選擇一次歌曲。', ephemeral: true });
                return;
            }

            const success = PlaylogRepository.savePlaylog(discordId, detail);
            if (success) {
                await i.reply({ content: `成功將 **${detail.song_name}** 的詳細遊玩紀錄儲存至獨立資料庫中！`, ephemeral: true });
            } else {
                await i.reply({ content: '儲存失敗或該紀錄已經存在。', ephemeral: true });
            }
        }
    });

    collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
    });
}
