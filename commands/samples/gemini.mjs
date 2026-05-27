import { SlashCommandBuilder } from 'discord.js';
import { GoogleGenAI } from '@google/genai';

export const data = new SlashCommandBuilder()
    .setName('gemini')
    .setDescription('Gemini 3.1 Pro Previewにプロンプトを送信します')
    .addStringOption(option =>
        option.setName('prompt')
            .setDescription('送信するプロンプト')
            .setRequired(true));

export async function execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        return interaction.reply({ content: 'APIキー (GOOGLE_API_KEY) が設定されていません。', flags: 64 });
    }

    // 応答に時間がかかる可能性があるため、保留状態にする
    await interaction.deferReply();

    try {
        // main.mjs の形式に合わせる
        const ai = new GoogleGenAI({ apiKey: apiKey });
        
        // Gemini 3.1 Pro Previewを使用
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const text = response.text;

        if (!text) {
            return interaction.editReply('AIからの応答が空でした。');
        }

        // Discordのメッセージ長制限 (2000文字) への対応
        if (text.length > 2000) {
            const chunks = text.match(/[\s\S]{1,2000}/g) || [text];
            await interaction.editReply(chunks[0]);
            for (let i = 1; i < chunks.length; i++) {
                await interaction.followUp(chunks[i]);
            }
        } else {
            await interaction.editReply(text);
        }
    } catch (error) {
        console.error('Gemini API Error:', error);
        
        let errorMessage = 'エラーが発生しました。';
        if (error.message) {
            errorMessage += `\n詳細: ${error.message}`;
        }
        
        if (interaction.deferred) {
            await interaction.editReply(errorMessage);
        } else {
            await interaction.reply({ content: errorMessage, flags: 64 });
        }
    }
}
