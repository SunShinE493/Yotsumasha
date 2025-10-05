import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ScorePage() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">スコアアタック 🕒🏆</h1>
        {!isPlaying ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">設定</h2>
              <div className="grid gap-3">
                <Input placeholder="jsonファイル名 (例: rinri.json)" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="開始 (例: 1)" />
                  <Input placeholder="終了 (例: 100)" />
                </div>
                <Input placeholder="制限時間(秒)" />
                <Button className="mt-2" onClick={() => setIsPlaying(true)}>開始</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>コンボ: 0</div>
                <div>スコア: 0</div>
                <div>残り: 00:00</div>
              </div>
              <Input placeholder="ここに回答を入力" />
              <div className="flex gap-2">
                <Button>送信</Button>
                <Button variant="outline" onClick={() => setIsPlaying(false)}>終了</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
