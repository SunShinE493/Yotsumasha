import { randomUUID } from "crypto";

export class MemStorage {
  constructor() {
    this.users = new Map();
    this.vocabularyWords = new Map();
    this.studySessions = new Map();
    this.wordProgress = new Map();
    this.nextWordIndex = 1;
  }

  // User operations - Referenced from javascript_log_in_with_replit integration
  async getUser(id) {
    return this.users.get(id);
  }

  async upsertUser(userData) {
    const existingUser = this.users.get(userData.id);
    const user = {
      ...userData,
      id: userData.id,
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getVocabularyWords() {
    return Array.from(this.vocabularyWords.values()).sort((a, b) => a.word.localeCompare(b.word));
  }

  async getVocabularyWordsInRange(start, end) {
    const allWords = Array.from(this.vocabularyWords.values()).sort((a, b) => a.word.localeCompare(b.word));
    return allWords.slice(start - 1, end);
  }

  async createVocabularyWord(insertWord) {
    const id = randomUUID();
    const word = {
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

  async createVocabularyWords(insertWords) {
    const words = [];
    for (const insertWord of insertWords) {
      const word = await this.createVocabularyWord(insertWord);
      words.push(word);
    }
    return words;
  }

  async clearVocabularyWords() {
    this.vocabularyWords.clear();
    this.nextWordIndex = 1;
  }

  async createStudySession(insertSession) {
    const id = randomUUID();
    const session = {
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

  async getStudySession(id) {
    return this.studySessions.get(id);
  }

  async updateStudySession(id, updates) {
    const session = this.studySessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.studySessions.set(id, updatedSession);
    return updatedSession;
  }

  async createWordProgress(insertProgress) {
    const id = randomUUID();
    const progress = {
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

  async getWordProgressBySession(sessionId) {
    return Array.from(this.wordProgress.values()).filter(p => p.sessionId === sessionId);
  }

  async getReviewWords() {
    const reviewProgress = Array.from(this.wordProgress.values())
      .filter(p => !p.isRemembered)
      .sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
    
    const result = [];
    for (const progress of reviewProgress) {
      const word = this.vocabularyWords.get(progress.wordId);
      if (word) {
        result.push({ ...progress, word });
      }
    }
    return result;
  }

  async updateWordProgress(id, updates) {
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
