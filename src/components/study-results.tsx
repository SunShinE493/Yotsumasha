import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StudySession, VocabularyWord } from "@shared/schema";

interface StudyResultsProps {
  session: StudySession;
  onNewSession: () => void;
  onReview: (incorrectWords: VocabularyWord[]) => void;
}

export function StudyResults({ session, onNewSession, onReview }: StudyResultsProps) {
  const answeredWords = (session.correctCount || 0) + (session.incorrectCount || 0);
  const accuracy = answeredWords > 0
    ? Math.round(((session.correctCount || 0) / answeredWords) * 100)
    : 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center space-y-6">
          {/* Results Header */}
          <div className="space-y-2">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <i className="fas fa-trophy text-2xl text-success"></i>
            </div>
            <h2 className="text-2xl font-bold text-foreground">学習完了！</h2>
            <p className="text-muted-foreground">お疲れ様でした</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto">
            <div className="bg-accent rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground" data-testid="text-total-words">
                {answeredWords}
              </div>
              <div className="text-xs text-muted-foreground">総問題数</div>
            </div>
            <div className="bg-success/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-success" data-testid="text-correct-words">
                {session.correctCount || 0}
              </div>
              <div className="text-xs text-muted-foreground">正解</div>
            </div>
            <div className="bg-warning/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-warning" data-testid="text-incorrect-words">
                {session.incorrectCount || 0}
              </div>
              <div className="text-xs text-muted-foreground">不正解</div>
            </div>
            <div className="bg-primary/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary" data-testid="text-accuracy">
                {accuracy}%
              </div>
              <div className="text-xs text-muted-foreground">正答率</div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 space-y-4">
          <Button
            className="w-full"
            size="lg"
            onClick={() => onReview(session.incorrectWords || [])}
            data-testid="button-review"
          >
            <i className="fas fa-redo-alt mr-2"></i>
            間違えた単語を復習
          </Button>
          <Button
            className="w-full"
            variant="outline"
            size="lg"
            onClick={onNewSession}
            data-testid="button-new-session"
          >
            <i className="fas fa-book-open mr-2"></i>
            ホームに戻る
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
