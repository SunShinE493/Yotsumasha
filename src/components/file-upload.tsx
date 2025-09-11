// FileUpload.tsx

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// JSONファイルごとのクイック設定の範囲のみを定義
const FILE_PRESETS = {
  "koumin.json": {
    presets: [
      { start: 1, end: 157, label: "公共Ⅱ1-157" },
      { start: 158, end: 262, label: "公共Ⅲ158-262" },
      { start: 263, end: 471, label: "公共Ⅳ263－471" },
    ],
  },
  "koumin2.json": {
    presets: [
      { start: 1, end: 202, label: "公共Ⅴ1-202" },
    ],
  },
  "rinri.json": {
  presets: [
  { start: 1, end: 73, label: "倫理Ⅰ1-73" },
  ],
  },
  "seikei.json":{
    presets: [
      { start: 1, end: 53, label: "政経Ⅱ1-53" },
    ]
  }
};

// インポートするJSONファイル (実際のパスに修正してください)
import koumin from "./data/koumin.json";
import koumin2 from "./data/koumin2.json";
import rinri from "./data/rinri.json";
import seikei from "./data/seikei.json";
// 選択可能な内蔵JSONファイル
const availableJsonFiles = {
  "koumin.json": koumin,
  "koumin2.json": koumin2,
  "rinri.json": rinri,
  "seikei.json": seikei,
};

// 親に渡すデータの型を定義
export interface SelectedJsonInfo {
  name: string;
  wordCount: number;
  presets: { start: number; end: number; label: string }[];
}

interface FileUploadProps {
  onUploadSuccess: (selectedFile: SelectedJsonInfo) => void;
}

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; wordCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // processJsonData関数は変更なし
  const processJsonData = (data: any[], fileName: string) => {
    if (!Array.isArray(data)) {
      throw new Error("JSONファイルは配列形式である必要があります");
    }

    const words = data.map(item => {
      if (!item.word || !item.meaning) {
        throw new Error("各単語にはwordとmeaningフィールドが必要です");
      }
      return {
        word: item.word,
        meaning: item.meaning,
        category: item.category || "未分類",
        example: item.example,
        difficulty: item.difficulty || 1,
      };
    });

    uploadMutation.mutate(words, {
      onSuccess: () => {
        const preset = FILE_PRESETS[fileName as keyof typeof FILE_PRESETS];
        const selectedFile: SelectedJsonInfo = {
          name: fileName,
          wordCount: words.length,
          presets: preset ? preset.presets : [],
        };

        onUploadSuccess(selectedFile);
        setUploadedFile({ name: fileName, wordCount: words.length });
        toast({
          title: "アップロード成功",
          description: `${words.length}個の単語が読み込まれました`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/vocabulary"] });
      },
    });
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.json')) {
      toast({
        title: "ファイル形式エラー",
        description: "JSONファイルのみ対応しています",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        processJsonData(data, file.name);
      } catch (error) {
        toast({
          title: "ファイル読み込みエラー",
          description: error instanceof Error ? error.message : "ファイルの形式が正しくありません",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleSelectChange = (value: string) => {
    if (!value) return;

    const selectedData = availableJsonFiles[value as keyof typeof availableJsonFiles];
    if (selectedData) {
      // 取得した値（ファイル名）を直接 processJsonData に渡す
      processJsonData(selectedData, value);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (words: any[]) => {
      const response = await apiRequest("POST", "/api/vocabulary/upload", { words });
      return response.json();
    },
    onSuccess: (data, variables) => {},
    onError: (error) => {
      toast({
        title: "アップロードエラー",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <i className="fas fa-upload text-primary"></i>
          <h2 className="text-lg font-semibold text-foreground">JSONファイルをアップロード</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* File Upload Area */}
          <div className="space-y-3">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="area-file-upload"
            >
              <i className="fas fa-cloud-upload-alt text-3xl text-muted-foreground mb-3"></i>
              <p className="text-foreground font-medium">ファイルを選択またはドラッグ&ドロップ</p>
              <p className="text-sm text-muted-foreground mt-1">JSON形式のファイルのみ対応</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleInputChange}
                data-testid="input-file"
              />
            </div>

            {/* 内蔵ファイル選択UI */}
            <div className="bg-muted rounded-lg p-3">
              <Label htmlFor="builtin-file-select" className="block text-sm font-medium text-foreground mb-2">
                内蔵JSONファイルを選択
              </Label>
              <Select onValueChange={handleSelectChange}> {/* ここを修正 */}
                <SelectTrigger>
                  <SelectValue placeholder="ファイルを選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(availableJsonFiles).map((fileName) => (
                    <SelectItem key={fileName} value={fileName}>
                      {fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sample JSON Structure */}
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm font-medium text-foreground mb-2">サンプル構造:</p>
              <pre className="text-xs text-muted-foreground overflow-x-auto">
{`[
  {
    "word": "apple",
    "meaning": "りんご",
    "category": "food"
  }
]`}
              </pre>
            </div>
          </div>

          {/* Loaded File Info */}
          <div className="space-y-3">
            {uploadedFile ? (
              <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <i className="fas fa-check-circle text-success"></i>
                  <span className="font-medium text-success-foreground" data-testid="text-filename">
                    {uploadedFile.name}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p data-testid="text-word-count">{uploadedFile.wordCount} 語彙が読み込まれました</p>
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <i className="fas fa-info-circle text-muted-foreground"></i>
                  <span className="font-medium text-muted-foreground">ファイルが未選択</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>JSONファイルをアップロードしてください</p>
                </div>
              </div>
            )}

            {uploadMutation.isPending && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <i className="fas fa-spinner fa-spin text-primary"></i>
                  <span className="font-medium text-primary">アップロード中...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}