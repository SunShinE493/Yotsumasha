import { randomUUID, createHash } from "crypto";
import fs from "fs";
import path from "path";
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
    this.scoreAttackRuns = new Map(); // userId -> Array<run>

    // Session store for authentication
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });

    // Persistence
    this.persistDir = path.join(process.cwd(), 'data');
    this.persistPath = path.join(this.persistDir, 'memstorage.json');
    this._saveTimer = null;
  }

  _stableUserId(username) {
    try {
      const h = createHash('sha256').update(String(username||'unknown')).digest('hex').slice(0, 16);
      return `user_${h}`;
    } catch {
      return `user_${randomUUID()}`;
    }
  }

  _scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._saveNow();
    }, 500);
  }

  _saveNow() {
    try {
      if (!fs.existsSync(this.persistDir)) fs.mkdirSync(this.persistDir, { recursive: true });
      const obj = this._toSerializable();
      fs.writeFileSync(this.persistPath, JSON.stringify(obj));
    } catch (e) {
      console.error('[Persist] save failed:', e?.message || e);
    }
  }

  async loadFromDisk() {
    try {
      if (!fs.existsSync(this.persistPath)) return false;
      const raw = fs.readFileSync(this.persistPath, 'utf-8');
      const data = JSON.parse(raw);
      this._fromSerializable(data);
      return true;
    } catch (e) {
      console.error('[Persist] load failed:', e?.message || e);
      return false;
    }
  }

  _toSerializable() {
    return {
      users: Array.from(this.users.values()),
      vocabularyWords: Array.from(this.vocabularyWords.entries()).map(([uid, map]) => [uid, Array.from(map.values())]),
      studySessions: Array.from(this.studySessions.entries()).map(([uid, map]) => [uid, Array.from(map.values())]),
      wordProgress: Array.from(this.wordProgress.entries()).map(([uid, map]) => [uid, Array.from(map.values())]),
      nextWordIndex: Array.from(this.nextWordIndex.entries()),
      userDatasets: Array.from(this.userDatasets.entries()).map(([uid, map]) => [uid, Array.from(map.entries())]),
      scoreAttack: Array.from(this.scoreAttack.entries()),
      scoreAttackRuns: Array.from(this.scoreAttackRuns.entries()),
    };
  }

  _fromSerializable(data) {
    try {
      this.users = new Map((data?.users || []).map(u => [u.id, u]));
      this.vocabularyWords = new Map((data?.vocabularyWords || []).map(([uid, arr]) => [uid, new Map((arr||[]).map(w => [w.id, w]))]));
      this.studySessions = new Map((data?.studySessions || []).map(([uid, arr]) => [uid, new Map((arr||[]).map(s => [s.id, s]))]));
      this.wordProgress = new Map((data?.wordProgress || []).map(([uid, arr]) => [uid, new Map((arr||[]).map(p => [p.wordId, p]))]));
      this.nextWordIndex = new Map(data?.nextWordIndex || []);
      this.userDatasets = new Map((data?.userDatasets || []).map(([uid, entries]) => [uid, new Map(entries || [])]));
      this.scoreAttack = new Map(data?.scoreAttack || []);
      this.scoreAttackRuns = new Map((data?.scoreAttackRuns || []).map(([uid, arr]) => [uid, Array.isArray(arr) ? arr : []]));
    } catch (e) {
      console.error('[Persist] populate failed:', e?.message || e);
    }
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
    const id = this._stableUserId(userData.username);
    const user = {
      id,
      username: userData.username,
      password: userData.password,
      isGuest: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    this._scheduleSave();
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
      id: userData.id || this._stableUserId(userData.username),
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
    this._scheduleSave();
    return user;
  }

  async updateUserProfile(userId, { displayName }) {
    const user = this.users.get(userId);
    if (!user) return null;
    const sanitized = (typeof displayName === 'string' && displayName.trim().length > 0) ? displayName.trim() : null;
    user.displayName = sanitized;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    this._scheduleSave();
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
    this._scheduleSave();
    return word;
  }

  async createVocabularyWords(userId, insertWords) {
    const words = [];
    for (const insertWord of insertWords) {
      const word = await this.createVocabularyWord(userId, insertWord);
      words.push(word);
    }
    this._scheduleSave();
    return words;
  }

  async clearVocabularyWords(userId) {
    if (this.vocabularyWords.has(userId)) {
      this.vocabularyWords.get(userId).clear();
    }
    this.nextWordIndex.set(userId, 1);
    this._scheduleSave();
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
    this._scheduleSave();
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
    this._scheduleSave();
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
    this._scheduleSave();
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
    this._scheduleSave();
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
      this._scheduleSave();
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
      this._scheduleSave();
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
    this._scheduleSave();
    return updatedProgress;
  }

  // --- Export (minimal) / Import all user data (backup/restore) ---
  // Minimal export: only account info and review (incorrect) words
  async exportUserData(userId) {
    const user = await this.getUser(userId);
    const reviewWords = await this.getReviewWords(userId);
    // reduce payload of reviewWords to essential fields
    const compact = (reviewWords || []).map((rw) => ({
      wordId: rw.word?.id || rw.wordId,
      word: rw.word ? { id: rw.word.id, word: rw.word.word, meaning: rw.word.meaning } : undefined,
    }));
    return {
      user: { id: userId, username: user?.username || null, displayName: user?.displayName || null, isDev: !!user?.isDev, isGuest: this.isGuestUser(userId) },
      reviewWords: compact,
    };
  }

  async exportAllUsersData() {
    const result = [];
    // Collect known users from the users map only (minimal and safe)
    for (const user of this.users.values()) {
      const userId = user.id;
      const minimal = await this.exportUserData(userId);
      result.push(minimal);
    }
    return { users: result };
  }

  async importUserData(userId, data) {
    // Normalize possible shapes
    let payload = data || {};
    if (Array.isArray(payload?.users)) {
      // Pick the matching user by id or username, else first entry
      const byId = payload.users.find((u) => u?.user?.id === userId);
      const user = this.users.get(userId);
      const byName = user ? payload.users.find((u) => u?.user?.username === user.username) : null;
      const chosen = byId || byName || payload.users[0];
      if (chosen?.data) payload = chosen.data;
      else if (chosen?.reviewWords) payload = { reviewWords: chosen.reviewWords };
    }

    // If classic full payload provided, import fully
    if (Array.isArray(payload?.words) || Array.isArray(payload?.sessions) || Array.isArray(payload?.progress)) {
      // restore datasets
      if (payload && payload.datasetPayload && typeof payload.datasetPayload === 'object') {
        const ds = new Map();
        for (const name of Object.keys(payload.datasetPayload)) {
          ds.set(name, payload.datasetPayload[name]);
        }
        this.userDatasets.set(userId, ds);
      }
      // restore vocabulary
      this.vocabularyWords.set(userId, new Map());
      if (Array.isArray(payload?.words)) {
        for (const w of payload.words) {
          await this.createVocabularyWord(userId, w);
        }
      }
      // restore sessions
      this.studySessions.set(userId, new Map());
      if (Array.isArray(payload?.sessions)) {
        const m = this.studySessions.get(userId);
        for (const s of payload.sessions) {
          m.set(s.id || randomUUID(), { ...s });
        }
      }
      // restore progress
      this.wordProgress.set(userId, new Map());
      if (Array.isArray(payload?.progress)) {
        const m = this.wordProgress.get(userId);
        for (const p of payload.progress) {
          m.set(p.wordId, { ...p });
        }
      }
      // restore score attack
      if (!this.scoreAttack) this.scoreAttack = new Map();
      if (payload?.score) {
        this.scoreAttack.set(userId, payload.score);
      }
      this._scheduleSave();
      return true;
    }

    // Minimal payload: reviewWords only -> append/replace review list
    if (Array.isArray(payload?.reviewWords)) {
      // Ensure maps exist
      if (!this.wordProgress.has(userId)) this.wordProgress.set(userId, new Map());
      const m = this.wordProgress.get(userId);
      for (const rw of payload.reviewWords) {
        const wid = rw.wordId || rw?.word?.id || randomUUID();
        if (rw.word) {
          // upsert vocabulary for this word
          await this.createVocabularyWord(userId, rw.word);
        }
        // Create/overwrite a progress entry marking as not remembered
        m.set(wid, {
          id: randomUUID(),
          wordId: wid,
          isRemembered: false,
          attempts: 0,
          lastStudied: new Date(),
          sessionId: null,
          word: rw.word,
        });
      }
      this.wordProgress.set(userId, m);
      this._scheduleSave();
      return true;
    }

    // Unknown shape, no-op
    return false;
  }

  async addScoreAttackRun(userId, run) {
    if (!this.scoreAttackRuns.has(userId)) this.scoreAttackRuns.set(userId, []);
    const list = this.scoreAttackRuns.get(userId);
    const user = this.users.get(userId);
    const playerName = user?.displayName || '名無しさん';
    const record = {
      playerName,
      userId,
      score: Number(run.score)||0,
      maxCombo: Number(run.maxCombo)||0,
      correctCount: Number(run.correctCount)||0,
      fileName: run.fileName || null,
      start: Number(run.start)||0,
      end: Number(run.end)||0,
      limit: Number(run.limit)||0,
      ppm: (Number(run.limit) > 0 ? (Number(run.score) / (Number(run.limit)/60)) : 0),
      createdAt: new Date(),
    };
    list.push(record);
    this.scoreAttackRuns.set(userId, list);
    this._scheduleSave();
    return record;
  }

  async getScoreAttackRankings({ metric = 'ppm', period = 'overall', source }) {
    // Collect all runs
    const all = [];
    for (const [uid, arr] of this.scoreAttackRuns.entries()) {
      for (const r of arr) {
        all.push(r);
      }
    }
    const now = new Date();
    const withinPeriod = (d) => {
      if (period === 'overall') return true;
      const diffMs = now - new Date(d);
      const dayMs = 24*60*60*1000;
      if (period === 'weekly') return diffMs <= 7*dayMs;
      if (period === 'monthly') return diffMs <= 30*dayMs;
      return true;
    };
    let filtered = all.filter(r => withinPeriod(r.createdAt));
    if (source) filtered = filtered.filter(r => r.fileName === source);
    const key = metric === 'combo' ? 'maxCombo' : (metric === 'correct' ? 'correctCount' : 'ppm');
    filtered.sort((a,b) => (b[key]||0) - (a[key]||0));
    return filtered.slice(0, 100);
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
    this._scheduleSave();
    return record;
  }

  async getScoreAttack(userId) {
    return this.scoreAttack.get(userId) || { lastScore: 0, bestScore: 0, updatedAt: null };
  }
}

export const storage = new MemStorage();
