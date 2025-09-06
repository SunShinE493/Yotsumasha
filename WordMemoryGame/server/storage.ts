import { 
  type VocabularyWord, 
  type InsertVocabularyWord,
  type StudySession,
  type InsertStudySession,
  type WordProgress,
  type InsertWordProgress
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Vocabulary Words
  getVocabularyWords(): Promise<VocabularyWord[]>;
  getVocabularyWordsInRange(start: number, end: number): Promise<VocabularyWord[]>;
  createVocabularyWord(word: InsertVocabularyWord): Promise<VocabularyWord>;
  createVocabularyWords(words: InsertVocabularyWord[]): Promise<VocabularyWord[]>;
  clearVocabularyWords(): Promise<void>;
  
  // Study Sessions
  createStudySession(session: InsertStudySession): Promise<StudySession>;
  getStudySession(id: string): Promise<StudySession | undefined>;
  updateStudySession(id: string, updates: Partial<StudySession>): Promise<StudySession | undefined>;
  
  // Word Progress
  createWordProgress(progress: InsertWordProgress): Promise<WordProgress>;
  getWordProgressBySession(sessionId: string): Promise<WordProgress[]>;
  getReviewWords(): Promise<(WordProgress & { word: VocabularyWord })[]>;
  updateWordProgress(id: string, updates: Partial<WordProgress>): Promise<WordProgress | undefined>;
}

export class MemStorage implements IStorage {
  private vocabularyWords: Map<string, VocabularyWord> = new Map();
  private studySessions: Map<string, StudySession> = new Map();
  private wordProgress: Map<string, WordProgress> = new Map();
  private nextWordIndex: number = 1;

  async getVocabularyWords(): Promise<VocabularyWord[]> {
    return Array.from(this.vocabularyWords.values()).sort((a, b) => a.word.localeCompare(b.word));
  }

  async getVocabularyWordsInRange(start: number, end: number): Promise<VocabularyWord[]> {
    const allWords = Array.from(this.vocabularyWords.values()).sort((a, b) => a.word.localeCompare(b.word));
    return allWords.slice(start - 1, end);
  }

  async createVocabularyWord(insertWord: InsertVocabularyWord): Promise<VocabularyWord> {
    const id = randomUUID();
    const word: VocabularyWord = {
      ...insertWord,
      id,
      category: insertWord.category || null,
      example: insertWord.example || null,
      difficulty: insertWord.difficulty || null,
      createdAt: new Date(),
    };
    this.vocabularyWords.set(id, word);
    return word;
  }

  async createVocabularyWords(insertWords: InsertVocabularyWord[]): Promise<VocabularyWord[]> {
    const words: VocabularyWord[] = [];
    for (const insertWord of insertWords) {
      const word = await this.createVocabularyWord(insertWord);
      words.push(word);
    }
    return words;
  }

  async clearVocabularyWords(): Promise<void> {
    this.vocabularyWords.clear();
    this.nextWordIndex = 1;
  }

  async createStudySession(insertSession: InsertStudySession): Promise<StudySession> {
    const id = randomUUID();
    const session: StudySession = {
      ...insertSession,
      id,
      correctCount: 0,
      incorrectCount: 0,
      isCompleted: false,
      createdAt: new Date(),
    };
    this.studySessions.set(id, session);
    return session;
  }

  async getStudySession(id: string): Promise<StudySession | undefined> {
    return this.studySessions.get(id);
  }

  async updateStudySession(id: string, updates: Partial<StudySession>): Promise<StudySession | undefined> {
    const session = this.studySessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.studySessions.set(id, updatedSession);
    return updatedSession;
  }

  async createWordProgress(insertProgress: InsertWordProgress): Promise<WordProgress> {
    const id = randomUUID();
    const progress: WordProgress = {
      ...insertProgress,
      id,
      wordId: insertProgress.wordId || null,
      sessionId: insertProgress.sessionId || null,
      attempts: insertProgress.attempts || 1,
      lastStudied: new Date(),
    };
    this.wordProgress.set(id, progress);
    return progress;
  }

  async getWordProgressBySession(sessionId: string): Promise<WordProgress[]> {
    return Array.from(this.wordProgress.values()).filter(p => p.sessionId === sessionId);
  }

  async getReviewWords(): Promise<(WordProgress & { word: VocabularyWord })[]> {
    const reviewProgress = Array.from(this.wordProgress.values())
      .filter(p => !p.isRemembered)
      .sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
    
    const result: (WordProgress & { word: VocabularyWord })[] = [];
    for (const progress of reviewProgress) {
      const word = this.vocabularyWords.get(progress.wordId!);
      if (word) {
        result.push({ ...progress, word });
      }
    }
    return result;
  }

  async updateWordProgress(id: string, updates: Partial<WordProgress>): Promise<WordProgress | undefined> {
    const progress = this.wordProgress.get(id);
    if (!progress) return undefined;
    
    const updatedProgress = { 
      ...progress, 
      ...updates,
      lastStudied: new Date()
    };
    this.wordProgress.set(id, updatedProgress);
    return updatedProgress;
  }
}

export const storage = new MemStorage();
