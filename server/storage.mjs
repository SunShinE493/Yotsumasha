import { randomUUID } from "crypto";

export class MemStorage {
  constructor() {
    this.users = new Map();
    // User-specific data maps: userId -> Map<id, data>
    this.vocabularyWords = new Map(); // userId -> Map<wordId, word>
    this.studySessions = new Map(); // userId -> Map<sessionId, session>
    this.wordProgress = new Map(); // userId -> Map<progressId, progress>
    this.nextWordIndex = new Map(); // userId -> nextIndex
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

  async getVocabularyWords(userId) {
    const userWords = this.vocabularyWords.get(userId) || new Map();
    return Array.from(userWords.values()).sort((a, b) => a.word.localeCompare(b.word));
  }

  async getVocabularyWordsInRange(userId, start, end) {
    const userWords = this.vocabularyWords.get(userId) || new Map();
    const allWords = Array.from(userWords.values()).sort((a, b) => a.word.localeCompare(b.word));
    return allWords.slice(start - 1, end);
  }

  async createVocabularyWord(userId, insertWord) {
    const id = randomUUID();
    const word = {
      ...insertWord,
      id,
      category: insertWord.category || null,
      example: insertWord.example || null,
      difficulty: insertWord.difficulty || null,
      createdAt: new Date(),
    };
    
    if (!this.vocabularyWords.has(userId)) {
      this.vocabularyWords.set(userId, new Map());
    }
    this.vocabularyWords.get(userId).set(id, word);
    return word;
  }

  async createVocabularyWords(userId, insertWords) {
    const words = [];
    for (const insertWord of insertWords) {
      const word = await this.createVocabularyWord(userId, insertWord);
      words.push(word);
    }
    return words;
  }

  async clearVocabularyWords(userId) {
    if (this.vocabularyWords.has(userId)) {
      this.vocabularyWords.get(userId).clear();
    }
    this.nextWordIndex.set(userId, 1);
  }

  async createStudySession(userId, insertSession) {
    const id = randomUUID();
    const session = {
      ...insertSession,
      id,
      correctCount: 0,
      incorrectCount: 0,
      isCompleted: false,
      createdAt: new Date(),
    };
    
    if (!this.studySessions.has(userId)) {
      this.studySessions.set(userId, new Map());
    }
    this.studySessions.get(userId).set(id, session);
    return session;
  }

  async getStudySession(userId, id) {
    const userSessions = this.studySessions.get(userId) || new Map();
    return userSessions.get(id);
  }

  async updateStudySession(userId, id, updates) {
    const userSessions = this.studySessions.get(userId) || new Map();
    const session = userSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    userSessions.set(id, updatedSession);
    return updatedSession;
  }

  async createWordProgress(userId, insertProgress) {
    const id = randomUUID();
    const progress = {
      ...insertProgress,
      id,
      wordId: insertProgress.wordId || null,
      sessionId: insertProgress.sessionId || null,
      attempts: insertProgress.attempts || 1,
      lastStudied: new Date(),
    };
    
    if (!this.wordProgress.has(userId)) {
      this.wordProgress.set(userId, new Map());
    }
    this.wordProgress.get(userId).set(id, progress);
    return progress;
  }

  async getWordProgressBySession(userId, sessionId) {
    const userProgress = this.wordProgress.get(userId) || new Map();
    return Array.from(userProgress.values()).filter(p => p.sessionId === sessionId);
  }

  async getReviewWords(userId) {
    const userProgress = this.wordProgress.get(userId) || new Map();
    const userWords = this.vocabularyWords.get(userId) || new Map();
    
    const reviewProgress = Array.from(userProgress.values())
      .filter(p => !p.isRemembered)
      .sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
    
    const result = [];
    for (const progress of reviewProgress) {
      const word = userWords.get(progress.wordId);
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
