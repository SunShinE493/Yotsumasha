import { SlashCommandBuilder } from 'discord.js';

// コマンド定義と処理
export const data = new SlashCommandBuilder()
    .setName('echo')
        .setDescription('入力内容をそのまま返します')
        .addStringOption(option =>
            option.setName('message')
                  .setDescription('送信するメッセージ')
                  .setRequired(true));
   
export async function execute(interaction) {
   // ユーザーが入力したメッセージを取得
        const message = interaction.options.getString('message');
        // 入力内容をそのまま返信
        await interaction.channel.send(message);
  
  

            // コマンド実行者に成功メッセージを送信

            await interaction.reply({

                content: 'メッセージを送信しました！',

                ephemeral: true,

            });
    };