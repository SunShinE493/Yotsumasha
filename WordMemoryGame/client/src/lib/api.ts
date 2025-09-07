// api.ts - API utility functions

import { apiRequest } from "./queryClient";
import type { VocabularyWord } from "@shared/schema";

export async function fetchVocabularyWords(): Promise<VocabularyWord[]> {
  const response = await apiRequest("GET", "/api/vocabulary");
  return response.json();
}

export async function fetchVocabularyWordsInRange(start: number, end: number): Promise<VocabularyWord[]> {
  const response = await apiRequest("GET", `/api/vocabulary/range/${start}/${end}`);
  return response.json();
}