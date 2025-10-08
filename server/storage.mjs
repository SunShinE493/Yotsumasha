import { randomUUID } from "crypto";
import createMemoryStore from "memorystore";
import session from "express-session";

const MemoryStore = createMemoryStore(session);

export class MemStorage {
  constructor() {
    this.users = new Map();
    // User-specific data maps: userId -> Map<id, data>
    this.vocabularyWords = new Map(); // userId -> Map<wordId, word>
    this.studySessions = new Map(); // userId -> Map<sessionId, session>
    // wordProgress is now keyed by a composite of wordId and sessionId to prevent duplicates
    this.wordProgress = new Map(); // userId -> Map<compositeKey, progress>
    this.nextWordIndex = new Map(); // userId -> nextIndex

    // User datasets library: userId -> Map<datasetName, words[]>
    this.userDatasets = new Map();

    // Score attack: userId -> record
    this.scoreAttack = new Map();

    // Session store for authentication
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }

  // User operations - Referenced from blueprint:javascript_auth_all_persistance integration
  async getUser(id) {
    return this.users.get(id);
  }

  async getUserByUsername(username) {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(userData) {
    const id = randomUUID();
    const user = {
      id,
      username: userData.username,
      password: userData.password,
      isGuest: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  // Guest user helper
  isGuestUser(userId) {
    return userId && userId.startsWith('guest_');
  }

  // Clear all data for a specific guest user
  clearGuestData(guestId) {
    if (this.isGuestUser(guestId)) {
      this.vocabularyWords.delete(guestId);
      this.studySessions.delete(guestId);
      this.wordProgress.delete(guestId);
      this.nextWordIndex.delete(guestId);
    }
  }

  async upsertUser(userData) {
    const existingUser = this.users.get(userData.id);
    const user = {
      ...userData,
      id: userData.id,
      username: userData.username || userData.email || null,
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      isGuest: userData.isGuest || false,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getVocabularyWords(userId) {
    const userWords = this.vocabularyWords.get(userId) || new Map();
    // Preserve insertion order (JSON order) instead of alphabetical sort
    return Array.from(userWords.values());
  }

  async getVocabularyWordsInRange(userId, start, end) {
    const userWords = this.vocabularyWords.get(userId) || new Map();
    // Preserve insertion order when slicing range
    const allWords = Array.from(userWords.values());
    return allWords.slice(start - 1, end);
  }

  async createVocabularyWord(userId, insertWord) {
    const id = insertWord.id || randomUUID();
    const word = {
      ...insertWord,
      id,
      category: insertWord.category || null,
      example: insertWord.example || null,
      difficulty: insertWord.difficulty || null,
      createdAt: insertWord.createdAt || new Date(),
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

  // --- User datasets library ---
  _ensureUserDatasetMap(userId) {
    if (!this.userDatasets.has(userId)) {
      this.userDatasets.set(userId, new Map());
    }
    return this.userDatasets.get(userId);
  }

  async saveDataset(userId, name, words) {
    const map = this._ensureUserDatasetMap(userId);
    const normalized = words.map((w) => ({
      id: w.id || randomUUID(),
      word: w.word,
      meaning: w.meaning,
      category: w.category || null,
      example: w.example || null,
      difficulty: w.difficulty || null,
      createdAt: w.createdAt || new Date(),
    }));
    map.set(name, normalized);
    return { name, count: normalized.length };
  }

  async listDatasets(userId) {
    const map = this.userDatasets.get(userId) || new Map();
    return Array.from(map.entries()).map(([name, arr]) => ({ name, count: arr.length }));
  }

  async applyDataset(userId, name) {
    const map = this.userDatasets.get(userId) || new Map();
    const arr = map.get(name);
    if (!arr) return { applied: false, count: 0 };
    this.vocabularyWords.set(userId, new Map());
    for (const w of arr) {
      await this.createVocabularyWord(userId, w);
    }
    return { applied: true, count: arr.length };
  }

  async createStudySession(userId, insertSession) {
    const id = randomUUID();
    const session = {
      ...insertSession,
      id,
      sourceFile: insertSession.sourceFile || null,
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

    console.log(`[DEBUG] updateStudySession called for user ${userId}, session ${id}`);
    console.log(`[DEBUG] Updates:`, JSON.stringify(updates, null, 2));

    const updatedSession = { ...session, ...updates };

    // If the session is being completed and has incorrect words, create word progress entries
    if (updates.isCompleted && updates.incorrectWords && Array.isArray(updates.incorrectWords)) {
      console.log(`[DEBUG] Session completed with ${updates.incorrectWords.length} incorrect words`);
      for (const word of updates.incorrectWords) {
        console.log(`[DEBUG] Processing incorrect word: ${word.id} - ${word.word}`);

        // Ensure the word exists in vocabularyWords first
        const userWords = this.vocabularyWords.get(userId) || new Map();
        if (!userWords.has(word.id)) {
          console.log(`[DEBUG] Word ${word.id} not found in vocabularyWords, creating it`);
          await this.createVocabularyWord(userId, word);
        }

        console.log(`[DEBUG] Creating/Updating word progress for word ${word.id}`);
        await this.createWordProgress(userId, {
          wordId: word.id,
          sessionId: id,
          isRemembered: false,
        });
      }
    } else {
      console.log(`[DEBUG] Session not completed or no incorrect words. isCompleted: ${updates.isCompleted}, incorrectWords length: ${updates.incorrectWords?.length || 0}`);
    }

    userSessions.set(id, updatedSession);
    return updatedSession;
  }

  async createWordProgress(userId, insertProgress) {
    const userProgress = this.wordProgress.get(userId) || new Map();
    // Ensure vocabulary contains the word; allow upsert if payload provided
    if (insertProgress.word && insertProgress.word.word && insertProgress.word.meaning) {
      const ensureId = insertProgress.wordId || insertProgress.word.id || randomUUID();
      insertProgress.word.id = ensureId;
      insertProgress.wordId = ensureId;
      const userWords = this.vocabularyWords.get(userId) || new Map();
      if (!userWords.has(ensureId)) {
        await this.createVocabularyWord(userId, insertProgress.word);
      }
    }
    const existingProgress = userProgress.get(insertProgress.wordId);

    if (existingProgress) {
      // If progress exists for this word, update it.
      const updatedProgress = {
        ...existingProgress,
        isRemembered: insertProgress.isRemembered,
        attempts: existingProgress.attempts + 1,
        lastStudied: new Date(),
        sessionId: insertProgress.sessionId,
      };
      userProgress.set(insertProgress.wordId, updatedProgress);
      console.log(`[DEBUG] Updated progress for wordId: ${insertProgress.wordId}`);
      return updatedProgress;
    } else {
      // If no progress exists, create a new entry.
      const progressId = randomUUID();
      const newProgress = {
        ...insertProgress,
        id: progressId,
        attempts: 0,
        lastStudied: new Date(),
        sessionId: insertProgress.sessionId,
      };
      userProgress.set(insertProgress.wordId, newProgress);
      this.wordProgress.set(userId, userProgress);
      console.log(`[DEBUG] Created new progress for wordId: ${insertProgress.wordId}`);
      return newProgress;
    }
  }

  async getWordProgressBySession(userId, sessionId) {
    const userProgress = this.wordProgress.get(userId) || new Map();
    return Array.from(userProgress.values()).filter(p => p.sessionId === sessionId);
  }

  async getReviewWords(userId) {
    console.log(`[DEBUG] getReviewWords called for user ${userId}`);
    const userProgress = this.wordProgress.get(userId) || new Map();
    const userWords = this.vocabularyWords.get(userId) || new Map();

    console.log(`[DEBUG] User has ${userProgress.size} progress entries`);
    console.log(`[DEBUG] User has ${userWords.size} vocabulary words`);

    // Use a unique set to get the most recent progress for each word
    const uniqueProgressMap = new Map();
    Array.from(userProgress.values()).forEach(p => {
      if (!uniqueProgressMap.has(p.wordId) || p.lastStudied > uniqueProgressMap.get(p.wordId).lastStudied) {
        uniqueProgressMap.set(p.wordId, p);
      }
    });

    const reviewProgress = Array.from(uniqueProgressMap.values())
      .filter(p => !p.isRemembered)
      .sort((a, b) => (b.attempts || 0) - (a.attempts || 0));

    console.log(`[DEBUG] Found ${reviewProgress.length} words needing review`);

    const result = [];
    for (const progress of reviewProgress) {
      const word = userWords.get(progress.wordId);
      if (word) {
        result.push({ ...progress, word });
        console.log(`[DEBUG] Added review word: ${word.word}`);
      } else if (progress.word && progress.word.word && progress.word.meaning) {
        // Fallback to embedded word payload if vocabulary no longer has it
        result.push({ ...progress, word: progress.word });
        console.log(`[DEBUG] Using embedded word for progress wordId ${progress.wordId}`);
      } else {
        console.log(`[DEBUG] Warning: No word found for progress wordId ${progress.wordId}`);
      }
    }
    console.log(`[DEBUG] Returning ${result.length} review words`);
    return result;
  }

  async updateWordProgress(userId, progressId, updates) {
    const userProgress = this.wordProgress.get(userId);
    if (!userProgress) return undefined;

    const progress = userProgress.get(progressId);
    if (!progress) return undefined;

    const updatedProgress = {
      ...progress,
      ...updates,
      lastStudied: new Date()
    };
    userProgress.set(progressId, updatedProgress);
    return updatedProgress;
  }

  // --- Export/Import all user data (backup/restore) ---
  async exportUserData(userId) {
    const words = await this.getVocabularyWords(userId);
    const sessions = Array.from((this.studySessions.get(userId) || new Map()).values());
    const progress = Array.from((this.wordProgress.get(userId) || new Map()).values());
    const datasets = await this.listDatasets(userId);
    const dsMap = this.userDatasets.get(userId) || new Map();
    const datasetPayload = {};
    for (const [name, arr] of dsMap.entries()) {
      datasetPayload[name] = arr;
    }
    const score = this.scoreAttack?.get(userId) || null;
    return { words, sessions, progress, datasets, datasetPayload, score };
  }

  async exportAllUsersData() {
    const result = [];
    for (const user of this.users.values()) {
      const userId = user.id;
      const data = await this.exportUserData(userId);
      const reviewWords = await this.getReviewWords(userId);
      result.push({
        user: { id: user.id, username: user.username, isDev: !!user.isDev },
        data,
        reviewWords,
      });
    }
    return { users: result };
  }

  async importUserData(userId, data) {
    // restore datasets
    if (data && data.datasetPayload && typeof data.datasetPayload === 'object') {
      const ds = new Map();
      for (const name of Object.keys(data.datasetPayload)) {
        ds.set(name, data.datasetPayload[name]);
      }
      this.userDatasets.set(userId, ds);
    }
    // restore vocabulary
    this.vocabularyWords.set(userId, new Map());
    if (Array.isArray(data?.words)) {
      for (const w of data.words) {
        await this.createVocabularyWord(userId, w);
      }
    }
    // restore sessions
    this.studySessions.set(userId, new Map());
    if (Array.isArray(data?.sessions)) {
      const m = this.studySessions.get(userId);
      for (const s of data.sessions) {
        m.set(s.id || randomUUID(), { ...s });
      }
    }
    // restore progress
    this.wordProgress.set(userId, new Map());
    if (Array.isArray(data?.progress)) {
      const m = this.wordProgress.get(userId);
      for (const p of data.progress) {
        m.set(p.wordId, { ...p });
      }
    }
    // restore score attack
    if (!this.scoreAttack) this.scoreAttack = new Map();
    if (data?.score) {
      this.scoreAttack.set(userId, data.score);
    }
    return true;
  }

  // --- Score Attack operations ---
  async saveScoreAttack(userId, score) {
    const prev = this.scoreAttack.get(userId) || { lastScore: 0, bestScore: 0, updatedAt: null };
    const record = {
      lastScore: score,
      bestScore: Math.max(prev.bestScore || 0, score),
      updatedAt: new Date(),
    };
    this.scoreAttack.set(userId, record);
    return record;
  }

  async getScoreAttack(userId) {
    return this.scoreAttack.get(userId) || { lastScore: 0, bestScore: 0, updatedAt: null };
  }
}

export const storage = new MemStorage();
