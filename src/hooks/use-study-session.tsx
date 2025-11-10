import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import type { StudySession, VocabularyWord } from "@shared/schema";
import { useUserId } from "@/hooks/use-user-id";
import { apiRequest } from "@/lib/queryClient";

interface UseStudySessionProps {
  initialSession: StudySession;
  onComplete: (sessionData: StudySession) => void;
}

export function useStudySession({ initialSession, onComplete }: UseStudySessionProps) {
  const userId = useUserId();
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(initialSession.correctCount || 0);
  const [incorrectCount, setIncorrectCount] = useState(initialSession.incorrectCount || 0);
  const [studyWords, setStudyWords] = useState<VocabularyWord[]>([]);
  const [correctWords, setCorrectWords] = useState<VocabularyWord[]>([]);
  const [incorrectWords, setIncorrectWords] = useState<VocabularyWord[]>([]);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  const updateSessionMutation = useMutation({
    mutationFn: async (sessionData: StudySession) => {
      const response = await apiRequest("PUT", `/api/study/session/${sessionData.id}`, sessionData, userId || undefined);
      return response.json();
    },
    onSuccess: (data, variables) => {
      console.log("DEBUG: セッションデータの更新に成功しました。");
      onComplete(variables);
    },
    onError: (error) => {
      console.log("DEBUG: セッションデータの更新に失敗しました。Error:", error);
      onComplete(null);
    }
  });

  useEffect(() => {
    const words = initialSession.words || [];
    const filteredWords = words.filter(word => word != null);
    setStudyWords(filteredWords);

    if (initialSession.id.startsWith('review-')) {
      setIncorrectWords(initialSession.incorrectWords || []);
    }

    const initialCorrect: VocabularyWord[] = [];
    if (initialSession.progress) {
      for (const progress of initialSession.progress) {
        const word = filteredWords.find(w => w.id === progress.wordId);
        if (word && progress.isRemembered) {
          initialCorrect.push(word);
        }
      }
    }
    setCorrectWords(initialCorrect);
    setCorrectCount(initialCorrect.length);

    setIsSessionLoading(false);
  }, [initialSession]);

  const currentWord = studyWords[currentWordIndex] || null;
  const isComplete = studyWords.length > 0 && currentWordIndex >= studyWords.length;

  useEffect(() => {
    if (isComplete && !hasCompleted) {
      setHasCompleted(true);
      const completedSessionData = {
        ...initialSession,
        correctCount,
        incorrectCount,
        isCompleted: true,
        words: studyWords,
        incorrectWords,
      };

      if (!initialSession.id.startsWith('review-')) {
        updateSessionMutation.mutate(completedSessionData);
      } else {
        setTimeout(() => {
        onComplete(completedSessionData);
        },500);
      }
    }
  }, [isComplete, hasCompleted, onComplete, initialSession, correctCount, incorrectCount, studyWords, updateSessionMutation, incorrectWords]);

  const markWord = (isRemembered: boolean) => {
    if (!currentWord) return;

    if (isRemembered) {
      setCorrectCount(prev => prev + 1);
      setCorrectWords(prev => [...prev, currentWord]);
    } else {
      setIncorrectCount(prev => prev + 1);
      if (!incorrectWords.some(word => word.id === currentWord.id)) {
        setIncorrectWords(prev => [...prev, currentWord]);
      }
    }
    setCurrentWordIndex(prev => prev + 1);
  };

  const handleEarlyFinish = () => {
    const completedSessionData = {
      ...initialSession,
      correctCount,
      incorrectCount,
      isCompleted: true,
      words: studyWords,
      incorrectWords,
    };
    if (!initialSession.id.startsWith('review-')) {
      updateSessionMutation.mutate(completedSessionData);
    } else {
      onComplete(completedSessionData);
    }
  };

  const isLoading = isSessionLoading || updateSessionMutation.isPending;

  return {
    currentWordIndex,
    currentWord,
    correctCount,
    incorrectCount,
    studyWords,
    isComplete,
    markWord,
    handleEarlyFinish,
    isLoading,
    isError: false,
    error: null,
    correctWords,
    incorrectWords,
  };
}
