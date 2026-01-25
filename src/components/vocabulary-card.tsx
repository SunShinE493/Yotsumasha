import { useState } from "react";
import type { VocabularyWord } from "@shared/schema";
import { MathText } from "./MathText";
import { formatMeaning } from "@/lib/answerUtils";

interface VocabularyCardProps {
  word: VocabularyWord;
  rotationCount: number;
  onFlip: () => void;
  fontSizeClass?: string;
  fontSizePx?: number;
  rotationDeg?: number;
  rotationTurn?: number; // 0.5 turn per flip when provided
  selectedDifficulties?: (number | string)[];
  langMode?: "en-jp" | "jp-en";
}

export function VocabularyCard({ word, rotationCount, onFlip, fontSizeClass, fontSizePx, rotationDeg, rotationTurn, selectedDifficulties, langMode }: VocabularyCardProps) {
  // Determine Question (Front) and Answer (Back) based on langMode
  // Default (en-jp): Front=Word, Back=Meaning
  // Reverse (jp-en): Front=Meaning, Back=Word
  const isJpEn = langMode === "jp-en";
  const frontText = isJpEn ? formatMeaning(word.meaning, word.difficulty, selectedDifficulties) : word.word;
  const backText = isJpEn ? word.word : formatMeaning(word.meaning, word.difficulty, selectedDifficulties);
  const diffDisplay = word.difficulty ? `Difficulty: ${word.difficulty}` : null;
  // User asked to display difficulty string "below the answer on flashcards" (small text)
  // "Answer" is usually Back in en-jp, but in jp-en?
  // "Display the difficulty string... below the answer".
  // If jp-en, Answer is Word. Should I display diff below word?
  // Probably yes. The goal is "Check answer, see difficulty".

  return (
    <div
      className="relative h-64 cursor-pointer touch-target"
      onClick={onFlip}
      data-testid="card-vocabulary"
    >
      {/* card-flip に style プロパティで回転角度を直接適用 */}
      <div
        className="card-flip relative w-full h-full"
        style={{ transform: rotationTurn !== undefined ? `rotateY(${rotationTurn}turn)` : `rotateY(${rotationDeg !== undefined ? rotationDeg : rotationCount * 180}deg)` }}
      >
        {/* Front of Card */}
        <div className="card-front bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg p-8 flex flex-col items-center justify-center text-center">
          <div className="space-y-4">
            <div className="text-sm text-primary-foreground/80 font-medium">{isJpEn ? "意味" : "単語"}</div>
            <div
              className={`${fontSizeClass || ''} font-bold text-primary-foreground`}
              style={fontSizePx ? { fontSize: `${fontSizePx}px`, lineHeight: 1.25 } : undefined}
              data-testid="text-word"
            >
              <MathText text={frontText} fontSizePx={fontSizePx} />
            </div>
            {/* If Front is Word (en-jp) or Meaning (jp-en) */}
            {!isJpEn && word.category && (
              <div className="text-sm text-primary-foreground/80" data-testid="text-category">
                {word.category}
              </div>
            )}
          </div>
          <div className="absolute bottom-4 right-4">
            <i className="fas fa-hand-pointer text-primary-foreground/60 text-sm"></i>
          </div>
        </div>

        {/* Back of Card */}
        <div className="card-back bg-gradient-to-br from-accent to-muted rounded-xl shadow-lg p-8 flex flex-col items-center justify-center text-center">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground font-medium">{isJpEn ? "単語" : "意味"}</div>
            <div
              className="font-bold text-foreground"
              style={fontSizePx ? { fontSize: `${Math.max(12, fontSizePx - 2)}px`, lineHeight: 1.4 } : undefined}
              data-testid="text-meaning"
            >
              <MathText text={backText} fontSizePx={fontSizePx ? Math.max(12, fontSizePx - 2) : undefined} />
            </div>
            {/* Difficulty display below answer */}
            {word.difficulty && (
              <div className="text-xs text-muted-foreground/70 mt-1">
                {String(word.difficulty)}
              </div>
            )}

            {!isJpEn && word.example && (
              <div className="text-sm text-muted-foreground" data-testid="text-example">
                例: {word.example}
              </div>
            )}
            {isJpEn && word.category && (
              <div className="text-sm text-muted-foreground mb-1">
                {word.category}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
