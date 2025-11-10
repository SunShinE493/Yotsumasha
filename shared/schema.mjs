import { z } from "zod";

// User authentication schemas
export const insertUserSchema = z.object({
  username: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export const loginUserSchema = z.object({
  username: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

// Vocabulary schemas
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
  sourceFile: z.string().optional(),
});

export const insertWordProgressSchema = z.object({
  wordId: z.string().optional(),
  sessionId: z.string().optional(),
  isRemembered: z.boolean(),
  attempts: z.number().optional(),
  // Optional word payload to upsert into vocabulary if missing
  word: z
    .object({
      id: z.string().optional(),
      word: z.string(),
      meaning: z.string(),
      category: z.string().optional(),
      example: z.string().optional(),
      difficulty: z.number().min(1).max(5).optional(),
    })
    .optional(),
});