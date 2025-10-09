import { createServer } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage.mjs";
import { loadVocabularyFromJson } from "./utils.mjs";
import { setupAuth, isAuthenticated, optionalAuthentication } from "./auth.mjs";
import { 
  vocabularyFileSchema, 
  studyConfigSchema, 
  insertWordProgressSchema 
} from "../shared/schema.mjs";

export async function registerRoutes(app) {
  // Setup authentication middleware
  setupAuth(app);

  // Guest access route - allows users to continue without login
  app.post('/api/guest/continue', (req, res) => {
    // Generate unique guest ID per session
    if (!req.session.guestId) {
      req.session.guestId = `guest_${randomUUID()}`;
    }

    res.json({ 
      id: req.session.guestId,
      username: 'ゲストユーザー',
      isGuest: true,
      message: 'ゲストとしてアクセス中です' 
    });
  });

  // Guest logout/clear route - clears guest session data
  app.post('/api/guest/logout', (req, res) => {
    if (req.session.guestId) {
      // Clear guest data from storage
      storage.clearGuestData(req.session.guestId);

      // Clear guest ID from session
      delete req.session.guestId;
    }

    res.json({ message: 'ゲストデータをクリアしました' });
  });

  // --- Admin backup/restore gated by env ---
  function isBackupAdmin(req) {
    const envUser = process.env.BACKUP_ADMIN_EMAIL;
    const envPass = process.env.BACKUP_ADMIN_PASSWORD;
    const bodyEmail = req.body?.email;
    const bodyPassword = req.body?.password;
    const sessionUserEmail = req.user?.username || null;
    const isDevFlag = req.user?.isDev === true;
    // Developer flag in session grants access directly
    if (isDevFlag) return true;
    // Otherwise require env credentials and that the logged-in user matches admin email
    return (
      !!envUser && !!envPass &&
      bodyEmail === envUser &&
      bodyPassword === envPass &&
      sessionUserEmail === envUser
    );
  }

  // CSRF-exempt for developer account (handled in auth through isDev)
  app.post('/api/admin/export', optionalAuthentication, async (req, res) => {
    try {
      if (!isBackupAdmin(req)) return res.status(403).json({ message: 'forbidden' });
      const full = req.body && req.body.full === true;
      // If "all" flag is provided, export all users' data
      if (req.body && req.body.all === true) {
        const all = full ? await storage.exportAllUsersDataFull() : await storage.exportAllUsersData();
        return res.json(all);
      }
      const data = full ? await storage.exportUserDataFull(req.userId) : await storage.exportUserData(req.userId);
      return res.json(data);
    } catch (e) {
      res.status(500).json({ message: 'failed to export' });
    }
  });

  app.post('/api/admin/import', optionalAuthentication, async (req, res) => {
    try {
      if (!isBackupAdmin(req)) return res.status(403).json({ message: 'forbidden' });
      const body = req.body || {};
      // Bulk import: support users at top-level or inside data
      const list = Array.isArray(body.users) ? body.users : (Array.isArray(body.data?.users) ? body.data.users : null);
      if (list) {
        let count = 0;
        for (const entry of list) {
          const u = entry?.user || {};
          // Upsert user meta first (id/username/isDev/displayName)
          const up = await storage.upsertUser({
            id: u.id,
            username: u.username || u.email || null,
            isDev: !!u.isDev,
            displayName: u.displayName || null,
            isGuest: !!u.isGuest,
          });
          // Accept shapes: {data:{...}} or {reviewWords:[...]}
          const payload = entry?.data || entry;
          await storage.importUserData(up.id, payload);
          count++;
        }
        return res.json({ ok: true, imported: count });
      }
      // Single import; allow specifying target user in payload
      const userMeta = body.user || body.data?.user;
      let targetId = req.userId;
      if (userMeta) {
        const up = await storage.upsertUser({
          id: userMeta.id,
          username: userMeta.username || userMeta.email || null,
          isDev: !!userMeta.isDev,
          displayName: userMeta.displayName || null,
          isGuest: !!userMeta.isGuest,
        });
        targetId = up.id;
      }
      // Accept shapes: { data: {...} } OR { reviewWords: [...] }
      const payload = body?.data || body;
      await storage.importUserData(targetId, payload);
      res.json({ ok: true, userId: targetId });
    } catch (e) {
      res.status(500).json({ message: 'failed to import' });
    }
  });

  // --- Open rooms listing for battle ---
  // Provide a lightweight endpoint that lists room IDs and player counts
  app.get('/api/battle/rooms', (req, res) => {
    try {
      // Expose indirectly via storage/session map on server; since rooms are in main.mjs,
      // use a global publisher -- for simplicity, return 501 if not available in this module.
      res.status(501).json({ message: 'rooms listing not available on this route handler' });
    } catch (e) {
      res.status(500).json({ message: 'failed' });
    }
  });

  // Upload vocabulary JSON file
  app.post("/api/vocabulary/upload", optionalAuthentication, async (req, res) => {
    try {
      const { words } = vocabularyFileSchema.parse(req.body);
      const userId = req.userId;

      // Append words without clearing existing vocabulary to preserve review and prior datasets
      const createdWords = await storage.createVocabularyWords(userId, words);

      res.json({
        message: "Vocabulary uploaded successfully",
        count: createdWords.length,
        words: createdWords
      });
    } catch (error) {
      res.status(400).json({ 
        message: "Invalid vocabulary file format",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get all vocabulary words
  app.get("/api/vocabulary", optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const sourceFile = req.query.source;

      let words;
      if (sourceFile) {
        // Load from JSON file
        words = await loadVocabularyFromJson(sourceFile);
      } else {
        // Load from MemStorage
        words = await storage.getVocabularyWords(userId);
      }
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: error.message || "Failed to fetch vocabulary" });
    }
  });

  // Get vocabulary words in range
  app.get("/api/vocabulary/range/:start/:end", optionalAuthentication, async (req, res) => {
    try {
      const start = parseInt(req.params.start);
      const end = parseInt(req.params.end);
      const userId = req.userId;
      const sourceFile = req.query.source;

      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        return res.status(400).json({ message: "Invalid range parameters" });
      }

      let words;
      if (sourceFile) {
        const allWords = await loadVocabularyFromJson(sourceFile);
        words = allWords.slice(start - 1, end);
      } else {
        words = await storage.getVocabularyWordsInRange(userId, start, end);
      }
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: error.message || "Failed to fetch vocabulary range" });
    }
  });

  // Create study session
  app.post("/api/study/session", optionalAuthentication, async (req, res) => {
    try {
      const config = studyConfigSchema.parse(req.body);
      const userId = req.userId;

      const session = await storage.createStudySession(userId, {
        startRange: config.startRange,
        endRange: config.endRange,
        totalWords: config.questionCount,
        sourceFile: config.sourceFile,
      });

      let words;
      if (config.sourceFile) {
        const allWords = await loadVocabularyFromJson(config.sourceFile);
        words = allWords.slice(config.startRange - 1, config.endRange);
      } else {
        words = await storage.getVocabularyWordsInRange(userId, config.startRange, config.endRange);
      }

      if (config.order === "random") {
        words = words.sort(() => Math.random() - 0.5);
      }

      words = words.slice(0, config.questionCount);

      const reviewWords = await storage.getReviewWords(userId);

      const sessionWithWords = {
        ...session,
        words,
        progress: [],
        incorrectWords: reviewWords,
      };

      res.json(sessionWithWords);
    } catch (error) {
      res.status(400).json({ 
        message: "セッションの作成に失敗しました。無効な学習設定です。",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get study session
  app.get("/api/study/session/:id", optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const session = await storage.getStudySession(userId, req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Study session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch study session" });
    }
  });

  // Update study session (PATCH and PUT)
  app.patch("/api/study/session/:id", optionalAuthentication, async (req, res) => {
    try {
      const updates = req.body;
      const userId = req.userId;
      const session = await storage.updateStudySession(userId, req.params.id, updates);
      if (!session) {
        return res.status(404).json({ message: "Study session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update study session" });
    }
  });

  app.put("/api/study/session/:id", optionalAuthentication, async (req, res) => {
    try {
      const updates = req.body;
      const userId = req.userId;
      const session = await storage.updateStudySession(userId, req.params.id, updates);
      if (!session) {
        return res.status(404).json({ message: "Study session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update study session" });
    }
  });

  // Record word progress
  app.post("/api/study/progress", optionalAuthentication, async (req, res) => {
    try {
      const progressData = insertWordProgressSchema.parse(req.body);
      const userId = req.userId;
      // The storage.createWordProgress function now handles the check-and-update logic
      const progress = await storage.createWordProgress(userId, progressData);
      res.json(progress);
    } catch (error) {
      res.status(400).json({ 
        message: "Invalid progress data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get session progress
  app.get("/api/study/progress/:sessionId", optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const progress = await storage.getWordProgressBySession(userId, req.params.sessionId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session progress" });
    }
  });

  // Get review words
  app.get("/api/vocabulary/review", optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const reviewWords = await storage.getReviewWords(userId);
      res.json(reviewWords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch review words" });
    }
  });

  // --- Score Attack APIs ---
  app.post('/api/score-attack/submit', optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const { score, summary } = req.body || {};
      if (typeof score !== 'number' || score < 0) {
        return res.status(400).json({ message: 'Invalid score' });
      }
      const record = await storage.saveScoreAttack(userId, score);
      // Optionally record run for rankings
      if (summary && typeof summary === 'object') {
        const payload = {
          score: Number(score),
          maxCombo: Number(summary.maxCombo)||0,
          correctCount: Number(summary.correctCount)||0,
          fileName: summary.fileName || null,
          start: Number(summary.start)||0,
          end: Number(summary.end)||0,
          limit: Number(summary.limit)||0,
        };
        await storage.addScoreAttackRun(userId, payload);
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: 'Failed to save score' });
    }
  });

  app.get('/api/score-attack/me', optionalAuthentication, async (req, res) => {
    try {
      const userId = req.userId;
      const record = await storage.getScoreAttack(userId);
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: 'Failed to load score' });
    }
  });

  // Rankings API
  app.get('/api/rankings', optionalAuthentication, async (req, res) => {
    try {
      const metric = String(req.query.metric || 'ppm'); // 'ppm' | 'combo' | 'correct'
      const period = String(req.query.period || 'overall'); // 'overall' | 'weekly' | 'monthly'
      const source = req.query.source ? String(req.query.source) : undefined;
      const list = await storage.getScoreAttackRankings({ metric, period, source });
      res.json(list);
    } catch (e) {
      res.status(500).json({ message: 'Failed to load rankings' });
    }
  });

  // User profile update (display name)
  app.post('/api/profile', optionalAuthentication, async (req, res) => {
    try {
      const { displayName } = req.body || {};
      const user = await storage.updateUserProfile(req.userId, { displayName });
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ ok: true, user: { id: user.id, username: user.username, displayName: user.displayName } });
    } catch (e) {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // --- User datasets library ---
  app.get('/api/datasets', optionalAuthentication, async (req, res) => {
    try {
      const list = await storage.listDatasets(req.userId);
      res.json(list);
    } catch (e) {
      res.status(500).json({ message: 'Failed to list datasets' });
    }
  });

  app.post('/api/datasets', optionalAuthentication, async (req, res) => {
    try {
      const { name, words } = req.body || {};
      if (!name || !Array.isArray(words)) {
        return res.status(400).json({ message: 'Invalid dataset' });
      }
      const saved = await storage.saveDataset(req.userId, name, words);
      res.json(saved);
    } catch (e) {
      res.status(500).json({ message: 'Failed to save dataset' });
    }
  });

  app.post('/api/datasets/apply', optionalAuthentication, async (req, res) => {
    try {
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ message: 'name required' });
      const result = await storage.applyDataset(req.userId, name);
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: 'Failed to apply dataset' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
