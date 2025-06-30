
import { SlashCommandBuilder } from 'discord.js';

let emoji = ['<:Flapper:1288693937770467409>','<:Kao:1315279759739195443>','<:Keshitetekusa:1315640091787395113>','<a:GoodGay:1339928519731445852>','<a:Gorouri:1339929066249392221>','<a:Caeru:1339929082615435347>','<a:Shrek:1339929094145703946>','<:Tamazarashi:1340318651227832370>','<a:TNT:1344272756241334385>','<:Kire_gay:1345682703818690650>','<:Kitsu:1346466382283280485>',' <a:NoMB:1346470590697050194>','<:Shine:1348294242862235680>','<:Fashionmodel:1348294448777396355>','<:WhoIsHe:1348294771982078015>','<:Reasoning:1348294788574875699>','<:herpointofview:1348294797600751727>','<a:Furicaeru:1348901406215634995>','<:Foreverlove:1349555062246215680>','<:Aiseki:1349555074774339584>','<:CoolRider:1349555084417171456>','<:GayActor:1349555116797198388>','<:philosophical:1349555227732475994>','<:Genkoku:1349583835733426226>','<:Hikoku:1349583835733426226>','<:1000006731:1349586583807852655>','<:1000006733:1349586874515324989>','<:Imara:1349592318897815622>','<:Comfortable:1349592333175488532>','<:MasterofBilliards:1349592653288701994>','<:FeelAsleep:1349592778639802551>','<:FrontofFace:1349592789578547302>','<:Imara2:1349592796935491584>','<:Obake:1349592808964755467>','<:BeautifulSummer:1349592817722327122>','','']



export const data = new SlashCommandBuilder()

        .setName('react')

        .setDescription('特定のメッセージにリアクションをします')

        .addStringOption(option =>

            option.setName('message_id')

                  .setDescription('リアクション対象のメッセージID')

                  .setRequired(true))

        .addStringOption(option =>

            option.setName('react_content')

                  .setDescription('Discord絵文字\n 0:Fla \n 1:Kao  2:Kesh  3:GG  4:Gori  5:Ca  6:Sh 7:Tama 8:TNT 9:kire 10:kit')

                  .setRequired(true));

      

export async function execute(interaction)  {

        // ユーザー入力を取得

        const messageId = interaction.options.getString('message_id'); // 対象メッセージのID

        const replyContent = interaction.options.getString('react_content'); // リプライ内容

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
if (replyContent <= 40){
    await targetMessage.react(emoji[replyContent]);
}
       /***   if (100<=replyContent <= 114){

await targetMessage.react('👪')

await targetMessage.react('👨‍👩‍👦')

await targetMessage.react('👨‍👩‍👧')

await targetMessage.react('👨‍👩‍👧‍👦')

await targetMessage.react('👨‍👩‍👦‍👦')

await targetMessage.react('👨‍👩‍👧‍👧')

await targetMessage.react('👩‍👩‍👦')

await targetMessage.react('👩‍👩‍👧')

await targetMessage.react('👩‍👩‍👧‍👦')

await targetMessage.react('👩‍👩‍👦‍👦')

await targetMessage.react('👩‍👩‍👧‍👧')

await targetMessage.react('👨‍👨‍👦')

await targetMessage.react('👨‍👨‍👧')

await targetMessage.react('👨‍👨‍👧‍👦')

await targetMessage.react('👨‍👨‍👦‍👦')

await targetMessage.react('👨‍👨‍👧‍👧')

await targetMessage.react('👩‍👦')

await targetMessage.react('👩‍👧')

await targetMessage.react('👩‍👧‍👦')

await targetMessage.react('👩‍👦‍👦')

await targetMessage.react('👩‍👧‍👧')

await targetMessage.react('👨‍👦')

await targetMessage.react('👨‍👧')

await targetMessage.react('👨‍👧‍👦')

await targetMessage.react('👨‍👦‍👦')

await targetMessage.react('👨‍👧‍👧')

}
          ***/
  await targetMessage.react(replyContent);
            // コマンド実行者に成功メッセージを送信

            await interaction.reply({

                content: 'リアクションをしました！',

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

