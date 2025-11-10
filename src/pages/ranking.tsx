import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';

export default function RankingPage() {
  const [tab, setTab] = useState('overall');
  const [metric, setMetric] = useState<'ppm'|'combo'|'correct'>('ppm');
  const [source, setSource] = useState<string | ''>('');
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const res = await apiRequest('GET', `/api/rankings?period=${tab}&metric=${metric}` + (source ? `&source=${encodeURIComponent(source)}` : ''));
    setRows(await res.json());
  }

  useEffect(()=>{ load(); }, [tab, metric, source]);

  return (
    <div className="min-h-screen bg-background bg-[linear-gradient(to_bottom,transparent_0,transparent_calc(100%-2rem)),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.06),transparent_60%)]">
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
              <TabsContent value="overall">{renderTable(rows, metric)}</TabsContent>
              <TabsContent value="weekly">{renderTable(rows, metric)}</TabsContent>
              <TabsContent value="monthly">{renderTable(rows, metric)}</TabsContent>
              <TabsContent value="theme">{renderTable(rows, metric)}</TabsContent>
            </Tabs>
            <div className="mt-4 grid sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">指標</span>
                <Select value={metric} onValueChange={(v)=>setMetric(v as any)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ppm">1分あたりスコア</SelectItem>
                    <SelectItem value="combo">最大コンボ</SelectItem>
                    <SelectItem value="correct">正解数</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">テーマ(ファイル名)</span>
                <input className="px-2 py-1 rounded bg-background border border-border text-sm text-foreground flex-1" placeholder="例: koumin.json" value={source} onChange={(e)=>setSource(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function renderTable(rows: any[], metric: 'ppm'|'combo'|'correct') {
  if (!rows || rows.length === 0) return <div className="text-sm text-muted-foreground mt-4">データがありません</div>;
  return (
    <div className="mt-4 grid gap-2">
      {rows.map((r, i)=> (
        <div key={i} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
          <div className="text-sm">
            <div className="font-medium text-foreground">{i<3?['🥇','🥈','🥉'][i]:''} {r.playerName}</div>
            <div className="text-xs text-muted-foreground">{r.fileName || '-'} / 範囲 {r.start}-{r.end} / 制限 {r.limit}s</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-foreground">{metric==='ppm' ? `${Math.round(r.ppm)} ppm` : metric==='combo' ? `最大コンボ ${r.maxCombo}` : `正解 ${r.correctCount}`}</div>
            <div className="text-muted-foreground text-xs">スコア {r.score}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
