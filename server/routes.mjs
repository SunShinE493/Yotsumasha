import { createServer } from "http";
import { storage } from "./storage.mjs";
import { setupAuth, isAuthenticated } from "./replitAuth.mjs";
import { 
  vocabularyFileSchema, 
  studyConfigSchema, 
  insertWordProgressSchema 
} from "../shared/schema.mjs";

export async function registerRoutes(app) {
  // Setup authentication middleware
  await setupAuth(app);

  // Auth routes - Referenced from javascript_log_in_with_replit integration
  app.get('/api/auth/user', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // Upload vocabulary JSON file
  app.post("/api/vocabulary/upload", isAuthenticated, async (req, res) => {
    try {
      const { words } = vocabularyFileSchema.parse(req.body);
      const userId = req.user.claims.sub;
      
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
  app.get("/api/vocabulary", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const words = await storage.getVocabularyWords(userId);
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vocabulary" });
    }
  });

  // Get vocabulary words in range
  app.get("/api/vocabulary/range/:start/:end", isAuthenticated, async (req, res) => {
    try {
      const start = parseInt(req.params.start);
      const end = parseInt(req.params.end);
      const userId = req.user.claims.sub;
      
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        return res.status(400).json({ message: "Invalid range parameters" });
      }
      
      const words = await storage.getVocabularyWordsInRange(userId, start, end);
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vocabulary range" });
    }
  });

  // Create study session
  app.post("/api/study/session", isAuthenticated, async (req, res) => {
    try {
      const config = studyConfigSchema.parse(req.body);
      const userId = req.user.claims.sub;
      
      const session = await storage.createStudySession(userId, {
        startRange: config.startRange,
        endRange: config.endRange,
        totalWords: config.questionCount
      });
      
      res.json(session);
    } catch (error) {
      res.status(400).json({ 
        message: "Invalid study configuration",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get study session
  app.get("/api/study/session/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.patch("/api/study/session/:id", isAuthenticated, async (req, res) => {
    try {
      const updates = req.body;
      const userId = req.user.claims.sub;
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
  app.post("/api/study/progress", isAuthenticated, async (req, res) => {
    try {
      const progressData = insertWordProgressSchema.parse(req.body);
      const userId = req.user.claims.sub;
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
  app.get("/api/study/progress/:sessionId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const progress = await storage.getWordProgressBySession(userId, req.params.sessionId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session progress" });
    }
  });

  // Get review words
  app.get("/api/vocabulary/review", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const reviewWords = await storage.getReviewWords(userId);
      res.json(reviewWords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch review words" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
