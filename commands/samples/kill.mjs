import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('指定したユーザーをVCから切断します')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('切断するユーザー')
            .setRequired(true));

export async function execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.MoveMembers)) {
        return interaction.reply({ content: 'このコマンドを使用する権限がありません。', ephemeral: true });
    }

    const member = interaction.options.getMember('user');
    if (!member) {
        return interaction.reply({ content: 'VCから切断するメンバーを指定してください。', ephemeral: true });
    }

    if (!member.voice.channel) {
        return interaction.reply({ content: `${member.user.tag} はボイスチャンネルにいません。`, ephemeral: true });
    }

    await member.voice.disconnect();
    interaction.reply({ content: `${member.user.tag} をVCから切断しました。`, ephemeral: false });
}
