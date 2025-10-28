import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background bg-[linear-gradient(to_bottom,transparent_0,transparent_calc(100%-2rem)),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.06),transparent_60%)] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">404 - ページが見つかりません</h1>
        </div>
        <p className="text-muted-foreground">お探しのページは存在しません。</p>
        <div className="grid gap-2">
          <a href="/" className="text-primary underline underline-offset-4">ホームへ</a>
          <a href="/study" className="text-primary underline underline-offset-4">暗記へ</a>
        </div>
      </div>
    </div>
  );
}
