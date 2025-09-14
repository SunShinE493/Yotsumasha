// schema.tsの変更に合わせてインポートを更新
import {
vocabularyFileSchema,
insertVocabularyWordSchema,
type VocabularyWord,
type InsertVocabularyWord,
} from "@shared/schema";
import { z } from "zod";

export function shuffleArray<T>(array: T[]): T[] {
const shuffled = [...array];
for (let i = shuffled.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
return shuffled;
}

export async function fetchVocabularyWords(jsonFile: any): Promise<InsertVocabularyWord[]> {
const response = await jsonFile.text();
if (!response) {
throw new Error(`File error!`);
}
let data;
try {
data = JSON.parse(response);
} catch (e) {
throw new Error(`JSON parse error: ${e}`);
}
return validateVocabularyFile(data);
}

// アップロードされるファイルから取得した単語を検証する関数
export function validateVocabularyFile(data: any): InsertVocabularyWord[] {
const parsedFile = vocabularyFileSchema.safeParse({ words: data });
if (!parsedFile.success) {
throw new Error(`ファイル検証エラー: ${parsedFile.error.errors.map(e => e.message).join(", ")}`);
}

return parsedFile.data.words.map((item: any, index: number) => {
const parsed = insertVocabularyWordSchema.safeParse(item);
if (!parsed.success) {
throw new Error(`行 ${index + 1}: ${parsed.error.errors.map(e => e.message).join(", ")}`);
}
return parsed.data;
});
}

// SSR環境でもエラーにならないようにlocalStorageの使用をチェック
export function getProgressFromLocalStorage(userId: string): Record<string, boolean> {
if (typeof window === 'undefined') {
return {};
}
try {
const stored = localStorage.getItem(`vocabulary-progress-${userId}`);
return stored ? JSON.parse(stored) : {};
} catch {
return {};
}
}

export function saveProgressToLocalStorage(userId: string, wordId: string, isRemembered: boolean) {
if (typeof window === 'undefined') {
return;
}
try {
const progress = getProgressFromLocalStorage(userId);
progress[wordId] = isRemembered;
localStorage.setItem(`vocabulary-progress-${userId}`, JSON.stringify(progress));
} catch (error) {
console.error("Failed to save progress to localStorage:", error);
}
}