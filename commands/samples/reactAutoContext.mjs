import { ContextMenuCommandBuilder, ApplicationCommandType } from 'discord.js';
import OpenAI from 'openai';

export const data = new ContextMenuCommandBuilder()
    .setName('AI絵文字リアクション')
    .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
    // コンテキストメニューでは、interaction.targetMessage に対象のメッセージが入っています
    const targetMessage = interaction.targetMessage;

    if (!targetMessage) {
        await interaction.reply({
            content: 'メッセージが取得できませんでした。',
            ephemeral: true,
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const apiKey = process.env.G_API_KEY;
        if (!apiKey) {
            await interaction.editReply('APIキーが設定されていないためAIモードは利用できません。');
            return;
        }

        const ai = new OpenAI({
            baseURL: 'https://api.groq.com/openai/v1',
            apiKey: apiKey
        });

        const prompt = `以下のメッセージに対する最適なリアクション絵文字（標準のUnicode絵文字）を厳選して3つ選んでください。他のテキストは一切含めず、絵文字のみをスペース区切りで出力してください。\n\nメッセージ: ${targetMessage.content}`;
        
        const response = await ai.chat.completions.create({
            model: 'openai/gpt-oss-120b',
            messages: [{ role: 'user', content: prompt }],
        });
        
        const text = response.choices[0]?.message?.content?.trim() || '';
        
        // カスタム絵文字を抽出
        const customEmojis = text.match(/<a?:[a-zA-Z0-9_]+:\d+>/g) || [];
        const remainingText = text.replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, '');
        
        // Intl.Segmenterを使って文字列を1文字（書記素）ずつ分割し、連続した絵文字も分離する
        const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
        const graphemes = Array.from(segmenter.segment(remainingText)).map(s => s.segment);
        
        // 絵文字の性質を持つ書記素のみをフィルタリング
        const unicodeEmojis = graphemes.filter(g => /\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji}\uFE0F/u.test(g));
        
        // 重複を除外して最大3つ取得
        const emojis = Array.from(new Set([...customEmojis, ...unicodeEmojis])).slice(0, 3);
        
        let reacted = false;
        for (let emj of emojis) {
            try {
                // Discord APIは本来不要な異体字セレクタ(U+FE0F)がついているとエラーを返すため削除する
                emj = emj.replace(/\uFE0F/g, '');
                await targetMessage.react(emj);
                reacted = true;
            } catch (e) {
                console.error('AI絵文字リアクションエラー:', emj, e);
            }
        }
        
        if (reacted) {
            await interaction.editReply('AIが自動リアクションしました！');
        } else {
            await interaction.editReply('AIが適切な絵文字を見つけられませんでした。');
        }
    } catch (err) {
        console.error('AI自動リアクションエラー:', err);
        await interaction.editReply('AI自動リアクションに失敗しました。');
    }
}
