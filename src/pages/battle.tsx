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
  const [selectedJson, setSelectedJson] = useState<SelectedJsonInfo | null>(null);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(50);
  const [limitSec, setLimitSec] = useState<number>(30);
  const [canStart, setCanStart] = useState(false);

  // --- WebSocket client state ---
  const wsRef = useRef<WebSocket | null>(null);
  const [phase, setPhase] = useState<'idle'|'lobby'|'running'|'ended'>('idle');
  const [players, setPlayers] = useState<string[]>([]);
  const [questionMeaning, setQuestionMeaning] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
          }
        } else if (msg.type === 'question') {
          setPhase('running');
          setQuestionMeaning(msg.meaning ?? null);
          setAnswerText('');
        } else if (msg.type === 'score') {
          setScores(msg.scores || {});
        } else if (msg.type === 'end') {
          setPhase('ended');
          setScores(msg.scores || {});
          setQuestionMeaning(null);
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
    // Preload to server
    const s = Math.max(1, rangeStart);
    const e = Math.max(s, rangeEnd);
    await apiRequest('GET', `/api/vocabulary/range/${s}/${e}`);
    const ws = ensureSocket();
    ws.onopen = () => {
      const createMsg = { type: 'create', room, name, limitSec, words: [] };
      // words array is not sent via REST; server uses uploaded vocabulary. But protocol expects words array.
      // Send a minimal placeholder; server validates and normalizes existing upload on its side.
      ws.send(JSON.stringify(createMsg));
      // Immediately transition to lobby; server will broadcast lobby with players
      setMode('host');
    };
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

  const submitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsRef.current || !answerText.trim()) return;
    wsRef.current.send(JSON.stringify({ type: 'answer', room, name, text: answerText.trim() }));
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
            <CardContent className="p-6 space-y-4">
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
                  setRangeStart(1);
                  setRangeEnd(Math.min(20, info.wordCount));
                }} />
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
                      <Button size="sm" onClick={handleStart} disabled={players.length === 0}>開始</Button>
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
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">部屋: {room}</div>
                <div className="text-sm">残り時間: {remaining ?? '-'}s</div>
              </div>
              <div className="rounded-lg border border-border p-6 bg-card">
                <div className="text-sm text-muted-foreground mb-1">問題:</div>
                <div className="text-2xl font-semibold text-foreground">{questionMeaning ?? (phase==='ended' ? '終了しました' : '...')}</div>
              </div>

              {phase === 'running' && (
                <form onSubmit={submitAnswer} className="flex gap-2">
                  <Input placeholder="英単語を入力" value={answerText} onChange={(e)=>setAnswerText(e.target.value)} autoFocus />
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
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
