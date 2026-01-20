import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import axios from "axios"; // Gist操作用

// --- 設定: Gist連携用 ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''; // GitHub Personal Access Token
const GIST_ID = process.env.GIST_ID || '';           // 保存先のGist ID
const GIST_FILENAME = 'wordlistmemory.json';

// 数字絵文字の定義
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

// ---------------------------------------------------
// Gist 操作関数
// ---------------------------------------------------

// Gistからデータを読み込む
async function readWordList() {
  if (!GITHUB_TOKEN || !GIST_ID) {
    console.error("GitHub Token または Gist ID が設定されていません。");
    return [];
  }
  try {
    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const file = response.data.files[GIST_FILENAME];
    if (file && file.content) {
      return JSON.parse(file.content);
    }
    return [];
  } catch (error) {
    console.error("Gistの読み込みに失敗しました:", error.message);
    return [];
  }
}

// Gistへデータを保存する
async function saveWordList(list) {
  if (!GITHUB_TOKEN || !GIST_ID) return;
  try {
    await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(list, null, 2)
        }
      }
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    console.log("Gistへの保存完了");
  } catch (error) {
    console.error("Gistへの保存に失敗しました:", error.message);
  }
}

// ---------------------------------------------------
// 修正版 askQuiz 関数 (リスト表示 & 自動削除)
// ---------------------------------------------------
export async function askQuiz(client, channelId, number) {
  // 1. Gistから単語リストを取得
  let words = await readWordList();

  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    console.error(`指定されたチャンネルIDが見つかりません: ${channelId}`);
    return;
  }

  if (!words || words.length === 0) {
    channel.send("単語リストが空です。");
    return;
  }

  // 2. インデックス計算 (10n-9 番目 -> 0始まりで 10(n-1))
  // 指定された番号nが有効でない場合は、有効になるまで総単語数を引く
  let startIndex = (number - 1) * 10;

  // 総単語数より大きい場合、収まるまで引く（ループさせる）
  while (startIndex >= words.length && words.length > 0) {
    startIndex -= words.length;
  }
  // 念のため負の値対策
  if (startIndex < 0) startIndex = 0;

  // 3. 表示する9個の単語を抽出
  // 配列の最後までいったら途切れる（ループさせずにそこで止める場合）
  // もし「表示もループさせたい」場合はロジックを追加する必要がありますが、
  // ここでは「リストの末尾まで」を取得します。
  const targetWords = [];
  for (let i = 0; i < 9; i++) {
    const index = startIndex + i;
    if (index < words.length) {
      targetWords.push(words[index]);
    } else {
      break; // リストの末尾に到達したら終了
    }
  }

  if (targetWords.length === 0) {
    channel.send("表示可能な単語がありません。");
    return;
  }

  // 4. メッセージの作成
  let messageContent = `**単語リスト (No.${number} / Start Index: ${startIndex})**\nCheck ✅ to delete after 59 mins.\n\n`;

  targetWords.forEach((item, index) => {
    const emoji = NUMBER_EMOJIS[index];
    messageContent += `${emoji} ${item.word} ー ${item.meaning}\n`;
  });

  // 5. メッセージ送信
  const message = await channel.send(messageContent);

  // 6. リアクションの付与 (1〜9)
  // 順番通りにリアクションするために reduce または for...of を使用
  try {
    for (let i = 0; i < targetWords.length; i++) {
      await message.react(NUMBER_EMOJIS[i]);
    }
  } catch (error) {
    console.error("リアクション付与中にエラー:", error);
  }

  // 7. コレクターの設置 (59分間待機)
  const waitTime = 59 * 60 * 1000; // 59分

  const collector = message.createReactionCollector({
    time: waitTime,
    dispose: true // リアクションが外された場合も考慮する場合はtrue（今回は終了時判定なので必須ではないが念のため）
  });

  console.log(`コレクター開始: ${waitTime / 60000}分間監視します。`);

  collector.on("end", async (collected) => {
    console.log("コレクター終了。削除判定を開始します。");

    try {
      // 削除を実行する前に、最新のリストを再取得する（競合回避のため）
      let currentWords = await readWordList();
      let wordsToDelete = [];

      // 各絵文字についてチェック
      for (let i = 0; i < targetWords.length; i++) {
        const emojiChar = NUMBER_EMOJIS[i];
        const reaction = collected.get(emojiChar);

        if (reaction) {
          // Bot以外のユーザーがリアクションしているか確認
          // countにはBot自身のリアクションも含まれるため count > 1 なら誰かが押したとみなす
          // より厳密には users.fetch() をすべきですが、簡易的に count で判定
          if (reaction.count > 1) {
            wordsToDelete.push(targetWords[i].word); // 削除対象の単語を記録
          }
        }
      }

      if (wordsToDelete.length > 0) {
        // 削除対象を除外した新しいリストを作成
        const initialLength = currentWords.length;
        const newWordList = currentWords.filter(w => !wordsToDelete.includes(w.word));

        if (initialLength !== newWordList.length) {
          await saveWordList(newWordList);

          const deletedCount = initialLength - newWordList.length;
          const reportMsg = `以下の単語をリストから削除しました (${deletedCount}件):\n` + wordsToDelete.join(', ');

          await channel.send(reportMsg);
          console.log(`削除実行: ${wordsToDelete.join(', ')}`);
        }
      } else {
        // 削除対象なし
        // console.log("削除対象の単語はありませんでした。");
      }

      // 終わったらメッセージのリアクションを消すなどの処理はお好みで
      // await message.reactions.removeAll(); 

    } catch (error) {
      console.error("削除処理中にエラーが発生しました:", error);
    }
  });
}

// ---------------------------------------------------
// スラッシュコマンドの定義
// ---------------------------------------------------
export const data = new SlashCommandBuilder()
  .setName("word")
  .setDescription("Gistの単語リストを管理します。")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("指定番号に基づいて単語リストを表示します（暗記モード）。")
      .addIntegerOption((option) =>
        option
          .setName("number")
          .setDescription("リスト番号 (n)")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("新しい英単語と意味をGistに追加します。")
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
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const client = interaction.client;
  const channelId = interaction.channelId;

  if (subcommand === "list") { // 旧 quiz
    const number = interaction.options.getInteger("number");

    await interaction.reply({
      content: `リスト #${number} を読み込んでいます...`,
      ephemeral: true
    });

    // リスト表示関数呼び出し
    await askQuiz(client, channelId, number);

  } else if (subcommand === "add") {
    const word = interaction.options.getString("word");
    const meaning = interaction.options.getString("meaning");

    await interaction.deferReply({ ephemeral: true });

    const words = await readWordList();
    words.push({
      word: word, // 原文ママ保存（必要なら.toLowerCase()）
      meaning: meaning,
    });

    await saveWordList(words);

    await interaction.editReply({
      content: `Gistに新しい単語「${word}」と意味「${meaning}」を追加しました。`,
    });

    // Gistの内容を確認用に送信（必要なら）
    // sendJsonAsText(client, channelId); 
  }
}

// ---------------------------------------------------
// ユーティリティ: JSONテキスト送信（デバッグ用など）
// ---------------------------------------------------
export async function sendJsonAsText(client, channelId) {
  try {
    const words = await readWordList();
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

    const jsonString = JSON.stringify(words, null, 2);
    // 長すぎる場合は分割が必要ですが、ここでは簡易的にconsole出力のみ、または先頭のみにする等の配慮が必要
    console.log("Current Gist Content Length:");

    if (jsonString.length < 1900) {
     // channel.send("```json\n" + jsonString + "\n```");
    } else {
      channel.send("データが大きすぎるため、コンソールに出力しました。");
    }
  } catch (error) {
    console.error('JSONデータの送信中にエラーが発生しました:', error);
  }
}