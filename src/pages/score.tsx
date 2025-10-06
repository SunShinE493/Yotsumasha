import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUpload, type SelectedJsonInfo } from '@/components/file-upload';
import { apiRequest } from '@/lib/queryClient';

export default function ScorePage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedJson, setSelectedJson] = useState<SelectedJsonInfo | null>(null);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(50);
  const [limitSec, setLimitSec] = useState<number>(60);

  // gameplay state
  const [words, setWords] = useState<Array<{ id: string; word: string; meaning: string }>>([]);
  const [idx, setIdx] = useState<number>(0);
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [skips, setSkips] = useState(0);
  const [flash, setFlash] = useState<'none'|'red'>('none');
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
  }>(null);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<number | null>(null);

  const current = words[idx];

  useEffect(() => {
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, []);

  const startGame = async () => {
    // Fetch words from server storage (FileUpload already saved them)
    const s = Math.max(1, rangeStart);
    const e = Math.max(s, rangeEnd);
    const res = await apiRequest('GET', `/api/vocabulary/range/${s}/${e}` + (selectedJson?.presets?.length ? `?source=${encodeURIComponent(selectedJson!.name)}` : ''));
    const list = await res.json();
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    setWords(shuffled);
    setIdx(0);
    setScore(0);
    setCombo(0);
    setMistakes(0);
    setSkips(0);
    setFlash('none');
    setResult(null);
    setRemaining(limitSec);
    setIsPlaying(true);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          finishGame();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  const finishGame = async () => {
    setIsPlaying(false);
    const summary = {
      fileName: selectedJson?.name ?? null,
      start: rangeStart,
      end: rangeEnd,
      limit: limitSec,
      maxCombo: combo, // this is current; compute max below
      score,
      mistakes,
      skips,
    };
    setResult(summary);
    try {
      await apiRequest('POST', '/api/score-attack/submit', { score });
      // Record review entries for mistakes and skips
      const currentWord = words[idx];
      if (currentWord) {
        try { await apiRequest('POST', '/api/study/progress', { wordId: currentWord.id, isRemembered: false }); } catch {}
      }
    } catch {}
  };

  const submitAnswer = async () => {
    if (!current) return;
    const ok = answer.trim() === String(current.meaning||'').trim();
    if (ok) {
      const next = (idx + 1) % words.length;
      setScore((s) => s + 100 + combo * 10);
      setCombo((c) => c + 1);
      setIdx(next);
      setAnswer('');
      if (current?.meaning) setLastAnswer(current.meaning);
    } else {
      setCombo(0);
      setMistakes((m)=>m+1);
      setFlash('red');
      setTimeout(()=>setFlash('none'), 200);
      try { await apiRequest('POST', '/api/study/progress', { wordId: current.id, isRemembered: false }); } catch {}
    }
  };

  const skipQuestion = async () => {
    if (!current) return;
    setSkips((k)=>k+1);
    setScore((s)=> Math.max(0, s - 50));
    setCombo(0);
    setFlash('red');
    setTimeout(()=>setFlash('none'), 200);
    const next = (idx + 1) % words.length;
    setIdx(next);
    setAnswer('');
    if (current?.meaning) setLastAnswer(current.meaning);
    // Save to review
    try { await apiRequest('POST', '/api/study/progress', { wordId: current.id, isRemembered: false }); } catch {}
  };

  return (
    <div className="min-h-screen bg-background">
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
                    {selectedJson.presets.map((p)=> (
                      <Button key={p.label} variant="outline" size="sm" onClick={()=>{ setRangeStart(p.start); setRangeEnd(p.end); }}>
                        {p.label}
                      </Button>
                    ))}
                    <Button variant="secondary" size="sm" onClick={()=>{ setRangeStart(1); setRangeEnd(selectedJson.wordCount); }}>全範囲</Button>
                  </div>
                ) : null}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-sm text-muted-foreground">開始</label>
                    <Input type="number" min={1} value={rangeStart} onChange={(e)=>setRangeStart(Number(e.target.value)||1)} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">終了</label>
                    <Input type="number" min={rangeStart} value={rangeEnd} onChange={(e)=>setRangeEnd(Number(e.target.value)||rangeStart)} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">制限(秒)</label>
                    <Input type="number" min={10} value={limitSec} onChange={(e)=>setLimitSec(Number(e.target.value)||60)} />
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
            <CardContent className={`p-6 space-y-4 ${flash==='red' ? 'bg-red-500/10 animate-pulse' : ''}`}>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>コンボ: <span className="text-foreground font-medium">{combo}</span></div>
                <div>スコア: <span className="text-foreground font-medium">{score}</span></div>
                <div>残り: <span className="text-foreground font-medium">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</span></div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-xl font-semibold">{current?.word ?? '読み込み中...'}</div>
                <div className="text-sm text-muted-foreground">意味を入力</div>
              </div>
              <div className="flex gap-2">
                <Input placeholder="ここに意味を入力" value={answer} onChange={(e)=>setAnswer(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') submitAnswer(); }} />
                <Button onClick={submitAnswer}>送信</Button>
                <Button variant="secondary" onClick={skipQuestion}>？</Button>
                <Button variant="outline" onClick={finishGame}>終了</Button>
              </div>
              {lastAnswer && (
                <div className="text-sm text-muted-foreground">直前の答え: <span className="text-foreground font-medium">{lastAnswer}</span></div>
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
              </div>
              <div className="flex gap-2">
                <Button onClick={startGame}>もう一度</Button>
                <Button variant="outline" onClick={()=>setResult(null)}>閉じる</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
