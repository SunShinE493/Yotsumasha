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
  app.post("/api/vocabulary/upload", async (req, res) => {
    try {
      const { words } = vocabularyFileSchema.parse(req.body);
      
      // Clear existing words and upload new ones
      await storage.clearVocabularyWords();
      const createdWords = await storage.createVocabularyWords(words);
      
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
  app.get("/api/vocabulary", async (req, res) => {
    try {
      const words = await storage.getVocabularyWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vocabulary" });
    }
  });

  // Get vocabulary words in range
  app.get("/api/vocabulary/range/:start/:end", async (req, res) => {
    try {
      const start = parseInt(req.params.start);
      const end = parseInt(req.params.end);
      
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        return res.status(400).json({ message: "Invalid range parameters" });
      }
      
      const words = await storage.getVocabularyWordsInRange(start, end);
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vocabulary range" });
    }
  });

  // Create study session
  app.post("/api/study/session", async (req, res) => {
    try {
      const config = studyConfigSchema.parse(req.body);
      
      const session = await storage.createStudySession({
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
  app.get("/api/study/session/:id", async (req, res) => {
    try {
      const session = await storage.getStudySession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Study session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch study session" });
    }
  });

  // Update study session
  app.patch("/api/study/session/:id", async (req, res) => {
    try {
      const updates = req.body;
      const session = await storage.updateStudySession(req.params.id, updates);
      if (!session) {
        return res.status(404).json({ message: "Study session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update study session" });
    }
  });

  // Record word progress
  app.post("/api/study/progress", async (req, res) => {
    try {
      const progressData = insertWordProgressSchema.parse(req.body);
      const progress = await storage.createWordProgress(progressData);
      res.json(progress);
    } catch (error) {
      res.status(400).json({ 
        message: "Invalid progress data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get session progress
  app.get("/api/study/progress/:sessionId", async (req, res) => {
    try {
      const progress = await storage.getWordProgressBySession(req.params.sessionId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session progress" });
    }
  });

  // Get review words
  app.get("/api/vocabulary/review", async (req, res) => {
    try {
      const reviewWords = await storage.getReviewWords();
      res.json(reviewWords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch review words" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
