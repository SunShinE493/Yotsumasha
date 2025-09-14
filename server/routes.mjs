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

  // Upload vocabulary JSON file
  app.post("/api/vocabulary/upload", optionalAuthentication, async (req, res) => {
    try {
      const { words } = vocabularyFileSchema.parse(req.body);
      const userId = req.userId;

      // Clear existing words and upload new ones for this user
      await storage.clearVocabularyWords(userId);
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
      const sourceFile = req.query.source; // 'koumin.json'など

      let words;
      if (sourceFile) {
        // JSONファイルから読み込む
        words = await loadVocabularyFromJson(sourceFile);
      } else {
        // MemStorageから読み込む
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
      const sourceFile = req.query.source; // 'koumin.json'など

      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        return res.status(400).json({ message: "Invalid range parameters" });
      }

      let words;
      if (sourceFile) {
        // JSONファイルから読み込み、範囲を適用
        const allWords = await loadVocabularyFromJson(sourceFile);
        words = allWords.slice(start - 1, end);
      } else {
        // MemStorageから読み込み、範囲を適用
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

      // Get vocabulary words for this session
      let words;
      if (config.sourceFile) {
        // Get words from JSON file
        const allWords = await loadVocabularyFromJson(config.sourceFile);
        words = allWords.slice(config.startRange - 1, config.endRange);
      } else {
        // Get words from user storage
        words = await storage.getVocabularyWordsInRange(userId, config.startRange, config.endRange);
      }

      // Shuffle words if random order is requested
      if (config.order === "random") {
        words = words.sort(() => Math.random() - 0.5);
      }

      // Limit to questionCount
      words = words.slice(0, config.questionCount);

      // Include words in the session response
      const sessionWithWords = {
        ...session,
        words,
        progress: [],
        incorrectWords: []
      };

      res.json(sessionWithWords);
    } catch (error) {
      res.status(400).json({ 
        message: "Invalid study configuration",
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

  // Update study session
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

  // Update study session (PUT method for frontend compatibility)
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

  const httpServer = createServer(app);
  return httpServer;
}
