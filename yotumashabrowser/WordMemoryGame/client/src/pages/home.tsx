// home.tsx

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileUpload, SelectedJsonInfo } from "@/components/file-upload";
import { RangeSelector } from "@/components/range-selector";
import { StudySession } from "@/components/study-session";
import { StudyResults } from "@/components/study-results";
import { ReviewWords } from "@/components/review-words";
import { apiRequest } from "@/lib/queryClient";
import type { StudyConfig, StudySession as StudySessionType, VocabularyWord } from "@shared/schema";
import iconSvg from './1f974.svg';
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [selectedJson, setSelectedJson] = useState<SelectedJsonInfo | null>(null);
  const [currentSession, setCurrentSession] = useState<StudySessionType | null>(null);
  const [completedSession, setCompletedSession] = useState<StudySessionType | null>(null);
  const { toast } = useToast();

  const { data: reviewWords = [] } = useQuery<VocabularyWord[]>({
    queryKey: ["/api/vocabulary/review"],
  });

  const quickStartMutation = useMutation({
    mutationFn: async (config: StudyConfig) => {
      const response = await apiRequest("POST", "/api/study/session", config);
      return response.json();
    },
    onSuccess: (session) => {
      setCurrentSession(session);
      setCompletedSession(null);
    },
    onError: () => {
      toast({
        title: "クイック学習開始エラー",
        description: "セッションの作成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleUploadSuccess = (fileInfo: SelectedJsonInfo) => {
    setSelectedJson(fileInfo);
    // ファイルアップロード成功時に vocabularyWords の状態を更新
    // ここでは refetchVocabulary() は不要
  };

  const handleStartSession = (session: StudySessionType) => {
    setCurrentSession(session);
    setCompletedSession(null);
  };

  const handleSessionComplete = (sessionData?: StudySessionType) => {
    setCompletedSession(sessionData || currentSession);
    setCurrentSession(null);
  };

  const handleNewSession = () => {
    setCurrentSession(null);
    setCompletedSession(null);
  };

  const handleStartReview = () => {
    if (reviewWords.length === 0) {
      toast({
        title: "復習単語なし",
        description: "現在、復習すべき単語はありません。",
      });
      return;
    }
    const reviewSession: StudySessionType = {
      id: `review-${Date.now()}`,
      config: {
        startRange: 1,
        endRange: reviewWords.length,
        questionCount: reviewWords.length,
        order: "random",
        reviewOnly: true,
      },
      words: reviewWords,
      correctCount: 0,
      incorrectCount: 0,
      isCompleted: false,
      startTime: new Date(),
      endTime: null,
    };
    handleStartSession(reviewSession);
  };

  const handleQuickStart = () => {
    if (!selectedJson || selectedJson.wordCount === 0) {
      toast({
        title: "データなし",
        description: "学習を開始するJSONファイルを選択してください。",
        variant: "destructive",
      });
      return;
    }

    const endRange = Math.min(20, selectedJson.wordCount);
    const config: StudyConfig = {
      startRange: 1,
      endRange,
      questionCount: endRange,
      order: "random",
      reviewOnly: false,
    };
    quickStartMutation.mutate(config);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <img
                  src={iconSvg}
                  alt="App Logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">よつましゃアプリブラウザ版</h1>
                <p className="text-sm text-muted-foreground">Vocabulary Learning</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="touch-target p-2 rounded-lg bg-secondary hover:bg-accent transition-colors"
                data-testid="button-settings"
              >
                <i className="fas fa-cog text-secondary-foreground"></i>
              </button>
              <div className="hidden sm:flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
                <i className="fas fa-chart-line text-primary text-sm"></i>
                <span className="text-sm font-medium text-foreground" data-testid="text-progress">
                  {selectedJson ? `${selectedJson.wordCount}語` : "0語"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- */}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {currentSession ? (
          <StudySession
            session={currentSession}
            onComplete={handleSessionComplete}
            onBack={handleNewSession}
          />
        ) : completedSession ? (
          <StudyResults
            session={completedSession}
            onNewSession={handleNewSession}
            onReview={handleStartReview}
          />
        ) : (
          <>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
            <RangeSelector
              selectedJson={selectedJson}
              onStartSession={handleStartSession}
            />
            <ReviewWords
              reviewWords={reviewWords}
              onStartReview={handleStartReview}
            />
          </>
        )}
      </main>

      {/* --- */}

      {/* Floating Action Button */}
      {selectedJson && selectedJson.wordCount > 0 && !currentSession && !completedSession && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={handleQuickStart}
            disabled={quickStartMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg hover:bg-primary/90 transition-all hover:scale-105 flex items-center gap-2 group"
            data-testid="button-quick-start"
            title="クイック学習開始（最初の20語をランダムで学習）"
          >
            {quickStartMutation.isPending ? (
              <i className="fas fa-spinner fa-spin text-xl"></i>
            ) : (
              <i className="fas fa-play text-xl group-hover:scale-110 transition-transform"></i>
            )}
            <span className="font-mono">ランダム20問<br />開始</span>
          </button>
        </div>
      )}
    </div>
  );
}