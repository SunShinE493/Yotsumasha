import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WordProgress, VocabularyWord } from "@shared/schema";

interface ReviewWordsProps {
  reviewWords: (WordProgress & { word: VocabularyWord })[];
  onStartReview?: () => void;
}

export function ReviewWords({ reviewWords, onStartReview }: ReviewWordsProps) {
  if (reviewWords.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-list text-primary"></i>
              <h2 className="text-lg font-semibold text-foreground">復習が必要な単語</h2>
            </div>
          </div>
          <div className="text-center py-8">
            <i className="fas fa-check-circle text-4xl text-success mb-4"></i>
            <p className="text-muted-foreground">復習が必要な単語はありません</p>
            <p className="text-sm text-muted-foreground mt-2">全ての単語を習得済みです！</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <i className="fas fa-list text-primary"></i>
            <h2 className="text-lg font-semibold text-foreground">復習が必要な単語</h2>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground" data-testid="text-review-count">
              {reviewWords.length}語
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={onStartReview}
              data-testid="button-start-review"
            >
              <i className="fas fa-study mr-1"></i>
              復習開始
            </Button>
          </div>
        </div>

        <ScrollArea className="h-64">
          <div className="space-y-2">
            {reviewWords.map((item, index) => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors"
                data-testid={`row-review-word-${index}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-warning rounded-full"></div>
                  <div>
                    <div className="font-medium text-foreground" data-testid={`text-review-word-${index}`}>
                      {item.word.word}
                    </div>
                    <div className="text-sm text-muted-foreground" data-testid={`text-review-meaning-${index}`}>
                      {item.word.meaning}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground" data-testid={`text-review-attempts-${index}`}>
                  {item.attempts}回目
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
