import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUpload, type SelectedJsonInfo } from '@/components/file-upload';
import { MathText } from '@/components/MathText';
import { validateAnswer, formatMeaning } from '@/lib/answerUtils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function ScorePage() {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedJson, setSelectedJson] = useState<SelectedJsonInfo | null>(null);
  const [rangeStart, setRangeStart] = useState<number | ''>(1);
  const [rangeEnd, setRangeEnd] = useState<number | ''>(50);
  const [limitSec, setLimitSec] = useState<number | ''>(60);

  // gameplay state
  const [words, setWords] = useState<Array<{ id: string; word: string; meaning: string }>>([]);
  const [idx, setIdx] = useState<number>(0);
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [skips, setSkips] = useState(0);
  const [flash, setFlash] = useState<'none' | 'green' | 'red'>('none');
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    fileName: string | null;
    start: number;
    end: number;
    limit: number;
    maxCombo: number;
    score: number;
    mistakes: number;
    skips: number;
    correctCount?: number;
    lastWord?: string | null;
    lastMeaning?: string | null;
  }>(null);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<number | null>(null);
  const finalizedRef = useRef<boolean>(false);
  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(0);
  const maxComboRef = useRef<number>(0);
  const correctRef = useRef<number>(0);
  const idxRef = useRef<number>(0);
  const wordsRef = useRef<Array<{ id: string; word: string; meaning: string }>>([]);
  const selectedJsonRef = useRef<SelectedJsonInfo | null>(null);
  const rangeStartRef = useRef<number | ''>(1);
  const rangeEndRef = useRef<number | ''>(50);
  const limitSecRef = useRef<number | ''>(60);

  const current = words[idx];

  useEffect(() => {
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, []);

  const startGame = async () => {
    // Fetch words from server storage (FileUpload already saved them)
    const s = Math.max(1, Number(rangeStart));
    const e = Math.max(s, Number(rangeEnd));
    let list: Array<{ id: string; word: string; meaning: string }> = [];
    try {
      const useSource = Boolean(selectedJson?.isBuiltin && selectedJson?.presets?.length);
      const res = await apiRequest('GET', `/api/vocabulary/range/${s}/${e}` + (useSource ? `?source=${encodeURIComponent(selectedJson!.name)}` : ''));
      list = await res.json();
    } catch (err: any) {
      toast({
        title: '読み込みエラー',
        description: String(err?.message || err || '問題データの読み込みに失敗しました'),
        variant: 'destructive',
      });
      return;
    }
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    setWords(shuffled); wordsRef.current = shuffled;
    setIdx(0); idxRef.current = 0;
    setScore(0); scoreRef.current = 0;
    setCombo(0); comboRef.current = 0;
    setMaxCombo(0); maxComboRef.current = 0;
    setCorrect(0); correctRef.current = 0;
    setMistakes(0);
    setSkips(0);
    setFlash('none');
    setResult(null);
    setRemaining(Number(limitSec) || 60); limitSecRef.current = limitSec;
    setIsPlaying(true);
    finalizedRef.current = false;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          // Just set to 0; finalize via effect to avoid stale closures
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  async function finalizeGame(reason: 'timeout' | 'manual') {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    const currentWord = wordsRef.current[idxRef.current];
    const summary = {
      fileName: selectedJsonRef.current?.name ?? null,
      start: Number(rangeStartRef.current) as number,
      end: Number(rangeEndRef.current) as number,
      limit: Number(limitSecRef.current) || 0,
      maxCombo: maxComboRef.current,
      score: scoreRef.current,
      mistakes,
      skips,
      correctCount: correctRef.current,
      lastWord: currentWord?.word ?? null,
      lastMeaning: currentWord?.meaning ?? null,
    };
    setResult(summary);
    setIsPlaying(false);
    try {
      await apiRequest('POST', '/api/score-attack/submit', { score: scoreRef.current, summary });
    } catch { }
    // Only time-out should add last question to review per request
    if (reason === 'timeout' && currentWord) {
      try { await apiRequest('POST', '/api/study/progress', { wordId: currentWord.id, isRemembered: false, word: { id: currentWord.id, word: currentWord.word, meaning: currentWord.meaning } }); } catch { }
    }
  }

  const finishGame = async () => {
    await finalizeGame('manual');
  };

  const submitAnswer = async () => {
    if (!current) return;
    const ok = validateAnswer(answer, current.meaning || '');
    if (ok) {
      const next = (idx + 1) % words.length;
      setScore((s) => { const v = s + 100 + combo * 10; scoreRef.current = v; return v; });
      setCombo((c) => { const v = c + 1; comboRef.current = v; if (v > maxComboRef.current) { setMaxCombo(v); maxComboRef.current = v; } return v; });
      setCorrect((c) => { const v = c + 1; correctRef.current = v; return v; });
      setIdx(next); idxRef.current = next;
      setAnswer('');
      if (current?.meaning) setLastAnswer(current.meaning);
      setFlash('green'); setTimeout(() => setFlash('none'), 120);
    } else {
      setCombo(0);
      setMistakes((m) => m + 1);
      setFlash('red');
      setTimeout(() => setFlash('none'), 200);
      try { await apiRequest('POST', '/api/study/progress', { wordId: current.id, isRemembered: false, word: { id: current.id, word: current.word, meaning: current.meaning } }); } catch { }
    }
  };

  const skipQuestion = async () => {
    if (!current) return;
    setSkips((k) => k + 1);
    setScore((s) => Math.max(0, s - 50));
    setCombo(0);
    setFlash('red');
    setTimeout(() => setFlash('none'), 200);
    const next = (idx + 1) % words.length;
    setIdx(next); idxRef.current = next;
    setAnswer('');
    if (current?.meaning) setLastAnswer(current.meaning);
    // Save to review
    try { await apiRequest('POST', '/api/study/progress', { wordId: current.id, isRemembered: false, word: { id: current.id, word: current.word, meaning: current.meaning } }); } catch { }
  };

  // keep refs in sync for values not set via closures
  useEffect(() => { wordsRef.current = words; }, [words]);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { correctRef.current = correct; }, [correct]);
  useEffect(() => { selectedJsonRef.current = selectedJson; }, [selectedJson]);
  useEffect(() => { rangeStartRef.current = rangeStart; }, [rangeStart]);
  useEffect(() => { rangeEndRef.current = rangeEnd; }, [rangeEnd]);
  useEffect(() => { limitSecRef.current = limitSec; }, [limitSec]);

  // finalize via effect to avoid stale interval closures
  useEffect(() => {
    if (isPlaying && remaining === 0) {
      void finalizeGame('timeout');
    }
  }, [remaining, isPlaying]);

  return (
    <div className="min-h-screen bg-background bg-[linear-gradient(to_bottom,transparent_0,transparent_calc(100%-2rem)),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.06),transparent_60%)]">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">スコアアタック 🕒🏆</h1>
          <a href="/" className="text-sm text-muted-foreground hover:underline">ホーム</a>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {!isPlaying ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">設定</h2>
              <div className="grid gap-4">
                <FileUpload onUploadSuccess={(info) => {
                  setSelectedJson(info);
                  if (info.presets && info.presets.length > 0) {
                    setRangeStart(info.presets[0].start);
                    setRangeEnd(info.presets[0].end);
                  } else {
                    setRangeStart(1);
                    setRangeEnd(Math.min(50, info.wordCount));
                  }
                }} />
                {selectedJson?.presets?.length ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedJson.presets.map((p) => (
                      <Button key={p.label} variant="outline" size="sm" onClick={() => { setRangeStart(p.start); setRangeEnd(p.end); }}>
                        {p.label}
                      </Button>
                    ))}
                    <Button variant="secondary" size="sm" onClick={() => { setRangeStart(1); setRangeEnd(selectedJson.wordCount); }}>全範囲</Button>
                  </div>
                ) : null}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-sm text-muted-foreground">開始</label>
                    <Input type="number" min={0} value={rangeStart} onChange={(e) => {
                      if (e.target.value === '') { setRangeStart(''); return; }
                      const v = Number(e.target.value);
                      setRangeStart(isNaN(v) ? '' : v);
                    }} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">終了</label>
                    <Input type="number" min={typeof rangeStart === 'number' ? rangeStart : 0} value={rangeEnd} onChange={(e) => {
                      if (e.target.value === '') { setRangeEnd(''); return; }
                      const v = Number(e.target.value);
                      setRangeEnd(isNaN(v) ? '' : v);
                    }} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">制限(秒)</label>
                    <Input type="number" min={10} value={limitSec} onChange={(e) => { if (e.target.value === '') { setLimitSec(''); return; } const v = Number(e.target.value); setLimitSec(isNaN(v) ? '' : v); }} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectedJson ? `${selectedJson.name} / ${selectedJson.wordCount}語` : 'ファイル未選択'}
                  </div>
                  <Button className="mt-2" onClick={startGame} disabled={!selectedJson}>開始</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className={`p-6 space-y-4 ${flash === 'green' ? 'bg-green-500/10' : ''} ${flash === 'red' ? 'bg-red-500/10 animate-pulse' : ''}`}>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>コンボ: <span className="text-foreground font-medium">{combo}</span></div>
                <div>スコア: <span className="text-foreground font-medium">{score}</span></div>
                <div>残り: <span className="text-foreground font-medium">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</span></div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-xl font-semibold"><MathText text={current?.word ?? '読み込み中...'} smilesVariant="black" /></div>
                <div className="text-sm text-muted-foreground">意味を入力</div>
              </div>
              <div className="flex gap-2">
                <Input placeholder="ここに意味を入力" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitAnswer(); }} />
                <Button onClick={submitAnswer}>送信</Button>
                <Button variant="secondary" onClick={skipQuestion}>？</Button>
                <Button variant="outline" onClick={finishGame}>終了</Button>
              </div>
              {lastAnswer && (
                <div className="text-sm text-muted-foreground">直前の答え: <span className="text-foreground font-medium"><MathText text={formatMeaning(lastAnswer)} smilesVariant="black" /></span></div>
              )}
            </CardContent>
          </Card>
        )}

        {(!isPlaying && result) && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold">リザルト</h3>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">ファイル</span><span className="text-foreground">{result.fileName ?? '-'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">範囲</span><span className="text-foreground">{rangeStart} - {rangeEnd}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">制限時間</span><span className="text-foreground">{limitSec}s</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">コンボ</span><span className="text-foreground">{combo}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">スコア</span><span className="text-foreground">{score}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">間違い</span><span className="text-foreground">{mistakes}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">スキップ</span><span className="text-foreground">{skips}</span></div>
                {result.lastMeaning ? (
                  <div className="flex justify-between sm:col-span-2"><span className="text-muted-foreground">最後の問題の答え</span><span className="text-foreground"><MathText text={formatMeaning(result.lastMeaning!)} smilesVariant="black" /> {result.lastWord ? <span>（<MathText text={result.lastWord} smilesVariant="black" />）</span> : ''}</span></div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button onClick={startGame}>もう一度</Button>
                <Button variant="outline" onClick={() => setResult(null)}>閉じる</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
