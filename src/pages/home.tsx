import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUpload, SelectedJsonInfo } from "@/components/file-upload";
import { RangeSelector } from "@/components/range-selector";
import { StudySession } from "@/components/study-session";
import { StudyResults } from "@/components/study-results";
import { ReviewWords } from "@/components/review-words";
import { apiRequest } from "@/lib/queryClient";
import iconSvg from "./1f974.svg";
import type {
  StudyConfig,
  StudySession as StudySessionType,
  VocabularyWord,
  WordProgress,
} from "@shared/schema";
// import iconSvg from './1f974.svg';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const { user, isLoading: isUserLoading } = useAuth();
  const userId = user?.id || null;
  const username = user?.username || "ゲスト";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedJson, setSelectedJson] = useState<SelectedJsonInfo | null>(
    null,
  );
  const [currentSession, setCurrentSession] = useState<StudySessionType | null>(
    null,
  );
  const [completedSession, setCompletedSession] =
    useState<StudySessionType | null>(null);
  const [showUserInfo, setShowUserInfo] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>("");
  const [isSavingName, setIsSavingName] = useState<boolean>(false);
  const [rankMetric, setRankMetric] = useState<"maxCombo" | "correctCount" | "scorePerMinute">("maxCombo");
  const { data: rankings = [], refetch: refetchRankings } = useQuery<any[]>({
    queryKey: ["/api/rankings", rankMetric],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/rankings?metric=${rankMetric}`);
      return res.json();
    },
  });
  const { data: profile } = useQuery<{ id: string; playerName: string | null } | null>({
    queryKey: ["/api/profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/profile", undefined, userId || undefined);
      return res.json();
    },
  });

  useEffect(() => {
    if (profile && typeof profile.playerName === "string") setPlayerName(profile.playerName);
  }, [profile]);

  const { data: reviewWords = [], isLoading: isReviewWordsLoading } = useQuery<
    (WordProgress & { word: VocabularyWord })[]
  >({
    queryKey: ["/api/vocabulary/review", userId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/vocabulary/review`,
        null,
        userId || undefined,
      );
      return response.json();
    },
    enabled: !!userId,
  });

  const startSessionMutation = useMutation({
    mutationFn: async (config: StudyConfig) => {
      if (!userId) {
        throw new Error("User ID not available.");
      }
      const response = await apiRequest(
        "POST",
        "/api/study/session",
        config,
        userId || undefined,
      );
      return response.json();
    },
    onSuccess: (session) => {
      setCurrentSession(session);
      setCompletedSession(null);
    },
    onError: () => {
      toast({
        title: "学習開始エラー",
        description: "セッションの作成に失敗しました。",
        variant: "destructive",
      });
    },
  });

  const handleUploadSuccess = (fileInfo: SelectedJsonInfo) => {
    setSelectedJson(fileInfo);
    toast({
      title: "アップロード成功",
      description: `${fileInfo.wordCount}個の単語が読み込まれました`,
    });
  };

  const handleSessionComplete = (sessionData?: StudySessionType) => {
    if (sessionData) {
      setCompletedSession(sessionData);
      setCurrentSession(null);
      // submit ranking
      (async () => {
        try {
          if (!userId) return;
          const body = {
            sourceFile: sessionData.sourceFile,
            startRange: sessionData.startRange,
            endRange: sessionData.endRange,
            correctCount: sessionData.correctCount,
            maxCombo: sessionData.maxCombo || 0,
            durationMs: sessionData.durationMs || 1,
          };
          await apiRequest("POST", "/api/rankings", body, userId);
          refetchRankings();
        } catch (e) {
          // no-op
        }
      })();

      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary/review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
    }
  };

  const handleGoHome = () => {
    setCurrentSession(null);
    setCompletedSession(null);
  };

  const handleStartSession = (session: StudySessionType) => {
    setCurrentSession(session);
    setCompletedSession(null);
  };

  const handleStartReview = () => {
    const wordsToReview = reviewWords.map((p) => p.word);
    const initialIncorrectWords = reviewWords.map((p) => p.word);

    if (wordsToReview.length === 0) {
      toast({
        title: "復習単語なし",
        description: "現在、復習すべき単語はありません。",
      });
      return;
    }

    // progressを初期化し、各単語の過去の不正解回数を反映させる
    const initialProgress: WordProgress[] = reviewWords.map((p) => ({
      wordId: p.word.id,
      isRemembered: false, // 復習セッション開始時はすべて不正解扱い
      incorrectCount: p.incorrectCount, // 過去の不正解回数を引き継ぐ
      attempts: p.attempts,
      lastStudied: p.lastStudied,
    }));

    const reviewSession: StudySessionType = {
      id: `review-${Date.now()}`,
      correctCount: 0,
      incorrectCount: 0,
      totalWords: wordsToReview.length,
      sourceFile: "Review Session",
      startRange: 0,
      endRange: 0,
      isCompleted: false,
      createdAt: new Date(),
      words: wordsToReview,
      progress: initialProgress,
      incorrectWords: initialIncorrectWords,
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
    startSessionMutation.mutate(config);
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex justify-center items-center h-full">
          <p className="text-muted-foreground">ユーザー情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center">
                <img
                  src={iconSvg}
                  alt="App Logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  よつましゃアプリブラウザ版
                </h1>
                <p className="text-sm text-muted-foreground">
                  Vocabulary Learning
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="touch-target p-2 rounded-lg bg-secondary hover:bg-accent transition-colors"
                data-testid="button-settings"
                onClick={() => setShowUserInfo(!showUserInfo)}
              >
                <i className="fas fa-cog text-secondary-foreground"></i>
              </button>
              <div className="hidden sm:flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
                <i className="fas fa-chart-line text-primary text-sm"></i>
                <span
                  className="text-sm font-medium text-foreground"
                  data-testid="text-progress"
                >
                  {selectedJson ? `${selectedJson.wordCount}語` : "0語"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- */}

      {/* User Info Panel */}
      {showUserInfo && (
        <div className="bg-card border-b border-border shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                ユーザー情報
              </h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <i className="fas fa-user text-primary"></i>
                  <span className="text-sm text-muted-foreground">
                    ユーザーID:
                  </span>
                  <span className="text-sm font-mono text-foreground bg-background px-2 py-1 rounded">
                    {userId}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <i className="fas fa-id-badge text-primary"></i>
                  <span className="text-sm text-muted-foreground">
                    ユーザー名:
                  </span>
                  <span className="text-sm text-foreground">{username}</span>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">プレイヤー名</label>
                  <div className="flex gap-2">
                    <input
                      className="h-10 px-3 rounded-md border bg-background w-full"
                      value={playerName || ""}
                      maxLength={32}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="ランキング表示名"
                    />
                    <Button
                      onClick={async () => {
                        if (!userId) return;
                        setIsSavingName(true);
                        try {
                          await apiRequest("PUT", "/api/profile", { playerName }, userId);
                          await refetchRankings();
                        } finally {
                          setIsSavingName(false);
                        }
                      }}
                      disabled={isSavingName || !playerName}
                    >保存</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">データ引き継ぎ（エクスポート）</label>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!userId) return;
                      const res = await apiRequest("GET", "/api/export", undefined, userId);
                      const data = await res.json();
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `export-${userId}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >エクスポート</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {currentSession ? (
          <StudySession
            session={currentSession}
            onComplete={handleSessionComplete}
            onBack={handleGoHome}
          />
        ) : completedSession ? (
          <StudyResults
            session={completedSession}
            onNewSession={handleGoHome}
            onReview={() => handleStartReview()}
          />
        ) : (
          <>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
            <RangeSelector
              selectedJson={selectedJson}
              onStartSession={handleStartSession}
              isStarting={startSessionMutation.isPending}
              userId={userId} // 👈 ユーザーIDを渡す
            />
            <ReviewWords
              reviewWords={reviewWords}
              isReviewWordsLoading={isReviewWordsLoading}
              onStartReview={() => handleStartReview()}
            />
            {/* Ranking Board */}
            <Card>
              <CardHeader>
                <CardTitle>ランキング</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Tabs value={rankMetric} onValueChange={(v) => setRankMetric(v as any)}>
                    <TabsList>
                      <TabsTrigger value="maxCombo">最大コンボ</TabsTrigger>
                      <TabsTrigger value="correctCount">正解数</TabsTrigger>
                      <TabsTrigger value="scorePerMinute">1分あたりスコア</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-2 pr-2">順位</th>
                        <th className="py-2 pr-2">プレイヤー</th>
                        <th className="py-2 pr-2">JSON名</th>
                        <th className="py-2 pr-2">範囲</th>
                        <th className="py-2 pr-2">正解</th>
                        <th className="py-2 pr-2">最大コンボ</th>
                        <th className="py-2 pr-2">1分あたり</th>
                        <th className="py-2 pr-2">時間</th>
                        <th className="py-2 pr-2">日時</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankings.map((r: any, idx: number) => {
                        const apm = r.durationMs > 0 ? Math.round((r.correctCount * 60000) / r.durationMs) : 0;
                        const durationSec = Math.round((r.durationMs || 0) / 1000);
                        const date = r.createdAt ? new Date(r.createdAt) : null;
                        return (
                          <tr key={r.id} className="border-b border-border">
                            <td className="py-2 pr-2">{idx + 1}</td>
                            <td className="py-2 pr-2">{r.playerName || "未設定"}</td>
                            <td className="py-2 pr-2">{r.sourceFile || "-"}</td>
                            <td className="py-2 pr-2">{r.startRange}-{r.endRange}</td>
                            <td className="py-2 pr-2">{r.correctCount}</td>
                            <td className="py-2 pr-2">{r.maxCombo}</td>
                            <td className="py-2 pr-2">{apm}</td>
                            <td className="py-2 pr-2">{durationSec}s</td>
                            <td className="py-2 pr-2">{date ? date.toLocaleString() : ""}</td>
                          </tr>
                        );
                      })}
                      {rankings.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-muted-foreground">まだランキングがありません</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* --- */}

      {/* Floating Action Button */}
      {selectedJson &&
        selectedJson.wordCount > 0 &&
        !currentSession &&
        !completedSession && (
          <div className="fixed bottom-6 right-6">
            <button
              onClick={handleQuickStart}
              disabled={startSessionMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg hover:bg-primary/90 transition-all hover:scale-105 flex items-center gap-2 group"
              data-testid="button-quick-start"
              title="クイック学習開始（最初の20語をランダムで学習）"
            >
              {startSessionMutation.isPending ? (
                <i className="fas fa-spinner fa-spin text-xl"></i>
              ) : (
                <i className="fas fa-play text-xl group-hover:scale-110 transition-transform"></i>
              )}
              <span className="font-mono">
                ランダム20問
                <br />
                開始
              </span>
            </button>
          </div>
        )}
    </div>
  );
}
