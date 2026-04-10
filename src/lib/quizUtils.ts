import { formatMeaning } from "./answerUtils";

export interface QuizWord {
    id: string;
    word: string;
    meaning: string;
    answerType?: string;
    category?: string;
    subcategory?: string;
}

export interface QuizQuestion {
    id: string;
    word: string; 
    meaning: string; 
    choices?: string[]; 
    correctAnswer: string; 
    originalId: string;
}

export function generateQuizData(targetWords: QuizWord[], allWords: QuizWord[]): QuizQuestion[] {
    const questions: QuizQuestion[] = [];

    targetWords.forEach(target => {
        const targetSegments = target.meaning.split(/\/(?!r\d)/g);
        const answerTypes = (target.answerType || "").split("/").filter(Boolean);

        const correctAnswer = formatMeaning(target.meaning);
        const typeLabels = answerTypes.join('/');
        const questionText = `${target.word}${typeLabels ? ` (${typeLabels})` : ""}`;

        const choices: string[] = [correctAnswer];

        // --- 修正ポイント：同じ型だけのプールを作り、その中での距離を見る ---

        // 1. まず同じ型を持つ単語だけを抽出（順序は維持）
        const filteredPool = allWords.filter(w => {
            if (answerTypes.length === 0) return !w.answerType;
            const wTypes = (w.answerType || "").split("/").filter(Boolean);
            return wTypes.some(t => answerTypes.includes(t));
        });

        // 2. そのプール内でのターゲットの位置を探す
        const indexInPool = filteredPool.findIndex(w => w.id === target.id);

        // 3. プール内での前後（距離が近い順）から誤答候補を取得
        // indexInPool が -1（万が一見つからない）の場合は allWords から探すようにフォールバック
        const sourceList = indexInPool !== -1 ? filteredPool : allWords;
        const centerIndex = indexInPool !== -1 ? indexInPool : allWords.findIndex(w => w.id === target.id);

        const neighbors = findDistractors(sourceList, centerIndex, 6, w => w.id !== target.id);

        // --- 誤答の組み立て ---
        for (let k = 0; k < 3; k++) {
            const neighbor = neighbors[k] || allWords[Math.floor(Math.random() * allWords.length)];
            const nSegments = neighbor.meaning.split(/\/(?!r\d)/g);

            const distractorParts = targetSegments.map((tSeg, j) => {
                if (tSeg.startsWith('c:')) {
                    const parts = tSeg.slice(2).split(':');
                    const correctPart = parts.pop();
                    const wrongOptions = parts.filter(p => p !== correctPart);
                    return wrongOptions.length > 0 ? wrongOptions[k % wrongOptions.length] : correctPart;
                } else {
                    const dRaw = nSegments[j] !== undefined ? nSegments[j] : nSegments[0];
                    return formatMeaning(dRaw);
                }
            });

            choices.push(distractorParts.join('/'));
        }

        let finalChoices = Array.from(new Set(choices.map(c => c.trim()).filter(Boolean)));
        while (finalChoices.length < 4) {
            finalChoices.push(`Option ${finalChoices.length + 1}`);
        }

        finalChoices = finalChoices.slice(0, 4).sort(() => Math.random() - 0.5);


        console.log(`問題: ${target.word}, 型: ${target.answerType}`);
console.log(`同じ型の単語数: ${filteredPool.length}件見つかりました`);
if (filteredPool.length === 0) {
    console.warn("警告: 同じ型の単語がゼロなので、ランダム抽出に切り替わっています！");
}

        
        questions.push({
            id: target.id,
            originalId: target.id,
            word: questionText,
            meaning: correctAnswer,
            correctAnswer: correctAnswer,
            choices: finalChoices
        });
        
    });

    return questions;
}

/**
 * 指定されたリスト内での近隣探索
 */
function findDistractors(
    list: QuizWord[],
    centerIndex: number,
    count: number,
    filterFn: (w: QuizWord) => boolean
): QuizWord[] {
    const candidates: QuizWord[] = [];
    let range = 1;

    while (candidates.length < count && range < list.length) {
        const left = centerIndex - range;
        if (left >= 0 && filterFn(list[left])) {
            candidates.push(list[left]);
        }
        if (candidates.length >= count) break;

        const right = centerIndex + range;
        if (right < list.length && filterFn(list[right])) {
            candidates.push(list[right]);
        }
        range++;
    }

    if (candidates.length < count) {
        const remaining = list.filter(w => !candidates.includes(w) && filterFn(w));
        candidates.push(...remaining.sort(() => Math.random() - 0.5).slice(0, count - candidates.length));
    }

    // 近接順を維持しつつ少しだけシャッフル（毎回同じ並びにならないように）
    return candidates.sort(() => Math.random() - 0.5).slice(0, count);
}
