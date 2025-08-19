import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(
  import.meta.url
);
const __dirname = path.dirname(__filename);
const wordListPath = path.join(__dirname, "wordlist.json");

// wordlist.jsonの読み込み関数
async function readWordList() {
  try {
    const data = await fs.readFile(
      wordListPath,
      "utf8"
    );
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read wordlist.json:", error);
    return [];
  }
}

// wordlist.jsonへの保存関数
async function saveWordList(list) {
  try {
    await fs.writeFile(
      wordListPath,
      JSON.stringify(list, null, 2)
    );
  } catch (error) {
    console.error("Failed to save wordlist.json:", error);
  }
}

// ---------------------------------------------------
// 修正版 askQuiz 関数
// ---------------------------------------------------
export async function askQuiz(client, channelId, number) {
  const words = await readWordList();

  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    console.error(`指定されたチャンネルIDが見つかりません: ${channelId}`);
    return;
  }

    if (number <= 0 || number > words.length) {
    console.error("無効な番号が指定されました。", number);
      channel.send("無効な番号が指定されました。", number )
    return;
  }

  const selectedWord = words[number - 1];
  const embed = new EmbedBuilder()
    .setColor("Blue")
    .setTitle(`今日の英単語 #${number}`)
    .setDescription(`この英単語の意味を答えてください:\n\n**${selectedWord.word}**`);

  // 答えを見るボタンと覚えたボタンを追加
  const showAnswerButton = new ButtonBuilder()
    .setCustomId(`show_meaning_${number}`)
    .setLabel("答えを見る")
    .setStyle(ButtonStyle.Primary);

  const learnedButton = new ButtonBuilder()
    .setCustomId(`learned_word_${number}`)
    .setLabel("覚えた")
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(
    showAnswerButton,
    learnedButton
  );

  // interaction.reply()の代わりに channel.send() を使う
  const message = await channel.send({
    embeds: [embed],
    components: [row],
  });

  // メッセージにコレクターを付ける
  const collector = message.createMessageComponentCollector({
    time: 3600000, // 1時間有効
  });

  collector.on("collect", async (i) => {
    // 答えボタンを押したユーザーのみに回答を見せる
    if (i.customId === `show_meaning_${number}`) {
      const answerEmbed = new EmbedBuilder()
        .setColor("Green")
        .setTitle(`回答 #${number}`)
        .setDescription(`**${selectedWord.word}** の意味は\n\n**${selectedWord.meaning}** です。`);

      await i.reply({
        embeds: [answerEmbed],
        ephemeral: true,
      });
      // collector.stop(); は削除。覚えたボタンも押せるようにするため。
    }
    // 覚えたボタンが押されたときの処理
    else if (i.customId === `learned_word_${number}`) {
      const currentWords = await readWordList();
      const wordToDelete = currentWords[number - 1];

      // フィルターを使って削除
      const updatedWords = currentWords.filter(
        (word) => word.word !== wordToDelete.word
      );

      await saveWordList(updatedWords);
      await i.reply({
        content: `英単語「${wordToDelete.word}」をリストから削除しました。これで完璧に覚えましたね！`,
        ephemeral: false,
      });

      // コレクターを停止し、メッセージのボタンを無効化
      collector.stop();
      message.edit({
        components: [
          new ActionRowBuilder().addComponents(
            showAnswerButton.setDisabled(true),
            learnedButton.setDisabled(true)
          ),
        ],
      });
    }
  });

  collector.on("end", (collected) => {
    // コレクターが時間切れで終了した場合、ボタンを無効化する
    if (collected.size === 0) {
      message.edit({
        components: [
          new ActionRowBuilder().addComponents(
            showAnswerButton.setDisabled(true),
            learnedButton.setDisabled(true)
          ),
        ],
      });
    }
    console.log(`コレクターが終了しました。回答数: ${collected.size}`);
  });
}

// ---------------------------------------------------
// スラッシュコマンドの定義
// ---------------------------------------------------
export const data = new SlashCommandBuilder()
  .setName("word")
  .setDescription("英単語の問題と回答を管理します。")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("quiz")
      .setDescription("番号に対応する英単語の問題を出題します。")
      .addIntegerOption((option) =>
        option
          .setName("number")
          .setDescription("表示する英単語の番号")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("新しい英単語と意味を追加します。")
      .addStringOption((option) =>
        option
          .setName("word")
          .setDescription("追加する英単語")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("meaning")
          .setDescription("英単語の意味")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("training")
      .setDescription("今日の英単語の練習ができます")
      .addIntegerOption((option) =>
        option
          .setName("questions")
          .setDescription("問題数")
          .setRequired(true)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "quiz") {
    const number = interaction.options.getInteger("number");
    
    
    interaction.reply({
      content: `英単語 #${number}　の問題を出題します。 `,
      ephemeral: true
    })
    const channelId = interaction.channelId;
    const client = interaction.client;
    // 新しい関数を呼び出す
  let filePath = 'commands/samples/wordlist.json';
  sendJsonAsText(client, channelId, filePath) 
  
    await askQuiz(client, channelId, number);
  } else if (subcommand === "add") {
    const word = interaction.options.getString("word");
    const meaning = interaction.options.getString("meaning");
    const words = await readWordList();
    words.push({
      word: word.toLowerCase(),
      meaning: meaning,
    });
    await saveWordList(words);

    await interaction.reply({
      content: `新しい英単語「${word}」と意味「${meaning}」を追加しました。`,
      ephemeral: true,
    });
    const channelId = interaction.channelId;
    const client = interaction.client;
    // 新しい関数を呼び出す
  let filePath = 'commands/samples/wordlist.json';
  await sendJsonAsText(client, channelId, filePath) 
  }else if (subcommand === "training") {

    const questions = interaction.options.getInteger("questions");
    let words = await readWordList();
    
    const channelId = interaction.channelId;
    const client = interaction.client;
    // 新しい関数を呼び出す
    for(let i=0;i<questions;i++){
    let number = Math.floor(Math.random()*words.length+1)
    await askQuiz(client, channelId, number);
  }
  }
}





/**
 * JSONファイルの内容を読み込み、テキストメッセージとして送信します。
 * @param {object} client - Discord.jsのクライアントオブジェクト
 * @param {string} channelId - 送信するチャンネルのID
 * @param {string} filePath - 送信するJSONファイルのパス（プロジェクトルートからの相対パス）
 */
export async function sendJsonAsText(client, channelId, filePath) {
  try {
    // 1. ファイルへの絶対パスを構築
    const fullPath = path.join(__dirname, 'wordlist.json');
    
    // 2. JSONファイルを文字列として読み込む
    const jsonString = await fs.readFile(fullPath, 'utf8');
let channelId ='1188202806851682314'
    // 3. チャンネルを取得
    const channel = await client.channels.fetch(channelId);
    if (!channel) return console.error('チャンネルが見つかりません。');

    // 4. コードブロック記法を使って、JSONの内容をテキストとして送信
    // `json`を付けることでシンタックスハイライトが適用されます。
    await channel.send('```json\n' + jsonString + '\n```');

    console.log('JSONファイルの内容がテキストとして正常に送信されました。');
  } catch (error) {
    console.error('JSONデータの送信中にエラーが発生しました:', error);
  }
}
