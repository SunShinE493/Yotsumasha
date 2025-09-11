import { useState, useCallback } from "react";
import { StudySession } from "@shared/schema";

export function useStudySession() {
  const [currentSession, setCurrentSession] = useState<StudySession | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startSession = useCallback((session: StudySession) => {
    setCurrentSession(session);
  }, []);

  const endSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  const updateSession = useCallback((updates: Partial<StudySession>) => {
    setCurrentSession(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return {
    currentSession,
    isLoading,
    startSession,
    endSession,
    updateSession,
  };
}