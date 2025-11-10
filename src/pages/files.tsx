import React, { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

type CatalogItem = { name: string; wordCount: number | null; type: "builtin" | "uploaded"; updatedAt?: string | null; size?: number | null; owner?: { ownerId: string; ownerName: string } | null; };

export default function FilesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<{ builtin: CatalogItem[]; uploaded: CatalogItem[] }>({ builtin: [], uploaded: [] });
  const [selected, setSelected] = useState<string>("");
  const [editorContent, setEditorContent] = useState<string>("");
  const [isBuiltin, setIsBuiltin] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>("my-words.json");
  const [isOwner, setIsOwner] = useState<boolean>(false);

  const reload = async () => {
    try {
      const res = await apiRequest("GET", "/api/files");
      setCatalog(await res.json());
    } catch {
      toast({ title: "取得失敗", description: "ファイル一覧の取得に失敗しました", variant: "destructive" });
    }
  };

  useEffect(() => { reload(); }, []);

  const loadFile = async (name: string, builtin: boolean) => {
    setSelected(name);
    setIsBuiltin(builtin);
    const entry = catalog.uploaded.find(f => f.name === name);
    setIsOwner(!!(entry?.owner && user?.id && entry.owner.ownerId === user.id));
    if (!builtin) {
      try {
        const res = await apiRequest("GET", `/api/files/${encodeURIComponent(name)}`);
        const data = await res.json();
        setEditorContent(data?.content || "[]");
      } catch {
        toast({ title: "読み込み失敗", description: "ファイルを読み込めませんでした", variant: "destructive" });
      }
    }
  };

  const handleCreate = async () => {
    try {
      // クライアント側で .json 拡張子を強制付与し、前後空白を除去
      let name = (newFileName || "").trim();
      if (!name.toLowerCase().endsWith(".json")) {
        name = `${name}.json`;
      }
      await apiRequest("POST", "/api/files", { name, content: editorContent || "[]" });
      toast({ title: "保存しました", description: `${name} を作成しました` });
      setSelected(name);
      setIsBuiltin(false);
      await reload();
      // Try backup to gist (best-effort)
      try { await apiRequest("POST", "/api/admin/backup/gist", {}); } catch {}
    } catch (e: any) {
      toast({ title: "保存失敗", description: e?.message || "ファイルの保存に失敗しました", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      if (!isBuiltin) {
        await apiRequest("PUT", `/api/files/${encodeURIComponent(selected)}`, { content: editorContent });
      }
      toast({ title: "保存しました", description: `${selected} を保存しました` });
      await reload();
      // Try backup to gist (best-effort)
      try { await apiRequest("POST", "/api/admin/backup/gist", {}); } catch {}
    } catch (e: any) {
      toast({ title: "保存失敗", description: e?.message || "保存に失敗しました", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!selected || isBuiltin) return;
    try {
      await apiRequest("DELETE", `/api/files/${encodeURIComponent(selected)}`);
      toast({ title: "削除しました", description: `${selected} を削除しました` });
      setSelected("");
      setEditorContent("");
      await reload();
      try { await apiRequest("POST", "/api/admin/backup/gist", {}); } catch {}
    } catch (e: any) {
      toast({ title: "削除失敗", description: e?.message || "削除に失敗しました", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">ファイル管理</h1>
            <p className="text-sm text-muted-foreground">JSON の読み込み・保存・編集</p>
          </div>
          <a href="/" className="px-3 py-2 rounded-lg bg-secondary hover:bg-accent transition-colors text-sm">ホームへ</a>
        </header>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">ファイル一覧</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">アップロード</Label>
                <div className="mt-2 space-y-2">
                  {catalog.uploaded.map((f) => (
                    <button key={f.name} className={`w-full text-left px-4 py-3 rounded-md border ${selected === f.name ? 'bg-accent' : 'bg-background'} hover:bg-accent transition-colors`}
                      onClick={() => loadFile(f.name, false)}>
                      <div className="text-base text-foreground truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(f.wordCount ?? '-') + ' 語'} {f.owner?.ownerName ? `・作成者: ${f.owner.ownerName}` : ''} {f.updatedAt ? `・${new Date(f.updatedAt).toLocaleString()}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">エディタ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder="new-file.json" />
                <Button variant="outline" onClick={handleCreate}>新規作成</Button>
                <div className="flex-1" />
                <Button onClick={handleSave} disabled={!selected || !isOwner}>保存</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={!selected || !isOwner}>削除</Button>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={()=>{
                  // 初期テンプレート
                  if (!editorContent || editorContent.trim().length === 0) {
                    setEditorContent('[\n  {\n    "word": "",\n    "meaning": "",\n    "category": "",\n    "example": "",\n    "difficulty": 1\n  }\n]');
                  } else {
                    // 配列末尾に1行追加
                    try {
                      const arr = JSON.parse(editorContent);
                      if (Array.isArray(arr)) {
                        arr.push({ word: "", meaning: "", category: "", example: "", difficulty: 1 });
                        setEditorContent(JSON.stringify(arr, null, 2));
                      }
                    } catch {
                      // 無視
                    }
                  }
                }}>行を追加</Button>
              </div>
              <Textarea
                className="min-h-[360px]"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                onKeyDown={(e)=>{
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    // Ctrl/Cmd+Enter でテンプレート行を追加
                    try {
                      const arr = editorContent ? JSON.parse(editorContent) : [];
                      if (Array.isArray(arr)) {
                        arr.push({ word: "", meaning: "", category: "", example: "", difficulty: 1 });
                        setEditorContent(JSON.stringify(arr, null, 2));
                        e.preventDefault();
                      }
                    } catch {}
                  }
                }}
                placeholder={`[\n  { "word": "apple", "meaning": "りんご" }\n]`}
              />
              <p className="text-xs text-muted-foreground">ヒント: Ctrl/Cmd+Enter でテンプレート行を追加できます。</p>
              {selected && (
                <div className="w-full mt-3 px-4 py-3 rounded-md border border-border bg-muted text-foreground">
                  <div className="text-base font-medium truncate">{selected}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

