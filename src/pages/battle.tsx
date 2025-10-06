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

  useEffect(()=>{
    setCanStart(Boolean(name && room && selectedJson && rangeEnd >= rangeStart));
  },[name, room, selectedJson, rangeStart, rangeEnd]);

  const handleCreate = async () => {
    // In a future step this would create a server room (socket.io). For now, validate inputs.
    if (!canStart) return;
    // Preload words to ensure data exists on server
    const s = Math.max(1, rangeStart);
    const e = Math.max(s, rangeEnd);
    await apiRequest('GET', `/api/vocabulary/range/${s}/${e}`);
    alert(`部屋 ${room} を作成しました。参加者に部屋番号を共有してください。`);
  };

  const handleJoin = async () => {
    if (!name || !room) return;
    alert(`部屋 ${room} に入室しました（デモ）。`);
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
                  <Button className="mt-2" onClick={handleCreate} disabled={!canStart}>部屋を作成して開始</Button>
                </div>
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
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
