import { SlashCommandBuilder } from 'discord.js';
import request from 'requests';

export const data = new SlashCommandBuilder()
  .setName('rateLimit')
  .setDescription('GitRateLimit')
  .addIntegerOption(option =>
    option.setName('password')
      .setDescription('パスワード')
      .setRequired(true)
  );

export async function execute(interaction) {
  // パスワードを取得
  const pass = interaction.options.getInteger('password');
  const respons = request.get('https://github.com')
  // パスワードの検証
  if (pass === 4649) {
    console.log('rateLimitが使用されました。'); // ログをここに移動
    await interaction.reply(respons.json);
    process.exit(); // プロセスを終了し、Glitchが再起動するのを待ちます
  } else {
    await interaction.reply('パスワードが違います');
  }
}
