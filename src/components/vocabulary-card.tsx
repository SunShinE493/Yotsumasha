import { useState } from "react";
import type { VocabularyWord } from "@shared/schema";

interface VocabularyCardProps {
  word: VocabularyWord;
  onFlip: () => void;
  fontSizeClass?: string;
  fontSizePx?: number;
  flipKey?: number;   // increment to trigger a right-rotation flip
  resetKey?: number;  // increment to reset orientation to front
}

export function VocabularyCard({ word, onFlip, fontSizeClass, fontSizePx, flipKey, resetKey }: VocabularyCardProps) {
  const [baseDeg, setBaseDeg] = useState(0);       // 0 or 180; persistent orientation
  const [animDeg, setAnimDeg] = useState(0);       // 0 -> 180 for each flip
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger a right-rotation flip on flipKey change
  useEffect(() => {
    if (flipKey === undefined) return;
    setIsAnimating(true);
    // Start animation 0 -> 180deg (always right rotation)
    setAnimDeg(180);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipKey]);

  // Reset orientation to front on resetKey change
  useEffect(() => {
    if (resetKey === undefined) return;
    setIsAnimating(false);
    setBaseDeg(0);
    setAnimDeg(0);
  }, [resetKey]);

  const handleTransitionEnd = () => {
    if (!isAnimating) return;
    // Commit the flip and rebase to 0 without visual jump
    setIsAnimating(false);
    setBaseDeg((prev) => (prev + 180) % 360);
    setAnimDeg(0);
  };

  const totalDeg = baseDeg + animDeg;

  return (
    <div 
      className="relative h-64 cursor-pointer touch-target"
      onClick={onFlip}
      data-testid="card-vocabulary"
    >
      {/* card-flip に style プロパティで回転角度を直接適用 */}
      <div 
        className="card-flip relative w-full h-full"
        style={{ transform: `rotateY(${totalDeg}deg)`, transition: isAnimating ? 'transform 0.3s ease-in-out' : 'none' }}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Front of Card (Word) */}
        <div className="card-front bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg p-8 flex flex-col items-center justify-center text-center">
          <div className="space-y-4">
            <div className="text-sm text-primary-foreground/80 font-medium">単語</div>
            <div
              className={`${fontSizeClass || ''} font-bold text-primary-foreground`}
              style={fontSizePx ? { fontSize: `${fontSizePx}px`, lineHeight: 1.25 } : undefined}
              data-testid="text-word"
            >
              {word.word}
            </div>
            {word.category && (
              <div className="text-sm text-primary-foreground/80" data-testid="text-category">
                {word.category}
              </div>
            )}
          </div>
          <div className="absolute bottom-4 right-4">
            <i className="fas fa-hand-pointer text-primary-foreground/60 text-sm"></i>
          </div>
        </div>

        {/* Back of Card (Meaning) */}
        <div className="card-back bg-gradient-to-br from-accent to-muted rounded-xl shadow-lg p-8 flex flex-col items-center justify-center text-center">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground font-medium">意味</div>
            <div
              className="font-bold text-foreground"
              style={fontSizePx ? { fontSize: `${Math.max(12, fontSizePx - 2)}px`, lineHeight: 1.4 } : undefined}
              data-testid="text-meaning"
            >
              {word.meaning}
            </div>
            {word.example && (
              <div className="text-sm text-muted-foreground" data-testid="text-example">
                例: {word.example}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
