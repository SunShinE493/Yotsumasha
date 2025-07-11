import { SlashCommandBuilder } from 'discord.js';

// ユーザーごとのスコアを管理するオブジェクト

const participants = {};
const userSkippedQuestions = new Map();

let firstAnswer = true; 
let qskip = true;

// スラッシュコマンドの定義

export const data = new SlashCommandBuilder()

  .setName('koubun_quiz')

  .setDescription('英語の構文150の問題を出題します')

  .addIntegerOption(option => 

    option.setName('questions')

      .setDescription('出題する問題数')

      .setRequired(true)

  )

  .addIntegerOption(option => 

    option.setName('category')

      .setDescription('問題のカテゴリ 1：4,5章 2：8,10章 3：12,13章')

      .setRequired(true)                 

  )

   .addIntegerOption(option => 

    option.setName('waittime')

      .setDescription('正解者が出てから次の問題に行くまで')

      .setRequired(true)

  )
.addIntegerOption(option => 

    option.setName('fromnumber')

      .setDescription('この問題からスタート(順番)')

      .setRequired(false)

  )
.addStringOption(option => 

    option.setName('missnumber')

      .setDescription('スキップした問題番号を貼り付けて')

      .setRequired(false)

  )
.addIntegerOption(option => 

    option.setName('point')

      .setDescription('得点を表示する場合は0')

      .setRequired(false)                 

  )
.addIntegerOption(option => 

    option.setName('score_clear')

      .setDescription('スコアをクリア')

      .setRequired(false)

  );


export async function execute(interaction) {
    let mondaisuuChiri = interaction.options.getInteger('questions');
    const hani = interaction.options.getInteger('category');
    const answerTime = interaction.options.getInteger('waittime') * 1000;
    const waitTime = answerTime + 500;
    const fromnum = interaction.options.getInteger('fromnumber') || 0;
    const point = interaction.options.getInteger('point') || 0;
  let missnumber = []
  let answeredUsersPerQuestion = new Set();
    missnumber = interaction.options.getString('missnumber');
  const skippedQuestionNumbers = [];
  let stopFlag = false;  // ストップフラグ
  let currentQuestion = 0;

    if (answerTime < 0 || answerTime > 40000) {
        await interaction.reply('回答時間が無効です。');
        return;
    }

 
  if(mondaisuuChiri>350){
    interaction.channel.send('本当にやる気ある？')
    console.log('mondaisuu_ error')
    return;
  }
  
  
  console.log(missnumber)
  let numbersArray = []
  if( missnumber !== null){
      const numbersString = interaction.options.getString('missnumber'); 
        if (!numbersString) {
            await interaction.reply({ content: '数字のリストを指定してください（例: 1,2,3）', ephemeral: true });
            return;
        }
         numbersArray = numbersString.split(',').map(s => s.trim());
        console.log('取得した配列（文字列）:', numbersArray);
        mondaisuuChiri = numbersArray.length
}
  
  

    await interaction.reply(`公共一問一答 ${mondaisuuChiri} 問`);
   // askQuestion();  
  
    const askQuestion = async () => {
        if (currentQuestion >= mondaisuuChiri ||currentQuestion >= numbersArray.lngth || stopFlag) {
          
            await showCurrentScores(interaction);
          
          if (skippedQuestionNumbers.length === 0) {

            await interaction.channel.send('今回のクイズでは、スキップされた問題はありませんでした。');

            return;

          }

          const uniqueAndSortedSkipped = [...new Set(skippedQuestionNumbers)].sort((a, b) => a - b);

          // 配列を直接Discordのsendメソッドに渡すと、自動的にカンマ区切り文字列に変換されます。

          await interaction.channel.send(`スキップされた問題番号は以下の通りです:`);
          await interaction.channel.send(`\n${uniqueAndSortedSkipped}`);
          await interaction.channel.send(`missnumberに追加することで、リストの問題のみをテストできます。\n/misslistでは、これらの問題の穴埋めシートを作れます。`);
          

          skippedQuestionNumbers.length = 0; // 

          console.log('スキップされた問題リストがリセットされました。');
          
          return;
        }

        let random, tango, seikai;
        if (fromnum > 0) {
            random = fromnum + currentQuestion;
            if (hani === 1) {
                tango = problem45[random];
                seikai = answer45[random];
            } else if (hani === 2) {
                tango = problem810[random];
                seikai = answer810[random];
            } else if (hani === 3) {
                tango = problem1213[random];
                seikai = answer1213[random];
            } else if (hani === 10) {
                tango = chemistry[2*random];
                seikai = chemistry[2*random+1];
            }
        } else if(missnumber !== null){
          console.log('配列のやつ')
          console.log(numbersArray)
          
          random = numbersArray[currentQuestion];
          if (hani === 1) {

                tango = problem45[random];

                seikai = answer45[random];

            } else if (hani === 2) {

                tango = problem810[random];

                seikai = answer810[random];

            } else if (hani === 3) {

                tango = problem1213[random];

                seikai = answer1213[random];

            } else if (hani === 10) {

                tango = chemistry [2*random];

                seikai = chemistry [2*random+1];

            }
        }else {
          console. log('普通の')
            if (hani === 1) {
                random = genRandomInt(problem45.length);
                tango = problem45[random];
                seikai = answer45[random];
            } else if (hani === 2) {
                random = genRandomInt(problem810.length);
                tango = problem810[random];
                seikai = answer810[random];
            } else if (hani === 3) {
                random = genRandomInt(problem1213.length);
                tango = problem1213[random];
                seikai = answer1213[random];
            } else if (hani === 10) {
                random = genRandomInt(chemistry.length/2);
                tango = chemistry [2*random];
                seikai = chemistry [2*random+1];
            } else {
                await interaction.followUp('カテゴリが無効です。');
                return;
            }
        }

        await interaction.channel.send(`### \`${currentQuestion + 1} ${tango} ${random}\``);
        firstAnswer = true;
        qskip = true;
        answeredUsersPerQuestion = new Set();

        const messageHandler = async (message) => {
          
              if (message.channel.id !== interaction.channel.id) return;
          
            if (message.content.includes(seikai)) {
               qskip = false;
                try {
                  console.log('正解！')
                    await message.react('⭕');
                    await handleCorrectAnswer(message, seikai, interaction,answeredUsersPerQuestion);
                    
                  if(firstAnswer){
                     firstAnswer = false;
                  setTimeout(() => {      
                    interaction.client.removeListener('messageCreate', messageHandler);
                    currentQuestion++;
                    askQuestion(); // 次の問題へ

                  },answerTime);

                    }
                  
                } catch (error) {
                    console.error('リアクションエラー:', error);
                }
            }else if(!message.author.bot){
               if (message.content.includes('？')) {

              qskip = false;

              try {

                console.log('？が送信されました。');

        // 問題番号を記録

        // ここでは '2*random' が問題番号として記録されると想定します。

        // もし 'currentQuestion' など、別の変数が正しい問題番号を指すなら、そちらを使ってください。

                skippedQuestionNumbers.push(random);
                console.log(`問題 ${random} がスキップされました。現在のスキップリスト:`, skippedQuestionNumbers);
                await message.react('🤦‍♂️');
                interaction.channel.send('答えは' + seikai + 'でした。');
                
              } catch (error) {

                console.error('リアクションエラー:', error);

              }

            }

          else if (message.content.includes('終了')) {
               qskip = false;
                try {
                  console.log('終了フラグが送信されました。')
                    firstAnswer = false
                    await message.react('<a:TNT:1344272756241334385>');
                    interaction.client.removeListener('messageCreate', messageHandler);
                    interaction.channel.send('答えは'+seikai+'でした。');
                    interaction.channel.send('処理が正常に終了しました。');
                    await showCurrentScores(interaction);
                    currentQuestion+=300;
                    await interaction.channel.send(`スキップされた問題番号は以下の通りです:`);
                    if (skippedQuestionNumbers.length === 0) {
                      await interaction.channel.send('今回のクイズでは、スキップされた問題はありませんでした。');
                    }else{
                      await interaction.channel.send(`\n${skippedQuestionNumbers}`);
                       await interaction.channel.send(`missnumberに追加することで、リストの問題のみをテストできます。\n/misslistでは、これらの問題の穴埋めシートを作れます。`);
                    }
                  return;
                   } catch (error) {
                    console.error('リアクションエラー:', error);
                }

            return;
        }
            }
        };
      
        interaction.client.on('messageCreate', messageHandler);

            setTimeout(() => {
              if(point === 234 ){
                console.log('時間切れ処理が行われました。')
                interaction.client.removeListener('messageCreate', messageHandler);
                    interaction.channel.send(`時間切れです。正解は ${seikai} でした。`);
                currentQuestion++;
                askQuestion();
              }
            }, answerTime);
    };
console.log ('kokohanani')
   askQuestion();
}





const handleCorrectAnswer = async (message, seikai, interaction,answeredUsersPerQuestion) => {
    const userId = message.author.id;
  // この問題で既に正解しているかチェック 
  if(answeredUsersPerQuestion.has(userId)) { 
    await message.react('<:kocchiminnna:1389578545302601819> ');                             
    return; 
}
    if (!participants[userId]) {
        participants[userId] = { score: 0, participation: 0 };
    }
    if (firstAnswer) {
        participants[userId].score += 3;
        await message.react('🥇');
      } else {
        participants[userId].score += 1;
        await message.react('⭕️');
    }
  // 正解したユーザーを記録
  answeredUsersPerQuestion.add(userId);
};

// 現在のスコアを表示する関数（各問題終了後）

const showCurrentScores = async (interaction) => {

  let scoreMessage = '> 現在のスコア:\n';

  Object.keys(participants).forEach(userId => {

    const user = participants[userId];

    scoreMessage += `<@${userId}>: ${user.score}点\n`;

  });
  await interaction.channel.send(scoreMessage);
};





var mondaiNum = [];
function genRandomInt(max1) {
    while (true) {
        var retur = Math.floor(Math.random() * (max1 + 1));
        if (!mondaiNum.includes(retur)) {
            mondaiNum.push(retur);
            break;
        }
    }
    return retur;
};


export const problem45 = ["0十分に厳しくしないことによって、多くの母親は自分の息子をダメにする。Many mothers spoil their sons (    )(    )(    ) strict enough.","1彼は誰にも一言も告げずに会社（事務所）を去った。He left the office (    )(    ) a word to anyone.",

             "2私は不平さえ言わずに、上司のために懸命に働き続けている。I have been working hard for my boss (    )(    )(    ).※不平⇒complain","3その荷物はあまりにも大きい。君はどうやって、誰にも知られずにそれを家から運び出せるのか。The package is too big. How can you carry it out of the house (    )(    )(    ) it?",

             "4オリビアはテレビ局の人たちに話を聞くことによって、テレビについて少し学んだ。Olivia learned a little about television (    )(    )(    ) the people at the television station.","5彼女は新聞を読み、それを翻訳することで英語をマスターした。She mastered English (    )(    ) newspapers and (    )(    ).",

             "6最初に何かを失わずには、何物も得られない。You can't gain anything (    )(    )(    ) first.","7世論の傾向を理解する際には、世論調査が不可欠だ。A public opinion poll is indispensable (    )(    ) the trends of public opinion.",

             "8私は射撃をするときにはいつも眼鏡をかける。I always wear glasses (    )(    ).","9その衝突音を聞いてすぐに、私は家から飛び出した。(    )(    ) the crash, I rushed out of the house.",

             "10怒られて、その少女は泣き出した。(    )(    ) scolded, the girl started crying.","11何をするにも最善を尽くすべきだ。(    )(    ) anything, you should do your best.",

             "12ドアを開けると、彼は背の高い男がそこに立っているのを目にした。(    )(    ) the door, he saw a tall man standing there.","13そのニュースを聞いて、彼は落胆した。(    )(    ) the news, he was disapppointed.",

             "14彼女の気持ちを気付つけることを恐れて、私は彼女に真実を言えなかった。I couldn't tell her the truth (    )(    )(    )(    ) her feelings.","15そこに家を建てる目的で、彼はその土地を買った。He bought the land (    )(    )(    )(    )(    ) a house on it.",

             "16いつもただ勉強ばかりしてないで、たまには外に出て楽しい時間を過ごしなよ。Go out and have a good time once in a while (    )(    )(j   )(    ) all the time.","17彼は捕らわれる危機にあった。He was (    )(    )(    )(    ) captured.",

             "18彼は音楽を勉強する目的でイタリアに行った。He went to Italy (f   )(    )(    )(    )(    ) music.","19#彼は買おうと思って、その家を調べに来た。He came to inspect the house (w   )(    )(    )(    )(    ) it.",

             "20私を雇ってくれた上に、彼は私に１つ助言をしてくれた。(    )(    )(    )(    ) me, he gave me a piece of advice.","21彼女はもっと多くのオンライン授業を取ることを楽しみにしている。She (    )(    )(    )(    )(    ) more online classes.",

             "22彼は家族のためにもっと多くの時間を過ごすことを楽しみにしている。He (    )(    )(    )(    ) more time for his family.","23どの言語が学ぶ価値があるだろうか？What language (    )(    )(    )?",

             "24あのお寺は少なくとも１度は行く価値がある。It (    )(    )(    ) to that temple at least once.","25私はあなたと働くのを本当に楽しみにしています。I'm really (    )(    )(    ) working with you.",

             "26私の子供たちはあなたのコンサートを楽しみにしています。My children (    )(    )(    )(    ) your concert.","27この小説は繰り返し読む価値がある。This novel (    )(    )(    ) over and over again.",

             "28私は英語でエッセー(小論文)を書くことに慣れていない。I (    ) not (    )(    )(    ) essays in English.","29私はギターを弾くのが自然に得意になった。I naturally (    )(    )(    )(    ) the guitar.",

             "30彼女は飛ぶことに興味を持ち、パイロットの免許を取った。She (    )(    )(    )(    ) and earned her pilot's license.","31私たちは彼が戻ってくることを確信している。We (    )(    )(    )(    )(    ) back.",

             "32#その農場主は雄牛を買うことに興味がなかった。The farmer (    )(    )(    )(    ) a bull.","33私は雪のせいで学校に遅刻することを心配した。I (    )(    )(    )(    ) late for school because of the snow.",

             "34彼は父親に怒られることを恐れている。He (    )(    )(    )(    ) sclded by his father.","35私は昨晩その騒音のために眠れなかった。The noise (    )(    )(    )(    ) last night.",

             "36ネイティブスピーカーでない人が単純化された表現を使わざるを得ない場合、ネイティブスピーカーは彼らを見下すことがある。Native speakers sometimes look down on non-native speakers when they (    )(    )(    )(    ) simplified expressions.","37そのニュースを聞いたとき、私は泣かずにはいられなかった。I (    )(    )(    ) when I heard the news.",

             "38#私はサリーがたった一人でハイキングに行くのは悪い考えだと思った。だから私は彼女を説得してそれをやめさせようとした。I thought it was a bad idea for Sally to go hiking all alone, so I tried to (    )(    )(    )(    )(    ).","39私はあのうるさいネコが私の庭に入って来るのをやめさせることができない。I cannot (    )(    )(    )(    )(    )(    ) into my garden.",

             "40重大な事故のためイベントは実施されなかった。The serious accident (    )(t   )(    )(    )(    ) place.","41その恐ろしい自動車事故を見て、私は衝撃を受けずにはいられなかった。I (    )(    )(    ) shocked when I saw the terrible car accident.",

             "42マイクがいつ着くかは分からない。(    )(    )(    )(    ) when Mike will arrive.","43私を納得させようとしても無駄だ。(    )(n   )(    )(    ) to convince me.",

             "44ジョージのミスを強調しても無駄だ。それは単に状況を悪化させるだけだ。(    )(    )(    )(p   )(    )(e   ) George's mistakes; it just worsens the situation.","45彼に怒鳴っても無駄だ。(    )(    )(    )(    )(    ) at him.",

             "46将来何が起こるか分からない。(    )(    )(    )(    ) what will happen in the future.","47君のもとを離れることはできない。(    )(    )(    )(    ) you.",

             "48彼女に話しかけても無駄だった。(    )(    )(    )(    )(    ) to her.","49彼女は有名な俳優とディナーを共にしているところを見られた。She (    )(    )(    ) dinner with a well-known actor.",

             "50隣の部屋で何かが焦げているにおいがしませんか？Don't you (    )(    )(    ) in the next room?","51 その歌が日本人の歌手に歌われるのを聞いたことがありますか？Have you ever (    )(    )(    )(    ) by a Japanese singer?",

             "52彼女は後ろから力強い腕でつかまれるのを感じた。She (    )(    )(s   ) by a strong arm from behind.","53私がその話をした時、私は彼がほほ笑んでいるのに気付いた。When I told the story, I (    )(    )(    ).",

             "54私は独り言を言っているのを聞かれた。I was (h   )(    ) to myself.","55私の祖父は私たちが野球をしているのを見るのが好きだった。My grandfather liked to (    )(    )(    ) baseball.",

             "56私は息子を庭で遊ばせっぱなしにしておいた。I (    )(    )(    )(    ) in the yard.","57私は駅で約30分待たされ続けた。I (    )(    )(    ) for about thirty minutes at the station.",

             "58私はいつも自分の携帯電話のスイッチを切ったままにしてある。I always (    )(    )(    )(t   ) off.","59#彼はいつも自分の仕事を中途半端なままにする。He always (    )(    )(    )(h   )(    ).",

             "60私は彼をそんなにも長く待たせ続けたことを申し訳なく思った。I felt so sorry to have (    )(    )(    ) for so long.","61彼らは普段、日中はそのドアにカギをかけておく。 They usually (    )(    )(    )(    ) during the day.",

             "62彼はその絵を１時間、日光にさらしておいた。He (    )(    )(    )(    ) to the sun for an hour.","63私は今、家を塗装してもらっているところだ。 I (    )(    )(m   )(    )(    ) now.",

             "64私は明日の朝までにそれを終えてしまうつもりだ。I will (    )(    )(    ) by tomorrow morning.","65私はサッカーをしている最中に足を折ってしまった。I (    )(    )(    )(    ) while playing soccer.",

             "66彼はドアに傘をはさまれてしまった。He (    )(    )(    )(    ) in the door.","67私はあなたにこの仕事を今してしまってほしい。I want you (t   )(    )(    )(    )(    ) now.",

             "68#彼らは自分たちの要望が完全に無視された。they (    )(    )(    )(    ) completely.","69私は彼らに部屋を掃除してもらうつもりだ。I will (    )(t   )(    )(    ) by them.",

             "70カギとなるのは、どのようにこれを潜在的なユーザーに知らせる(知ってもらう)かということだ。The key is how to (    )(    )(    ) to the potential users.","71あなたはフランス語で理解してもらえますか？Can you (    )(    )(    ) in French?",

             "72私のめいはいつも部屋をきれいにしている。My niece always (    )(    )(    )(t   ).","73毎日これらの花の手入れをすると、生活はとても楽しいものとなる。Taking care of these flowers every day (    )(    ) so (e   )",

             "74私はどうにかしてジェスチャーで自分のことを理解してもらえた。I managed to (    )(    )(    ) with gestures.","75 どうやって仕事で自分を認めてもらえるだろうか？How can I (    )(    )(    ) in my job?",

             "76旅行者たちがダイビングを楽しんでいるのを見て彼は幸せになった。It (    )(    )(    ) to see the tourrists enjoying diving.","77彼は昔のビートルズの歌を歌いながらその道を歩いて行った。He walked along the street, (    ) an old Beatles' song.",

             "78１８６６年に、ダイヤモンドが南アフリカのキンバリーで発見され、世界で最初のダイヤモンドラッシュを引き起こした。In 1866, diamonds were discovered in Kimberley, South Africa, (s   ) the world's first diamond rush.","79 仕事を終えて、私たちは家に歩いて帰った。(    )(    ) our work, we walked back home.",

             "80多額の借金があるが、彼はそれについて気にしていないようだ。(T   )(    ) a large amount of debt, he doesn't seem to care about it.","81気分がよくなかったので、私は家にいることに決めた。(    )(    )(w   ), I decided to stay at home.",

             "82そのボトルを開けて、彼女は錠剤を１つ取り出した。(    )(    )(    ), she took out one pill.","83 その列車は６時に京都を出て、９時ごろに東京につく。The train leaves Kyoto at six, (    )(    ) Tokyo at nine or so.",

             "84一人ぼっちにされて、その少年は泣き出した。(    ) alone, the boy began to cry.","85何百人もの警官に付き添われながら、彼らはその道をパレードした。They paraded along the street (    ) by hundreds of police officers.",

             "86字が読めないので、彼はその手紙に何が書いてあるのかが理解できなかった。(    ) to read, he couldn't understand what the letter said.","87１８世紀後半から１９世紀にイギリスは最初の工業国となり、ドイツとアメリカがこれに続いた。Great Britain became the first industrialized nation in the late eighteenth and nineteenth centuries, (f   ) by Germany and the United States.",

             "88群衆に囲まれて、ハンサムな少年が歌っていた。A handsome boy was singing (    )(    ) a crowd.","89東京での生活と比べると、オクラホマでの生活は多くの点で不便だ。(    )(    ) life in Tokyo, life in Oklahoma is inconvenient in many ways.",

             "90助けを求めるのに乗り気でなくて、私は自分でそれをしようと決めた。(R   )(    )(    ) for help, I decided to do it by myself.","91霧がとても濃かったので、誰も山頂を見ることが出来なかった。No one was able to see the top of the mountain, (    )(    )(    ) very thick.",

             "92右手で岩をつかみながら、彼はその花を取ろうとして左手を伸ばした。He reached for the flower with his left hand, (h   )(    )(    )(g   ) the rock.","93その試合が終わったので、多くの観客は駅に急いだ。(    )(    )(    ) over, many spectators rushed to the station.",

             "94月が昇ったので、私たちは散歩に出かけた。(    )(    )(    )(    ), we went for a walk.","95日が暮れたので、私たちは家に急いだ。(    )(    )(    )(    ), we hurried home.",

             "96他の条件が同じならば、彼はレースに勝つだろう。(    )(    )(b   )(    ), he will win the race.","97外はひどく寒かったので、私は家にいた。It (    )(    )(    )(    ), I stayed at home.",

             "98一般的に言うと、夏の風邪と冬の風邪は異なるウイルスによって引き起こされる。(    )(    ), summer and winter colds are caused by different viruses.","99看護師になるための勉強に何年費やしましたか？(H   )(    )(    ) did you (    )(    ) how to be a nurse?",

             "100若いことを考えれば、彼はどんどん向上できるよ。(C   ) he is young, he can improve himself rapidly.","101彼の経験が浅いことを考慮に入れると、彼は素晴らしい仕事をした。(G   )(    ) he is inexperienced, he has done an excellent job.",

             "102率直に言えば、私はこの事業は成功しそうにないと思う。(F   )(    ), I think this project is not likely to succeed.","103彼の見た目から判断すると、彼は病気のようだ。(J   )(    )(    )(    ), he seems sick",

             "104彼はあまりにも多くの時間をテレビゲームをすることに費やした。He (    )(    )(    )(    )(    ) video games.","105その犬はしっぽを振りながらそこに座っていた。The dog was sitting there (    )(    )(    )(    ).",

             "106彼は急に振り向くと、目に涙をためて、部屋から走り去った。Turning suddenly, (    )(    )(i   )(    )(    ), he ran out of the room.","107彼は腕を組んでそういった。He said so (    )(    )(    )(f   ).",

             "108彼女は肩に鳥を乗せてその部屋に入ってきた。She came into the room (    )(    )(    )(    )(    )(    ).","109メグは目を輝かせながら私の話を聞いた。Meg listened to me (    )(    )(    )(    ).",

             "110エアコンが壊れていたので、私たちは部屋を涼しくしておくことができなかった。(    ) the air-conditioner (    ), we couldn't keep the room cool.","111食卓に着いている時は、口をいっぱいにして喋ってはなりません。Don't speak (    )(    )(    )(    ) when you are at the table.",

             "ex0 You should be careful when crossing the street./You should be careful (   e)(    ) the street.","ex1 As soon as I heard the crash, I rushed out of the house. / (    )(    ) the crash, I rushed out of the house.",

             "ex2"]



export const answer45 = ["0 by not being ","1 without saying","2 without even complaining(さえ、に注目)","3 without anybody knowing","4 by listening to","5 by reading / translating them","6 without lose something",

            "7 in understanding","8 when shooting","9 On hearing","10 On being","11 In doing","12 On opening","13 On hearing",

            "14 for fear of hurting","15 for the purpose of building","16 instead of just studying","17 in danger of being","18 for the purpose of studying","19 with the view to buying","20 In addition to hiring",

            "21 is looking forward to taking","22 looks forward to having","23 is worth learning","24 is worth going","25 looking forward to","26 are looking forward to","27 is worth reading",

            "28 am / used to writing","29 became good at playing","30 became interested in flying","31 are sure of his coming","32 wasn't interested in keeping","33 was worried about being","34 is afraid of being",

            "35 kept me from sleeping","36 cannot help but use","37 couldn't help crying","38 talk her out of it","39 stop that noisy cat from getting","40 prevented the event from taking","41 couldn't help being",

            "42 There is no telling","43 It's no use trying","44 There is no point in emphasizing","45 There is no use shouting","46 There is no telling","47 There is no leaving","48 It was no use talking",

            "49 was seen having","50 smell something burning","51 heard that song sung","52 felt herself seized","53 noticed him smiling","54 heard talking","55 watch us playing",

            "56 left my son playing","57 was kept waiting","58 keep my cellphone turned","59 leaves his work half done","60 kept him waiting","61 keep the door locked","62 left the picture exposed",

            "63 am having my house painted","64 get it finished","65 got my leg broken","66 had his umbrella caught","67 to get this work done","68 had their requests ignored","69 get the room cleaned",

            "70 make this known","71 make yourself understood","72 makes the room tidy","73 makes life / enjoyable","74 make myself understood","75 make myself recognized","76 made him happy",

            "77 singing","78 sparking","79 Having finished","80 Though having","81 Not feeling well","82 Opening the bottle","83 arriving at",

            "84 Left","85 accompanied","86 Unable","87 followed","88 surrounded by","89 Compared with","90 Reluctant to ask",

            "91 the fog being","92 his right hand grasping","93 The match being","94 The moon having risen","95 The sun having set","96 Other things being equal","97 being terribly cold outside",

            "98 Generally speaking","99 How many years / spend learning","100 Considering","101 Given that","102 Frankly speaking","103 Judging from his appearance","104 spent too much time playing",

            "105 with his tail waving","106 with tears in his eyes","107 with his arms folded","108 with a bird on her shoulder","109  with her eyes shining","110 With / broken","111 with your mouth full",

            "ex0 while crossing※whenをwhileに言い換える事の知識","ex1 On hearing※on doing(～するとすぐに)の類義語としてas soon asを用いている",

            "ex2"]




export const problem810 = ["0 ここが私たちが美しい景色を楽しみながら冬を過ごす山荘だ。This is the cottage (    ) we spend the winters enjoying the beautiful scenery.","1 あなたがこの仕事を成し遂げられる唯一の方法は、プロのコンサルタントからアドバイスを得ることだ。(    )(    )(    )(    ) you can accomplish this task is to get advice from professional consultants.",

              "2 彼女の話し方は私に彼女のお母さんを思い出させる。(    )(    ) she speaks reminds me of her mother.","3 その映画の中の、警官が強盗を見つけるシーンを覚えていますか？Do you remember the scene in the movie (    ) the police officer finds the robber?",

              "4 私は家族と2匹の犬と一緒に暮らせる家を探している。I am looking for a house (    )(    )(    ) live with my family and two dogs.","5 私は父親が大阪に転勤になった年に生まれた。I was born in the year (    ) my father was transferred to Osaka.",

              "6 彼女は自分がそんなにも忙しい理由を私に言わなかった。She didn't tell me (t   )(    )(    ) she was so busy.","7ジョンソン氏は的確な決断をするのが速く、それが彼が友人たちから尊敬されている理由だ。Mr. Johnson is quick to make good decisions, and (    )(    )(    ) he is looked up to by his friends.",

              "8 その美術館は、私たちが滞在していた場所から遠くない所にあった。The art museum was not far (    )(    ) we were staying.","9 ここが、私が子供だった時に地元の図書館があった場所だ。(    )(    )(    ) the local library used to be when I was a child.",

              "10 こんなふうにしてその爆発は起こった。This is (    ) the explosion happened.","11 妻が病気で私が看病をする必要があった。そんなわけで私はそのパーティーに行けなかった。My wife was sick and I needed to take care of her. (    )(    )(    ) couldn't attend the party.",

              "12# こんなふうにしてジョブス氏はパソコンビジネスで成功した。(    )(    )(    ) Mr. Jobs succeeded in the personal computer business.","13 彼が住んでいる場所は小さな町だ。(    )(    ) lives is a small town.",

              "14 これが私が最も必要としているものだ。(    )(    )(    ) I need most.","15 私はあなたが言ったことの大部分に賛成するが、全部には賛成できない。I agree with (    )(    )(    ) you said, but I don't agree with everything.",

              "16 彼は本当に魅力的で、さらにいいことに、お金持ちだ。He is really attractive, and (    )(    )(    ), he is rich.","17 とても遅い時間になってきていて、さらに悪いことに、風が吹き始めた。It was getting very late, and (    )(    )(    ), the wind started to blow.",

              "18# 彼は自分の国の外で起こっていることには何の興味も示さなかった。He showed no interest in (    )(    )(    ) outside his country.","19 私は彼が書いたものを全部読みたい。I want to read (    )(    )(    ) he wrote.",

              "20# 彼女はその賞を獲得し、さらに名誉なことに、王様自身が彼女にメダルを授けた。She won the prize, and (    )(    )(    )(h   ), the king himself gave her a medal.","21デイビッドは、自分はその事件と何の関係もないと言ったが、それは信じがたい。David said he had nothing to do with the incident, (    )(    )(h   ) to believe.",

              "22 朝に私は自分の犬を公園で散歩させたが、それは私が予想していたよりも楽しかった。In the morninng, I walked my dog in the park, (    )(    )(    ) fun than I had expected.","23 私は健康状態が悪くなり、このため私は仕事をやめることになった。My health got worse, (    )(    ) me to quit my job.",

              "24# 彼女は彼に、あなたとは結婚したくないと言ったが、私に言わせれば、そんなことを言うなんて彼女は浅はかだった。She told him that she didn't want to marry him, (    )(    )(    )(    ) was silly of her.","25 私は彼女の言語で彼女に話しかけ、これが彼女を大いに喜ばせた。I talked to her in her language, (    )(    ) her a lot.",

              "26 ジャックはその入試を突破し、この事で彼のお母さんはとても幸せになった。Jack passed the entrance exam, (    )(    ) his mother very happy.","27# 私の隣人の犬が一晩中吠え続けた。このため私は眠れないままだった。My neighbor's dog kept barking all night, (    )(    )(    ) awake.",

              "28# ケンにはよくあることだが、彼は締め切りまでに宿題を提出しなかった。(    )(    )(    )(    )(    )(    ) him, Ken did not submit his homework by the deadline.","29 彼のなまりから明らかなように、彼は大阪出身だった。He was from Osaka, (    )(    )(    ) from his accent.",

              "30 この例からわかるように、文化の違いは異なる国出身の2人の関係において、大きな障害になりうる。(    )(    )(    ) see from this example, differences in culture can be a great obstacle in a relationship between two people from different countries.","31よく言われてきたことだが、社会から切り離された個人は、言葉が話せないし、思考能力もなくなるだろう。(    )(    )(    ) well said, the individual apart from society would be bothspeechless and mindless.",

              "32 皆に知られていることだが、地球温暖化は悪化しつつある。(    )(    )(    ) to everybody, global warming is getting worse.","33 この表から明らかなように、がんは第一位の死亡原因だ。Cancer is the leading cause of death, (    )(    )(o   ) from this chart.",

              "34 彼の顔からわかるように、彼は幸せではない。(    )(    )(    )(    ) from his face, he isn't happy.","35 ネットサーフィンをすることは必ずしも悪いことではない。Surfing the Internet (    )(    )(    ) bad.",

              "36 ある言語の母語話者だということは、その人がその言語において効果的にコミュニケーションができるということを常に意味するとは限らない。Being a native speaker of a language (    )(    ) mean you are an effective communicator in that language.","37 小説家レオ・トルストイは「誰もが世界を変えることを考えているが、誰も自分自身を変えようとは考えていない」と述べた。Novelist Leo Tolstoy observed, 「Everyone thinks of changing the world, but (    )(    )(    ) of changing himself」",

              "38 彼の主張は、進化の連なりは長く、また、視点が全く明らかではないということだ。His point is that the chain of evolution is long and has (    )(c   ) beginning.","39 どちらの志願者も指定の様式を使用しなかった。 (    )(    ) the two applicants employed the designated style.",

              "40 私はその子供の両方は知らない。I (    )(    )(b   ) of the kids.","41# 図書館にはどんな飲み物も持ち込めません。You (    )(    )(    )(    ) drinks into the library.",

              "42 花を愛さない人は一人もいない。There is (    )(    ) who does (    ) love flowers.","43 日本人が電話中にお辞儀をしているのを目にするのは珍しいことではない。 It's (    )(u   ) to see a Japanese person bowing while on the telephone.",

              "44 真剣になり情熱を持てば、不可能なことなど何もないのではないでしょうか。I would say that (    )(    )(    ) if you are serious and have passion.","45 私はこの写真を見ると必ず田舎での幸せな日々を思い出す。 I (    ) see this photo (    ) being reminded of my happy days in the countryside.",

              "46 この場所を訪れると必ず、亡くなった祖母のことを思い出す。I can (    ) visit this place (    )(t   ) of my late grandmother.","47 彼を愛していない人は一人もいなかった。 There was (    ) who was (    ) in love with him.",

              "48 男性と女性はしばしばとても異なる視点を持つので、子育てに関して夫婦が意見を異にすることは珍しくない。Since men and women often have very different viewpoints, it is (    )(un  ) for couples to differ in opinion about child-raising.","49 この論点からすれば、科学技術は脅威ではなく機会の源だ。From this point of view, technology (    )(    ) a threat (    ) a source of oppotunity.",

              "50 お金が欲しいからではなく、自分の世界を表現したいから私は絵を描いている。I'm painting (    )(    ) I want money (    ) because I want to express my world.","51 これらのマンホールのふたは地元の十人の注目を集めただけでなく、観光に訪れている人たちをも魅了した。These manhole covers (    )(    ) caught the attention of local residents, (    )(    ) attracted visiting tourists.",

              "52 コロナウイルスの発生は、人々の結びつき方だけでなく、消費者の買い物の仕方も変えた。The coronavirus outbreak has altered (    )(    ) how people connect, (    )(    ) how consumers shop.","53 このダイヤモンドの指輪は本物であって、模造品ではない。This diamond ring is (g   ), (    ) fake.",

              "54 彼はギターだけでなくピアノも弾ける。He can play (    )(    ) the guitar (    )(    ) the piano.","55 彼女は返事をせずにテーブルの上に本を置いて去っていった。She (    )(    ) answer (    ) put the book on the table and left.",

              "56 妻と私はめったに豚肉を食べない。 My wife and I (s   )(    )(    ) pork.","57 父は公務員でいつもとても遅く帰宅したので、私はめったに父と会話をしなかった。My dad was a public servant and always came home very late, and so I (    )(    )(    ) a conversation with him.",

              "58 バスにはほとんど誰もいなかった。 There were (    )(    ) people on the bus.","59 スミス氏は身勝手な人なので、彼はめったに妻の家事を手伝わない。Since Mr. Smith is a selfish man, he (    )(    )(h   ) his wife with the housework.",

              "60 土曜日のキャンパスにはほとんど学生がいなかった。There were (    )(    ) students on campus on Saturday.","61 彼はめったに酒を飲んだりタバコを吸ったりしない。He (    )(    )drinks or smokes.",

              "62 その候補が選挙に勝つ見込みはほとんどない。There is (    )(    )(    ) that the candidate will win the election.","63 私たちが食事をするために座るとすぐに玄関のベルが鳴った。We had (    )(    ) sat down to eat (    ) the doorbell rang.",

              "64 私たちが空港に着くとすぐに私たちの便は悪天候のために欠航になった。(    )(    ) had we arrived at the airport (    ) our flight was cancelled due to bad weather.","65 夜が明け始めるとすぐに激しい嵐が起こった。The day had (    ) begun to dawn (    ) a violent storm arose.",

              "66 その先生が教室に入るとすぐにすべての学生はおしゃべりをやめた。(    )(    ) the teacher entered the classroom (    ) all the students stopped chatting","67 私がその部屋に入るとすぐに電話が鳴った。(    )(    ) had I entered the room (    ) the phone beeped.",

              "68 彼が走り出るとすぐにそのビルは倒壊した。(S   )(    ) he run out (    ) the building collapsed.","69私たちがホテルにチェックインするとすぐに雨が降り出した。We had (    ) checked in at the hotel (    ) it began to rain.",

              "70 彼は自分の将来の計画が非現実的な幻想にすぎないと悟ったのであきらめた。He gave up because he realized that his plans for the future were (    )(    ) romantic fantasies.","71 私はその候補が自分の政策について語るのを聞いて、彼は理想的なリーダーからは程遠いと思った。I listened to the candidate talking about his policies and thought that he was (    )(    ) an ideal leader.",

              "72 君のフライトは9時に出発だから、空港に向かうのをこれ以上遅らせないほうがいい。Your flight departs at 9 o'clock, so you had better (    ) delay leaving for the airport (    )(    ).","73 私はこれ以上歩けない。I can (    ) walk (    )(    ).",

              "74 息子は朝から晩まで携帯電話ゲームをしてばかりいる。My son does (    )(    )(    ) mobile games from morning till night.","75 私はその騒音にもはや耐えられなかった。I (    )(p   )(    ) with the noise (    )(    ).",

              "76 彼は英雄どころではない。He is (    )(    ) a hero."]



export const answer810 = ["where","The only way that","The way","where","where I can","when","the reason why",

"that is why","from where","This is where","how","That's why I","This is how","Where he",

"This is what","most of what","what is better","what was worse","what was happening","all of what","what is more honorable",

"which is hard","which was more","which caused","which in my opinion","which pleased","which made","which kept me",

"As is often the case with","as was clear","As you can","As has been","As is known","as is obvious","As can see",

"is not necessarily","doesn't always","no one thinks","no clear","Neither of","don't know both","can not bring any",

"not anyone not","not uncommon","nothing is impossible","never without","never without thinking","nobody not","not unusual",

"is not but","not because but","not only but also","not just but also","genuine not","not just but also","did not but",

"scarcely ever eat","hardly ever had","hardly any","hardly ever helps","scarcely any","hardly ever","hardly any chance",

"no sooner than","No sooner than","hardly before","Hardly had when","No sooner than","Scarcely had before","scarcely before",

"nothing but","anything but","not any longer","not any more","nothing but play","couldn't put up any longer","anything but"]



export const problem1213 = ["0 大事なのは結果だ。(    )(    )(    )(t   ) count.","1 人間が寒い北の地域に定住することを可能にしたのは、火を思い通りに扱えるようになったことと、衣類の着用だった。(    )(    )(    )(c   )(    )(    ) and (    )(    )(    )(c   )(    ) allowed humans to settle in the cold northern areas.",

               "2 私がこれから話そうとしているのは、この車についてだ。(    )(    )(    )(    ) I'm going to talk about.","3# 私に欠けているものは富だけだ。(    )(    )(    )(    )(t   ) I lack.",

               "4# 私の成功の多くはまさに妻のおかげです。(    )(    )(    )(    )(w   ) I owe a lot of my success to.","5 私たちが一番大切にしているのはこの絵だ。(    )(    )(    )(    ) we treasure most.",

               "6 その事故に責任があるのは君ではなくもう一方のドライバーだった。 (    )(    )(    )(    )(b   ) the other driver (    ) was responsible for the accident.","7 鉄が初めて道具に用いられたのは西アジアだった。(    )(    )(    ) West Asia (    ) iron was first used for tools.",

               "8 1902年になって初めていくつかのイギリスの裁判所が指紋の証拠を使い始めた。(    )(    )(    )(    ) 1902 (    ) some British courts began to use fingerprint evidence.","9# 私が学校に遅れたのはその事故のためだ。(    )(    )(    )(    )(t   )(a   )(    ) I was late for school.",

               "10 高校を卒業して初めて私は自分自身を愛し、受け入れ始めた。(    )(    )(    )(    ) I graduated from high school (    ) I started to love and accept myself.","11 彼のもとを訪れて初めて私は彼がどれほど具合が悪いかがわかった。(    )(    )(    )(    ) I (v   ) him (    ) I realized how ill he was.",

               "12 何も無駄にしないことの価値を私が学んだのは父からだった。(    )(    )(    ) my father (    ) I learned the value of not wasting anything","13# 私がその事件について聞いたのは帰宅後だった。(    )(    )(    )(    ) got home (    ) I heard about the incident.",

               "14 彼女は疲れていたが、それでも自分の仕事を終えることができた。(    )(    )(    )(    ), she was still able to finish her work.","15 私たちは速く走ったが、その電車に乗り遅れた。(    )(    )(    )(    ), we missed the train.",

               "16 遅い時間だったが、私たちは友達のもとを訪れることに決めた。(    )(    )(    )(    ), we decided to visit our friends.","17 彼は眠かったので、その問題を上手に説明することができなかった。(    )(    )(    )(    )(    ), he couldn't explain the problem well.",

               "18 あなたを助けたいのはやまやまだが、あまりに忙しいんだ。(    )(    )(    )(    )(    )(t   ) help you, I'm too busy.","19 その問題は難しいが、解決した場合の報酬は非常に大きい。(A   )(    )(    )(    )(    )(    ), the reward for solving it is enormous.",

               "20 奇妙に思われるかもしれないが、その火事で誰もケガをしなかった。(    )(    )(    )(    )(    ), nobody was injured in the fire.","21 川岸は砂地で、その奥にはうっそうとした森があった。The river banks were sandy, and (    )(    )(    )(    )(    ).",

               "22 わずか２０歩離れたところに大きなオオカミがおり、罠にかかっていた。(    )(    )(    ) 20 steps away (    )(    )(    )(    ) -- caught in a trap.","23 雲の後ろから月が現れた。(    )(    ) the cloud (    ) the moon.",

               "24 美しい白猫が壁を登って超えていった。(    ) the wall (    )(    )(    ) white cat.","25 ほら消防車が来たよ。(    )(    ) the fire engine.",

               "26 テーブルの上には３つの品物がある。(    )(    )(    )(    ) three items.","27 ニューヨークのモルガン・ライブラリーには中世やルネサンスの本のコレクションがある。In the Morgan Library (    ) New York (    )(    )(    )(    ) medieval and renaissance books.",

               "28 私は彼が１等賞を取るとは思ってもみなかった。(    )(    )(    )(    ) he would win first prize.","29 帰宅して初めて私は事務所のドアに鍵をかけ忘れたことに気付いた。(O   )(    ) I (g   )(    )(d   )(    )(    ) that I forgot to lock my office door.",

               "30 父は何があっても私が父の車を使うことを許さないだろう。(    )(    )(    )(    ) my father (l   ) me use his car.","31 サルは数歳になって初めて母親から独立する兆しを見せ始める。(    )(    ) a monkey several years old (    )(    )(    ) to exhibit signs of independence from its mother.",

               "32 教会の聖歌隊からこんなにも美しいコーラスを聞くことはめったにない(S   )(    )(    )(    )(    ) a beautiful chorus from church choirs.","33 初代のスペースシャトルを見ることができるのはこの博物館だけです。(    )(    )(    )(    )(    ) you see the first space shuttle",

               "34 彼は一言もしゃべらなかった。(    )(    )(    )(    ) he speak.","35 彼らは自分たちの地域を誇りに思っていないし、自分たちの環境をよりよくするために何もしていない。They do not take pride in their area, (    )(    )(    )(    ) anything to improve their environment.",

               "36 食べ物を分け合いたくない人もいるが、私もそうだ。Some people don't want to share their food, (    )(    )(    )(    ).","37 姉とその友達はパニックになったが、私もだった。My sister and her friend panicked -- (    )(    )(    )(    ).",

               "38 「彼女は親切だね。」　「まったくだ。」”She is so kind.”-- ”(    )(    )(    ).”","39 この動物は嗅覚がよくないが、目も良く見えない。This animal doesn't have a good sense of smell, (    )(    )(    )(    ) well.",

               "40 彼女は授業に遅れたことが一度もないが私もない。She has never been late for class (    )(    )(    )(    ).","41 冬期、ロシアは極めて寒い国だが、フィンランドもだ。In the winter Russia is an extremely cold country, (    )(    )(    ) Finland.",

               "42 彼女の体調が悪いのはとても明らかだった。(    )(p   )(    )(    )(    ) that she was out of shape.","43 この事に負けず劣らず重要なのは、その製品を広く宣伝することだ。(N   )(    )(    )(    )(    )(    ) to advertise the product widely",

               "44 ステージの上で歌っていたのは私の担任の先生だった。(    )(    )(    )(    )(    ) my homeroom teacher.","45 アメリカのある大学の図書館の入口の上にこんな標語が刻み込まれている。「知識の半分はそれをどこで見つければ良いかを知ることだ。」(En  )(    )(     )(    )(    ) the library (    ) an American university (    )(    )(    ): 「Half of knowledge is knowing where to find it.」",

               "46 全員に明らかだったのは、彼の存在の重要性だ。(    )(    )(    )(    )(    )(i   ) of his existence","47 何も期待しない人は幸せだ。というのも、その人は決して落胆しないからだ。(    )(    )(    ) who expects nothing, for he will never be disappointed.",

               "48 その交通事故で死んだのはメグという名の少女だった。(K   )(    ) the traffic accident (    )(    )(    ) named Meg.","49 私たちは、彼の全ての作品は政府によって買い上げられたと告げられた。All his works, (    )(    )(    ), were bought by the government.",

               "50 おじいちゃんは、いつものことだったが、イヌを散歩に連れ出した。Grandpa, (    )(    )(u   )(    )(    ), took the dog out for a walk.","51 アリスは、どこでその本を見つければいいか分からず、お母さんにその本がどこにあるかを尋ねた。Alice, (    )(    )(    )(    )(    ) the book, asked her mother where the book was.",

               "52 トムは、自分のしてしまったことに恐れをなして、最初は何も言えなかった。Tom, (h   )(    )(    )(    )(    )(    ), could at first say nothing.","53 私はあなたの息子さんはこの分野で成功すると固く信じている。Your son, (    )(f   )(    ), will succeed in this field.",

               "54 彼女のお母さんは病気で入院しているようだ。Her mother, (    )(    ), is sick in the hospital.","55 うちの息子は、家にいるよう説得されて、外出するのをあきらめた。My son, (p   )(    )(    )(    ), (    )(    ) going outdooors.",

               "56 彼はバスを待っている間、新聞を読んで時間をつぶした。He killed time by reading a newspaper (    )(    )(    )(    ) bus.","57 病気だろうと体調がよかろうと、彼女はいつも快活だ。(W   )(    )(    )(    ), she is always cheerful.",

               "58 悪い癖は、一度つくと簡単には取れない。A bad habit, (    )(    ), cannot easily be got rid of.","59 ティーンエージャーのとき、彼女は家族とともにリバプールに引っ越した。(    )(    )(h   )(    ), she moved with her family to Liverpool.",

               "60 訪問者はビルに入る許可を得る前にこの用紙に記入をしなければならない。Visitors must fill in this form (b   )(p   )(    )(    ) the building.","61 その老女はその道を渡ろうとしていた時に車にはねられた。The old woman was hit by a car (w   )(a   )(    )(    ) the road.",

               "62 たとえ疲れていても私は一晩に５時間しか寝ない。I sleep only five hours a night (    )(    )(    ).","63 万が一雨が降ったら、私たちは最初の晴れた日曜日まで試合を延期するつもりだ。(    )(    )(    ), we'll postpone the game till the first fine Sunday.",

               "64 もし私がもっとお金を持っていたら、もっといい車を買っただろう。(    )(    )(    ) more money, I would have bought a better car.","65# 音楽が無ければ人生はつまらないだろう。Life would be boring (    )(    )(    )(    ) music.",

               "66 その嵐が無かったら、私たちのフライトは時間通りに着いただろう。(    )(    )(    )(    )(    ) the storm, our flight would have arrived on time.","67 スピード違反をしていなければ、ジャックはその衝突事故を避けることができただろう。Jack could have avoided the crash (    )(    )(    )(    )(s   ).",

               "68 私があなたなら、違った道を選ぶだろう。(    )(    )(    ), I would choose a different path.","69 明日万が一雪が降ったら、試合は延期されるだろう。(    )(    )(    )(    ), the game will be postponed.",

               "70 私は父が重病で入院しているという知らせを受けた。I received (    )(    )(    ) my father was seriously ill in the hospital.","71 彼は怠惰だという理由で解雇された。He was fired (    )(    )(    )(    ) he was lazy.",

               "72 人々は他人を誤解する傾向がある。その結果、何気ないコミュニケーションさえ避けるようになる。People tend to misunderstand others, (    )(    )(    )(    ) they come to avoid even casual communication.","73 漂白剤を飲むことが、そのウィルスに対する治療法だといううわさが流れた。There emerged (    )(    )(    ) drinking bleach is a cure for the virus.",

               "74 自分が失敗するかもしれないということは彼には思いもよらなかった。(    )(p   )(    ) he might fail never occurred to him.","75 その有名な歌手がコンサートを中止したというニュースは、彼のファンをがっかりさせるものだった。(    )(    )(    ) the famous singer canceled the concert was disappointing for his fans.",

               "76 ９時までに帰ってくるのならそのパーティーに行っていいよ。You can go to (    )(    )(    )(    )(    ) you come back by 9 o'clock","77 彼と彼の妻は、そのジャズクラブを閉めて東京郊外の静かな場所に引っ越すという大胆な決断をした。He and his wife made (    )(    )(    )(    )(    ) the jazz club and move to a quiet place outside of Tokyo.",

               "78 私は誰も気付つける意図はなかった。I had (    )(i   )(    )(    ) anyone.","79 デジタル情報は、故意の破壊だけでなく放置にも驚くほど弱いので、オンライン上に保存された知識は失われる危険にある。The knowledge stored online is (    )(    )(    )(    )(    ), as digital information is surprisingly vulnerable to neglect as well as deliberate destruction.",

               "80 １９６０年代半ばまでには、大企業はアフリカ系アメリカ人を雇うという決定をしていた。これらの企業は、全ての人に平等の機会を与えよという社会的要求にこたえていたのである。By the mid-1960s, major companies had decided to recruit African Americans. They were responding to (    )(d   )(    )(    ) equal opportunities to all.","81 社長とお会いする約束をしたいです。I'd like to make (    )(    )(    )(    ) the president.",

               "82 飲食をするという行為は、人間の営みの中心にある。(    )(a   )(    )(e   ) and (d   ) are central to human behavior.","83 アリスはいつもパイロットになりたいという野望を抱いていた。Alice always had (    )(    )(    )(    ) a pilot."]


export const answer1213 =  ["It's the results that","It was the control of fire the use of clothing that","It's this car that","It is only wealth that","It is my wife whom","It's this picture which","It was not you but who",
"It was in that","It was not until that","It was because of the accident that","It was not until that","It was not until visited that","It was from that","It was after I that",
"Tired as she was","Fast though we ran","Late as it was","As sleepy as he was","Much as I would like to","As difficult as the problem is","Strange as it may seem",
"behind them was dense forest","No more than was a huge wolf","From behind appeared","Over climbed a beautiful","Here comes","On the table are","in is a collection of",
"Little did I think","Only after got home did I realize","Under no condition will let","Not until does it begin","Seldom do we hear such","Only in this museum can","Not a word did",
"nor do they do","and neither do I","and so did I","So she is","nor can it see","and neither have I","and so is",
"Very plain was the fact","No less important than this is","Singing on the stage was","Engraved over the door of of is this motto","Clear to all was the importance","Happy is he","Killed in was a girl",
"we were told","as was usual with him","not knowing where to find","horrified at what he had done","I firmly believe","it seems","persuaded to stay home gave up",
"while waiting for the","Whether sick or well","once formed","When in her teens","before permitted to enter","while attempting to cross","even if tired",
"Should it rain","Had I had","were it not for","Had it not been for","had he not been speeding","Were I you","Should it snow tomorrow",
"the information that","on the grounds that","with the result that","a rumor that","The possibility that","The news that","the party on condition that",
"the bold decision to close","no intention of hurting","at risk of being lost","social demands to give","make an appointment to see","The acts of eating drinking","the ambition to become"
]




export const chemistry= ['ページ 79\n3 アルカリ金属の化合物\n(1)水酸化ナトリウム：化学式||NaOH||\n水によく溶け、水溶液は強い||塩基性||を示す。\n湿った空気中で水分を吸収して溶ける。このような現象を||潮解||という。\nまた、二酸化炭素を吸収して炭酸塩になる。\n2||NaOH|| + CO₂ → ||Na₂CO₃|| + H₂O\nこのように空気中の水分や二酸化炭素を吸収するので、密閉した容器に保存する。\n工業的には||塩化ナトリウム|| 水溶液の電気分解でつくる。','NaOH塩基性潮解NaOHNa₂CO₃塩化ナトリウム','(2)炭酸ナトリウム：化学式||Na₂CO₃||\n水によく溶け、水溶液はかなり強い||塩基性||を示す。\n十水和物の結晶を空気中に放置すると、水和物の大部分を失う。\nこのように結晶が自然に水和物を失う現象を||風解||という。','Na₂CO₃塩基性風解','(3)炭酸水素ナトリウム：化学式||NaHCO₃||\n水溶液は弱い||塩基性||を示す。\n加熱すると分解して||CO₂||を発生する。\n2NaHCO₃ → ||Na₂CO₃|| + H₂O + ||CO₂||','NaHCO₃塩基性CO₂Na₂CO₃CO₂','(4)アンモニアソーダ法(ソルベー法)：炭酸ナトリウムの工業的製法\n塩化ナトリウムの飽和水溶液に、アンモニアを吸収させた後、二酸化炭素を吹き込むと、比較的溶解度が小さい炭酸水素ナトリウムが沈殿する。\nNaCl + H₂O + NH₃ + CO₂ → ||NaHCO₃|| + ||NH₄Cl|| …①\n沈殿した炭酸ナトリウムを熱分解して、炭酸ナトリウムをつくる。\n2||NaHCO₃||→ Na₂CO₃ + H₂O + ||CO₂|| …②\n発生した||CO₂||は①の反応に利用する。不足分は石灰石の熱分解でつくる。\nCaCO₃ → ||CaO|| + ||CO₂|| …③\n③式で生成した||CaO||に水を加えて||Ca(OH)₂||にし、\n||CaO|| + H₂O → ||Ca(OH)₂|| …④\n①式の||NH₄Cl||と④式の||Ca(OH)₂||から||NH₃||をつくり、①式で利用する。\n2||NH₄Cl|| + ||Ca(OH)₂|| → CaCl₂ + 2H₂O + 2||NH₃|| …⑤','NaHCO₃NH₄ClCO₂CO₂CaOCO₂CaOCa(OH)₂CaOCa(OH)₂NH₄ClCa(OH)₂NH₃','ページ 80\n4 2族元素とアルカリ土類金属\n周期表の2族元素は、原子の価電子の数が||2||個であるから、||2||価の||陽||イオンになりやすい。\n||ベリリウムBeとマグネシウムMg||を除き、カルシウムCa、ストロンチウムSr、バリウムBa、ラジウムRaを、アルカリ土類金属という。\nCa Sr Ba Raキャッスルにバラ\n','22陽ベリリウムBeとマグネシウムMg','\n5 アルカリ土類金属の単体\nアルカリ土類金属の単体は、常温で水と反応して||H₂||を発生し、||水酸化物||になる。例えば、カルシウムの場合、水との反応の化学反応式は次のようになる。\nCa + 2H₂O → ||Ca(OH)₂|| + ||H₂||↑\nアルカリ土類金属も炎色反応を示す。色は次の通りである。\n * Ca….||橙赤||色\n * Sr….||深赤||色\n * Ba….||黄緑||色\n   ','H₂水酸化物Ca(OH)₂H₂橙赤深赤黄緑','\n6 アルカリ土類金属の化合物\n(1)酸化カルシウム：化学式||CaO||\n||生石灰||という。石灰石（主成分は炭酸カルシウム）を熱分解でつくる。\nCaCO₃ → ||CaO|| + ||CO₂||↑\n酸化カルシウムにコークス(炭素)を混ぜて電気炉で強く加熱すると、||炭化カルシウム(カーバイト)||ができる。\nCaO + 3C → ||CaC₂|| + CO\n塩基性の乾燥剤として用いる。水と反応すると、水酸化カルシウムになる。\nCaO + H₂O → ||Ca(OH)₂||\n酸化カルシウムは二酸化炭素とも反応し、炭酸カルシウムになる。\nCaO + CO₂ → ||CaCO₃||\nその他の手書き・図中のテキスト:\nCaO + 2HCl → CaCl₂ + H₂O||中和||\n↑||塩基性酸化物||\n','CaO生石灰CaOCO₂炭化カルシウム(カーバイト)CaC₂中和塩基性酸化物Ca(OH)₂CaCO₃','\nページ 81\n(2)水酸化カルシウム：化学式||Ca(OH)₂||\n||消石灰||ともいう。水に少し溶け、水溶液は強い||塩基性||を示す。\n水酸化カルシウムの水溶液(||石灰水||)に二酸化炭素を吹き込むと、水に溶けにくい炭酸カルシウムができるので、白濁する。\nCa(OH)₂ + CO₂ → ||CaCO₃||↓ + H₂O\nさらに二酸化炭素を吹き込むと、炭酸水素カルシウムとなって水に溶ける。\nCaCO₃ + H₂O + CO₂ → ||Ca(HCO₃)₂||\nこの水溶液を加熱すると、反応が逆方向に進み、ふたたび白濁する。\n鍾乳洞は、石灰岩（主成分：炭酸カルシウム）が長い年月をかけて二酸化炭素を含んだ雨に溶け、できたものである。\n','Ca(OH)₂消石灰塩基性石灰水CaCO₃Ca(HCO₃)₂','\n(3)炭酸カルシウム：化学式||CaCO₃||\n石灰石、大理石の主成分として広く天然に存在する。水に溶けにくい。塩酸と反応して、||CO₂||を発生する。\n||CaCO₃|| + 2HCl → ||CaCl₂|| + H₂O + ||CO₂||↑(弱酸の遊離)\n','CaCO₃CO₂CaCO₃CaCl₂CO₂','\n(4)硫酸カルシウム：化学式||CaSO₄||\n硫酸カルシウムの二水和物CaSO₄•2H₂Oは||セッコウ||とよばれる。約130℃で焼くと||CaSO₄||・||½H₂O|| となる。これを||焼き石膏||という。\n焼き石膏を水で練って放置すると、石膏にもどって固まる。このため、焼き石膏はギプスや美術工芸品に用いられる。\n','CaSO₄セッコウCaSO₄½H₂O焼き石膏','\n(5)塩化カルシウム：化学式||CaCl₂||\nアンモニアソーダ法の副生成物として多量にできる。無水物は潮解性があり、||中性の乾燥剤||として用いられる。(水と仲が良い)\n','CaCl₂中性の乾燥剤','\n7 アルカリ土類金属とマグネシウムの違い\n(1)アルカリ土類金属の単体は常温で||H₂O||と反応して||H₂||を発生するが、マグネシウムは反応しない。 マグネシウムは||熱水||となら反応する。単体が常温で水と反応する金属は、アルカリ金属とアルカリ土類金属である。\n(2)アルカリ土類金属は特有の||炎色||反応を示すが、マグネシウムは示さない。 炎色反応を示す金属は、アルカリ金属、アルカリ土類金属、銅である。\n**(3)アルカリ土類金属は酸化物が水に溶けて水溶液は強い塩基性を示すが、マグネシウムの酸化物は水に溶けにくい。**酸化物が水に溶けやすい金属は、アルカリ金属とアルカリ土類金属である。(酸化物の溶解は代替単体とおなじ。)\n(4)アルカリ土類金属は||硫酸塩||が水に溶けにくいが、マグネシウムの||硫酸塩||は水に溶けやすい。\nBa、Ca、Pb||硫酸塩||は水に溶けやすいが、アルカリ土類金属は例外である。\nBa、Ca　炭酸\n硫酸〇〇は溶けやすい。\n','H₂OH₂熱水炎色硫酸塩硫酸塩','\nページ 86\n第15講〉遷移元素とその化合物\n1 両性元素\n酸の水溶液とも強塩基の水溶液とも反応する性質を||両性||という。\n||両性元素||amphoteric elementとしては、||アルミニウムAl、亜鉛Zn、スズSn、鉛Pb||がよく知られている。\nあ(Al)あ(Zn)すん(Sn)なり(Pb)と両性に愛されて。\n','両性両性元素アルミニウムAl、亜鉛Zn、スズSn、鉛Pb','\n(1)アルミニウム：化学式||Al||\n周期表の||13||族の元素。イオンは||Al³⁺||。\nアルミニウムはイオン化傾向が大きく、酸化されやすい。空気中に放置すると、表面にち密な||酸化アルミニウム||の被膜ができ、内部を保護する。\nFe Ni Alは表面に不動態をつくり||濃硝酸||に溶けない。手にある(Fe)(Ni)(Al)ものは不動態。\n単体は、ボーキサイトから||アルミナ||(酸化アルミニウム)をつくり、||溶融塩電解||で製造する。\n陽極では、電極の炭素が酸化される。\nC + ||O²⁻|| → ||CO|| + ||2e⁻||\nC + 2||O²⁻|| → ||CO₂|| + ||4e⁻||\n陰極では、金属のアルミニウムができる。\n||Al³⁺|| + 3e⁻ → ||Al||\n※酸化アルミニウムの融点は2054℃と高いので、加熱して融解した氷晶石||Na₃AlF₆||に溶かし融点を下げて約1000℃で溶融塩電解する。\nアルミニウムは、酸と強塩基の両方の水溶液に溶け、||H₂||を発生する。\n2Al + 6HCl → ||2AlCl₃|| + 3||H₂||↑\n2Al + 2NaOH + 6H₂O → ||2Na[Al(OH)₄]|| + 3||H₂||\nただし、アルミニウムは、濃硝酸には||不動態||をつくって溶けない。\n2Na[Al(OH)₄]||テトラヒドロキシドアルミン酸||\n','Al13Al³⁺酸化アルミニウム濃硝酸アルミナ溶融塩電解O²⁻CO2e⁻O²⁻CO₂4e⁻Al³⁺AlNa₃AlF₆H₂2AlCl₃H₂2Na[Al(OH)₄]H₂不動態テトラヒドロキシドアルミン酸','\n(2)酸化アルミニウム(アルミナ)：化学式||Al₂O₃||\n水には溶けないが、両性酸化物なので、酸と強塩基の両方の水溶液に溶ける。\nAl₂O₃ + 6HCl → ||2AlCl₃|| + 3H₂O\nAl₂O₃ + 2NaOH + 3H₂O → ||2Na[Al(OH)₄]||\n','Al₂O₃2AlCl₃2Na[Al(OH)₄]','\n(3)水酸化アルミニウム：化学式||Al(OH)₃||\n||Al³⁺||を含む水溶液に、||NH₃水||や少量の||NaOH水溶液||を加えると白色ゼリー状(ゲル状)沈殿として生じる。\n水に溶けないが、両性水酸化物なので、酸と強塩基の両方の水溶液に溶ける。\nAl(OH)₃ + 3HCl → ||AlCl₃|| + 3H₂O\nAl(OH)₃ + NaOH → ||Na[Al(OH)₄]||\nテトラヒドロキソアルミン酸ナトリウム。\n','Al(OH)₃Al³⁺NH₃水NaOH水溶液AlCl₃Na[Al(OH)₄]','\nページ 87\n3 亜鉛とその化合物\n(1)亜鉛：化学式||Zn||\n電池の||負極||や黄銅(真鍮)などの合金の材料に使われる。イオンは||Zn²⁺||（p253見ろ）。\n亜鉛も両性元素なので、酸と強塩基の両方の水溶液に溶けて、||H₂||を発生する。\nZn + 2HCl → ||ZnCl₂|| + ||H₂O||\nZn + 2NaOH + 2H₂O → ||Na₂[Zn(OH)₄]||\nNa₂[Zn(OH)₄]||テトラヒドロキシド亜鉛(Ⅱ)酸ナトリウム||\n','Zn負極Zn²⁺H₂ZnCl₂H₂ONa₂[Zn(OH)₄]テトラヒドロキシド亜鉛(Ⅱ)酸ナトリウム','\n(2)酸化亜鉛：化学式||ZnO||\n水には溶けないが、両性の酸化物なので、酸と強塩基の両方の水溶液に溶ける。\n||ZnO|| + 2HCl → ||ZnCl₂|| + ||H₂O||\n||ZnO|| + 2NaOH + H₂O → ||Na₂[ZnO₂]||\n','ZnOZnOZnCl₂H₂OZnONa₂[ZnO₂]','\n(3)水酸化亜鉛：化学式||Zn(OH)₂||\n||Zn²⁺||を含む水溶液に、少量のNH₃水やNaOH水溶液を加えると白色沈殿。水には溶けない。\n両性水酸化物で、酸と強塩基の両方の水溶液に溶ける。\n||Zn(OH)₂|| + 2HCl → ||ZnCl₂|| + 2H₂O\n||Zn(OH)₂|| + 2NaOH → ||Na₂[Zn(OH)₄]||\nなお、水酸化亜鉛は、過剰のアンモニア水にも溶ける。\n||Zn(OH)₂|| + 4NH₃ → ||[Zn(NH₃)₄]²⁺|| + 2OH⁻\n[Zn(NH₃)₄]²⁺||テトラアンミン亜鉛()Ⅱイオン||\n','Zn(OH)₂Zn²⁺Zn(OH)₂ZnCl₂Zn(OH)₂Na₂[Zn(OH)₄]Zn(OH)₂[Zn(NH₃)₄]²⁺テトラアンミン亜鉛()Ⅱイオン','\n4 すずとその化合物\n(1)スズ：化学式||Sn||\n周期表の||14||族元素。\nはんだや青銅などの合金の材料。酸化数が+2と+4の化合物をつくる。\nブリキ(鉄+すず)見た目は錆びない。\n','Sn14','\n(2)塩化スズ(Ⅱ)：化学式||SnCl₂||\n||Sn²⁺||が||還元剤||として働く。\nSn²⁺ → ||Sn⁴⁺|| + 2e⁻\n','SnCl₂Sn²⁺還元剤Sn⁴⁺','\n5 鉛とその化合物\n(1)鉛：化学式||Pb||\n周期表の||14||族元素。\n鉛蓄電池の||負||極に使う。酸化数が+2と+4の化合物をつくる。水には溶けにくい。\n鉛イオン化傾向は水素Hより大きいが、塩酸や希硫酸にはほとんど溶けない。これは水に溶けにくい||塩化鉛(Ⅱ)||(化学式||PbCl₂||)や||硫酸鉛(Ⅱ)||(化学式||PbSO₄||)ができて鉛の表面をおおい、酸との接触をさまたげるからである。\n','Pb14負塩化鉛(Ⅱ)PbCl₂硫酸鉛(Ⅱ)PbSO₄',
                         '\n(2)酸化鉛(Ⅳ)：化学式||PbO₂||\n鉛蓄電池の||正||極に使う。||酸化||剤。\n','PbO₂正酸化','\nページ 92\n第16講〉遷移元素とその化合物\n1 遷移元素とその特徴\n(1)周期表の3~12の元素で、すべて||金属||元素。 遷移金属transition metalsともいう。\n(2)典型元素の金属に比べ、単体は密度が||大||きく、融点が||高||い。\n(3)複数の酸化数をとる化合物は||有||色のものが多い。\n','金属大高有','\n2 鉄とその化合物\n(1)鉄：化学式||Fe||\n単体は、鉄鉱石(Fe₃O₄(Fe₂O₃FeO))を溶鉱炉で、||一酸化炭素||(コークス由来)で還元してつくる。溶鉱炉から得られた鉄は、炭素などの不純物を含む||銑鉄||pig ironとよばれる。これに酸素を吹き込み不純物を減らした強靭な鉄を||鋼||steelという。\n鉄のイオンには||Fe²⁺||と||Fe³⁺||がある。Fe²⁺は酸化されてFe³⁺になりやすい。鉄は、希塩酸や希硫酸にはFe²⁺となって溶け、水素が発生する。\n濃硝酸には||不動態||をつくって溶けない。\n','Fe一酸化炭素銑鉄鋼Fe²⁺Fe³⁺不動態','\n(2)鉄イオンの反応\nFe²⁺\n * 水溶液の色: ||淡緑||色\n * K₄[Fe(CN)₆]: ||青白||色沈殿\n * K₃[Fe(CN)₆]: ||濃青色||沈殿\n * KSCN(チオ): 変化なし\n * NaOH: ||緑白色沈殿||\n   Fe³⁺\n * 水溶液の色: ||黄褐色||\n * K₄[Fe(CN)₆]: ||濃青色||沈殿\n * K₃[Fe(CN)₆]: ||赤褐色||溶液\n * KSCN: ||血赤色||溶液\n * NaOH: ||赤褐色沈殿||\n   ','Fe²⁺淡緑青白濃青色緑白色沈殿Fe³⁺黄褐色濃青色赤褐色血赤色赤褐色沈殿','\n3 銅とその化合物\n(1)銅：化学式||Cu||\n単体は、銅鉱石を還元して||粗銅||black copperをつくり、粗銅を陽極、純銅を陰極にして硫酸酸性硫酸銅(Ⅱ)水溶液中で電気精錬electric refiningし、純度を上げる。\n陽極：||Cu|| → ||Cu²⁺|| + 2e⁻\n陰極：||Cu²⁺|| + 2e⁻ → ||Cu||\n希塩酸や希硫酸には溶けないが、硝酸や熱濃硫酸には||酸化物||となって溶けて、\n希硝酸では||NO||、濃硝酸では||NO₂||、熱濃硫酸では||SO₂||が発生する。\n','Cu粗銅CuCu²⁺Cu²⁺Cu酸化物NONO₂SO₂','\nページ 93\n(2)銅(Ⅱ)イオン：イオン式||Cu²⁺||\n硫酸銅(Ⅱ)五水和物(CuSO₄・5H₂O)の結晶は||青||色だが、加熱すると水和水を失い、||白||色になる。CuSO₄・5H₂Oの青色は水が存在するときの色である。式量250\nCuSO₄・5H₂O → ||CuSO₄|| + 5H₂O\nCu²⁺を含む水溶液に少量の水酸化ナトリウム水溶液や少量の||アンモニア水||を加えると||青白色||の水酸化銅(Ⅱ)(化学式||Cu(OH)₂||)の沈殿を生じる。\n水酸化銅(Ⅱ)の沈殿は、過剰のアンモニア水に溶け、||深青||色の溶液になる。\nCu(OH)₂ + 4NH₃ → ||[Cu(NH₃)₄]²⁺|| + 2OH⁻\n[Cu(NH₃)₄]²⁺||テトラアンミン銅イオン||\nまた、水酸化銅(Ⅱ)を加熱すると、||黒||色の酸化銅(Ⅱ)になる。\nCu(OH)₂ → ||CuO|| + H₂O\nCuOは||黒||色。\n','Cu²⁺青白CuSO₄アンモニア水青白色Cu(OH)₂深青[Cu(NH₃)₄]²⁺テトラアンミン銅イオン黒CuO黒','\n4 銀とその化合物\n(1)銀：化学式||Ag||\n硝酸や希塩酸には溶けないが、硝酸や熱濃硝酸には||Ag⁺||となり溶ける。\n','AgAg⁺','\n(2)銀イオン：イオン式||Ag⁺||\n色は||無色||。水酸化ナトリウム水溶液や少量のアンモニア水で||褐||色の酸化銀(化学式||Ag₂O||)の沈殿を生じるが、過剰のアンモニア水に溶ける。\nAg₂O + 4NH₃ + H₂O → ||2[Ag(NH₃)₂]⁺|| + 2OH⁻\n2[Ag(NH₃)₂]⁺||ジアンミン銀イオン||\n銀イオンはハロゲン化物イオンと沈殿をつくる。これらの沈殿は光で分解する。\n * Ag⁺ + Cl⁻ → ||AgCl|| ↓塩化銀　||白||色　重要\n * Ag⁺ + Br⁻ → ||AgBr|| ↓臭化銀　||淡黄||色　\n * Ag⁺ + I⁻ → ||AgI|| ↓ヨウ化銀　||黄||色\n   ||光で分解し、Agに変化する||\n   ','Ag⁺無色褐Ag₂O2[Ag(NH₃)₂]⁺ジアンミン銀イオンAgCl白AgBr淡黄AgI黄光で分解し、Agに変化する','\n5 クロムとマンガンの化合物\n(1)クロム酸イオン：イオン式||CrO₄²⁻||\n色は||黄||色。鉛(Ⅱ)イオンPb²⁺や銀イオンAg⁺と沈殿をつくる。\nPb²⁺ + ||CrO₄²⁻|| → ||PbCrO₄||↓　クロム酸鉛(Ⅱ)||黄||色\n2Ag⁺ + ||CrO₄²⁻|| → ||Ag₂CrO₄||↓　クロム酸銀||暗赤||色\n','CrO₄²⁻黄CrO₄²⁻PbCrO₄黄CrO₄²⁻Ag₂CrO₄暗赤','\n(2)ニクロム酸イオン：イオン式||Cr₂O₇²⁻||\n色は||橙赤||色。クロム酸イオンを酸性にすると生じる。\n2CrO₄²⁻ + 2H⁺ → ||Cr₂O₇²⁻|| + H₂O\n酸性溶液で、二クロム酸イオンは強力な||酸化剤||として働く。\n','Cr₂O₇²⁻橙赤Cr₂O₇²⁻酸化剤','\n(3)過マンガン酸イオン：イオン式||MnO₄⁻||\n色は||赤紫||色。強力な||酸化||剤。\n酸化還元滴定のみ\n','MnO₄⁻赤紫酸化','\nページ 104\n第18講〉炭素・ケイ素、窒素・リン\n1 炭素とケイ素\n炭素Cとケイ素Siは周期表の||14||族の元素で、価電子は||4||個。\n-4≦⁠酸化数≦⁠+4になる。ともに非金属元素。同族にゲルマニウムGe、スズSn、鉛Pbが続く。これらは金属元素。\n','144','\n2 炭素とその化合物\n(1)炭素 carbon：化学式||C||\n単体は、次のような||同素体||allotropeがある。\nダイヤモンドdiamondは、非常に||硬||く、||無色||の結晶で、電気を||通さない||。自由電子なし\n宝石、ガラス切り、研磨剤などに使われている。\n黒鉛graphiteは、||やわらか||く、||灰黒||色の結晶で、電気を||通す||。鉛筆の芯などに使われている。\nダイヤモンドも黒鉛も、融点は非常に||高||い。\nほかにC₆₀ C₇₀などの分子式で表される球状分子の||フラーレン||fullereneや、結晶構造をもたない無定形炭素amorphous carbonなどがある。||カーボンチューブ||。\n','C同素体硬無色通さないやわらか灰黒通す高フラーレンカーボンチューブ','\n(2)一酸化炭素：分子式||CO||\n無色、無臭の極めて有毒な気体。水には溶けにくい。\n空気中で点火すると、青白い炎をあげて燃え、二酸化炭素になる。\n2CO + O₂ → 2||CO₂||　(C:+2=>+4(酸化))\n高温で||還元||性を示す。例えば、溶鉱炉中で鉄鉱石を還元し鉄を生成する。\n炭素や炭素化合物が||不完全||燃焼で生じる。\n実験室では、ギ酸HCOOHを||濃硫酸と加熱||し、脱水でつくる。\nHCOOH → ||H₂O|| + ||CO||↑\n水に溶けにくいので、||水上||置換で集める。\n','COCO₂還元不完全濃硫酸と加熱H₂OCO水上','\nページ 105\n(3)二酸化炭素：分子式||CO₂||\n無色、無臭の気体。水に少し溶け、水溶液は弱||酸性||を示す。||水酸化カルシウム||水溶液(石灰水)に吹き込むと||炭酸カルシウム||を生じる。\nCa(OH)₂ + CO₂ → ||CaCO₃||↓ +H₂O\nさらに吹き込むと、水に溶けやすい||炭酸水素カルシウム||を生じ、無色透明の溶液になる。\nCaCO₃ + H₂O + CO₂ → ||Ca(HCO₃)₂||\n炭素や炭素化合物の||燃焼||で生じる。\n実験室では、||炭酸カルシウム||に||希塩酸||を加えて熱分解で生じる。\nCaCO₃ + 2HCl → ||CaCl₂|| + H₂O + ||CO₂||↑\n水に少し溶け空気より重いので、ふつう下方置換で集めるが、水上置換でもよい。\n','CO₂酸性水酸化カルシウム炭酸カルシウム炭酸水素カルシウム燃焼炭酸カルシウム希塩酸CaCl₂CO₂','\n3 ケイ素とその化合物\n(1)ケイ素：化学式||Si||\n岩石や鉱物の成分元素として、地殻中に||酵素||についで多く存在する。\nダイヤモンドと似た構造をもち、ダイヤモンドほどではないが、硬く、融点が||高||い。\n金属と絶縁体の中間の電気伝導性を示す。||半導体||。\n単体は自然界には存在せず、二酸化ケイ素(化学式||SiO₂||)をコークスで還元してつくる。\nSiO₂ + 2C → Si + 2CO\n','Si酵素高半導体SiO₂','\n(2)二酸化ケイ素：化学式||SiO₂||\n||石英||、水晶、ケイ砂として天然に産出する。\n右図のような構造で、硬く、融点が||高||い。\n石英ガラスは、構造に右図のような規則性はないが、やはりSiO₂からできている。(非晶質)\n酸には溶けないが、ふつうの酸とは反応しないが、フッ化水素酸には溶ける。\nSiO₂ + 6HF → ||H₂SiF₆|| + 2H₂O\n塩基とは反応し、水酸化ナトリウムを加えて加熱するとケイ酸ナトリウムになる。\nSiO₂ + 2NaOH → ||Na₂SiO₃|| + H₂O\n炭酸ナトリウムと加熱しても、ケイ酸ナトリウムになる。\nSiO₂ + ||Na₂CO₃|| → ||Na₂SiO₃|| + ||CO₂||↑\nケイ酸ナトリウムに水を加えて加熱すると、||水ガラス||とよばれる粘性の大きな液体になる。水ガラスに塩酸を加えると、半透明ゼリー状のケイ酸の沈殿を生じる。これを、加熱脱水したものが||シリカゲル||で、乾燥剤、吸着剤として使われる。リカゲル||。\n','SiO₂石英高H₂SiF₆Na₂SiO₃Na₂CO₃Na₂SiO₃CO₂水ガラスシリカゲルリカゲル','\nページ 106\n第17講〉窒素とリン\n4 窒素とリン\n窒素NとリンPは周期表の||15||族の元素で、価電子の数は||5||個であり、||-3||≦⁠酸化数≦⁠||+5||である。\n','155-3+5','\n5 窒素とその化合物\n(1)窒素 nitrogen：分子式||N₂||\n無色、無臭の気体。水に溶けにくい。空気の約78%を占める。\n','N₂','\n(2)アンモニア ammonia：分子式||NH₃||\n無色、||刺激||臭の気体。水によく溶け、水溶液は弱い||塩基性||を示す。\n塩化水素と反応すると、||白||煙のような||NH₄Cl||の微粉末を生じる。\nNH₃ + HCl → ||NH₄Cl||\n工業的には、||鉄||を触媒として、窒素と水素を高温、高圧で直接反応させてつくる。このアンモニアの工業的製法を||ハーバー・ボッシュ法||という。\nN₂ + 3H₂ ⇌ 2||NH₃||\n実験室では、塩化アンモニウムに||Ca(OH)₂||を加えて加熱すると||NH₃||が発生する。\n2NH₄Cl + ||Ca(OH)₂|| → ||CaCl₂|| + 2H₂O + 2||NH₃||↑\n水に溶けやすく、空気よりも軽いので、||上方||置換で集める。\nアンモニアの乾燥には、||ソーダ石灰||など||塩基性||の乾燥剤を用いる。(ソーダ石灰CaO NaOH)\n','NH₃刺激塩基性白NH₄Cl鉄ハーバー・ボッシュ法NH₃Ca(OH)₂NH₃CaCl₂NH₃上方ソーダ石灰塩基性','\n(3)一酸化窒素 nitric monoxide：分子式||NO||\n無色、無臭の気体。水には溶けにくい。\n空気中では、酸素と反応して、||赤褐色||の二酸化窒素になる。\n2NO + O₂ → 2||NO₂||\n実験室では、銅に||希硝酸||を反応させてつくる。\n3Cu + 8||HNO₃|| → 3||Cu(NO₃)₂|| + 4H₂O + 2||NO||\n水に溶けにくいので、||水上||置換で集める。\n(超重要、係数暗記必須)\n','NO赤褐色NO₂希硝酸HNO₃Cu(NO₃)₂NO水上','\nページ 107\n(4)二酸化窒素：化学式||NO₂||\n||赤褐||色、特異臭の気体。水に溶けやすく、水溶液は||酸性||を示す。\n常温では、一部がN₂O₄に変化し、平衡状態になっている。実験室では、銅に濃硝酸を反応させてつくる。\nCu + 4HNO₃ → Cu(NO₃)₂ + 2H₂O + 2NO₂↑\n係数暗記必須\n水に溶け空気より重いので、||下方置換||で集める\n','NO₂赤褐酸性下方置換','\n(5)硝酸：化学式||HNO₃||\n強酸。||酸化||剤。光で分解し、NO₂を生じるので||褐色瓶||に保存する。酸化力のある酸なので、イオン化傾向の小さい銅や銀も溶かす。\n鉄、ニッケル、アルミニウムは。||不動態||をつくるため濃硝酸には溶けない。\n','HNO₃酸化褐色瓶不動態','\n(6)オストワルト法:硝酸の工業的製法\n||白金||を触媒として、アンモニアと空気中の酸素を反応させてNOをつくる。\n4NH₃ + 5O₂ → ||4NO|| + 6H₂O …①\nNOを空気中の酸素と反応させて||NO₂||にする。\n2NO + O₂ → 2||NO₂|| …②\nNO₂を水に溶かして硝酸にする。\n3NO₂ + H₂O → ||2HNO₃|| + NO …③\n①②③式を1つにまとめると、(①+3②+2③)','4より、\nNH₃ + 2O₂ → HNO₃ + H₂O\n①は係数暗記必須\n','白金4NONO₂NO₂2HNO₃','\n(6)リンとその化合物\n(1)リン：化学式||P||\n単体には、次のような||同素体||がある。\n||黄リン||は、淡黄色の固体で猛毒。空気中で||自然発火||するので、水中に保存。\n||赤リン||は、赤褐色の固体。黄リンに比べて、毒性は少なく、反応性も乏しい。マッチの側薬などに使われる。\n燃焼すると、橙色の明るい光を放って燃え、十酸化四リンとなる。\n4P + 5O₂ → ||P₄O₁₀||\n','P同素体黄リン自然発火赤リンP₄O₁₀','\n(2)十酸化四リン：分子式||P₄O₁₀||\n白色の固体。吸湿性が強く、||乾燥||剤に用いられる。\n水を加えて加熱すると、||リン酸||を生じる。\nP₄O₁₀ + 6H₂O → ||4H₃PO₄||\n','P₄O₁₀乾燥リン酸4H₃PO₄']



