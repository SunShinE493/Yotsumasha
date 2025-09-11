import { z } from "zod";

// Zod schemas for server use
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

export const insertWordProgressSchema = z.object({
  wordId: z.string().optional(),
  sessionId: z.string().optional(),
  isRemembered: z.boolean(),
  attempts: z.number().optional(),
});