import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUpload, type SelectedJsonInfo } from '@/components/file-upload';
import { apiRequest } from '@/lib/queryClient';

export default function BattlePage() {
  const [mode, setMode] = useState<'host'|'join'|null>(null);
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');
  const [openRooms, setOpenRooms] = useState<Array<{id:string; state:string; playerCount:number}> | null>(null);
  const [selectedJson, setSelectedJson] = useState<SelectedJsonInfo | null>(null);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(50);
  const [limitSec, setLimitSec] = useState<number>(30);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [canStart, setCanStart] = useState(false);

  // --- WebSocket client state ---
  const wsRef = useRef<WebSocket | null>(null);
  const [phase, setPhase] = useState<'idle'|'lobby'|'running'|'ended'>('idle');
  const [players, setPlayers] = useState<string[]>([]);
  const [questionWord, setQuestionWord] = useState<string | null>(null);
  const [questionMeaning, setQuestionMeaning] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<'none'|'green'|'red'>('none');
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [lastAnswerWord, setLastAnswerWord] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [serverLimitSec, setServerLimitSec] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Refs to track previous question for reliable display (avoid stale closures)
  const prevWordRef = useRef<string | null>(null);
  const prevMeaningRef = useRef<string | null>(null);

  useEffect(()=>{
    setCanStart(Boolean(name && room && selectedJson && rangeEnd >= rangeStart));
  },[name, room, selectedJson, rangeStart, rangeEnd]);

  // Utility: compute ws endpoint based on current page origin
  const wsUrl = useMemo(() => {
    const loc = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${loc.host}`; // ws to same host:port
  }, []);

  function ensureSocket(): WebSocket {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return wsRef.current;
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) return wsRef.current;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'error') {
          alert(`エラー: ${msg.message}`);
        } else if (msg.type === 'lobby') {
          setPhase('lobby');
          setPlayers(msg.players || []);
          if (typeof msg.timeLimit === 'number') {
            setRemaining(msg.timeLimit);
            setServerLimitSec(msg.timeLimit);
          }
          // reset previous answer state when entering lobby (new game)
          setLastAnswer(null);
          setLastAnswerWord(null);
          prevWordRef.current = null;
          prevMeaningRef.current = null;
        } else if (msg.type === 'question') {
          setPhase('running');
          // Prefer server-sent previous answer only; avoid fallback to prevent first-question leakage
          setLastAnswer(typeof msg.prevMeaning === 'string' ? msg.prevMeaning : null);
          setLastAnswerWord(typeof msg.prevWord === 'string' ? msg.prevWord : null);
          setQuestionWord(msg.word ?? null);
          setQuestionMeaning(msg.meaning ?? null);
          setQuestionId(msg.id ?? null);
          setAnswerText('');
          const secs = (serverLimitSec ?? limitSec);
          startCountdown(secs);
          // update previous refs to this new question
          prevWordRef.current = msg.word ?? null;
          prevMeaningRef.current = msg.meaning ?? null;
        } else if (msg.type === 'score') {
          setScores(msg.scores || {});
        } else if (msg.type === 'end') {
          setPhase('ended');
          setScores(msg.scores || {});
          // Build ranking with medals
          const entries = Object.entries(msg.scores || {}).sort((a,b)=> (b[1]??0) - (a[1]??0));
          const medal = ['🥇','🥈','🥉'];
          const lines = entries.map(([n,s],i)=> `${medal[i]||' '} ${n}: ${s}`).join('\n');
          if (entries.length) alert(`ランキング\n${lines}`);
          setQuestionWord(null);
          setQuestionMeaning(null);
          setQuestionId(null);
          setLastAnswer(null);
          setLastAnswerWord(null);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        }
      } catch {}
    };
    ws.onclose = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    return ws;
  }

  function startCountdown(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    setRemaining(seconds);
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const handleCreate = async () => {
    if (!canStart) return;
    // Load chosen range words from server-side storage for this user
    const s = Math.max(1, rangeStart);
    const e = Math.max(s, rangeEnd);
    const res = await apiRequest('GET', `/api/vocabulary/range/${s}/${e}` + (selectedJson?.presets?.length ? `?source=${encodeURIComponent(selectedJson!.name)}` : ''));
    const words = await res.json();
    const ws = ensureSocket();
    const sendCreate = () => {
      ws.send(JSON.stringify({ type: 'create', room, name, limitSec, questionCount, words }));
      setMode('host');
    };
    if (ws.readyState === WebSocket.OPEN) sendCreate();
    else ws.onopen = sendCreate;
  };

  const handleJoin = async () => {
    if (!name || !room) return;
    const ws = ensureSocket();
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', room, name }));
    };
  };

  const handleStart = () => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'start', room }));
    startCountdown(limitSec);
  };

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsRef.current || !answerText.trim()) return;
    const text = answerText.trim();
    // locally detect wrong answer to add to review
    const isCorrect = questionMeaning ? (text === questionMeaning) : false;
    if (!isCorrect && questionId) {
      try {
        await apiRequest('POST', '/api/study/progress', {
          wordId: questionId,
          isRemembered: false,
          word: { id: questionId, word: questionWord || '', meaning: questionMeaning || '' }
        });
      } catch {}
      setFlash('red'); setTimeout(()=>setFlash('none'), 200);
    } else {
      setFlash('green'); setTimeout(()=>setFlash('none'), 120);
    }
    wsRef.current.send(JSON.stringify({ type: 'answer', room, name, text }));
    setAnswerText('');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">リアルタイム対戦 🧠⚡</h1>
          <a href="/" className="text-sm text-muted-foreground hover:underline">ホーム</a>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {!mode && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Button onClick={() => setMode('host')} className="h-12">部屋を立てる</Button>
            <Button variant="outline" onClick={() => setMode('join')} className="h-12">部屋に入る</Button>
          </div>
        )}

        {mode === 'host' && (
          <Card>
            <CardContent className={`p-6 space-y-4 ${flash==='green' ? 'bg-green-500/10' : ''} ${flash==='red' ? 'bg-red-500/10' : ''}`}>
              <h2 className="font-semibold">部屋設定</h2>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm text-muted-foreground">名前</label>
                    <Input placeholder="名前" value={name} onChange={(e)=>setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">部屋番号</label>
                    <Input placeholder="部屋番号" value={room} onChange={(e)=>setRoom(e.target.value)} />
                  </div>
                </div>
                <FileUpload onUploadSuccess={(info)=>{
                  setSelectedJson(info);
                  // If presets exist, pick first preset as a sensible default
                  if (info.presets && info.presets.length > 0) {
                    setRangeStart(info.presets[0].start);
                    setRangeEnd(info.presets[0].end);
                  } else {
                    setRangeStart(1);
                    setRangeEnd(Math.min(20, info.wordCount));
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
                    <Input type="number" min={5} value={limitSec} onChange={(e)=>setLimitSec(Number(e.target.value)||30)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-sm text-muted-foreground">出題数</label>
                    <Input type="number" min={1} max={Math.max(1, rangeEnd - rangeStart + 1)} value={questionCount} onChange={(e)=>setQuestionCount(Math.max(1, Number(e.target.value)||questionCount))} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectedJson ? `${selectedJson.name} / ${selectedJson.wordCount}語` : 'ファイル未選択'}
                  </div>
                  <Button className="mt-2" onClick={handleCreate} disabled={!canStart}>部屋を作成</Button>
                </div>
                {phase === 'lobby' && (
                  <div className="mt-4 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">ロビー</div>
                      <Button size="sm" onClick={() => { handleStart(); /* collapse settings into game view */ setMode(null); }} disabled={players.length === 0}>開始</Button>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">参加者: {players.join(', ') || '---'}</div>
                    {typeof remaining === 'number' && (
                      <div className="mt-2 text-sm">制限時間: {remaining}s</div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {mode === 'join' && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">部屋に入る</h2>
              <div className="grid gap-3">
                <Input placeholder="名前" value={name} onChange={(e)=>setName(e.target.value)} />
                <Input placeholder="部屋番号" value={room} onChange={(e)=>setRoom(e.target.value)} />
                <Button className="mt-2" onClick={handleJoin} disabled={!name || !room}>入室</Button>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">開いている部屋</div>
                  <Button size="sm" variant="outline" onClick={async ()=>{
                    try {
                      const res = await fetch('/api/battle/rooms');
                      const list = await res.json();
                      setOpenRooms(list);
                    } catch {
                      setOpenRooms([]);
                    }
                  }}>更新</Button>
                </div>
                <div className="grid gap-2">
                  {(openRooms||[]).map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                      <div className="text-sm text-foreground">{r.id} <span className="text-muted-foreground">({r.playerCount})</span></div>
                      <Button size="sm" onClick={()=>{ setRoom(r.id); }}>この部屋に入る</Button>
                    </div>
                  ))}
                  {openRooms && openRooms.length === 0 && (
                    <div className="text-sm text-muted-foreground">開いている部屋はありません</div>
                  )}
                </div>
              </div>
              {phase === 'lobby' && (
                <div className="mt-4 rounded-lg border border-border p-4">
                  <div className="font-semibold">ロビー</div>
                  <div className="mt-2 text-sm text-muted-foreground">参加者: {players.join(', ') || '---'}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(phase === 'running' || phase === 'ended') && (
          <Card>
            <CardContent className={`p-0 ${flash==='green' ? 'bg-green-500/10' : ''} ${flash==='red' ? 'bg-red-500/10 animate-pulse' : ''}`}>
              {typeof remaining === 'number' && (
                <div className="h-1 bg-blue-500/20">
                  <div
                    className="h-1 bg-blue-500 transition-[width] duration-1000"
                    style={{ width: `${Math.max(0, Math.min(100, (remaining / Math.max(1, limitSec)) * 100))}%` }}
                  />
                </div>
              )}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">部屋: {room}</div>
                  <div className="text-sm">残り時間: {remaining ?? '-'}s</div>
                </div>
                <div className="rounded-lg border border-border p-6 bg-card">
                  <div className="text-sm text-muted-foreground mb-1">問題:</div>
                  <div className="text-2xl font-semibold text-foreground">{questionWord ?? (phase==='ended' ? '終了しました' : '...')}</div>
                </div>

                {phase === 'running' && (
                  <form onSubmit={submitAnswer} className="flex gap-2">
                    <Input placeholder="意味を入力" value={answerText} onChange={(e)=>setAnswerText(e.target.value)} autoFocus />
                    <Button type="submit">回答</Button>
                  </form>
                )}

                <div>
                  <div className="font-semibold mb-2">スコア</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {Object.entries(scores).sort((a,b)=> (b[1]??0) - (a[1]??0)).map(([n, sc]) => (
                      <div key={n} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                        <div className="text-foreground">{n}</div>
                        <div className="text-sm text-muted-foreground">{sc}</div>
                      </div>
                    ))}
                  </div>
                  {lastAnswer && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      直前の答え: <span className="text-foreground font-medium">{lastAnswer}</span>
                      {lastAnswerWord ? <span className="text-muted-foreground">（{lastAnswerWord}）</span> : null}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
