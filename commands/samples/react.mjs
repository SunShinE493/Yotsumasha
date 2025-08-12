
import { SlashCommandBuilder } from 'discord.js';

let emoji = ['<:Flapper:1288693937770467409>','<:Flapper:1288693937770467409>','<:Keshitetekusa:1315640091787395113>','<a:GoodGay:1339928519731445852>','<a:Gorouri:1339929066249392221>','<a:Caeru:1339929082615435347>','<a:Shrek:1339929094145703946>','<:Tamazarashi:1340318651227832370>','<a:TNT:1344272756241334385>','<:Kire_gay:1345682703818690650>','<:Kitsu:1346466382283280485>',' <a:NoMB:1346470590697050194>','<:Shine:1348294242862235680>','<:Fashionmodel:1348294448777396355>','<:WhoIsHe:1348294771982078015>','<:Reasoning:1348294788574875699>','<:herpointofview:1348294797600751727>','<a:Furicaeru:1348901406215634995>','<:Foreverlove:1349555062246215680>','<:Aiseki:1349555074774339584>','<:CoolRider:1349555084417171456>','<:GayActor:1349555116797198388>','<:philosophical:1349555227732475994>','<:Genkoku:1349583835733426226>','<:Hikoku:1349583835733426226>','<:1000006731:1349586583807852655>','<:1000006733:1349586874515324989>','<:Imara:1349592318897815622>','<:Comfortable:1349592333175488532>','<:MasterofBilliards:1349592653288701994>','<:FeelAsleep:1349592778639802551>','<:FrontofFace:1349592789578547302>','<:Imara2:1349592796935491584>','<:Obake:1349592808964755467>','<:BeautifulSummer:1349592817722327122>','','']


export const data = new SlashCommandBuilder()
    .setName('react')
    .setDescription('特定のメッセージにリアクションをします')
    .addStringOption(option =>
        option.setName('message_id')
              .setDescription('リアクション対象のメッセージID')
              .setRequired(true))
        .addStringOption(option =>
        option.setName('react_content')
              .setDescription('リアクションする絵文字を選択')
              .setRequired(false)
              .addChoices(
                                     
                  { name: 'Flapper: <:Flapper:1288693937770467409>', value: '<:Flapper:1288693937770467409>' },
                  { name: 'Keshitetekusa: <:Keshitetekusa:1315640091787395113>', value: '<:Keshitetekusa:1315640091787395113>' },
                  { name: 'GoodGay: <a:GoodGay:1339928519731445852>', value: '<a:GoodGay:1339928519731445852>' },
                  { name: 'Gorouri: <a:Gorouri:1339929066249392221>', value: '<a:Gorouri:1339929066249392221>' },
                  { name: 'Caeru: <a:Caeru:1339929082615435347>', value: '<a:Caeru:1339929082615435347>' },
                  { name: 'Shrek: <a:Shrek:1339929094145703946>', value: '<a:Shrek:1339929094145703946>' },
                  { name: 'Tamazarashi: <:Tamazarashi:1340318651227832370>', value: '<:Tamazarashi:1340318651227832370>' },
                  { name: 'TNT: <a:TNT:1344272756241334385>', value: '<a:TNT:1344272756241334385>' },
                  { name: 'Kire_gay: <:Kire_gay:1345682703818690650>', value: '<:Kire_gay:1345682703818690650>' },
                  { name: 'Kitsu: <:Kitsu:1346466382283280485>', value: '<:Kitsu:1346466382283280485>' },
                  { name: 'NoMB: <a:NoMB:1346470590697050194>', value: '<a:NoMB:1346470590697050194>' },
                  { name: 'Shine: <:Shine:1348294242862235680>', value: '<:Shine:1348294242862235680>' },
                  { name: 'Fashionmodel: <:Fashionmodel:1348294448777396355>', value: '<:Fashionmodel:1348294448777396355>' },
                  { name: 'WhoIsHe: <:WhoIsHe:1348294771982078015>', value: '<:WhoIsHe:1348294771982078015>' },
                  { name: 'Reasoning: <:Reasoning:1348294788574875699>', value: '<:Reasoning:1348294788574875699>' },
                  { name: 'herpointofview: <:herpointofview:1348294797600751727>', value: '<:herpointofview:1348294797600751727>' },
                  { name: 'Furicaeru: <a:Furicaeru:1348901406215634995>', value: '<a:Furicaeru:1348901406215634995>' },
                  { name: 'Foreverlove: <:Foreverlove:1349555062246215680>', value: '<:Foreverlove:1349555062246215680>' },
                  { name: 'Aiseki: <:Aiseki:1349555074774339584>', value: '<:Aiseki:1349555074774339584>' },
                  { name: 'CoolRider: <:CoolRider:1349555084417171456>', value: '<:CoolRider:1349555084417171456>' },
                  { name: 'GayActor: <:GayActor:1349555116797198388>', value: '<:GayActor:1349555116797198388>' },
                  { name: 'philosophical: <:philosophical:1349555227732475994>', value: '<:philosophical:1349555227732475994>' },
                  { name: 'Genkoku: <:Genkoku:1349583835733426226>', value: '<:Genkoku:1349583835733426226>' },
                  { name: 'Hikoku: <:Hikoku:1349583835733426226>', value: '<:Hikoku:1349583835733426226>' },
                  
                  
                  // 以下、絵文字リストに合わせて追加してください
              ))
    .addStringOption(option =>
    option.setName('react_content2')
          .setDescription('リアクションする絵文字を選択')
          .setRequired(false)
          .addChoices(
              { name: 'chobun: <:1000006731:1349586583807852655>', value: '<:1000006731:1349586583807852655>' },
                  { name: 'chobunchobun: <:1000006733:1349586874515324989>', value: '<:1000006733:1349586874515324989>' },
                  { name: 'Imara: <:Imara:1349592318897815622>', value: '<:Imara:1349592318897815622>' },
                  { name: 'Comfortable: <:Comfortable:1349592333175488532>', value: '<:Comfortable:1349592333175488532>' },
                  { name: 'MasterofBilliards: <:MasterofBilliards:1349592653288701994>', value: '<:MasterofBilliards:1349592653288701994>' },
                  { name: 'FeelAsleep: <:FeelAsleep:1349592778639802551>', value: '<:FeelAsleep:1349592778639802551>' },
                  { name: 'FrontofFace: <:FrontofFace:1349592789578547302>', value: '<:FrontofFace:1349592789578547302>' },
                  { name: 'Imara2: <:Imara2:1349592796935491584>', value: '<:Imara2:1349592796935491584>' },
                  { name: 'Obake: <:Obake:1349592808964755467>', value: '<:Obake:1349592808964755467>' },
                  { name: 'BeautifulSummer: <:BeautifulSummer:1349592817722327122>', value: '<:BeautifulSummer:1349592817722327122>' }
))
    .addStringOption(option =>
        option.setName('word')
              .setDescription('リアクションする文字列')
              .setRequired(false));


// アルファベットをリージョンインジケーター絵文字に変換するマップ
const alphabetToEmoji = {
    'a': '🇦', 'b': '🇧', 'c': '🇨', 'd': '🇩', 'e': '🇪', 'f': '🇫', 'g': '🇬', 'h': '🇭', 'i': '🇮', 'j': '🇯', 'k': '🇰', 'l': '🇱', 'm': '🇲', 'n': '🇳', 'o': '🇴', 'p': '🇵', 'q': '🇶', 'r': '🇷', 's': '🇸', 't': '🇹', 'u': '🇺', 'v': '🇻', 'w': '🇼', 'x': '🇽', 'y': '🇾', 'z': '🇿'
};

// 2回目以降の文字に使う絵文字リスト（例: a2, b2, ...）
// 実際の絵文字名に置き換えてください
const alphabetToEmoji2 = {
    'a': 'a2', 'b': 'b2', 'c': 'c2', 'd': 'd2', 'e': 'e2', 'f': 'f2', 'g': 'g2', 'h': 'h2', 'i': 'i2', 'j': 'j2', 'k': 'k2', 'l': 'l2', 'm': 'm2', 'n': 'n2', 'o': 'o2', 'p': 'p2', 'q': 'q2', 'r': 'r2', 's': 's2', 't': 't2', 'u': 'u2', 'v': 'v2', 'w': 'w2', 'x': 'x2', 'y': 'y2', 'z': 'z2'
};

export async function execute(interaction) {
    const messageId = interaction.options.getString('message_id');
    const reactContent = interaction.options.getString('react_content');
    const word = interaction.options.getString('word');

    try {
        const targetMessage = await interaction.channel.messages.fetch(messageId);

        if (!targetMessage) {
            await interaction.reply({
                content: '指定されたメッセージが見つかりません。',
                ephemeral: true,
            });
            return;
        }

        // wordオプションが指定されている場合の処理
        if (word) {
        await interaction.reply({
            content: 'リアクションを開始しました！',
            ephemeral: true,
        });

            const lowerCaseWord = word.toLowerCase();
            const reactedChars = new Set(); // すでにリアクションした文字を記録するSet

            for (const char of lowerCaseWord) {
                if (alphabetToEmoji[char]) {
                    // すでにリアクション済みかチェック
                    if (reactedChars.has(char)) {
                        // 2回目以降の場合は別の絵文字を使用
                        if (alphabetToEmoji2[char]) {
                            await targetMessage.react(alphabetToEmoji2[char]);
                        }
                    } else {
                        // 初めての文字の場合は通常の絵文字を使用
                        

                        await targetMessage.react(alphabetToEmoji[char]);
                        reactedChars.add(char); // リアクションした文字を記録
                    }
                }
            }
        // react_contentオプションが指定されている場合の処理
        } else if (reactContent) {
            // react_contentが数字として解釈できる場合
                await targetMessage.react(reactContent);
        await interaction.reply({
            content: 'リアクションをしました！',
            ephemeral: true,
        });
            
    }else{
            await interaction.reply({
                content: 'リアクションする内容が指定されていません。\n`react_content`または`word`オプションを指定してください。',
                ephemeral: true,
            });
            return;
        }


    } catch (error) {
        console.error('エラーが発生しました:', error);
        await interaction.reply({
            content: 'エラーが発生しました。メッセージIDが正しいか確認してください。',
            ephemeral: true,
        });
    }
}
