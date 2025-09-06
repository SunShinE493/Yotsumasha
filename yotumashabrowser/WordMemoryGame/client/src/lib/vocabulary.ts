import type { VocabularyWord } from "@shared/schema";

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function validateVocabularyFile(data: any): VocabularyWord[] {
  if (!Array.isArray(data)) {
    throw new Error("JSONファイルは配列形式である必要があります");
  }

  return data.map((item, index) => {
    if (!item.word || !item.meaning) {
      throw new Error(`行 ${index + 1}: wordとmeaningフィールドが必要です`);
    }

    return {
      id: "", // Will be set by server
      word: String(item.word).trim(),
      meaning: String(item.meaning).trim(),
      category: item.category ? String(item.category).trim() : "未分類",
      example: item.example ? String(item.example).trim() : null,
      difficulty: item.difficulty ? Number(item.difficulty) : 1,
      createdAt: new Date(),
    };
  });
}

export function getProgressFromLocalStorage(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem("vocabulary-progress");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveProgressToLocalStorage(wordId: string, isRemembered: boolean) {
  try {
    const progress = getProgressFromLocalStorage();
    progress[wordId] = isRemembered;
    localStorage.setItem("vocabulary-progress", JSON.stringify(progress));
  } catch (error) {
    console.error("Failed to save progress to localStorage:", error);
  }
}
