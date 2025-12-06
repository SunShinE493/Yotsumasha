import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VocabularyCard } from "./vocabulary-card";
import { useStudySession } from "@/hooks/use-study-session";
import { useUserId } from "@/hooks/use-user-id";
import type { StudySession as StudySessionType, VocabularyWord } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

interface StudySessionProps {
  session: StudySessionType;
  onComplete: (sessionData?: StudySessionType) => void;
  onBack: () => void;
}

export function StudySession({ session, onComplete, onBack }: StudySessionProps) {
  const [fontSizePx, setFontSizePx] = useState<number>(28); // 初期28px相当
  // Revert to previous rotation model
  const [rotationCount, setRotationCount] = useState(0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [rotationTurn, setRotationTurn] = useState(0);
  const [isEarlyFinishDialogOpen, setIsEarlyFinishDialogOpen] = useState(false);
  const { toast } = useToast();
  const userId = useUserId();

  if (!userId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <i className="fas fa-spinner fa-spin text-4xl text-primary"></i>
            <p className="text-muted-foreground">ユーザーを読み込み中...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    currentWordIndex,
    currentWord,
    correctCount,
    incorrectCount,
    studyWords,
    markWord,
    isComplete,
    isLoading,
    isError,
    error,
    incorrectWords,
    handleEarlyFinish: hookHandleEarlyFinish
  } = useStudySession({
    initialSession: session,
    onComplete: (data) => {
      // useStudySession内でonCompleteが呼ばれたときに、このコンポーネントのonCompleteを呼び出す
      if (data) onComplete(data);
    }
  });

  // Debugging: Monitor currentWord changes and log them
  useEffect(() => {
    console.log("DEBUG: Current word changed. Current word:", currentWord);
    console.log("DEBUG: Current word ID:", currentWord?.id);
    console.log("DEBUG: Current word word:", currentWord?.word);
  }, [currentWord]);

  // Safeguard: If "Loading next word..." (i.e. !isLoading && !currentWord) persists for >5s, interrupt session
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isLoading && !currentWord && studyWords?.length > 0) {
      console.log("Safeguard: Stuck in loading next word state. Starting 5s timer.");
      timer = setTimeout(() => {
        console.warn("Safeguard: 5s timeout reached. Interrupting session.");
        toast({
          title: "通信エラー",
          description: "読み込みに時間がかかっているため、セッションを中断しました。",
          variant: "destructive",
        });
        hookHandleEarlyFinish();
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, currentWord, studyWords, hookHandleEarlyFinish, toast]);

  const recordProgressMutation = useMutation({
    mutationFn: async ({ wordId, isRemembered }: { wordId: string; isRemembered: boolean }) => {
      await apiRequest("POST", "/api/study/progress", {
        wordId,
        sessionId: session.id,
        isRemembered,
        //attempts: 1,
      }, userId);
    },
  });

  const handleFlip = () => {
    setRotationCount(prevCount => prevCount + 1);
    setRotationDeg(prev => prev + 180);
    setRotationTurn(prev => prev + 0.5);
  };

  const handleMarkWord = (isRemembered: boolean) => {
    // 覚えた: 同一方向に回転（+1）し次へ
    // 覚えていない: 回転をリセット（0）して次へ
    if (isRemembered) {
      setRotationCount(prev => prev + 1);
      setRotationDeg(prev => prev + 180);
      setRotationTurn(prev => prev + 0.5);
    } else {
      setRotationCount(0);
      setRotationDeg(0);
      setRotationTurn(0);
    }
    setTimeout(() => {
      markWord(isRemembered);
    }, 200);

    if (!currentWord) {
      console.log("handleMarkWord called with no currentWord.");
      return;
    }

    recordProgressMutation.mutate({
      wordId: currentWord.id,
      isRemembered,
    }, {
      onSuccess: () => {
        // setRotationCount(0);
        //markWord(isRemembered);
      }
    });
  };

  const handleSkip = () => {
    if (!currentWord) return;
    // スキップ時は回転をリセット
    setRotationCount(0);
    setRotationDeg(0);
    setRotationTurn(0);
    markWord(false);
  };

  const handleEarlyFinish = () => {
    // useStudySessionフック内のhandleEarlyFinishを呼び出す
    hookHandleEarlyFinish();
    toast({
      title: "学習中断",
      description: "ここまでの学習結果を保存しました。",
    });
    setIsEarlyFinishDialogOpen(false);
  };

  if (isLoading || !Array.isArray(studyWords)) {
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

  if (isError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <i className="fas fa-exclamation-triangle text-4xl text-destructive"></i>
            <p className="text-destructive-foreground">データの取得中にエラーが発生しました。</p>
            <p className="text-sm text-muted-foreground">{error && 'message' in error ? error.message : 'Unknown error'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (studyWords.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <i className="fas fa-box-open text-4xl text-muted-foreground"></i>
            <p className="text-muted-foreground">指定された範囲に単語が見つかりませんでした。</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = (currentWordIndex / (studyWords?.length || 1)) * 100;

  return (
    <Card className="overflow-hidden">
      <div className="bg-muted/50 px-6 py-4 border-b border-border">
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
        <div className="flex items-center justify-center space-x-4 mt-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-foreground" data-testid="text-current-question">
              {currentWordIndex + 1}
            </span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground" data-testid="text-total-questions">
              {studyWords.length}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <i className="fas fa-check-circle text-success text-sm"></i>
            <span className="text-sm text-success" data-testid="text-correct-count">{correctCount}</span>
          </div>
          <div className="flex items-center space-x-2">
            <i className="fas fa-times-circle text-warning text-sm"></i>
            <span className="text-sm text-warning" data-testid="text-incorrect-count">{incorrectCount}</span>
          </div>
        </div>
        <Progress value={progress} className="h-2 w-full mt-2" />
      </div>
      <div className="p-8">
        <div className="max-w-md mx-auto">
          {currentWord ? (
            <>
              <VocabularyCard
                word={currentWord}
                rotationCount={rotationCount}
                onFlip={handleFlip}
                fontSizeClass={''}
                fontSizePx={fontSizePx}
                rotationDeg={rotationDeg}
                rotationTurn={rotationTurn}
              />
              <div className="mt-8 grid grid-cols-2 gap-4">
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => handleMarkWord(false)}
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
                  disabled={rotationCount % 2 === 0}
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  data-testid="button-remembered"
                >
                  <i className="fas fa-check mr-2"></i>
                  覚えた
                </Button>
              </div>
              <div className="mt-4 flex flex-col items-center space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSkip()}
                  data-testid="button-skip"
                >
                  <i className="fas fa-forward mr-1"></i>
                  スキップ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEarlyFinishDialogOpen(true)}
                  className="text-muted-foreground border-muted-foreground/50 hover:bg-muted hover:text-foreground"
                  data-testid="button-early-finish"
                >
                  <i className="fas fa-stop mr-1"></i>
                  途中終了
                </Button>
              </div>
              <div className="mt-4 flex items-center justify-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setFontSizePx((v) => Math.max(10, v - 3))}>-A</Button>
                <div className="text-xs text-muted-foreground">{fontSizePx}px</div>
                <Button variant="outline" size="sm" onClick={() => setFontSizePx((v) => v + 3)}>+A</Button>
              </div>
              {rotationCount % 2 === 0 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  カードをタップして意味を表示
                </p>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="space-y-4">
                  <i className="fas fa-spinner fa-spin text-4xl text-primary"></i>
                  <p className="text-muted-foreground">次の単語を読み込み中...</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Dialog open={isEarlyFinishDialogOpen} onOpenChange={setIsEarlyFinishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>学習を途中でやめますか？</DialogTitle>
            <DialogDescription>
              ここまでの学習結果は保存されます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEarlyFinishDialogOpen(false)}>キャンセル</Button>
            <Button
              variant="default"
              onClick={handleEarlyFinish}
            >
              中断して結果画面へ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
