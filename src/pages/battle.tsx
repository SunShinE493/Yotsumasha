import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUpload, type SelectedJsonInfo } from '@/components/file-upload';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function BattlePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [fontSizePx, setFontSizePx] = useState<number>(24);
  const [mode, setMode] = useState<'host'|'join'|null>(null);
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');
  const [openRooms, setOpenRooms] = useState<Array<{id:string; state:string; playerCount:number}> | null>(null);
  const [selectedJson, setSelectedJson] = useState<SelectedJsonInfo | null>(null);
  const [rangeStart, setRangeStart] = useState<number | ''>(1);
  const [rangeEnd, setRangeEnd] = useState<number | ''>(50);
  const [limitSec, setLimitSec] = useState<number | ''>(30);
  const [questionCount, setQuestionCount] = useState<number | ''>(20);
  const [canStart, setCanStart] = useState(false);

  // --- WebSocket client state ---
  const wsRef = useRef<WebSocket | null>(null);
  const [phase, setPhase] = useState<'idle'|'lobby'|'running'|'ended'>('idle');
  const [players, setPlayers] = useState<string[]>([]);
  const [lastAnsweredBy, setLastAnsweredBy] = useState<string | null>(null);
  const [lastAnswerByName, setLastAnswerByName] = useState<Record<string, string>>({});
  const [questionWord, setQuestionWord] = useState<string | null>(null);
  const [questionMeaning, setQuestionMeaning] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<'none'|'green'|'red'>('none');
  const selfNameRef = useRef<string>('');
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [lastAnswerWord, setLastAnswerWord] = useState<string | null>(null);
  const [lastAnswerer, setLastAnswerer] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [serverLimitSec, setServerLimitSec] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Refs to track previous question for reliable display (avoid stale closures)
  const prevWordRef = useRef<string | null>(null);
  const prevMeaningRef = useRef<string | null>(null);
  const [finalRanking, setFinalRanking] = useState<Array<{name:string;score:number}>>([]);
  const [finalLastWord, setFinalLastWord] = useState<string | null>(null);
  const [finalLastMeaning, setFinalLastMeaning] = useState<string | null>(null);

  useEffect(()=>{
    const isNum = (v: number | ''): v is number => typeof v === 'number' && !Number.isNaN(v);
    const ok = Boolean(
      name && room && selectedJson &&
      isNum(rangeStart) && isNum(rangeEnd) &&
      rangeEnd >= rangeStart
    );
    setCanStart(ok);
  },[name, room, selectedJson, rangeStart, rangeEnd]);

  // Prefill display name if available
  useEffect(() => {
    if (!name && user?.displayName) {
      setName(user.displayName);
    }
  }, [user?.displayName, name]);

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
    ws.onmessage = async (ev) => {
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
          setLastAnswerer(null);
          prevWordRef.current = null;
          prevMeaningRef.current = null;
        } else if (msg.type === 'question') {
          setPhase('running');
          // Prefer server-sent previous answer only; avoid fallback to prevent first-question leakage
          setLastAnswer(typeof msg.prevMeaning === 'string' ? msg.prevMeaning : null);
          setLastAnswerWord(typeof msg.prevWord === 'string' ? msg.prevWord : null);
          if (typeof msg.prevAnswerer === 'string') setLastAnswerer(msg.prevAnswerer);
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
        } else if (msg.type === 'players') {
          setPlayers(Array.isArray(msg.players) ? msg.players : []);
        } else if (msg.type === 'answered') {
          // correct/incorrect visual cue per client
          const by = typeof msg.by === 'string' ? msg.by : null;
          if (by && by === selfNameRef.current && msg.correct) {
            setFlash('green'); setTimeout(()=>setFlash('none'), 200);
          } else if (by && by !== selfNameRef.current && msg.correct) {
            setFlash('red'); setTimeout(()=>setFlash('none'), 200);
          }
          if (typeof msg.by === 'string') {
            setLastAnsweredBy(`${msg.by}: ${String(msg.text || '')}`);
            setLastAnswerByName(prev => ({ ...prev, [msg.by]: String(msg.text || '') }));
          }
        } else if (msg.type === 'end') {
          setPhase('ended');
          setScores(msg.scores || {});
          const entries = Object.entries(msg.scores || {}).sort((a,b)=> (b[1]??0) - (a[1]??0));
          setFinalRanking(entries.map(([n,s])=>({ name: n, score: Number(s) })));
          if (msg.lastMeaning) {
            setFinalLastMeaning(msg.lastMeaning);
            setFinalLastWord(msg.lastWord ?? null);
            // add to review if timeout
            if (msg.endReason === 'timeout' && msg.lastId) {
              try {
                await apiRequest('POST','/api/study/progress', {
                  wordId: msg.lastId,
                  isRemembered: false,
                  word: { id: msg.lastId, word: msg.lastWord || '', meaning: msg.lastMeaning || '' }
                } as any);
              } catch {}
            }
          }
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
    const s = Math.max(1, Number(rangeStart));
    const e = Math.max(s, Number(rangeEnd));
    let words: any[] = [];
    try {
      const useSource = Boolean(selectedJson?.isBuiltin && selectedJson?.presets?.length);
      const res = await apiRequest('GET', `/api/vocabulary/range/${s}/${e}` + (useSource ? `?source=${encodeURIComponent(selectedJson!.name)}` : ''));
      words = await res.json();
    } catch (err: any) {
      toast({
        title: '読み込みエラー',
        description: String(err?.message || err || '問題データの読み込みに失敗しました'),
        variant: 'destructive',
      });
      return;
    }
    const ws = ensureSocket();
    const sendCreate = () => {
      selfNameRef.current = name;
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
      selfNameRef.current = name;
      ws.send(JSON.stringify({ type: 'join', room, name }));
    };
  };

  const handleStart = () => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'start', room }));
    startCountdown(Number(serverLimitSec ?? limitSec) || 0);
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
    <div className="min-h-screen bg-background bg-[linear-gradient(to_bottom,transparent_0,transparent_calc(100%-2rem)),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.06),transparent_60%)]">
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
                    <Input type="number" min={0} value={rangeStart} onChange={(e)=>{
                      if (e.target.value === '') { setRangeStart(''); return; }
                      const v = Number(e.target.value);
                      setRangeStart(isNaN(v) ? '' : v);
                    }} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">終了</label>
                    <Input type="number" min={typeof rangeStart==='number' ? rangeStart : 0} value={rangeEnd} onChange={(e)=>{
                      if (e.target.value === '') { setRangeEnd(''); return; }
                      const v = Number(e.target.value);
                      setRangeEnd(isNaN(v) ? '' : v);
                    }} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">制限(秒)</label>
                    <Input type="number" min={5} value={limitSec} onChange={(e)=>{ if(e.target.value===''){ setLimitSec(''); return; } const v = Number(e.target.value); setLimitSec(isNaN(v)?'':v); }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-sm text-muted-foreground">出題数</label>
                    <Input type="number" value={questionCount} onChange={(e)=>{ if(e.target.value===''){ setQuestionCount(''); return; } const v = Number(e.target.value); setQuestionCount(isNaN(v)?'':v); }} />
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
                  <Button type="button" size="sm" variant="outline" onClick={async (e)=>{
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      const res = await fetch('/api/battle/rooms', { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
                      const list = await res.json();
                      setOpenRooms(Array.isArray(list) ? list : []);
                    } catch {
                      setOpenRooms([]);
                    }
                  }}>更新</Button>
                </div>
                <AutoRoomsList onUpdate={(list)=>setOpenRooms(list)} intervalMs={5000} />
                <div className="grid gap-2">
                  {Array.isArray(openRooms) && openRooms.map(r => (
                    <div key={r.id} className="rounded-md border border-border bg-background px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-foreground">{r.id} <span className="text-muted-foreground">({r.playerCount})</span> {Array.isArray((r as any).players) && (r as any).players.length>0 ? <span className="text-xs text-muted-foreground ml-2">[{(r as any).players.join(', ')}]</span> : null}</div>
                        <Button size="sm" onClick={()=>{ setRoom(r.id); }}>この部屋に入る</Button>
                      </div>
                      {Number(r.playerCount) === 0 && (
                        <div className="mt-1 text-[11px] text-muted-foreground">誰もいないこの部屋はもうすぐ削除されます</div>
                      )}
                    </div>
                  ))}
                  {Array.isArray(openRooms) && openRooms.length === 0 && (
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
                    style={{ width: `${Math.max(0, Math.min(100, (remaining / Math.max(1, Number(serverLimitSec ?? limitSec) || 1)) * 100))}%` }}
                  />
                </div>
              )}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">部屋: {room}</div>
                  <div className="text-sm">残り時間: {remaining ?? '-'}s</div>
                </div>
                {/* participants label removed per request */}
                <div className="rounded-lg border border-border p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">問題:</div>
                    <div className="flex items-center gap-2">
                      <button className="text-xs px-2 py-0.5 rounded border" onClick={()=>setFontSizePx(v=>Math.max(10, v-3))}>-A</button>
                      <span className="text-[10px] text-muted-foreground">{fontSizePx}px</span>
                      <button className="text-xs px-2 py-0.5 rounded border" onClick={()=>setFontSizePx(v=>v+3)}>+A</button>
                    </div>
                  </div>
                  <div className="font-semibold text-foreground" style={{ fontSize: `${fontSizePx}px`, lineHeight: 1.25 }}>
                    {questionWord ?? (phase==='ended' ? '終了しました' : '...')}
                  </div>
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
                      <div key={n} className="flex items-center rounded-md border border-border bg-background px-3 py-2">
                        <div className="text-foreground">{n}</div>
                        <div className="flex-1 mx-2 text-xs text-muted-foreground text-center truncate">{lastAnswerByName[n] ?? ''}</div>
                        <div className="text-sm text-muted-foreground tabular-nums">{sc}</div>
                      </div>
                    ))}
                  </div>
                  {lastAnswer && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      直前の答え: <span className="text-foreground font-medium">{lastAnswer}</span>
                      {lastAnswerWord ? <span className="text-muted-foreground">（{lastAnswerWord}）</span> : null}
                      {lastAnswerer ? <span className="ml-2 text-xs text-muted-foreground">正解者: <span className="text-foreground font-medium">{lastAnswerer}</span></span> : null}
                    </div>
                  )}
                  {phase==='ended' && (
                    <div className="mt-6">
                      <div className="font-semibold mb-2">最終ランキング</div>
                      <div className="space-y-1 text-sm">
                        {finalRanking.map((r, i)=> (
                          <div key={r.name} className="flex items-center justify-between">
                            <div>{['🥇','🥈','🥉'][i] || ' '} {r.name}</div>
                            <div className="text-muted-foreground">{r.score}</div>
                          </div>
                        ))}
                      </div>
                      {finalLastMeaning && (
                        <div className="mt-3 text-sm text-muted-foreground">
                          最後の問題の答え: <span className="text-foreground font-medium">{finalLastMeaning}</span>
                          {finalLastWord ? <span className="text-muted-foreground">（{finalLastWord}）</span> : null}
                        </div>
                      )}
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

function AutoRoomsList({ onUpdate, intervalMs = 5000 }: { onUpdate: (list: any[]) => void; intervalMs?: number }) {
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        const res = await fetch('/api/battle/rooms', { cache: 'no-store' });
        const list = await res.json();
        if (!cancelled) onUpdate(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) onUpdate([]);
      } finally {
        if (!cancelled) timer = window.setTimeout(tick, intervalMs);
      }
    };
    tick();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [onUpdate, intervalMs]);
  return null;
}
