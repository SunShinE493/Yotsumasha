import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import axios from "axios";

// --- 設定: Gist連携用 ---
const GIST_TOKEN = process.env.GIST_TOKEN || ''; // GitHub Token
const GIST_ID = process.env.GIST_ID || '';           // Gist ID
const GIST_FILENAME = 'wordlistmemory.json';

// 数字絵文字の定義
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

// ---------------------------------------------------
// Gist 操作関数
// ---------------------------------------------------

async function readWordList() {
  if (!GIST_TOKEN || !GIST_ID) {
    console.error("GitHub Token または Gist ID が設定されていません。");
    return [];
  }
  try {
    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `token ${GIST_TOKEN}` }
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

async function saveWordList(list) {
  if (!GIST_TOKEN || !GIST_ID) return;
  try {
    await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(list, null, 2)
        }
      }
    }, {
      headers: { Authorization: `token ${GIST_TOKEN}` }
    });
    console.log("Gistへの保存完了");
  } catch (error) {
    console.error("Gistへの保存に失敗しました:", error.message);
    throw error; // エラーを呼び出し元に伝える
  }
}

// ---------------------------------------------------
// リスト表示 & 自動削除ロジック (askQuiz)
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
  let startIndex = (number - 1) * 9;

  // 総単語数より大きい場合、収まるまで引く（ループさせる）
  while (startIndex >= words.length && words.length > 0) {
    startIndex -= words.length;
  }
  if (startIndex < 0) startIndex = 0;

  // 3. 表示する9個の単語を抽出
  const targetWords = [];
  for (let i = 0; i < 9; i++) {
    const index = startIndex + i;
    if (index < words.length) {
      targetWords.push(words[index]);
    } else {
      break; 
    }
  }

  if (targetWords.length === 0) {
    channel.send("表示可能な単語がありません。");
    return;
  }

  // 4. メッセージの作成
  // ★希望のフォーマット: 1️⃣ word ー ||meaning||
  let messageContent = `**単語リスト (No.${number} / Start Index: ${startIndex})**\nCheck ✅ to delete after 59 mins.\n\n`;

  targetWords.forEach((item, index) => {
    const emoji = NUMBER_EMOJIS[index];
    messageContent += `${emoji} ${item.word} ー ||${item.meaning}||\n`;
  });

  // 5. メッセージ送信
  const message = await channel.send(messageContent);

  // 6. リアクションの付与 (1〜9)
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
    dispose: true 
  });

  console.log(`コレクター開始: ${waitTime / 60000}分間監視します。`);

  collector.on("end", async (collected) => {
    console.log("コレクター終了。削除判定を開始します。");

    try {
      // 最新のリストを再取得
      let currentWords = await readWordList();
      let wordsToDelete = [];

      for (let i = 0; i < targetWords.length; i++) {
        const emojiChar = NUMBER_EMOJIS[i];
        const reaction = collected.get(emojiChar);

        if (reaction) {
          // Bot以外のユーザーがリアクションしているか (count > 1)
          if (reaction.count > 1) {
            wordsToDelete.push(targetWords[i].word);
          }
        }
      }

      if (wordsToDelete.length > 0) {
        const initialLength = currentWords.length;
        const newWordList = currentWords.filter(w => !wordsToDelete.includes(w.word));

        if (initialLength !== newWordList.length) {
          await saveWordList(newWordList);

          const deletedCount = initialLength - newWordList.length;
          const reportMsg = `以下の単語をリストから削除しました (${deletedCount}件):\n` + wordsToDelete.join(', ');

          await channel.send(reportMsg);
        }
      } 
    } catch (error) {
      console.error("削除処理中にエラーが発生しました:", error);
    }
  });
}

// ---------------------------------------------------
// スラッシュコマンド定義 & 実行
// ---------------------------------------------------
export const data = new SlashCommandBuilder()
  .setName("word")
  .setDescription("Gistの単語リストを管理します。")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("指定番号に基づいて単語リストを表示します。")
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

  // ★重要: まずdeferReplyしてタイムアウトを防ぐ
  await interaction.deferReply({ ephemeral: true });

  try {
    if (subcommand === "list") {
      const number = interaction.options.getInteger("number");

      // クイズ処理を実行
      await askQuiz(client, channelId, number);

      // 完了報告
      await interaction.editReply({
        content: `リスト #${number} をチャンネルに送信しました。`,
      });

    } else if (subcommand === "add") {
      const word = interaction.options.getString("word");
      const meaning = interaction.options.getString("meaning");

      const words = await readWordList();
      words.push({ word: word, meaning: meaning });

      await saveWordList(words);

      // 完了報告
      await interaction.editReply({
        content: `Gistに新しい単語「${word}」と意味「${meaning}」を追加しました。`,
      });
    }
  } catch (error) {
    console.error("コマンド実行エラー:", error);
    try {
      // 既に応答済み(replied) または 保留中(deferred) の場合
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          content: 'コマンド実行中にエラーが発生しました。', 
          ephemeral: true 
        });
      } else {
        // まだ何も返していない場合
        await interaction.reply({ 
          content: 'コマンド実行中にエラーが発生しました。', 
          ephemeral: true 
        });
      }
    } catch (reportError) {
      // エラー報告すら失敗した場合（有効期限切れや二重応答など）
      // ここでエラーを握りつぶすことで、Bot自体のクラッシュを防ぐ
      console.error("ユーザーへのエラー通知に失敗しました（このエラーは無視されます）:", reportError.message);
    }
  }
}