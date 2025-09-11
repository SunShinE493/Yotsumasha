// Landing page for logged out users - Referenced from javascript_log_in_with_replit integration
export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            よつましゃアプリ
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            単語学習システムへようこそ
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div>
            <a
              href="/api/login"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              ログイン
            </a>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              ログインして個人の学習データにアクセスしましょう
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}