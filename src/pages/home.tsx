import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUpload, SelectedJsonInfo } from "@/components/file-upload";
import { RangeSelector } from "@/components/range-selector";
import { StudySession } from "@/components/study-session";
import { StudyResults } from "@/components/study-results";
import { ReviewWords } from "@/components/review-words";
import { apiRequest } from "@/lib/queryClient";
import iconSvg from './1f974.svg';
import type { StudyConfig, StudySession as StudySessionType, VocabularyWord, WordProgress } from "@shared/schema";
// import iconSvg from './1f974.svg';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
const { user, isLoading: isUserLoading } = useAuth();
const userId = user?.id || null;
const username = user?.username || "ゲスト";
const { toast } = useToast();
const queryClient = useQueryClient();

const [selectedJson, setSelectedJson] = useState<SelectedJsonInfo | null>(null);
const [currentSession, setCurrentSession] = useState<StudySessionType | null>(null);
const [completedSession, setCompletedSession] = useState<StudySessionType | null>(null);
const [showUserInfo, setShowUserInfo] = useState<boolean>(false);

const { data: reviewWords = [], isLoading: isReviewWordsLoading } = useQuery<(WordProgress & { word: VocabularyWord })[]>({
queryKey: ['/api/vocabulary/review', userId],
queryFn: async () => {
const response = await apiRequest("GET", `/api/vocabulary/review`, null, userId || undefined);
return response.json();
},
enabled: !!userId,
});

const quickStartMutation = useMutation({
mutationFn: async (config: StudyConfig) => {
if (!userId) {
throw new Error("User ID not available.");
}
const response = await apiRequest("POST", "/api/study/session", config, userId || undefined);
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
toast({
title: "アップロード成功",
description: `${fileInfo.wordCount}個の単語が読み込まれました`,
});
};

const handleSessionComplete = (sessionData?: StudySessionType) => {
if (sessionData) {
setCompletedSession(sessionData);
setCurrentSession(null);

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
const wordsToReview = reviewWords.map(p => p.word);
const initialIncorrectWords = reviewWords.map(p => p.word);

if (wordsToReview.length === 0) {
toast({
title: "復習単語なし",
description: "現在、復習すべき単語はありません。",
});
return;
}

// progressを初期化し、各単語の過去の不正解回数を反映させる
const initialProgress: WordProgress[] = reviewWords.map(p => ({
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
sourceFile: 'Review Session',
startRange: 0,
endRange: 0,
isCompleted: false,
createdAt: new Date(),
words: wordsToReview,
progress: initialProgress,
incorrectWords: initialIncorrectWords
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
sourceFile: selectedJson.name,
};
quickStartMutation.mutate(config);
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
<h1 className="text-xl font-semibold text-foreground">よつましゃアプリブラウザ版</h1>
<p className="text-sm text-muted-foreground">Vocabulary Learning</p>
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
<span className="text-sm font-medium text-foreground" data-testid="text-progress">
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
<div className="bg-muted rounded-lg p-4">
<h3 className="text-lg font-semibold text-foreground mb-2">ユーザー情報</h3>
<div className="space-y-2">
<div className="flex items-center space-x-2">
<i className="fas fa-user text-primary"></i>
<span className="text-sm text-muted-foreground">ユーザーID:</span>
<span className="text-sm font-mono text-foreground bg-background px-2 py-1 rounded">{userId}</span>
</div>
<div className="flex items-center space-x-2">
<i className="fas fa-id-badge text-primary"></i>
<span className="text-sm text-muted-foreground">ユーザー名:</span>
<span className="text-sm text-foreground">{username}</span>
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
/>
<ReviewWords
reviewWords={reviewWords}
isReviewWordsLoading={isReviewWordsLoading}
onStartReview={() => handleStartReview()}
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

// 復習対象の単語を取得する際に、`reviewWords` が `WordProgress` 型の配列なので、その中に含まれている `word` オブジェクトを抽出して`VocabularyWord` 型の配列に変換する必要があります。