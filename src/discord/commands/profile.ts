import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } from 'discord.js';
import { generateProfileCard } from '../../render/profile.js';
import { getUserCollections, updateUserEquipment } from '../../db/repository.js';
import { getUser } from '../../db/repository.js';

export const data = new SlashCommandBuilder()
    .setName('profile')
    .setDescription('[廢棄] 管理與查看您的 maimai 個人資料卡')
    .addSubcommand(subcommand =>
        subcommand
            .setName('show')
            .setDescription('[廢棄] 產生個人資料卡圖片')
            .addStringOption(option =>
                option.setName('type')
                    .setDescription('版型大小')
                    .setRequired(true)
                    .addChoices(
                        { name: '小卡 (名牌)', value: 'small' },
                        { name: '大卡 (底板)', value: 'large' }
                    )
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('equip')
            .setDescription('[廢棄] 替換展示於 Discord 名片上的稱號、名牌或底板')
            .addStringOption(option =>
                option.setName('category')
                    .setDescription('選擇要更換的種類')
                    .setRequired(true)
                    .addChoices(
                        { name: '稱號 (Title)', value: 'title' },
                        { name: '名牌 (Nameplate)', value: 'plate' },
                        { name: '底板 (Frame)', value: 'frame' }
                    )
            )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    return interaction.reply({ 
        content: '⚠️ **此功能已被標註為廢棄 (Deprecated)**，目前停止提供服務。', 
        ephemeral: true 
    });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'show') {
        await interaction.deferReply();
        try {
            const type = interaction.options.getString('type') as 'small' | 'large';
            const buffer = await generateProfileCard(discordId, type);
            const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (error: any) {
            console.error('[Profile Command Error]', error);
            await interaction.editReply({ content: `產生個人資料卡失敗：${error.message}` });
        }
    } else if (subcommand === 'equip') {
        const category = interaction.options.getString('category') as 'title' | 'plate' | 'frame';
        const collections = getUserCollections(discordId);
        
        let options: { label: string, value: string, description?: string }[] = [];
        
        if (category === 'title') {
            options = collections.titles.map((t: any) => ({
                label: t.title_name.substring(0, 100),
                value: t.title_name,
                description: t.title_type
            }));
        } else if (category === 'plate') {
            options = collections.plates.map((p: any) => ({
                label: p.plate_name.substring(0, 100),
                value: p.plate_url
            }));
        } else if (category === 'frame') {
            options = collections.frames.map((f: any) => ({
                label: f.frame_name.substring(0, 100),
                value: f.frame_url
            }));
        }

        if (options.length === 0) {
            return interaction.reply({ content: `您目前沒有任何已解鎖的 ${category} 收藏品。請先確認遊戲內有解鎖，並等待系統自動抓取。`, ephemeral: true });
        }

        // Discord Select Menu maximum options is 25
        if (options.length > 25) {
            options = options.slice(0, 25);
            // In a real app we'd paginate, but for now just slice
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId(`equip_select_${category}_${discordId}`)
            .setPlaceholder(`選擇一個 ${category} 裝備`)
            .addOptions(options.map(opt => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(opt.label)
                    .setValue(opt.value.substring(0, 100))
                    .setDescription(opt.description || ' ')
            ));

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

        const response = await interaction.reply({
            content: `請從下方選單選擇您要裝備的 ${category}：\n(僅顯示前25筆)`,
            components: [row],
            ephemeral: true
        });

        try {
            const confirmation = await response.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id && i.customId.startsWith('equip_select_'),
                time: 60000,
                componentType: ComponentType.StringSelect
            });
            
            const selectedValue = confirmation.values[0];
            if (selectedValue) {
                updateUserEquipment(discordId, category, selectedValue);
            }
            
            await confirmation.update({ content: `裝備更新成功！您選擇了：${selectedValue}\n馬上使用 \`/profile show\` 看看新外觀吧！`, components: [] });
        } catch (e) {
            await interaction.editReply({ content: '選擇逾時或發生錯誤，請重試。', components: [] });
        }
    }
}
