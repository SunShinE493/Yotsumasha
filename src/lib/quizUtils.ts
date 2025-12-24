
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
    word: string; // The question text (e.g. "Phenol (Substance Name)")
    meaning: string; // The correct answer string for display/validation
    choices?: string[]; // 4 choices
    correctAnswer: string; // The exact string to match for correctness
    originalId: string;
}

/**
 * Split a list of raw word data into flattened quiz questions.
 * Handles:
 * - c:Choice1:Choice2... (Fixed choices)
 * - m:Meaning (Nearest neighbor distractors)
 * - r:Component (Nearest neighbor compound distractors)
 * - Standard text (Nearest neighbor distractors)
 */
export function generateQuizData(targetWords: QuizWord[], allWords: QuizWord[]): QuizQuestion[] {
    const questions: QuizQuestion[] = [];

    targetWords.forEach(target => {
        const targetIndex = allWords.findIndex(w => w.id === target.id);
        const targetSegments = target.meaning.split(/\/(?!r\d)/g);
        const answerTypes = (target.answerType || "").split("/");

        // Correct answer is the combined formatted segments
        const correctAnswer = formatMeaning(target.meaning);

        // Construct question text with all labels if present
        const typeLabels = answerTypes.filter(Boolean).join('/');
        const questionText = `${target.word}${typeLabels ? ` (${typeLabels})` : ""}`;

        const choices: string[] = [correctAnswer];

        // Find neighbors for distractors
        const neighbors = findDistractors(allWords, targetIndex, 6, w => w.id !== target.id);

        // Build 3 distractors
        for (let k = 0; k < 3; k++) {
            // For each distractor, use the k-th neighbor
            const neighbor = neighbors[k] || allWords[Math.floor(Math.random() * allWords.length)];
            const nSegments = neighbor.meaning.split(/\/(?!r\d)/g);

            const distractorParts = targetSegments.map((tSeg, j) => {
                if (tSeg.startsWith('c:')) {
                    // c: Rule: Distractor uses an INCORRECT option from the SAME word's c: tag
                    const parts = tSeg.slice(2).split(':');
                    const correctPart = parts.pop();
                    const wrongOptions = parts.filter(p => p !== correctPart);
                    if (wrongOptions.length > 0) {
                        // Spread options across distractors
                        return wrongOptions[k % wrongOptions.length];
                    }
                    return correctPart;
                } else {
                    // m:, r:, or Standard: Use neighbor's segment if it exists at index j
                    // If neighbor doesn't have segment at index j, it means its structure differs.
                    // Fallback to neighbor's segment 0 (usually the main substance name or equivalent).
                    const dRaw = nSegments[j] !== undefined ? nSegments[j] : nSegments[0];
                    return formatMeaning(dRaw);
                }
            });

            choices.push(distractorParts.join('/'));
        }

        // Finalize: Unique, 4 items, shuffle
        let finalChoices = Array.from(new Set(choices.map(c => c.trim()).filter(Boolean)));

        // If still not enough choices (rare), pad
        while (finalChoices.length < 4) {
            finalChoices.push(`Option ${finalChoices.length + 1}`);
        }

        // Shuffle
        finalChoices = finalChoices.slice(0, 4).sort(() => Math.random() - 0.5);

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

function findDistractors(
    allWords: QuizWord[],
    centerIndex: number,
    count: number,
    filterFn: (w: QuizWord) => boolean
): QuizWord[] {
    const candidates: QuizWord[] = [];
    let range = 1;

    // Spiral out from center
    while (candidates.length < count && range < allWords.length) {
        // Try left
        const left = centerIndex - range;
        if (left >= 0 && filterFn(allWords[left])) {
            candidates.push(allWords[left]);
        }
        if (candidates.length >= count) break;

        // Try right
        const right = centerIndex + range;
        if (right < allWords.length && filterFn(allWords[right])) {
            candidates.push(allWords[right]);
        }
        range++;
    }

    // If still not enough (small dataset), just random pick from remainder
    if (candidates.length < count) {
        const remaining = allWords.filter(w => !candidates.includes(w) && filterFn(w));
        const needed = count - candidates.length;
        candidates.push(...remaining.sort(() => Math.random() - 0.5).slice(0, needed));
    }

    // Randomize the selected neighbors so it's not always the exact same ones in same order
    return candidates.sort(() => Math.random() - 0.5).slice(0, count);
}

function simpleFormat(m: string): string {
    // Take first segment if multiple
    const first = m.split(/\/(?!r\d)/g)[0];
    return formatMeaning(first);
}
