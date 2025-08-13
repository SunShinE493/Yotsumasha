
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
                                     
                  { name: 'Flapper', value: '<:Flapper:1288693937770467409>' },
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
              { name: 'chobun', value: '<:1000006731:1349586583807852655>' },
                  { name: 'chobunchobun', value: '<:1000006733:1349586874515324989>' },
                  { name: 'Imara', value: '<:Imara:1349592318897815622>' },
                  { name: 'Comfortable', value: '<:Comfortable:1349592333175488532>' },
                  { name: 'MasterofBilliards', value: '<:MasterofBilliards:1349592653288701994>' },
                  { name: 'FeelAsleep', value: '<:FeelAsleep:1349592778639802551>' },
                  { name: 'FrontofFace', value: '<:FrontofFace:1349592789578547302>' },
                  { name: 'Imara2', value: '<:Imara2:1349592796935491584>' },
                  { name: 'Obake', value: '<:Obake:1349592808964755467>' },
                  { name: 'BeautifulSummer', value: '<:BeautifulSummer:1349592817722327122>' },              { name: 'Gekiita', value: '<:Gekiita:1349952380937965598>' },
              { name: 'Zecchi', value: '<:Zecchi:1349952390723403847>' },
              { name: 'Calling', value: '<:Calling:1349953298937024572>' },
              { name: 'Kirin', value: '<:Kirin:1349953307564576812>' },
              { name: 'Childhood', value: '<:Childhood:1349953315747794945>' },
              { name: 'Bodhisattva', value: '<:Bodhisattva:1349971173991125093>' },
              { name: 'serve', value: '<a:serve:1352267714974060644>' },
              { name: 'Enamorus', value: '<:Enamorus:1352270510414893186>' },
              { name: 'Kogao', value: '<:Kogao:1404987761672454266>' },
              { name: 'Shita', value: '<:Shita:1352270531218640926>' },
              { name: 'Agonai', value: '<:Agonai:1352270571336892509>' },
              { name: 'Kids', value: '<:Kids:1352270597152964660>' },
              { name: 'Happiness', value: '<:Happiness:1352270614672576532>' },
              { name: 'VirtualSex', value: '<:VirtualSex:1352270635266736200>' },
              { name: 'StreatSnap', value: '<:StreatSnap:1352270665574514698>' }
              
))
    
    .addStringOption(option =>
    option.setName('react_content3')
          .setDescription('リアクションする絵文字を選択')
          .setRequired(false)
          .addChoices(
              { name: 'Sensei', value: '<:Sensei:1352270696268697658>' },
                            { name: 'Imara3', value: '<:Imara3:1352270719278518292>' },
              { name: 'Hurousha', value: '<:Hurousha:1352270745455034420>' },
              { name: 'Kyomu', value: '<:Kyomu:1352270768179908658>' },
              { name: 'Vlog', value: '<:Vlog:1352270788060774470>' },
              { name: 'Kyouhaku', value: '<:Kyouhaku:1352270809661706250>' },
              { name: 'Peace', value: '<:Peace:1352270824245297242>' },
              { name: 'suikyou', value: '<:suikyou:1352270838443016344>' },
              { name: 'Hengao', value: '<:Hengao:1352270861683654747>' },
              { name: 'GCGGarrettTurbo', value: '<:GCGGarrettTurbo:1352270869170225233>' }
              ))
    .addStringOption(option =>
        option.setName('emojiid')
              .setDescription('絵文字Id')
              .setRequired(false))
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
// アルファベットをカスタム絵文字に変換するマップ
const alphabetToEmoji2 = {
    'a': '<:A_:1404991142050795661>',
    'b': '<:B_:1404991165186441286>',
    'c': '<:C_:1404991182408515646>',
    'd': '<:D_:1404991199043125342>',
    'e': '<:E_:1404991216583442552>',
    'f': '<:F_:1404991230512992256>',
    'g': '<:G_:1404991243070476328>',
    'h': '<:H_:1404991253489254400>',
    'i': '<:I_:1404991265749336166>',
    'j': '<:J_:1404991275647893514>',
    'k': '<:K_:1404991294832513075>',
    'l': '<:L_:1404991310028603502>',
    'm': '<:M_:1404991324276392017>',
    'n': '<:N_:1404991335756333134>',
    'o': '<:O_:1404991345981919394>',
    'p': '<:P_:1404991356899819520>',
    'q': '<:Q__:1404991382506049609>',
    'r': '<:R_:1404991393239400458>',
    's': '<:S_:1404991402391240824>',
    't': '<:T_:1404991408921776219>',
    'u': '<:U_:1404991415460823151>',
    'v': '<:V_:1404991421466939414>',
    'w': '<:W_:1404991429729587363>',
    'x': '<:X_:1404991435995877508>',
    'y': '<:Y_:1404991443898204301>',
    'z': '<:Z_:1404991449891737671>'
};


export async function execute(interaction) {
    const messageId = interaction.options.getString('message_id');
    const reactContent = interaction.options.getString('react_content');
    const word = interaction.options.getString('word');
    const emojiId = interaction.options.getString('emojiId');

    
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
            
    }else if (emojiId){
            await targetMessage.react(emojiId);
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
