import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VocabularyCard } from "./vocabulary-card";
import { useStudySession } from "@/hooks/use-study-session";
import type { StudySession as StudySessionType, VocabularyWord } from "@shared/schema";

const [fontSizeClass, setFontSizeClass] = useState('text-3xl');



interface StudySessionProps {
  session: StudySessionType;
  onComplete: (sessionData?: StudySessionType) => void;
  onBack: () => void;
}

export function StudySession({ session, onComplete, onBack }: StudySessionProps) {
  // isFlipped の代わりに rotationCount を使用
  const [rotationCount, setRotationCount] = useState(0); 
  const [hasCompleted, setHasCompleted] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    currentWordIndex,
    currentWord,
    correctCount,
    incorrectCount,
    studyWords,
    nextWord,
    markWord,
    isComplete
  } = useStudySession(session);

  const recordProgressMutation = useMutation({
    mutationFn: async ({ wordId, isRemembered }: { wordId: string; isRemembered: boolean }) => {
      const response = await apiRequest("POST", "/api/study/progress", {
        wordId,
        sessionId: session.id,
        isRemembered,
        attempts: 1,
      });
      return response.json();
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (updates: Partial<StudySessionType>) => {
      const response = await apiRequest("PATCH", `/api/study/session/${session.id}`, updates);
      return response.json();
    },
  });

  useEffect(() => {
    if (isComplete && !hasCompleted) {
      setHasCompleted(true);
      const isReviewSession = session.id.startsWith('review-');

      // 完了時のセッションデータを作成
      const completedSessionData = {
        ...session,
        correctCount,
        incorrectCount,
        isCompleted: true
      };

      if (isReviewSession) {
        // 復習セッションの場合、サーバー更新をスキップして直接完了処理
        queryClient.invalidateQueries({ queryKey: ["/api/vocabulary/review"] });
        onComplete(completedSessionData);
      } else {
        // 通常セッションの場合、サーバーを更新
        updateSessionMutation.mutate({
          correctCount,
          incorrectCount,
          isCompleted: true,
        }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vocabulary/review"] });
            onComplete();
          },
          onError: () => {
            // エラーの場合でも完了処理を実行
            onComplete(completedSessionData);
          }
        });
      }
    }
  }, [isComplete, hasCompleted]);

  // カードをタップしたときに、回転数を1増やす
  const handleFlip = () => {
    setRotationCount(prevCount => prevCount + 1);
  };

  // 覚えた/覚えてないボタンを押したときに、回転数を1増やし、0.3秒後に次の単語に進む
  const handleMarkWord = (isRemembered: boolean) => {
    if (!currentWord) return;

    // 回転数を1増やすことで、合計360度回転させる
    setRotationCount(prevCount => prevCount + 1);

    recordProgressMutation.mutate({
      wordId: currentWord.id,
      isRemembered,
    });

    setTimeout(() => {
      markWord(isRemembered);
    }, 300);
  };

  const handleSkip = () => {
    nextWord();
    // スキップ時も回転数をリセット
    setRotationCount(0);
  };

  const handleEarlyFinish = () => {
    if (!hasCompleted) {
      setHasCompleted(true);
      const isReviewSession = session.id.startsWith('review-');

      // 途中終了時のセッションデータを作成
      const completedSessionData = {
        ...session,
        correctCount,
        incorrectCount,
        totalWords: currentWordIndex, // 実際に答えた問題数を設定
        isCompleted: true
      };

      if (isReviewSession) {
        queryClient.invalidateQueries({ queryKey: ["/api/vocabulary/review"] });
        onComplete(completedSessionData);
      } else {
        updateSessionMutation.mutate({
          correctCount,
          incorrectCount,
          totalWords: currentWordIndex, // 実際の問題数で更新
          isCompleted: true,
        }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vocabulary/review"] });
            onComplete();
          },
          onError: () => {
            onComplete(completedSessionData);
          }
        });
      }
    }
  };

  if (!currentWord) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <i className="fas fa-spinner fa-spin text-4xl text-primary"></i>
            <p className="text-muted-foreground">単語を読み込んでいます...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = ((currentWordIndex + 1) / studyWords.length) * 100;

  return (
    <Card className="overflow-hidden">
      {/* Progress Header */}
      <div className="bg-muted/50 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              data-testid="button-back"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              戻る
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-foreground" data-testid="text-current-question">
              {currentWordIndex + 1}
            </span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground" data-testid="text-total-questions">
              {studyWords.length}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-check-circle text-success text-sm"></i>
              <span className="text-sm text-success" data-testid="text-correct-count">{correctCount}</span>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fas fa-times-circle text-warning text-sm"></i>
              <span className="text-sm text-warning" data-testid="text-incorrect-count">{incorrectCount}</span>
            </div>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-secondary rounded-full h-2">
          <div 
            className="progress-bar bg-primary h-2 rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
            data-testid="progress-bar"
          ></div>
        </div>
      </div>

      {/* Vocabulary Card */}
      <div className="p-8">
        <div className="max-w-md mx-auto">
          <VocabularyCard
            word={currentWord}
            // rotationCount を渡す
            rotationCount={rotationCount} 
            onFlip={handleFlip}
            fontSizeClass={fontSizeClass}
          />

          {/* Action Buttons */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <Button
              variant="destructive"
              size="lg"
              onClick={() => handleMarkWord(false)}
              // 修正後の disabled プロパティ
              disabled={rotationCount % 2 === 0}
              data-testid="button-not-remembered"
            >
              <i className="fas fa-times mr-2"></i>
              覚えていない
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={() => handleMarkWord(true)}
              // 修正後の disabled プロパティ
              disabled={rotationCount % 2 === 0}
              className="bg-success hover:bg-success/90 text-success-foreground"
              data-testid="button-remembered"
            >
              <i className="fas fa-check mr-2"></i>
              覚えた
            </Button>
          </div>

          {/* Skip and Early Finish Buttons */}
          <div className="mt-4 flex flex-col items-center space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              data-testid="button-skip"
            >
              <i className="fas fa-forward mr-1"></i>
              スキップ
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleEarlyFinish}
              className="text-muted-foreground border-muted-foreground/50 hover:bg-muted hover:text-foreground"
              data-testid="button-early-finish"
            >
              <i className="fas fa-stop mr-1"></i>
              途中終了
            </Button>
          </div>

          {/* 新しく追加したフォントサイズ変更ボタン */}
          <div className="mt-4 flex items-center justify-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSizeClass('text-2xl')}
            >
              -A
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSizeClass('text-3xl')}
            >
              A
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSizeClass('text-4xl')}
            >
              +A
            </Button>
          </div>
          {/* 回転の状態に応じてヒントを表示 */}
          {rotationCount % 2 === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              カードをタップして意味を表示
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}