import React from 'react';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-background bg-[linear-gradient(to_bottom,transparent_0,transparent_calc(100%-2rem)),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.06),transparent_60%)]">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">テストページ</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <a href="/battle" className="rounded-lg border border-border p-4 hover:bg-accent">対戦へ</a>
          <a href="/score" className="rounded-lg border border-border p-4 hover:bg-accent">スコアアタックへ</a>
          <a href="/ranking" className="rounded-lg border border-border p-4 hover:bg-accent">ランキングへ</a>
          <a href="/study" className="rounded-lg border border-border p-4 hover:bg-accent">暗記へ</a>
        </div>
      </div>
    </div>
  );
}