// Landing page for logged out users - Referenced from javascript_log_in_with_replit integration
export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-animated-gradient opacity-10" />
        <div className="relative max-w-4xl mx-auto px-6 py-12">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center">🥴</div>
              <div>
                <h1 className="text-xl font-bold text-foreground">よつましゃアプリ</h1>
                <p className="text-sm text-muted-foreground">学習ダッシュボード</p>
              </div>
            </div>
          </header>

          <main className="mt-10 grid gap-6 md:grid-cols-3">
            <a href="/study" className="group block rounded-xl border border-border bg-card p-5 hover:bg-accent transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">暗記学習</h3>
                <span className="text-sm text-muted-foreground">Study</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">単語帳で学習する</p>
            </a>

            <a href="/battle" className="group block rounded-xl border border-border bg-card p-5 hover:bg-accent transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">リアルタイム対戦</h3>
                <span className="text-sm text-muted-foreground">Battle</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">友達やランダムユーザと早押し</p>
            </a>

            <a href="/score" className="group block rounded-xl border border-border bg-card p-5 hover:bg-accent transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">スコアアタック</h3>
                <span className="text-sm text-muted-foreground">Score</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">制限時間でスコアを競う</p>
            </a>

            <a href="/ranking" className="group block rounded-xl border border-border bg-card p-5 hover:bg-accent transition-colors md:col-span-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">ランキング</h3>
                <span className="text-sm text-muted-foreground">Ranking</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">総合・期間別・テーマ別</p>
            </a>
          </main>
        </div>
      </div>
    </div>
  );
}