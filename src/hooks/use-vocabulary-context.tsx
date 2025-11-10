import { createContext, useContext, useState, ReactNode } from "react";
import { VocabularyWord } from "@shared/schema";

interface VocabularyContextType {
  words: VocabularyWord[];
  setWords: (words: VocabularyWord[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const VocabularyContext = createContext<VocabularyContextType | undefined>(undefined);

export function VocabularyProvider({ children }: { children: ReactNode }) {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <VocabularyContext.Provider value={{
      words,
      setWords,
      isLoading,
      setIsLoading
    }}>
      {children}
    </VocabularyContext.Provider>
  );
}

export function useVocabularyContext() {
  const context = useContext(VocabularyContext);
  if (context === undefined) {
    throw new Error('useVocabularyContext must be used within a VocabularyProvider');
  }
  return context;
}