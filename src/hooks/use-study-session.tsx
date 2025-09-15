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
// API通信の成功後、初めて onComplete を呼び出す
onComplete(variables);
},
onError: (error) => {
console.log("DEBUG: セッションデータの更新に失敗しました。Error:", error);
// エラー時もセッションを完了させるか、ユーザーに通知するかを検討
// 例: onComplete(null);
}
});

useEffect(() => {
const words = initialSession.words || [];
const filteredWords = words.filter(word => word != null);
setStudyWords(filteredWords);

if (initialSession.id.startsWith('review-') && initialSession.incorrectWords) {
setIncorrectWords(initialSession.incorrectWords);
}

const initialCorrect: VocabularyWord[] = [];
const initialIncorrect: VocabularyWord[] = [];
if (initialSession.progress) {
for (const progress of initialSession.progress) {
const word = filteredWords.find(w => w.id === progress.wordId);
if (word) {
if (progress.isRemembered) {
initialCorrect.push(word);
} else {
initialIncorrect.push(word);
}
}
}
}
setCorrectWords(initialCorrect);
setIncorrectWords(initialIncorrect);
setCorrectCount(initialCorrect.length);
setIncorrectCount(initialIncorrect.length);

setIsSessionLoading(false);
}, [initialSession]);

const currentWord = studyWords[currentWordIndex] || null;
const isComplete = studyWords.length > 0 && currentWordIndex >= studyWords.length;

useEffect(() => {
console.log("DEBUG: useEffect isComplete trigger. isComplete:", isComplete, "hasCompleted:", hasCompleted);
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
// レビューセッションの場合はAPIを呼ばず、直接 onComplete を呼ぶ
onComplete(completedSessionData);
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
setIncorrectWords(prev => [...prev, currentWord]);
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
// レビューセッションの場合はAPIを呼ばず、直接 onComplete を呼ぶ
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