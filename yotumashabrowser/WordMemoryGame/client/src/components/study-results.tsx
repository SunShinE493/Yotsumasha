import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StudySession } from "@shared/schema";

interface StudyResultsProps {
  session: StudySession;
  onNewSession: () => void;
  onReview: () => void;
}

export function StudyResults({ session, onNewSession, onReview }: StudyResultsProps) {
  const accuracy = session.totalWords > 0 
    ? Math.round(((session.correctCount || 0) / session.totalWords) * 100)
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
                {session.totalWords}
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
              <div className="text-xs text-muted-foreground">復習必要</div>
            </div>
            <div className="bg-primary/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary" data-testid="text-accuracy">
                {accuracy}%
              </div>
              <div className="text-xs text-muted-foreground">正答率</div>
            </div>
          </div>

          {/* Performance Message */}
          <div className="text-center">
            {accuracy >= 80 && (
              <p className="text-success font-medium">素晴らしい成績です！</p>
            )}
            {accuracy >= 60 && accuracy < 80 && (
              <p className="text-primary font-medium">よく頑張りました！</p>
            )}
            {accuracy < 60 && (
              <p className="text-warning font-medium">もう少し復習が必要です。</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            {(session.incorrectCount || 0) > 0 && (
              <Button
                variant="destructive"
                onClick={onReview}
                data-testid="button-review"
              >
                <i className="fas fa-redo mr-2"></i>
                復習する ({session.incorrectCount || 0}問)
              </Button>
            )}
            <Button
              onClick={onNewSession}
              data-testid="button-new-session"
            >
              <i className="fas fa-play mr-2"></i>
              新しいセッション
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
