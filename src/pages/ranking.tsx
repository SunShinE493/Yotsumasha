import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function RankingPage() {
  const [tab, setTab] = useState('overall');

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">ランキング</h1>
          <a href="/" className="text-sm text-muted-foreground hover:underline">ホーム</a>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardContent className="p-6">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="overall">総合</TabsTrigger>
                <TabsTrigger value="weekly">ウィークリー</TabsTrigger>
                <TabsTrigger value="monthly">マンスリー</TabsTrigger>
                <TabsTrigger value="theme">テーマ別</TabsTrigger>
              </TabsList>
              <TabsContent value="overall">総合ランキング（実装予定）</TabsContent>
              <TabsContent value="weekly">ウィークリー（実装予定）</TabsContent>
              <TabsContent value="monthly">マンスリー（実装予定）</TabsContent>
              <TabsContent value="theme">テーマ別（実装予定）</TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
