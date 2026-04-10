import React, { useState } from "react";
import { FileUpload, type SelectedJsonInfo } from "@/components/file-upload";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function CampfirePage() {
  const { toast } = useToast();
  const [uploaded, setUploaded] = useState<SelectedJsonInfo | null>(null);

  const handleUploadSuccess = (info: SelectedJsonInfo) => {
    setUploaded(info);
  };

  const handleCook = () => {
    const baseName = uploaded?.name ? uploaded.name.replace(/\.json$/i, "") : "未命名";
    toast({
      title: "焼き上がり！",
      description: `${baseName}リストが焼けた`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Campfire</h1>
            <p className="text-sm text-muted-foreground">復習リストを焼こう</p>
          </div>
          <a href="/" className="px-3 py-2 rounded-lg bg-secondary hover:bg-accent transition-colors text-sm">ホームへ</a>
        </header>

        <FileUpload onUploadSuccess={handleUploadSuccess} />

        <Card className="relative overflow-hidden">
          <div
            className="absolute inset-0 bg-center bg-cover opacity-30 pointer-events-none"
            style={{ backgroundImage: "url('/Campfire_lit.png')" }}
          />
          <div className="relative">
            <CardHeader>
              <CardTitle className="text-base">仕上げ</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {uploaded ? (
                  <span>
                    アップロード済み: <span className="text-foreground">{uploaded.name}</span>（{uploaded.wordCount}語）
                  </span>
                ) : (
                  <span>まず単語リスト（JSON）をアップロードしてください</span>
                )}
              </div>
              <Button onClick={handleCook} disabled={!uploaded}>
                料理する
              </Button>
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}

