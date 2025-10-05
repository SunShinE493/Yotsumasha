import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function BattlePage() {
  const [mode, setMode] = useState<'host'|'join'|null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">リアルタイム対戦 🧠⚡</h1>
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
              <div className="grid gap-3">
                <Input placeholder="名前" />
                <Input placeholder="部屋番号" />
                <Input placeholder="jsonファイル名 (例: rinri.json)" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="開始 (例: 1)" />
                  <Input placeholder="終了 (例: 50)" />
                </div>
                <Input placeholder="制限時間(秒)" />
                <Button className="mt-2">部屋を作成して開始</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === 'join' && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">部屋に入る</h2>
              <div className="grid gap-3">
                <Input placeholder="名前" />
                <Input placeholder="部屋番号" />
                <Button className="mt-2">入室</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
