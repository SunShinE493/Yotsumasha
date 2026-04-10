import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('refresh')
  .setDescription('Botを再起動します。')
  .addIntegerOption(option =>
    option.setName('password')
      .setDescription('パスワード')
      .setRequired(true)
  );

export async function execute(interaction) {
  // パスワードを取得
  const pass = interaction.options.getInteger('password');

  // パスワードの検証
  if (pass === 4649) {
    console.log('refreshが使用されました。'); // ログをここに移動
    await interaction.reply('Bot is restarting...');
    process.exit(); // プロセスを終了し、Glitchが再起動するのを待ちます
  } else {
    await interaction.reply('パスワードが違います');
  }
}
