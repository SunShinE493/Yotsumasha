import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const vocabularyWords = pgTable("vocabulary_words", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  word: text("word").notNull(),
  meaning: text("meaning").notNull(),
  category: text("category"),
  example: text("example"),
  difficulty: integer("difficulty").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const studySessions = pgTable("study_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  startRange: integer("start_range").notNull(),
  endRange: integer("end_range").notNull(),
  totalWords: integer("total_words").notNull(),
  correctCount: integer("correct_count").default(0),
  incorrectCount: integer("incorrect_count").default(0),
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const wordProgress = pgTable("word_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  wordId: varchar("word_id").references(() => vocabularyWords.id),
  sessionId: varchar("session_id").references(() => studySessions.id),
  isRemembered: boolean("is_remembered").notNull(),
  attempts: integer("attempts").default(1),
  lastStudied: timestamp("last_studied").defaultNow(),
});

// Zod schemas
export const insertVocabularyWordSchema = createInsertSchema(vocabularyWords).pick({
  word: true,
  meaning: true,
  category: true,
  example: true,
  difficulty: true,
});

export const insertStudySessionSchema = createInsertSchema(studySessions).pick({
  startRange: true,
  endRange: true,
  totalWords: true,
});

export const insertWordProgressSchema = createInsertSchema(wordProgress).pick({
  wordId: true,
  sessionId: true,
  isRemembered: true,
  attempts: true,
});

// Additional schemas for API
export const vocabularyFileSchema = z.object({
  words: z.array(z.object({
    word: z.string(),
    meaning: z.string(),
    category: z.string().optional(),
    example: z.string().optional(),
    difficulty: z.number().min(1).max(5).optional(),
  }))
});

export const studyConfigSchema = z.object({
  startRange: z.number().min(1),
  endRange: z.number().min(1),
  questionCount: z.number().min(1),
  order: z.enum(["sequential", "random", "difficulty"]),
  reviewOnly: z.boolean().default(false),
});

// Types
export type VocabularyWord = typeof vocabularyWords.$inferSelect;
export type InsertVocabularyWord = z.infer<typeof insertVocabularyWordSchema>;
export type StudySession = typeof studySessions.$inferSelect;
export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;
export type WordProgress = typeof wordProgress.$inferSelect;
export type InsertWordProgress = z.infer<typeof insertWordProgressSchema>;
export type VocabularyFile = z.infer<typeof vocabularyFileSchema>;
export type StudyConfig = z.infer<typeof studyConfigSchema>;
