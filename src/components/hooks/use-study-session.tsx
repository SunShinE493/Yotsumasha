import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StudySession, VocabularyWord } from "@shared/schema";

export function useStudySession(session: StudySession) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [studyWords, setStudyWords] = useState<VocabularyWord[]>([]);
  
  const isReviewSession = session.id.startsWith('review-');

  const { data: vocabularyWords = [] } = useQuery<VocabularyWord[]>({
    queryKey: isReviewSession 
      ? [`/api/vocabulary/review`] 
      : [`/api/vocabulary/range/${session.startRange}/${session.endRange}`],
  });

  useEffect(() => {
    if (vocabularyWords.length > 0) {
      let words: VocabularyWord[];
      
      if (isReviewSession) {
        // 復習セッションの場合、vocabularyWordsは実際には{ word: VocabularyWord }[]形式
        words = (vocabularyWords as any).map((item: any) => item.word || item);
      } else {
        words = [...vocabularyWords];
        // Shuffle if random order
        if (session.totalWords < words.length) {
          words = words.sort(() => Math.random() - 0.5);
          words = words.slice(0, session.totalWords);
        }
      }
      
      setStudyWords(words);
    }
  }, [vocabularyWords, session, isReviewSession]);

  const currentWord = studyWords[currentWordIndex] || null;
  const isComplete = studyWords.length > 0 && currentWordIndex >= studyWords.length;
  

  const nextWord = () => {
    setCurrentWordIndex(prev => prev + 1);
  };

  const markWord = (isRemembered: boolean) => {
    if (isRemembered) {
      setCorrectCount(prev => prev + 1);
    } else {
      setIncorrectCount(prev => prev + 1);
    }
    nextWord();
  };

  return {
    currentWordIndex,
    currentWord,
    correctCount,
    incorrectCount,
    studyWords,
    isComplete,
    nextWord,
    markWord,
  };
}
