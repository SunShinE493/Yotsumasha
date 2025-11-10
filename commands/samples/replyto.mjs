import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
        .setName('replyto')

        .setDescription('特定のメッセージにリプライを送ります')

        .addStringOption(option =>

            option.setName('message_id')

                  .setDescription('リプライ対象のメッセージID')

                  .setRequired(true))

        .addStringOption(option =>

            option.setName('reply_content')

                  .setDescription('リプライ内容')

                  .setRequired(true));
      
export async function execute(interaction)  {

        // ユーザー入力を取得

        const messageId = interaction.options.getString('message_id'); // 対象メッセージのID

        const replyContent = interaction.options.getString('reply_content'); // リプライ内容

        try {

            // メッセージが送信されたチャンネルで指定されたIDのメッセージを取得

            const targetMessage = await interaction.channel.messages.fetch(messageId);

            if (!targetMessage) {

                await interaction.reply({

                    content: '指定されたメッセージが見つかりません。',

                    ephemeral: true, // ユーザーにのみ表示

                });

                return;

            }

            // 対象のメッセージにリプライ

            await targetMessage.reply(replyContent);

            // コマンド実行者に成功メッセージを送信

            await interaction.reply({

                content: 'リプライを送信しました！',

                ephemeral: true,

            });

        } catch (error) {

            console.error('エラーが発生しました:', error);

            await interaction.reply({

                content: 'エラーが発生しました。メッセージIDが正しいか確認してください。',

                ephemeral: true,

            });

        }

    }

