import { SlashCommandBuilder } from 'discord.js';
import axios from 'axios';

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
  
  // パスワードの検証
  if (pass === 4649) {
    const respons = await axios.get('https://api.github.com/rate_limit');
    console.log('rateLimitが使用されました。'); // ログをここに移動
    await interaction.reply("```json\n" + JSON.stringify(respons.data, null, 2).slice(0, 1980) + "\n```");
    process.exit(); // プロセスを終了し、Glitchが再起動するのを待ちます
  } else {
    await interaction.reply('パスワードが違います');
  }
}
