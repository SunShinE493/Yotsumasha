import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVocabularyWords } from "@/lib/api";
import type { VocabularyWord } from "@shared/schema";

interface VocabularyContextType {
  data: VocabularyWord[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const VocabularyContext = createContext<VocabularyContextType | undefined>(undefined);

export function useVocabularyContext() {
  const context = useContext(VocabularyContext);
  if (context === undefined) {
    throw new Error("useVocabularyContext must be used within a VocabularyProvider");
  }
  return context;
}

export function VocabularyProvider({ children }: { children: ReactNode }) {
  const {
    data: vocabularyWords = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<VocabularyWord[]>({
    queryKey: ["vocabularyWords"],
    queryFn: fetchVocabularyWords,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const value = {
    data: vocabularyWords,
    isLoading,
    isError,
    refetch,
  };

  return (
    <VocabularyContext.Provider value={value}>
      {children}
    </VocabularyContext.Provider>
  );
}
