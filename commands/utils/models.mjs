import { SlashCommandBuilder } from 'discord.js';
import { GoogleGenAI } from "@google/genai";

export const data = new SlashCommandBuilder()
  .setName('models')
  .setDescription('Gemini APIで現在利用できるAIのモデル一覧を確認します');

export async function execute(interaction) {
  await interaction.deferReply();
  
  try {
    const API_KEY = process.env.GOOGLE_API_KEY;
    if (!API_KEY) {
      return await interaction.editReply("APIキーが設定されていません。");
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.list();
    
    let modelsList = [];
    for await (const model of response) {
      // モデル名と説明を追加
      const name = model.name.replace('models/', '');
      const desc = model.description || '説明なし';
      modelsList.push(`- **${name}**: ${desc}`);
    }
    
    if (modelsList.length === 0) {
      return await interaction.editReply("利用可能なモデルが見つかりませんでした。");
    }

    const replyText = `**現在利用可能なモデル一覧:**\n${modelsList.join('\n')}`;
    
    // Discordのメッセージ長制限 (2000文字) の対応
    if (replyText.length > 2000) {
      // 2000文字を超える場合はテキストファイルとして送信
      const plainTextList = modelsList.map(line => line.replace(/\*\*/g, '')).join('\n');
      const buffer = Buffer.from(`現在利用可能なモデル一覧:\n${plainTextList}`);
      return await interaction.editReply({
        content: "モデル一覧が長すぎるため、ファイルで送信します。",
        files: [{ attachment: buffer, name: 'models_list.txt' }]
      });
    } else {
      await interaction.editReply(replyText);
    }

  } catch (error) {
    console.error("Models Command Error:", error);
    await interaction.editReply("モデルの取得中にエラーが発生しました。");
  }
}
