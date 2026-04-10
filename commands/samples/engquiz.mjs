import {
  SlashCommandBuilder,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

// --- ここに問題を追加・編集してください ---
const quizzes = [
  {
    japanese: '私は毎日公園を散歩します。',
    english: 'I take a walk in the park every day.',
  },
  {
    japanese: 'この本はあなたに多くのことを教えてくれるでしょう。',
    english: 'This book will teach you a lot of things.',
  },
  {
    japanese: '彼女がその知らせを聞いてどれほど喜ぶか想像できますか？',
    english: 'Can you imagine how happy she will be to hear the news?',
  },
  // さらに問題を追加できます
  // { japanese: "次の問題の日本語", english: "Next quiz sentence." },
];
// ------------------------------------

// ユーザーごとのクイズの状態を管理します
// 注意: このMapはボットの再起動でリセットされます。
const userQuizStates = new Map();

/**
 * 配列の要素をシャッフルします (Fisher-Yates shuffle)
 * @param {Array} array シャッフルしたい配列
 * @returns {Array} シャッフルされた新しい配列
 */
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * クイズのEmbedとボタンコンポーネントを生成します
 * @param {object} quiz 現在の問題オブジェクト
 * @param {object} state 現在のユーザーの状態
 * @returns {object} メッセージ送信用オブジェクト { embeds, components }
 */
function createQuizMessage(quiz, state) {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('英文並べ替えクイズ！')
    .setDescription(`以下の日本語に合うように、英単語を並べ替えてください。\n\n**${quiz.japanese}**`)
    .addFields({
      name: 'あなたの回答',
      value: state.currentAnswer.length > 0 ? state.currentAnswer.join(' ') : '...',
    })
    .setFooter({ text: `第 ${state.quizIndex + 1} 問 / 全 ${quizzes.length} 問` });

  // 単語ボタンを作成
  const wordButtons = state.shuffledWords.map((word, index) =>
    new ButtonBuilder()
      .setCustomId(`word_${index}`)
      .setLabel(word)
      .setStyle(ButtonStyle.Primary)
  );

  // ボタンを5個ずつ複数の行に分割します
  const rows = [];
  for (let i = 0; i < wordButtons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(wordButtons.slice(i, i + 5)));
  }

  // 操作ボタンの行を追加します
  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('delete')
      .setLabel('削除')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('reset')
      .setLabel('リセット')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('submit')
      .setLabel('提出')
      .setStyle(ButtonStyle.Success)
  );
  rows.push(controlRow);

  return { embeds: [embed], components: rows };
}


// SlashCommanderで読み込むためのエクスポート形式
export const data = new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('英文並べ替えクイズを開始します。');
    
    // コマンドが実行されたときの処理
   export async function execute(interaction) {
        const userId = interaction.user.id;

        // 既にクイズセッションが進行中の場合は弾く
        if (userQuizStates.has(userId)) {
            await interaction.reply({
                content: '既にクイズが進行中です。現在のクイズを完了するか、時間切れになるまでお待ちください。',
                ephemeral: true,
            });
            return;
        }

        // --- クイズの初期化 ---
        const quizIndex = 0;
        const quiz = quizzes[quizIndex];
        const words = quiz.english.split(' ');

        const newState = {
            quizIndex: quizIndex,
            correctAnswer: quiz.english,
            shuffledWords: shuffleArray(words),
            currentAnswer: [],
        };
        userQuizStates.set(userId, newState);

        const messagePayload = createQuizMessage(quiz, newState);
        const message = await interaction.reply({
            ...messagePayload,
            fetchReply: true, // 送信したメッセージオブジェクトを取得するため
        });

        // --- ボタン操作を監視するコレクターを作成 ---
        // コマンドを実行したユーザーからの操作のみを15分間待つ
        const collector = message.createMessageComponentCollector({
            filter: (i) => i.user.id === userId,
            time: 15 * 60 * 1000, // 15分
        });

        collector.on('collect', async (i) => {
            const state = userQuizStates.get(i.user.id);
            if (!state) return; // 念の為セッションの存在を確認

            const customId = i.customId;
            let shouldUpdateMessage = false;

            // --- ボタンごとの処理 ---
            if (customId.startsWith('word_')) {
                const wordIndex = parseInt(customId.split('_')[1]);
                state.currentAnswer.push(state.shuffledWords[wordIndex]);
                shouldUpdateMessage = true;
            } else if (customId === 'delete') {
                state.currentAnswer.pop();
                shouldUpdateMessage = true;
            } else if (customId === 'reset') {
                state.currentAnswer = [];
                shouldUpdateMessage = true;
            } else if (customId === 'submit') {
                const userAnswer = state.currentAnswer.join(' ');
                if (userAnswer === state.correctAnswer) {
                    // --- 正解 ---
                    const nextQuizIndex = state.quizIndex + 1;
                    if (nextQuizIndex < quizzes.length) {
                        // 次の問題がある場合
                        const nextQuiz = quizzes[nextQuizIndex];
                        const nextWords = nextQuiz.english.split(' ');
                        
                        // 状態を次の問題用に更新
                        state.quizIndex = nextQuizIndex;
                        state.correctAnswer = nextQuiz.english;
                        state.shuffledWords = shuffleArray(nextWords);
                        state.currentAnswer = [];

                        const nextMessagePayload = createQuizMessage(nextQuiz, state);
                        await i.update(nextMessagePayload);
                    } else {
                        // 全問正解
                        userQuizStates.delete(i.user.id);
                        collector.stop(); // コレクターを停止
                        const embed = new EmbedBuilder()
                            .setColor(0x57F287) // Green
                            .setTitle('🎉 全問正解！おめでとうございます！')
                            .setDescription('すべての問題をクリアしました。\nもう一度挑戦するには `/quiz` を実行してください。');
                        await i.update({ embeds: [embed], components: [] });
                    }
                } else {
                    // --- 不正解 ---
                    await i.reply({ content: '不正解です。もう一度試してください！', ephemeral: true });
                }
            }

            if (shouldUpdateMessage) {
                const currentQuiz = quizzes[state.quizIndex];
                const updatedMessage = createQuizMessage(currentQuiz, state);
                await i.update(updatedMessage);
            }
        });

        // コレクターが（時間切れで）終了したときの処理
        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                // ユーザーセッションがまだ残っている場合（全問正解で終了していない場合）
                if (userQuizStates.has(userId)) {
                    const embed = new EmbedBuilder()
                        .setColor(0xED4245) // Red
                        .setTitle('時間切れ')
                        .setDescription('クイズの制限時間が終了しました。\nもう一度挑戦するには `/quiz` を実行してください。');
                    
                    // 元のメッセージを編集して、ボタンを消しタイムアウトを通知する
                    interaction.editReply({ embeds: [embed], components: [] });
                    userQuizStates.delete(userId);
                }
            }
        });
    }